import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Shared Types ──────────────────────────────────────────────────────────────

export interface EmailRecord {
  id: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledTime: string;
  delayMs: number | null;
  hourlyLimit: number | null;
  status: string;
  sentTime: string | null;
  createdAt: string;
}

export interface ScheduleEmailResult {
  emailId: string;
  recipientEmail: string;
  jobId: string | undefined;
}

export interface ScheduleEmailsPayload {
  senderEmail: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string;
  delayMs?: number;
  hourlyLimit?: number;
}

export interface ListEmailsResponse {
  emails: EmailRecord[];
  total: number;
}

export interface SearchResult {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  status: string;
  score?: number;
}

// ── Internal fetch wrapper with toast-based error handling ────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  errorMessage = 'An unexpected error occurred',
): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    const data = await res.json();

    if (!res.ok) {
      const message = data?.error || errorMessage;
      toast.error(message);
      return null;
    }

    return data as T;
  } catch (err: any) {
    const message = err?.message?.includes('fetch')
      ? 'Cannot connect to the API server. Is the backend running?'
      : err?.message || errorMessage;
    toast.error(message);
    return null;
  }
}

// ── API Functions ─────────────────────────────────────────────────────────────

/** Schedule emails for multiple recipients */
export async function scheduleEmails(payload: ScheduleEmailsPayload) {
  const result = await apiFetch<{
    status: string;
    scheduled: ScheduleEmailResult[];
    total: number;
  }>('/emails/schedule', { method: 'POST', body: JSON.stringify(payload) }, 'Failed to schedule emails');

  if (result?.status === 'success') {
    toast.success(`Scheduled ${result.total} email${result.total !== 1 ? 's' : ''} successfully!`);
  }
  return result;
}

/** Fetch all pending scheduled emails */
export async function getScheduledEmails(params?: { page?: number; limit?: number; sender?: string }) {
  const qs = new URLSearchParams();
  if (params?.page)   qs.set('page', String(params.page));
  if (params?.limit)  qs.set('limit', String(params.limit));
  if (params?.sender) qs.set('sender', params.sender);
  const query = qs.toString() ? `?${qs}` : '';

  return apiFetch<ListEmailsResponse>(`/emails/scheduled${query}`, undefined, 'Failed to load scheduled emails');
}

/** Fetch all sent emails */
export async function getSentEmails(params?: { page?: number; limit?: number; sender?: string }) {
  const qs = new URLSearchParams();
  if (params?.page)   qs.set('page', String(params.page));
  if (params?.limit)  qs.set('limit', String(params.limit));
  if (params?.sender) qs.set('sender', params.sender);
  const query = qs.toString() ? `?${qs}` : '';

  return apiFetch<ListEmailsResponse>(`/emails/sent${query}`, undefined, 'Failed to load sent emails');
}

/** Fetch all failed emails */
export async function getFailedEmails(params?: { page?: number; limit?: number; sender?: string }) {
  const qs = new URLSearchParams();
  if (params?.page)   qs.set('page', String(params.page));
  if (params?.limit)  qs.set('limit', String(params.limit));
  if (params?.sender) qs.set('sender', params.sender);
  const query = qs.toString() ? `?${qs}` : '';

  return apiFetch<ListEmailsResponse>(`/emails/failed${query}`, undefined, 'Failed to load failed emails');
}

/** Retry a permanently failed email */
export async function retryEmail(id: string) {
  const result = await apiFetch<{ status: string; message: string; jobId?: string }>(
    `/emails/${id}/retry`, 
    { method: 'POST' }, 
    'Failed to retry email'
  );
  if (result?.status === 'success') {
    toast.success('Email successfully queued for retry!');
  }
  return result;
}

/** Full-text Elasticsearch search */
export async function searchEmails(query: string) {
  return apiFetch<{ query: string; total: number; results: SearchResult[] }>(
    `/emails/search?q=${encodeURIComponent(query)}`,
    undefined,
    'Search request failed',
  );
}
