/**
 * POST /api/auth/otp/resend
 *
 * Resends an OTP with a 60-second cooldown enforcement.
 * Invalidates previous challenge and creates a new 5-minute single-use challenge.
 */
import { NextRequest } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limit";
import { logAuditEvent } from "@/lib/server/audit";
import { generateOtpCode, hashToken } from "@/lib/server/totp";
import { sendOtpEmail } from "@/lib/server/auth-email";
import { sendOtpSms } from "@/lib/server/auth-sms";
import { validateCsrf } from "@/lib/server/session";
import { randomUUID } from "crypto";

const RESEND_COOLDOWN_SECONDS = 60;
const OTP_EXPIRES_MINUTES = 5;

export async function POST(req: NextRequest) {
  if (!validateCsrf(req)) {
    return errorResponse("CSRF validation failed", 403);
  }

  const rateCheck = checkRateLimit(req, "sensitive");
  if (!rateCheck.allowed) {
    return errorResponse("Rate limit exceeded. Please try again shortly.", 429, {
      retryAfter: rateCheck.retryAfter,
    });
  }

  let body: { challenge_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const challengeId = typeof body.challenge_id === "string" ? body.challenge_id.trim() : "";
  if (!challengeId) {
    return errorResponse("challenge_id is required", 400);
  }

  const supabase = createServerAdminClient();

  // 1. Fetch existing challenge
  const { data: oldChallenge, error: challengeError } = await supabase
    .from("otp_challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (challengeError || !oldChallenge) {
    console.error("[otp/resend] Challenge lookup error:", challengeError);
    return errorResponse("Challenge not found", 404);
  }

  // 2. Cooldown check: 60 seconds from created_at
  const createdAtMs = new Date(oldChallenge.created_at).getTime();
  const nowMs = Date.now();
  const elapsedSeconds = Math.floor((nowMs - createdAtMs) / 1000);

  if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
    const remaining = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
    return errorResponse(
      `Please wait ${remaining} second${remaining !== 1 ? "s" : ""} before requesting a new code.`,
      429,
      { retryAfter: remaining }
    );
  }

  // 3. Invalidate old challenge
  await supabase
    .from("otp_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("id", challengeId);

  // 4. Fetch user email / phone
  const { data: userData } = await supabase.auth.admin.getUserById(oldChallenge.user_id);
  const user = userData?.user;
  if (!user) {
    return errorResponse("User account not found", 404);
  }

  // 5. Generate new OTP challenge
  const otpCode = generateOtpCode(6);
  const codeHash = hashToken(otpCode);
  const newChallengeId = randomUUID();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000).toISOString();

  await supabase.from("otp_challenges").insert({
    id: newChallengeId,
    user_id: user.id,
    channel: oldChallenge.channel,
    code_hash: codeHash,
    expires_at: expiresAt,
    ip_address: getClientIdentifier(req),
    attempt_count: 0,
  });

  console.log(`\n========================================`);
  console.log(`🔐 [GAWA RESENT OTP CODE for ${user.email}]: ${otpCode}`);
  console.log(`⏱️  Expires in: ${OTP_EXPIRES_MINUTES} minutes (Challenge: ${newChallengeId})`);
  console.log(`========================================\n`);

  // 6. Send code
  if (oldChallenge.channel === "sms" && user.phone) {
    sendOtpSms(user.phone, otpCode, OTP_EXPIRES_MINUTES).catch((err) =>
      console.error("[otp/resend] SMS failed:", err)
    );
  } else if (user.email) {
    sendOtpEmail(user.email, otpCode, OTP_EXPIRES_MINUTES).catch((err) =>
      console.error("[otp/resend] Email failed:", err)
    );
  }

  await logAuditEvent({
    actorId: user.id,
    action: "otp.resent",
    entityTable: "public.otp_challenges",
    entityId: newChallengeId,
    details: { channel: oldChallenge.channel },
  });

  return jsonResponse({
    success: true,
    challenge_id: newChallengeId,
    channel: oldChallenge.channel,
    cooldown_seconds: RESEND_COOLDOWN_SECONDS,
  });
}

