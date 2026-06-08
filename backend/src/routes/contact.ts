import express, { Request, Response } from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

const OWNER_EMAIL = 'h4rshal.workspace@gmail.com';

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

function smtpHostValue() {
  return envValue('EMAIL_HOST', 'SMTP_HOST') || 'smtp.gmail.com';
}

function smtpUserValue() {
  return envValue('EMAIL_USER', 'SMTP_USER', 'CONTACT_ADMIN_EMAIL', 'SUPPORT_EMAIL', 'ALERT_FROM_EMAIL') || OWNER_EMAIL;
}

const HAS_EMAIL_PROVIDER = Boolean(
  envValue('RESEND_API_KEY')
  || (smtpHostValue() && smtpUserValue() && envValue('EMAIL_PASS', 'SMTP_PASS', 'SMTP_PASSWORD'))
);
const EMAIL_MOCK_MODE = process.env.EMAIL_MOCK_MODE === 'true'
  || (process.env.EMAIL_MOCK_MODE !== 'false' && !HAS_EMAIL_PROVIDER);

function contactAdminEmail() {
  return (
    process.env.CONTACT_ADMIN_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    OWNER_EMAIL
  ).trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function htmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function subjectLabel(subject: string) {
  const labels: Record<string, string> = {
    sales: 'Sales',
    support: 'Technical support',
    billing: 'Billing',
    security: 'Security',
    feedback: 'Product feedback',
    other: 'Other',
  };
  return labels[subject] || 'Other';
}

async function sendEmailWithSmtp(
  to: string,
  subject: string,
  html: string,
  text: string,
  replyTo?: string,
) {
  if (!isValidEmail(to)) {
    throw new Error('Invalid recipient email address.');
  }

  if (EMAIL_MOCK_MODE) {
    console.info('[Contact] Email mock mode enabled — not sending real email', { to, subject });
    return;
  }

  const host = smtpHostValue();
  const user = smtpUserValue();
  const pass = envValue('EMAIL_PASS', 'SMTP_PASS', 'SMTP_PASSWORD');
  if (!host || !user || !pass) {
    throw new Error('SMTP not configured. Set EMAIL_HOST (or SMTP_HOST), EMAIL_USER (or SMTP_USER), and EMAIL_PASS (or SMTP_PASS).');
  }

  const port = Number(envValue('EMAIL_PORT', 'SMTP_PORT') || 587);
  const fromAddress = envValue('EMAIL_FROM', 'ALERT_FROM_EMAIL', 'SMTP_FROM') || `DriftBoard <${user}>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: fromAddress,
    to,
    replyTo: replyTo || process.env.ALERT_REPLY_TO || OWNER_EMAIL,
    subject,
    html,
    text,
  });

  console.info('[Contact] Email sent successfully', { to, subject, provider: 'smtp' });
}

function buildAdminHtml(name: string, email: string, subject: string, message: string, submittedAt: string) {
  const label = subjectLabel(subject);
  return `
<!doctype html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#080b12;color:#e5edf8;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080b12;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #253044;border-radius:18px;overflow:hidden;background:#101522;">
          <tr><td style="padding:28px 28px 18px;background:#121a2a;border-bottom:1px solid #253044;">
            <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7dd3fc;font-weight:800;">DriftBoard</div>
            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;color:#ffffff;">New contact request</h1>
            <p style="margin:10px 0 0;color:#94a3b8;font-size:14px;">${htmlEscape(name)} sent a ${label.toLowerCase()} message.</p>
          </td></tr>
          <tr><td style="padding:28px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#0b1020;border:1px solid #253044;border-radius:12px;overflow:hidden;">
              <tr><td style="padding:12px 14px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1f2937;width:38%;">Name</td><td style="padding:12px 14px;color:#f8fafc;font-size:14px;border-bottom:1px solid #1f2937;font-weight:700;">${htmlEscape(name)}</td></tr>
              <tr><td style="padding:12px 14px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1f2937;width:38%;">Email</td><td style="padding:12px 14px;color:#f8fafc;font-size:14px;border-bottom:1px solid #1f2937;font-weight:700;">${htmlEscape(email)}</td></tr>
              <tr><td style="padding:12px 14px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1f2937;width:38%;">Subject</td><td style="padding:12px 14px;color:#f8fafc;font-size:14px;border-bottom:1px solid #1f2937;font-weight:700;">${label}</td></tr>
              <tr><td style="padding:12px 14px;color:#94a3b8;font-size:13px;width:38%;">Submitted</td><td style="padding:12px 14px;color:#f8fafc;font-size:14px;font-weight:700;">${htmlEscape(submittedAt)}</td></tr>
            </table>
            <div style="margin-top:18px;padding:16px;border-radius:12px;background:#111827;border:1px solid #253044;">
              <div style="color:#94a3b8;font-size:13px;font-weight:700;margin-bottom:8px;">Message</div>
              <div style="white-space:pre-wrap;color:#e2e8f0;font-size:14px;line-height:1.7;">${htmlEscape(message)}</div>
            </div>
            <div style="margin-top:28px;">
              <a href="https://driftboard.app/contact" style="display:inline-block;background:#38bdf8;color:#06111f;text-decoration:none;font-weight:800;border-radius:10px;padding:13px 18px;">Open DriftBoard</a>
            </div>
          </td></tr>
          <tr><td style="padding:18px 28px;border-top:1px solid #253044;color:#64748b;font-size:12px;background:#0d1320;">
            Sent by DriftBoard contact form.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function buildConfirmationHtml(name: string, email: string, subject: string, message: string, submittedAt: string) {
  const label = subjectLabel(subject);
  return `
<!doctype html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#080b12;color:#e5edf8;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080b12;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #253044;border-radius:18px;overflow:hidden;background:#101522;">
          <tr><td style="padding:28px 28px 18px;background:#121a2a;border-bottom:1px solid #253044;">
            <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7dd3fc;font-weight:800;">DriftBoard</div>
            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;color:#ffffff;">We received your message</h1>
            <p style="margin:10px 0 0;color:#94a3b8;font-size:14px;">Thanks for contacting DriftBoard. Our team will review it and reply soon.</p>
          </td></tr>
          <tr><td style="padding:28px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#0b1020;border:1px solid #253044;border-radius:12px;overflow:hidden;">
              <tr><td style="padding:12px 14px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1f2937;width:38%;">Name</td><td style="padding:12px 14px;color:#f8fafc;font-size:14px;border-bottom:1px solid #1f2937;font-weight:700;">${name}</td></tr>
              <tr><td style="padding:12px 14px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1f2937;width:38%;">Email</td><td style="padding:12px 14px;color:#f8fafc;font-size:14px;border-bottom:1px solid #1f2937;font-w
