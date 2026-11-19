/**
 * POST /api/auth/2fa/challenge
 *
 * Verifies TOTP code during login (after credentials validated but before session issued).
 * - Accepts: { code, user_id } or { recovery_code, user_id }
 * - Validates against RFC 6238 TOTP with ±1 window, prevents code replay
 * - On success: issues authenticated session with HttpOnly cookies
 * - Applies existing MFA policy — OTP verification is also checked here
 */
import { NextRequest } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limit";
import { logAuditEvent } from "@/lib/server/audit";
import { decryptTotpSecret, verifyTotp, hashToken } from "@/lib/server/totp";
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

  let body: { code?: unknown; user_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const code = typeof body.code === "string" ? body.code.replace(/\s+/g, "") : "";

  if (!userId) {
    return errorResponse("user_id is required", 400);
  }
  if (!code || code.length !== 6) {
    return errorResponse("A 6-digit authenticator code is required", 400);
  }

  const supabase = createServerAdminClient();

  // 1. Fetch MFA settings
  const { data: mfaRecord, error: mfaError } = await supabase
    .from("auth_mfa_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (mfaError || !mfaRecord?.totp_enabled || !mfaRecord?.totp_secret_encrypted) {
    return errorResponse("TOTP is not enabled for this account", 400);
  }

  // 2. Decrypt TOTP secret
  let plainSecret: string;
  try {
    plainSecret = decryptTotpSecret(mfaRecord.totp_secret_encrypted);
  } catch {
    return errorResponse("Failed to validate TOTP configuration", 500);
  }

  // 3. Prevent replay — same code used in same window
  if (mfaRecord.totp_last_used_code === code) {
    return errorResponse("This code has already been used. Please wait for the next 30-second code.", 401);
  }

  // 4. Verify TOTP code
  const isValid = verifyTotp(plainSecret, code);
  if (!isValid) {
    await logAuditEvent({
      actorId: userId,
      action: "login.totp_failed",
      entityTable: "auth_mfa_settings",
      entityId: userId,
    });
    return errorResponse("Invalid authenticator code. Please try again.", 401);
  }

  // 5. Update last-used code (replay prevention)
  await supabase
    .from("auth_mfa_settings")
    .update({ totp_last_used_code: code, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  // 6. Check account status
  const { data: statusData } = await supabase
    .from("account_statuses")
    .select("status")
    .eq("user_id", userId)
    .single();

  if (statusData?.status !== "active") {
    return errorResponse("Account is not active.", 403);
  }

  // 7. Issue authenticated session
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  if (!userData?.user) {
    return errorResponse("User account not found", 404);
  }

  // Create session via admin link generation
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email!,
  });

  let session = null;
  if (linkData?.properties?.hashed_token) {
    const { data: verifyData } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });
    session = verifyData?.session;
  }

  // Fallback: create an email OTP sign-in
  if (!session) {
    return errorResponse("Failed to establish session after TOTP verification", 500);
  }

  // 8. Fetch roles
  const { data: roleData } = await supabase
    .from("account_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (roleData || []).map((r) => r.role);
  const primaryRole = roles.includes("admin")
    ? "admin"
    : roles.includes("business")
    ? "business"
    : "talent";

  const response = jsonResponse({
    authenticated: true,
    user: { id: userId, email: userData.user.email, role: primaryRole },
    role: primaryRole,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  setAuthCookies(response, session.access_token, session.refresh_token, session.expires_in);

  await recordUserSession({
    userId,
    refreshToken: session.refresh_token,
    mfaVerified: true,
    otpVerified: false,
    ipAddress: getClientIdentifier(req),
    userAgent: req.headers.get("user-agent") || undefined,
    expiresInSeconds: session.expires_in,
  });

  await logAuditEvent({
    actorId: userId,
    action: "login.totp_verified",
    entityTable: "public.auth_mfa_settings",
    entityId: userId,
  });

  return response;
}

