/**
 * POST /api/auth/2fa/setup
 *
 * Initializes Google Authenticator enrollment:
 * - Requires active authenticated session
 * - Generates unique Base32 TOTP secret
 * - Encrypts secret at rest using AES-256-GCM
 * - Stores encrypted secret with totp_enabled = false
 * - Returns secret and otpauth_url for QR code display (once only)
 */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import {
  generateTotpSecret,
  encryptTotpSecret,
  buildOtpAuthUrl,
} from "@/lib/server/totp";
import { validateCsrf } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  if (!validateCsrf(req)) {
    return errorResponse("CSRF validation failed", 403);
  }

  const { caller, error: authError } = await requireAuth(req, "sensitive");
  if (authError || !caller) {
    return authError || errorResponse("Unauthorized", 401);
  }

  const supabase = createServerAdminClient();

  // Generate unique TOTP secret
  const plainSecret = generateTotpSecret();
  const encryptedSecret = encryptTotpSecret(plainSecret);

  // Store in auth_mfa_settings (totp_enabled remains false until confirmed)
  await supabase
    .from("auth_mfa_settings")
    .upsert({
      user_id: caller.id,
      totp_enabled: false,
      totp_secret_encrypted: encryptedSecret,
      updated_at: new Date().toISOString(),
    });

  const otpauthUrl = buildOtpAuthUrl(plainSecret, caller.email, "GAWA");

  return jsonResponse({
    success: true,
    secret: plainSecret,
    otpauth_url: otpauthUrl,
  });
}

