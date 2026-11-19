/**
 * Email sending utilities for auth system.
 *
 * Uses raw SMTP via Node.js net/tls sockets (no nodemailer dependency).
 * Required env vars:
 *   SMTP_HOST  - SMTP server hostname
 *   SMTP_PORT  - SMTP server port (default: 587)
 *   SMTP_USER  - SMTP username
 *   SMTP_PASS  - SMTP password
 *   SMTP_FROM  - Sender address (e.g. "GAWA <noreply@gawa.app>")
 *
 * If env vars are not set, functions return { ok: false, error: "SMTP not configured" }.
 */
import * as net from "net";
import * as tls from "tls";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !pass || !from) return null;
  return {
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user,
    pass,
    from,
  };
}

/** Minimal SMTP client using raw socket + STARTTLS */
async function sendSmtp(
  config: SmtpConfig,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    let upgraded = false;
    let socket: net.Socket | tls.TLSSocket;

    const write = (cmd: string) => socket.write(cmd + "\r\n");

    const handleLine = (line: string) => {
      lines.push(line);
      const code = parseInt(line.substring(0, 3), 10);

      if (!upgraded && code === 220 && lines.length === 1) {
        write(`EHLO ${config.host}`);
      } else if (!upgraded && code === 250 && line.includes("STARTTLS")) {
        write("STARTTLS");
      } else if (!upgraded && code === 220 && line.includes("TLS")) {
        // Upgrade to TLS
        const tlsSocket = tls.connect({ socket: socket as net.Socket, servername: config.host }, () => {
          upgraded = true;
          socket = tlsSocket;
          write(`EHLO ${config.host}`);
        });
        tlsSocket.on("data", (d: Buffer) => d.toString().split("\r\n").filter(Boolean).forEach(handleLine));
        tlsSocket.on("error", reject);
      } else if (code === 250 && upgraded && !lines.some((l) => l.startsWith("AUTH"))) {
        // After EHLO on TLS, send AUTH LOGIN
        write("AUTH LOGIN");
      } else if (code === 334 && line.includes("VXNlcm5hbWU")) {
        write(Buffer.from(config.user).toString("base64"));
      } else if (code === 334 && line.includes("UGFzc3dvcmQ")) {
        write(Buffer.from(config.pass).toString("base64"));
      } else if (code === 235) {
        write(`MAIL FROM:<${config.from.replace(/.*<(.+)>/, "$1")}>`);
      } else if (code === 250 && lines.some((l) => l.includes("MAIL FROM"))) {
        write(`RCPT TO:<${to}>`);
      } else if (code === 250 && lines.some((l) => l.includes("RCPT TO"))) {
        write("DATA");
      } else if (code === 354) {
        const msg = [
          `From: ${config.from}`,
          `To: ${to}`,
          `Subject: ${subject}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/plain; charset=UTF-8`,
          ``,
          body,
          `.`,
        ].join("\r\n");
        socket.write(msg + "\r\n");
      } else if (code === 250 && lines.some((l) => l.startsWith("250 2.0.0"))) {
        write("QUIT");
        socket.destroy();
        resolve();
      } else if (code >= 400) {
        socket.destroy();
        reject(new Error(`SMTP error ${code}: ${line}`));
      }
    };

    const rawSocket = net.connect(config.port, config.host, () => {
      socket = rawSocket;
    });

    rawSocket.on("data", (d: Buffer) =>
      d
        .toString()
        .split("\r\n")
        .filter(Boolean)
        .forEach(handleLine)
    );
    rawSocket.on("error", reject);
    rawSocket.setTimeout(15000, () => {
      rawSocket.destroy();
      reject(new Error("SMTP connection timed out"));
    });
  });
}

// ---------------------------------------------------------------------------
// Public email functions
// ---------------------------------------------------------------------------

export async function sendOtpEmail(
  to: string,
  otp: string,
  expiresMinutes: number
): Promise<{ ok: boolean; error?: string }> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, error: "SMTP not configured" };

  try {
    await sendSmtp(
      config,
      to,
      "Your GAWA verification code",
      `Your one-time verification code is: ${otp}\n\nThis code expires in ${expiresMinutes} minute${expiresMinutes !== 1 ? "s" : ""}.\n\nIf you did not request this code, please ignore this email and secure your account.`
    );
    return { ok: true };
  } catch (err: any) {
    console.error("[sendOtpEmail] SMTP error:", err?.message);
    return { ok: false, error: err?.message || "Failed to send email" };
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, error: "SMTP not configured" };

  try {
    await sendSmtp(
      config,
      to,
      "Reset your GAWA password",
      `You requested a password reset for your GAWA account.\n\nClick the link below to set a new password (expires in 15 minutes):\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email. Your password will not change.`
    );
    return { ok: true };
  } catch (err: any) {
    console.error("[sendPasswordResetEmail] SMTP error:", err?.message);
    return { ok: false, error: err?.message || "Failed to send email" };
  }
}

export async function sendPasswordChangedEmail(
  to: string
): Promise<{ ok: boolean; error?: string }> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, error: "SMTP not configured" };

  try {
    await sendSmtp(
      config,
      to,
      "Your GAWA password has been changed",
      `This is a confirmation that your GAWA account password was just changed.\n\nIf you made this change, no further action is needed.\n\nIf you did NOT make this change, please contact our support team immediately and secure your account.`
    );
    return { ok: true };
  } catch (err: any) {
    console.error("[sendPasswordChangedEmail] SMTP error:", err?.message);
    return { ok: false, error: err?.message || "Failed to send email" };
  }
}
