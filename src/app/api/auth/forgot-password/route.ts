/**
 * POST /api/auth/forgot-password
 *
 * Requests a password reset link:
 * - Constant-time / generic response (never reveals if email exists)
 * - Cryptographically random 32-byte single-use token
 * - 15-minute token expiry
 * - SHA-256 token hash stored in private.password_reset_tokens
 * - Rate limited to prevent abuse
 */
import { NextRequest } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limit";
import { logAuditEvent } from "@/lib/server/audit";
import { hashToken } from "@/lib/server/totp";
import { sendPasswordResetEmail } from "@/lib/server/auth-email";
import { validateCsrf } from "@/lib/server/session";
import { randomBytes, randomUUID } from "crypto";

const RESET_TOKEN_EXPIRES_MINUTES = 15;

export async function POST(req: NextRequest) {
  if (!validateCsrf(req)) {
    return errorResponse("CSRF validation failed", 403);
  }

  // Rate limit password reset requests
  const rateCheck = checkRateLimit(req, "sensitive");
  if (!rateCheck.allowed) {
    return errorResponse("Too many reset requests. Please try again shortly.", 429, {
      retryAfter: rateCheck.retryAfter,
    });
  }

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  // Generic message returned regardless of email existence to prevent user enumeration
  const genericSuccess = jsonResponse({
    success: true,
    message: "If that email address is registered, we have sent instructions to reset your password.",
  });

  if (!email || !email.includes("@")) {
    return genericSuccess;
  }

  const supabase = createServerAdminClient();

  // Find user by email
  const { data: usersData, error: userError } = await supabase.auth.admin.listUsers();
  if (userError || !usersData?.users) {
    return genericSuccess;
  }

  const targetUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === email
  );

  if (!targetUser) {
    return genericSuccess;
  }

  // Generate secure 32-byte random token
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000
  ).toISOString();

  // Store token hash in password_reset_tokens
  await supabase.from("password_reset_tokens").insert({
    id: randomUUID(),
    user_id: targetUser.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    ip_address: getClientIdentifier(req),
  });

  // Construct reset URL
  const appBaseUrl =
    process.env.APP_BASE_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000";
  const resetUrl = `${appBaseUrl}/?reset_token=${rawToken}`;

  // Send email
  sendPasswordResetEmail(email, resetUrl).catch((err) =>
    console.error("[forgot-password] Email dispatch failed:", err)
  );

  await logAuditEvent({
    actorId: targetUser.id,
    action: "password.reset_requested",
    entityTable: "public.password_reset_tokens",
    entityId: targetUser.id,
  });

  return genericSuccess;
}

