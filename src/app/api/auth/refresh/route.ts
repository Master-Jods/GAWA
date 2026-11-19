/**
 * POST /api/auth/refresh
 *
 * Secure session refresh with token rotation and replay detection.
 * Reads refresh token from HttpOnly cookie or request body.
 * Updates private.user_sessions and issues new cookies.
 */
import { NextRequest } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limit";
import { logAuditEvent } from "@/lib/server/audit";
import {
  REFRESH_COOKIE_NAME,
  setAuthCookies,
  hashToken,
  recordUserSession,
  revokeAllUserSessions,
  validateCsrf,
} from "@/lib/server/session";

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

  let bodyRefreshToken = "";
  try {
    const body = await req.json();
    if (body?.refresh_token && typeof body.refresh_token === "string") {
      bodyRefreshToken = body.refresh_token.trim();
    }
  } catch {
    // Body optional if cookie is present
  }

  const cookieRefreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value || "";
  const rawRefreshToken = bodyRefreshToken || cookieRefreshToken;

  if (!rawRefreshToken) {
    return errorResponse("Refresh token missing", 401);
  }

  const supabase = createServerAdminClient();
  const tokenHash = hashToken(rawRefreshToken);

  // 1. Check for token replay in user_sessions
  const { data: sessionRecord } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("refresh_token_hash", tokenHash)
    .maybeSingle();

  if (sessionRecord?.revoked_at) {
    // Replay attack detected! A revoked token is being reused.
    // Invalidate ALL sessions for this user to protect the account.
    await revokeAllUserSessions(sessionRecord.user_id);
    await logAuditEvent({
      actorId: sessionRecord.user_id,
      action: "security.refresh_token_replay_detected",
      entityTable: "user_sessions",
      entityId: sessionRecord.user_id,
      details: { ip: getClientIdentifier(req) },
    });
    return errorResponse("Invalid refresh token. Sessions revoked for security.", 401);
  }

  // 2. Exchange refresh token with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.refreshSession({
    refresh_token: rawRefreshToken,
  });

  if (authError || !authData.session || !authData.user) {
    return errorResponse("Session expired or invalid. Please sign in again.", 401);
  }

  const newSession = authData.session;
  const user = authData.user;

  // 3. Invalidate old refresh token record (rotation)
  if (sessionRecord) {
    await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", sessionRecord.id);
  }

  // 4. Record new rotated session
  await recordUserSession({
    userId: user.id,
    refreshToken: newSession.refresh_token,
    mfaVerified: sessionRecord?.mfa_verified || false,
    otpVerified: sessionRecord?.otp_verified || false,
    ipAddress: getClientIdentifier(req),
    userAgent: req.headers.get("user-agent") || undefined,
    expiresInSeconds: newSession.expires_in,
  });

  const response = jsonResponse({
    success: true,
    user: { id: user.id, email: user.email },
    access_token: newSession.access_token,
    refresh_token: newSession.refresh_token,
    expires_in: newSession.expires_in,
  });

  // Set rotated HttpOnly cookies
  setAuthCookies(
    response,
    newSession.access_token,
    newSession.refresh_token,
    newSession.expires_in
  );

  return response;
}

