import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface NotificationEmailInput {
  to: string;
  subject: string;
  title: string;
  message: string;
  link: string;
}

let transporterPromise: Promise<Transporter> | null = null;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function createTransporter(): Promise<Transporter> {
  if (env.MAIL_PROVIDER === 'ethereal') {
    const account = await nodemailer.createTestAccount();

    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

function getTransporter(): Promise<Transporter> {
  if (!transporterPromise) {
    transporterPromise = createTransporter().catch((error: unknown) => {
      transporterPromise = null;
      throw error;
    });
  }

  return transporterPromise;
}

export function renderNotificationEmail(input: {
  title: string;
  message: string;
  link: string;
}): string {
  const title = escapeHtml(input.title);
  const message = escapeHtml(input.message);
  const link = escapeHtml(input.link);

  return `
    <div style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,sans-serif;color:#1f2937;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;background:#1d4ed8;color:#ffffff;font-size:20px;font-weight:700;">
            Developer Portal
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px 8px;font-size:20px;font-weight:700;">${title}</td>
        </tr>
        <tr>
          <td style="padding:8px 24px 24px;font-size:15px;line-height:1.6;">${message}</td>
        </tr>
        <tr>
          <td style="padding:0 24px 28px;">
            <a href="${link}" style="display:inline-block;padding:11px 18px;background:#1d4ed8;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;">
              View in DevPortal
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
            You are receiving this because of your notification preferences. Update them in your profile.
          </td>
        </tr>
      </table>
    </div>
  `.trim();
}

export async function sendNotificationEmail(input: NotificationEmailInput): Promise<void> {
  if (env.NODE_ENV === 'test') {
    return;
  }

  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: `${input.title}\n\n${input.message}\n\n${input.link}`,
    html: renderNotificationEmail({
      title: input.title,
      message: input.message,
      link: input.link,
    }),
  });

  if (env.MAIL_PROVIDER === 'ethereal') {
    const previewUrl = nodemailer.getTestMessageUrl(info);

    if (previewUrl) {
      console.log(`Ethereal email preview: ${previewUrl}`);
    }
  }
}
