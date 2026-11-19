/**
 * POST /api/auth/reset-password
 *
 * Completes password reset using single-use hashed token.
 * - Enforces 15-minute expiry
 * - Marks token used_at (replay prevention)
 * - Updates password hash
 * - Revokes all existing user sessions
 * - Sends confirmation notification email
 * - Preserves existing MFA protections
 */
import { NextRequest } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { logAuditEvent } from "@/lib/server/audit";
import { hashToken } from "@/lib/server/totp";
import { sendPasswordChangedEmail } from "@/lib/server/auth-email";
import { revokeAllUserSessions, validateCsrf } from "@/lib/server/session";

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

  let body: { token?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password) {
    return errorResponse("Token and new password are required", 400);
  }

  // Password policy validation
  if (password.length < 8) {
    return errorResponse("Password must be at least 8 characters long", 400);
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return errorResponse(
      "Password must contain at least one letter and one number",
      400
    );
  }

  const supabase = createServerAdminClient();
  const tokenHash = hashToken(token);

  // 1. Find token record
  const { data: tokenRecord, error: tokenError } = await supabase
    .from("password_reset_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRecord) {
    return errorResponse("Invalid or expired password reset link.", 400);
  }

  // 2. Check if already used
  if (tokenRecord.used_at) {
    return errorResponse(
      "This password reset link has already been used. Please request a new one.",
      410
    );
  }

  // 3. Check expiration (15 minutes)
  if (new Date(tokenRecord.expires_at) <= new Date()) {
    return errorResponse(
      "This password reset link has expired. Please request a new one.",
      410
    );
  }

  // 4. Update password via Supabase Admin
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    tokenRecord.user_id,
    { password }
  );

  if (updateError) {
    return errorResponse(updateError.message || "Failed to update password", 500);
  }

  // 5. Invalidate the reset token immediately
  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRecord.id);

  // 6. Revoke all active sessions for this user (prevent hijack)
  await revokeAllUserSessions(tokenRecord.user_id);

  // 7. Send confirmation email to account owner
  const { data: userData } = await supabase.auth.admin.getUserById(
    tokenRecord.user_id
  );
  if (userData?.user?.email) {
    sendPasswordChangedEmail(userData.user.email).catch((err) =>
      console.error("[reset-password] Confirmation email error:", err)
    );
  }

  await logAuditEvent({
    actorId: tokenRecord.user_id,
    action: "password.reset_completed",
    entityTable: "public.password_reset_tokens",
    entityId: tokenRecord.id,
  });

  return jsonResponse({
    success: true,
    message: "Password has been successfully reset. Please sign in with your new password.",
  });
}

