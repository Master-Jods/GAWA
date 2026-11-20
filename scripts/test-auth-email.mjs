// Node 24: node --env-file=.env --env-file-if-exists=.env.local scripts/test-auth-email.mjs --send-to-self
// Sends one explicitly labeled test message, only to the configured SMTP account.
import { sendAuthEmail } from '../src/lib/server/auth-email.ts';
if (!process.argv.includes('--send-to-self')) {
  console.error('Pass --send-to-self to authorize one test message to SMTP_USER.');
  process.exit(1);
}
const recipient = process.env.SMTP_USER?.trim();
if (!recipient) throw new Error('SMTP_USER is not configured');
const result = await sendAuthEmail(recipient, '[GAWA TEST] Email delivery check',
  'This is a GAWA email delivery test. It is NOT a login OTP or password reset.\n\nIf this message is in your inbox, the app SMTP sender reached this mailbox.\n\nNo action is required.');
if (!result.ok) {
  console.error('Test email failed:', result.error);
  process.exitCode = 1;
} else {
  console.log('Gmail SMTP accepted the test email to the configured sender account. Check Inbox/Spam; inbox delivery is not automatically confirmed.');
}
