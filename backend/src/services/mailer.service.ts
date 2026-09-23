import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/env';

let cachedTransporter: Transporter | null = null;

/**
 * Gets or creates a Nodemailer transporter using Ethereal SMTP.
 */
export const getEtherealTransporter = async (): Promise<Transporter> => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  let user = config.smtp.user;
  let pass = config.smtp.pass;
  let host = config.smtp.host;
  let port = config.smtp.port;

  // Fallback to auto-generated Ethereal test account if credentials are not configured
  if (!user || !pass) {
    const testAccount = await nodemailer.createTestAccount();
    user = testAccount.user;
    pass = testAccount.pass;
    host = testAccount.smtp.host;
    port = testAccount.smtp.port;
    console.log(`✉️ Created Ethereal Test Account: ${user}`);
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return cachedTransporter;
};

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
}

/**
 * Sends an email via Ethereal SMTP.
 */
export const sendEmailViaEthereal = async (params: SendEmailParams) => {
  const transporter = await getEtherealTransporter();

  const info = await transporter.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: `<div style="font-family: sans-serif; padding: 12px; line-height: 1.5;">${params.body}</div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`📫 Ethereal Email Sent! Preview URL: ${previewUrl}`);
  }

  return { messageId: info.messageId, previewUrl };
};
