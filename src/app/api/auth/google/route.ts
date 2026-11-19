/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth 2.0 / OIDC flow via Supabase Auth.
 *
 * Required Supabase Dashboard configuration:
 *   Auth → Providers → Google:
 *     - GOOGLE_CLIENT_ID     — From Google Cloud Console → Credentials
 *     - GOOGLE_CLIENT_SECRET — From Google Cloud Console → Credentials
 *     - Authorized redirect URI must include:
 *       https://<yourdomain>/api/auth/google/callback
 *
 * The Supabase service-role client is used here so we can call
 * signInWithOAuth server-side. The resulting OAuth URL is returned as JSON;
 * the browser then performs the redirect so the PKCE code_verifier can be
 * stored in sessionStorage by the Supabase JS client on the next page load.
 *
 * Security notes:
 *   - GOOGLE_CLIENT_SECRET is never exposed to the browser.
 *   - The redirect URL must be whitelisted in both Google Cloud Console
 *     and in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/server/security";

export async function GET(req: NextRequest) {
  try {
    // The callback URL that Google will redirect to after authentication.
    // Must match the value registered in Google Cloud Console and Supabase Dashboard.
    const redirectTo =
      process.env.GOOGLE_REDIRECT_URI ||
      `${req.nextUrl.origin}/api/auth/google/callback`;

    const supabase = createServerAdminClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "openid email profile",
        // Skip browser redirect so we can return the URL to the client.
        skipBrowserRedirect: true,
        queryParams: {
          // Request refresh token so long-lived sessions are possible.
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error || !data?.url) {
      console.error("[Google OAuth init error]:", error);
      return errorResponse("Failed to initiate Google sign-in", 500);
    }

    return NextResponse.json(
      { url: data.url },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (err) {
    console.error("[Google OAuth route unexpected error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
