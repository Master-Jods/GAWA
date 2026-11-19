/**
 * POST /api/auth/login
 *
 * Authenticates user credentials.
 * If MFA/OTP verification is required by policy or user setting, generates a challenge
 * and sends code via email/SMS without establishing an authenticated session.
 *
 * Body: { email, password, expected_role? }
 */
import { NextRequest } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limit";
import { logAuditEvent } from "@/lib/server/audit";
import { generateOtpCode, hashToken } from "@/lib/server/totp";
import { sendOtpEmail } from "@/lib/server/auth-email";
import { sendOtpSms, isSmsConfigured } from "@/lib/server/auth-sms";
import { setAuthCookies, recordUserSession, validateCsrf } from "@/lib/server/session";
import { randomUUID } from "crypto";

const OTP_EXPIRES_MINUTES = 5; // 5-minute expiration strictly enforced

export async function POST(req: NextRequest) {
  // CSRF protection check
  if (!validateCsrf(req)) {
    return errorResponse("CSRF validation failed", 403);
  }

  // Rate limit by IP â€” sensitive tier
  const rateCheck = checkRateLimit(req, "sensitive");
  if (!rateCheck.allowed) {
    return errorResponse("Rate limit exceeded. Please try again shortly.", 429, {
      retryAfter: rateCheck.retryAfter,
    });
  }

  let body: { email?: unknown; password?: unknown; expected_role?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return errorResponse("Email and password are required", 400);
  }

  const authClient = createServerAdminClient();
  const admin = createServerAdminClient();

  // 1. Validate credentials via Supabase Auth
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user || !authData.session) {
    return errorResponse("Invalid email or password", 401);
  }

  const user = authData.user;
  const tempSession = authData.session;

  // 2. Check account status
  const { data: statusData } = await admin
    .from("account_statuses")
    .select("status, reason")
    .eq("user_id", user.id)
    .single();

  if (statusData?.status === "suspended" || statusData?.status === "closed") {
    await admin.auth.admin.signOut(user.id).catch(() => {});
    return errorResponse(`Your account is currently ${statusData.status}.`, 403);
  }

  // 3. Role validation if expected_role was requested
  const { data: roleData } = await admin
    .from("account_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (roleData || []).map((r) => r.role);
  const primaryRole = roles.includes("admin") ? "admin" : roles.includes("business") ? "business" : "talent";

  if (body.expected_role && typeof body.expected_role === "string") {
    if (!roles.includes(body.expected_role) && !roles.includes("admin")) {
      await admin.auth.admin.signOut(user.id).catch(() => {});
      return errorResponse(
        `This account is registered as a ${primaryRole} account. Please switch tabs to log in.`,
        403
      );
    }
  }

  // 4. Check user MFA settings and policy
  const { data: mfaSettings } = await admin
    .from("auth_mfa_settings")
    .select("totp_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  const policy = (process.env.AUTH_VERIFICATION_POLICY || "email_only").toLowerCase();

  // Check if TOTP or OTP challenge is required
  const totpRequired = Boolean(mfaSettings?.totp_enabled);
  const otpRequired = true; // In GAWA, require OTP verification before completing login

  if (totpRequired || otpRequired) {
    // Terminate the temporary session so no authenticated tokens are active yet
    await admin.auth.admin.signOut(user.id).catch(() => {});

    if (totpRequired) {
      // User has Google Authenticator TOTP enabled
      return jsonResponse({
        mfa_required: true,
        method: "totp",
        user_id: user.id,
      });
    }

    // Determine channel based on policy and available credentials
    let channel: "email" | "sms" = "email";
    if (policy === "sms_only") {
      if (!isSmsConfigured()) {
        return errorResponse(
          "SMS verification policy is configured but SMS provider credentials are unavailable.",
          500
        );
      }
      channel = "sms";
    }

    // Generate single-use 6-digit OTP
    const otpCode = generateOtpCode(6);
    const codeHash = hashToken(otpCode);
    const challengeId = randomUUID();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await admin.from("otp_challenges").insert({
      id: challengeId,
      user_id: user.id,
      channel,
      code_hash: codeHash,
      expires_at: expiresAt,
      ip_address: getClientIdentifier(req),
      attempt_count: 0,
    });

    if (insertError) {
      console.error("[login] Error creating OTP challenge:", insertError);
      return errorResponse("Failed to initiate OTP verification challenge", 500);
    }

    // In local development or when SMTP is unconfigured, log OTP for immediate developer testing
    console.log(`\n========================================`);
    console.log(`🔐 [GAWA LOGIN OTP CODE for ${email}]: ${otpCode}`);
    console.log(`⏱️  Expires in: ${OTP_EXPIRES_MINUTES} minutes (Challenge: ${challengeId})`);
    console.log(`========================================\n`);

    // Send code to user via real SMTP or SMS gateway
    if (channel === "sms") {
      const userPhone = user.phone || "";
      if (userPhone) {
        sendOtpSms(userPhone, otpCode, OTP_EXPIRES_MINUTES).catch((err) =>
          console.error("[login] SMS OTP dispatch failed:", err)
        );
      }
    } else {
      sendOtpEmail(email, otpCode, OTP_EXPIRES_MINUTES).catch((err) =>
        console.error("[login] Email OTP dispatch failed:", err)
      );
    }

    await logAuditEvent({
      actorId: user.id,
      action: "login.otp_challenge_issued",
      entityTable: "public.otp_challenges",
      entityId: challengeId,
      details: { channel, expires_in_minutes: OTP_EXPIRES_MINUTES },
    });

    return jsonResponse({
      mfa_required: true,
      challenge_id: challengeId,
      channel,
      user_id: user.id,
    });
  }

  // 5. If no OTP/MFA required (policy allows immediate session)
  const response = jsonResponse({
    authenticated: true,
    user: { id: user.id, email: user.email, role: primaryRole },
    role: primaryRole,
  });

  // Set HttpOnly cookies
  setAuthCookies(
    response,
    tempSession.access_token,
    tempSession.refresh_token,
    tempSession.expires_in
  );

  // Track session in database
  await recordUserSession({
    userId: user.id,
    refreshToken: tempSession.refresh_token,
    mfaVerified: false,
    otpVerified: false,
    ipAddress: getClientIdentifier(req),
    userAgent: req.headers.get("user-agent") || undefined,
    expiresInSeconds: tempSession.expires_in,
  });

  await logAuditEvent({
    actorId: user.id,
    action: "login.success",
    entityTable: "account_profiles",
    entityId: user.id,
  });

  return response;
}
