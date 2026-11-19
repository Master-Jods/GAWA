/**
 * POST /api/auth/2fa/disable
 *
 * Disables Google Authenticator 2FA for the authenticated user.
 * - Requires active authenticated session (recent auth)
 * - Requires valid TOTP code OR a valid recovery code to confirm intent
 * - Clears totp_enabled, totp_secret_encrypted, and all recovery codes
 * - Logs audit event
 */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";
import { decryptTotpSecret, verifyTotp, hashToken } from "@/lib/server/totp";
import { validateCsrf } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  if (!validateCsrf(req)) {
    return errorResponse("CSRF validation failed", 403);
  }

  const { caller, error: authError } = await requireAuth(req, "sensitive");
  if (authError || !caller) {
    return authError || errorResponse("Unauthorized", 401);
  }

  let body: { code?: unknown; recovery_code?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const code = typeof body.code === "string" ? body.code.replace(/\s+/g, "") : "";
  const recoveryCode = typeof body.recovery_code === "string" ? body.recovery_code.trim() : "";

  if (!code && !recoveryCode) {
    return errorResponse("A verification code or recovery code is required to disable 2FA", 400);
  }

  const supabase = createServerAdminClient();

  const { data: mfaRecord } = await supabase
    .from("auth_mfa_settings")
    .select("*")
    .eq("user_id", caller.id)
    .maybeSingle();

  if (!mfaRecord?.totp_enabled) {
    return errorResponse("Two-Factor Authentication is not currently enabled.", 400);
  }

  let verified = false;

  if (code) {
    // Verify TOTP code
    if (!mfaRecord.totp_secret_encrypted) {
      return errorResponse("2FA configuration not found", 500);
    }
    let plainSecret: string;
    try {
      plainSecret = decryptTotpSecret(mfaRecord.totp_secret_encrypted);
    } catch {
      return errorResponse("Failed to verify 2FA credentials", 500);
    }

    if (mfaRecord.totp_last_used_code === code) {
      return errorResponse("This code has already been used. Please wait for the next code.", 401);
    }

    verified = verifyTotp(plainSecret, code);
    if (!verified) {
      return errorResponse("Invalid verification code.", 401);
    }
  } else if (recoveryCode) {
    // Verify recovery code
    const codeHash = hashToken(recoveryCode);
    const { data: recoveryRecord } = await supabase
      .from("auth_mfa_recovery_codes")
      .select("*")
      .eq("user_id", caller.id)
      .eq("code_hash", codeHash)
      .is("used_at", null)
      .maybeSingle();

    if (!recoveryRecord) {
      return errorResponse("Invalid or already-used recovery code.", 401);
    }

    // Mark recovery code as used
    await supabase
      .from("auth_mfa_recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", recoveryRecord.id);

    verified = true;
  }

  if (!verified) {
    return errorResponse("Verification failed. Please check your code and try again.", 401);
  }

  // Disable 2FA and clear all recovery codes
  await supabase
    .from("auth_mfa_settings")
    .update({
      totp_enabled: false,
      totp_secret_encrypted: null,
      totp_verified_at: null,
      totp_last_used_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", caller.id);

  await supabase
    .from("auth_mfa_recovery_codes")
    .delete()
    .eq("user_id", caller.id);

  await logAuditEvent({
    actorId: caller.id,
    action: "mfa.totp_disabled",
    entityTable: "public.auth_mfa_settings",
    entityId: caller.id,
  });

  return jsonResponse({
    success: true,
    message: "Two-Factor Authentication has been disabled.",
  });
}

