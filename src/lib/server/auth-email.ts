/** Server-only transactional mail. SMTP credentials must never use NEXT_PUBLIC_. */
import nodemailer from "nodemailer";

export type MailResult = { ok: boolean; error?: string };

export async function sendAuthEmail(
  to: string,
  subject: string,
  text: string
): Promise<MailResult> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const from = process.env.SMTP_FROM?.trim();
  let pass = process.env.SMTP_PASS;
  if (!host || !user || !pass || !from) {
    return { ok: false, error: "SMTP not configured" };
  }
  // Google displays app passwords in groups separated by spaces.
  if (host.toLowerCase() === "smtp.gmail.com") pass = pass.replace(/\s/g, "");
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: "Invalid SMTP port" };
  }
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  try {
    const result = await transport.sendMail({ from, to, subject, text });
    if (!result.accepted?.length || result.rejected?.length) {
      return { ok: false, error: "SMTP recipient rejected" };
    }
    // Accepted by SMTP is not a guarantee of inbox delivery.
    return { ok: true };
  } catch {
    // Do not return/log raw SMTP responses, credentials, message text or OTPs.
    return { ok: false, error: "SMTP delivery failed" };
  } finally {
    transport.close();
  }
}

export function sendOtpEmail(to: string, otp: string, expiresMinutes: number): Promise<MailResult> {
  return sendAuthEmail(to, "Your GAWA verification code",
    `Your one-time verification code is: ${otp}\n\nThis code expires in ${expiresMinutes} minute${expiresMinutes !== 1 ? "s" : ""}.\n\nIf you did not request this code, please ignore this email and secure your account.`);
}

export function sendPasswordResetEmail(to: string, resetUrl: string): Promise<MailResult> {
  return sendAuthEmail(to, "Reset your GAWA password",
    `You requested a password reset for your GAWA account.\n\nClick the link below to set a new password (expires in 15 minutes):\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email. Your password will not change.`);
}

export function sendPasswordChangedEmail(to: string): Promise<MailResult> {
  return sendAuthEmail(to, "Your GAWA password has been changed",
    "This is a confirmation that your GAWA account password was just changed.\n\nIf you made this change, no further action is needed.\n\nIf you did NOT make this change, please contact our support team immediately and secure your account.");
}
