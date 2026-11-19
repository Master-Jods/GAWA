/**
 * Server session management, cookie helpers, and CSRF protection.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServerAdminClient } from "@/lib/supabase/server";

export const ACCESS_COOKIE_NAME = "sb-access-token";
export const REFRESH_COOKIE_NAME = "sb-refresh-token";
export const CSRF_HEADER_NAME = "x-gawa-csrf";

/**
 * Hash a token using SHA-256 for secure database storage.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Set authentication cookies on a NextResponse.
 * Uses HttpOnly, SameSite=Lax, Secure in production.
 */
export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
  accessExpiresInSeconds = 3600
): void {
  const isProd = process.env.NODE_ENV === "production";

  // Access token cookie (short-lived)
  res.cookies.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: accessExpiresInSeconds,
  });

  // Refresh token cookie (longer-lived)
  res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/**
 * Clears authentication cookies on logout.
 */
export function clearAuthCookies(res: NextResponse): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(ACCESS_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Validate CSRF for cookie-based state-changing requests.
 * Allows safe methods (GET, HEAD, OPTIONS).
 * For state-changing methods, checks Origin / Referer matches host,
 * or verifies presence of custom client header.
 */
export function validateCsrf(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return true;
  }

  // Allow Bearer token authorization header (non-cookie clients)
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return true;
  }

  // Custom header check (browser AJAX cannot set custom header cross-origin without CORS preflight)
  const customHeader = req.headers.get(CSRF_HEADER_NAME);
  if (customHeader) {
    return true;
  }

  // Origin / Referer verification
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) {
        return true;
      }
    } catch {
      return false;
    }
  }

  // If running in development without strict origin
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return false;
}

/**
 * Record a user session in `private.user_sessions`.
 */
export async function recordUserSession(params: {
  userId: string;
  refreshToken: string;
  mfaVerified: boolean;
  otpVerified: boolean;
  ipAddress?: string;
  userAgent?: string;
  expiresInSeconds?: number;
}): Promise<void> {
  try {
    const supabase = createServerAdminClient();
    const tokenHash = hashToken(params.refreshToken);
    const expiresAt = new Date(
      Date.now() + (params.expiresInSeconds || 60 * 60 * 24 * 30) * 1000
    ).toISOString();

    await supabase.from("user_sessions").insert({
      user_id: params.userId,
      refresh_token_hash: tokenHash,
      mfa_verified: params.mfaVerified,
      otp_verified: params.otpVerified,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("[recordUserSession error]:", err);
  }
}

/**
 * Invalidate all sessions for a user (after logout or password reset).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  try {
    const supabase = createServerAdminClient();
    // 1. Revoke in user_sessions
    await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null);

    // 2. Invalidate via Supabase admin
    await supabase.auth.admin.signOut(userId).catch(() => {});
  } catch (err) {
    console.error("[revokeAllUserSessions error]:", err);
  }
}

