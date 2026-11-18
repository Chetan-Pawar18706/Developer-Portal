import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { escapeHtml } from './email.service';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (env.NODE_ENV === 'test') {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  const safeResetUrl = escapeHtml(resetUrl);

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Reset your password',
    text: `Reset your password using this link (valid for 1 hour): ${resetUrl}`,
    html: `<p>Reset your password by clicking <a href="${safeResetUrl}">this link</a>.</p><p>The link is valid for 1 hour.</p>`,
  });
}
