/**
 * POST /api/auth/2fa/recovery
 *
 * Uses a one-time recovery code to bypass TOTP during login.
 * - Single-use: marks code used_at immediately
 * - Prevents replay of same code
 * - Establishes authenticated session on success
 * - Requires user_id from the pending TOTP challenge state
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

  let body: { recovery_code?: unknown; user_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const recoveryCode =
    typeof body.recovery_code === "string" ? body.recovery_code.trim() : "";

  if (!userId || !recoveryCode) {
    return errorResponse("user_id and recovery_code are required", 400);
  }

  const supabase = createServerAdminClient();

  // Look up recovery code hash
  const codeHash = hashToken(recoveryCode);
  const { data: codeRecord, error: codeError } = await supabase
    .from("auth_mfa_recovery_codes")
    .select("*")
    .eq("user_id", userId)
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .maybeSingle();

  if (codeError || !codeRecord) {
    return errorResponse("Invalid or already-used recovery code.", 401);
  }

  // Mark code as used immediately (prevent replay)
  await supabase
    .from("auth_mfa_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", codeRecord.id);

  // Verify account status
  const { data: statusData } = await supabase
    .from("account_statuses")
    .select("status")
    .eq("user_id", userId)
    .single();

  if (statusData?.status !== "active") {
    return errorResponse("Account is not active.", 403);
  }

  // Issue authenticated session
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  if (!userData?.user) {
    return errorResponse("User account not found", 404);
  }

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

  if (!session) {
    return errorResponse("Failed to establish authenticated session", 500);
  }

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
    warning: "Recovery code used. You should re-enroll your authenticator.",
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
    action: "login.recovery_code_used",
    entityTable: "public.auth_mfa_recovery_codes",
    entityId: codeRecord.id,
  });

  return response;
}

