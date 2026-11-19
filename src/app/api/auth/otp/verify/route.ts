/**
 * POST /api/auth/otp/verify
 *
 * Verifies a single-use OTP challenge.
 * Enforces:
 * - 5-minute expiry
 * - Single-use (used_at is marked)
 * - Maximum 5 failed attempts per challenge
 * - Rate limiting
 * - Replay prevention
 * - If TOTP 2FA is also enabled, requires subsequent TOTP step
 * - Sets secure HttpOnly cookies upon success
 */
import { NextRequest } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limit";
import { logAuditEvent } from "@/lib/server/audit";
import { hashToken } from "@/lib/server/totp";
import { setAuthCookies, recordUserSession, validateCsrf } from "@/lib/server/session";

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

  let body: { challenge_id?: unknown; code?: unknown; user_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const challengeId = typeof body.challenge_id === "string" ? body.challenge_id.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";

  if (!challengeId || !code) {
    return errorResponse("Challenge ID and verification code are required", 400);
  }

  const supabase = createServerAdminClient();

  // 1. Fetch challenge
  const { data: challenge, error: challengeError } = await supabase
    .from("otp_challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (challengeError || !challenge) {
    console.error("[otp/verify] Challenge fetch error:", challengeError);
    return errorResponse("Invalid or expired verification challenge", 400);
  }

  // Check user mismatch if provided
  if (userId && challenge.user_id !== userId) {
    return errorResponse("Invalid challenge verification", 401);
  }

  // 2. Check if already used (prevent replay)
  if (challenge.used_at) {
    return errorResponse("This verification code has already been used.", 410);
  }

  // 3. Check expiration (5 minutes)
  const now = new Date();
  if (new Date(challenge.expires_at) <= now) {
    return errorResponse("This verification code has expired. Please request a new code.", 410);
  }

  // 4. Check attempt limits (max 5 attempts)
  if (challenge.attempt_count >= 5) {
    return errorResponse(
      "Too many failed verification attempts. This code has been invalidated.",
      429
    );
  }

  // 5. Verify hashed code
  const submittedHash = hashToken(code);
  if (submittedHash !== challenge.code_hash) {
    // Increment failed attempt count
    await supabase
      .from("otp_challenges")
      .update({ attempt_count: challenge.attempt_count + 1 })
      .eq("id", challengeId);

    const remaining = 5 - (challenge.attempt_count + 1);
    return errorResponse(
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
        : "Too many failed verification attempts. This code has been invalidated.",
      401
    );
  }

  // 6. Valid code! Mark challenge as used immediately
  await supabase
    .from("otp_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("id", challengeId);

  // 7. Check if Google Authenticator 2FA is ALSO enabled
  const { data: mfaSettings } = await supabase
    .from("auth_mfa_settings")
    .select("totp_enabled")
    .eq("user_id", challenge.user_id)
    .maybeSingle();

  if (mfaSettings?.totp_enabled) {
    return jsonResponse({
      mfa_required: true,
      method: "totp",
      user_id: challenge.user_id,
      otp_verified: true,
    });
  }

  // 8. Retrieve user and assigned role
  const { data: userProfile } = await supabase
    .from("account_profiles")
    .select("id, display_name")
    .eq("id", challenge.user_id)
    .single();

  const { data: roleData } = await supabase
    .from("account_roles")
    .select("role")
    .eq("user_id", challenge.user_id);

  const roles = (roleData || []).map((r) => r.role);
  const primaryRole = roles.includes("admin") ? "admin" : roles.includes("business") ? "business" : "talent";

  // Fetch user email from Supabase Auth admin
  const { data: userData } = await supabase.auth.admin.getUserById(challenge.user_id);
  const email = userData?.user?.email || "";

  // 9. Generate active authenticated session
  const linkRes = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  let session: any = null;
  if (linkRes.data?.properties?.hashed_token) {
    const { data: verifyData } = await supabase.auth.verifyOtp({
      token_hash: linkRes.data.properties.hashed_token,
      type: "magiclink",
    });
    session = verifyData?.session;
  }

  const response = jsonResponse({
    authenticated: true,
    user: {
      id: challenge.user_id,
      email,
      role: primaryRole,
      displayName: userProfile?.display_name,
    },
    role: primaryRole,
    access_token: session?.access_token,
    refresh_token: session?.refresh_token,
  });

  if (session) {
    setAuthCookies(response, session.access_token, session.refresh_token, session.expires_in);
    await recordUserSession({
      userId: challenge.user_id,
      refreshToken: session.refresh_token,
      mfaVerified: false,
      otpVerified: true,
      ipAddress: getClientIdentifier(req),
      userAgent: req.headers.get("user-agent") || undefined,
      expiresInSeconds: session.expires_in,
    });
  }

  await logAuditEvent({
    actorId: challenge.user_id,
    action: "login.otp_verified",
    entityTable: "public.otp_challenges",
    entityId: challengeId,
    details: { channel: challenge.channel },
  });

  return response;
}

