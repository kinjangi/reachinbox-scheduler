import { Client } from '@elastic/elasticsearch';
import { config } from '../config/env';

let esClientInstance: Client | null = null;

/**
 * Gets or initializes the Elasticsearch client singleton.
 */
export const getElasticsearchClient = (): Client => {
  if (!esClientInstance) {
    esClientInstance = new Client({
      node: config.elasticsearch.node,
    });
  }
  return esClientInstance;
};

/**
 * Ensures the target email index exists with proper schema mappings.
 */
export const ensureEmailIndexExists = async (): Promise<void> => {
  const client = getElasticsearchClient();
  const index = config.elasticsearch.index;

  try {
    const exists = await client.indices.exists({ index });
    if (!exists) {
      await client.indices.create({
        index,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            sender: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            status: { type: 'keyword' },
            body: { type: 'text' },
            scheduledTime: { type: 'date' },
            sentTime: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      });
      console.log(`[Elasticsearch] Created index '${index}' with mappings.`);
    }
  } catch (error: any) {
    console.warn(`[Elasticsearch] Notice: could not verify/create index '${index}':`, error?.message || error);
  }
};

export interface EmailIndexPayload {
  id: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  status: string;
  body?: string | null;
  scheduledTime?: Date | null;
  sentTime?: Date | null;
}

/**
 * Indexes or updates an email record in Elasticsearch.
 */
export const indexEmailDocument = async (email: EmailIndexPayload): Promise<void> => {
  const client = getElasticsearchClient();
  const index = config.elasticsearch.index;

  try {
    await client.index({
      index,
      id: email.id,
      document: {
        id: email.id,
        sender: email.senderEmail,
        recipient: email.recipientEmail,
        subject: email.subject,
        status: email.status.toLowerCase(),
        body: email.body || undefined,
        scheduledTime: email.scheduledTime,
        sentTime: email.sentTime,
        updatedAt: new Date(),
      },
      refresh: true, // Make immediately available for search
    });
    console.log(`[Elasticsearch] Indexed email document ${email.id} (status: ${email.status}).`);
  } catch (error: any) {
    console.error(`[Elasticsearch] Failed to index email document ${email.id}:`, error?.message || error);
  }
};

export interface EmailSearchResult {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  status: string;
  score?: number;
  highlight?: Record<string, string[]>;
}

/**
 * Searches email documents matching query across 'subject' and 'recipient' fields.
 */
export const searchEmails = async (query: string): Promise<EmailSearchResult[]> => {
  const client = getElasticsearchClient();
  const index = config.elasticsearch.index;

  try {
    const result = await client.search<{
      id: string;
      sender: string;
      recipient: string;
      subject: string;
      status: string;
    }>({
      index,
      query: {
        multi_match: {
          query,
          fields: ['subject^2', 'recipient', 'recipient.keyword'],
          fuzziness: 'AUTO',
        },
      },
      highlight: {
        fields: {
          subject: {},
          recipient: {},
        },
      },
    });

    return result.hits.hits.map((hit) => ({
      id: hit._source?.id || (hit._id as string),
      sender: hit._source?.sender || '',
      recipient: hit._source?.recipient || '',
      subject: hit._source?.subject || '',
      status: hit._source?.status || '',
      score: hit._score ?? undefined,
      highlight: hit.highlight,
    }));
  } catch (error: any) {
    console.error(`[Elasticsearch] Search query failed for "${query}":`, error?.message || error);
    return [];
  }
};
