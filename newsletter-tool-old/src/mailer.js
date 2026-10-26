// Sends the rendered newsletter over SMTP (Gmail by default) with nodemailer.
// The message carries both the HTML and a plain-text alternative so the inbox
// renders the full design and still has a readable fallback.

import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

const GMAIL_LOGIN_MESSAGE =
  'Gmail rejected the SMTP login. Use a Google App Password, not the account password.';

function shortResponse(err) {
  const text = err && typeof err.response === 'string' ? err.response.trim() : '';
  if (!text) return '';
  return ` (${text.length > 120 ? `${text.slice(0, 117)}...` : text})`;
}

// Turn a nodemailer failure into one plain sentence for the page.
function smtpFailure(err, smtp, phase) {
  const code = err && typeof err.code === 'string' ? err.code : '';
  const responseCode = err ? Number(err.responseCode) : NaN;
  if (code === 'EAUTH' || responseCode === 534 || responseCode === 535) {
    return new Error(GMAIL_LOGIN_MESSAGE);
  }
  if (phase === 'send') {
    return new Error(`The mail server did not accept the message${shortResponse(err)}.`);
  }
  return new Error(
    `Could not connect to the mail server at ${smtp.host}:${smtp.port}. Check SMTP_HOST, SMTP_PORT and the network.`,
  );
}

export async function sendNewsletter({ to, subject, html, text }, config) {
  const smtp = config && config.smtp;
  if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
    throw new Error('SMTP settings are missing. Set SMTP_USER and SMTP_PASS in .env.');
  }
  if (!to) throw new Error('No recipient. Set TO_EMAIL or SMTP_USER in .env.');
  if (!html) throw new Error('There is no newsletter HTML to send.');

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  try {
    // Check the connection and login first so a bad App Password fails with a
    // clear message instead of a generic send error.
    try {
      await transport.verify();
    } catch (err) {
      throw smtpFailure(err, smtp, 'verify');
    }

    let info;
    try {
      info = await transport.sendMail({
        from: `Biola Newsletter <${smtp.user}>`,
        to,
        subject,
        html,
        text,
        headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
      });
    } catch (err) {
      throw smtpFailure(err, smtp, 'send');
    }

    return { messageId: info.messageId };
  } finally {
    transport.close();
  }
}
