/**
 * POST /api/auth/2fa/verify
 *
 * Confirms Google Authenticator enrollment with initial code verification.
 * - Activates totp_enabled = true
 * - Generates 10 single-use recovery codes
 * - Stores recovery codes in hashed form only (SHA-256)
 * - Returns plaintext recovery codes exactly once
 */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";
import {
  decryptTotpSecret,
  verifyTotp,
  hashToken,
} from "@/lib/server/totp";
import { validateCsrf } from "@/lib/server/session";
import { randomBytes, randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  if (!validateCsrf(req)) {
    return errorResponse("CSRF validation failed", 403);
  }

  const { caller, error: authError } = await requireAuth(req, "sensitive");
  if (authError || !caller) {
    return authError || errorResponse("Unauthorized", 401);
  }

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code || code.length !== 6) {
    return errorResponse("A 6-digit verification code is required", 400);
  }

  const supabase = createServerAdminClient();

  // 1. Fetch pending enrollment secret
  const { data: mfaRecord, error: mfaError } = await supabase
    .from("auth_mfa_settings")
    .select("*")
    .eq("user_id", caller.id)
    .maybeSingle();

  if (mfaError || !mfaRecord?.totp_secret_encrypted) {
    return errorResponse("No 2FA enrollment in progress. Please start setup first.", 400);
  }

  // 2. Decrypt and verify code
  let plainSecret = "";
  try {
    plainSecret = decryptTotpSecret(mfaRecord.totp_secret_encrypted);
  } catch (err) {
    return errorResponse("Failed to decrypt 2FA secret", 500);
  }

  const isValid = verifyTotp(plainSecret, code);
  if (!isValid) {
    return errorResponse("Invalid verification code. Please check your authenticator app.", 400);
  }

  // 3. Prevent immediate code replay
  if (mfaRecord.totp_last_used_code === code) {
    return errorResponse("This code has already been used. Please wait for the next code.", 400);
  }

  // 4. Activate 2FA
  await supabase
    .from("auth_mfa_settings")
    .update({
      totp_enabled: true,
      totp_verified_at: new Date().toISOString(),
      totp_last_used_code: code,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", caller.id);

  // 5. Generate 10 one-time recovery codes
  const plainRecoveryCodes: string[] = [];
  const hashedRows: Array<{
    id: string;
    user_id: string;
    code_hash: string;
  }> = [];

  for (let i = 0; i < 10; i++) {
    const raw = `${randomBytes(3).toString("hex")}-${randomBytes(3).toString("hex")}`;
    plainRecoveryCodes.push(raw);
    hashedRows.push({
      id: randomUUID(),
      user_id: caller.id,
      code_hash: hashToken(raw),
    });
  }

  // Clear existing recovery codes for user and insert new ones
  await supabase
    .from("auth_mfa_recovery_codes")
    .delete()
    .eq("user_id", caller.id);

  await supabase
    .from("auth_mfa_recovery_codes")
    .insert(hashedRows);

  await logAuditEvent({
    actorId: caller.id,
    action: "mfa.totp_enabled",
    entityTable: "public.auth_mfa_settings",
    entityId: caller.id,
  });

  return jsonResponse({
    success: true,
    message: "Two-Factor Authentication is now enabled.",
    recovery_codes: plainRecoveryCodes,
  });
}

