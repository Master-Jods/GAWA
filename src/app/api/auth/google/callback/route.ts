/**
 * GET /api/auth/google/callback
 *
 * Handles the OAuth 2.0 authorization code callback from Google via Supabase.
 *
 * Flow:
 *   1. Receive `code` (and optional `error`) from Google via Supabase.
 *   2. Exchange code for a Supabase session (PKCE).
 *   3. Upsert a record in `public.auth_identity_providers` for this Google identity.
 *   4. Determine whether the user needs onboarding (no account_profiles row yet).
 *   5. Apply MFA policy: if the user has TOTP enabled, redirect to MFA verification.
 *   6. Redirect to the app with contextual query parameters.
 *
 * Security notes:
 *   - Code exchange uses the service-role client so we can call admin auth APIs.
 *   - We rely on Supabase's OIDC token validation — we do NOT re-verify the
 *     Google ID token ourselves (Supabase handles this).
 *   - Accounts are NEVER auto-merged by email alone. If the Google email
 *     matches an existing password-only account, the user is notified and
 *     must explicitly confirm the link via a separate flow.
 *   - The `state` param integrity is verified by Supabase internally.
 *
 * Required env vars (set in Supabase Dashboard → Auth → Providers → Google):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/server/audit";

/** Build the base redirect URL for this origin. */
function appUrl(req: NextRequest, path: string): string {
  return `${req.nextUrl.origin}${path}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Google/Supabase sends `error` when the user denies access.
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const description = searchParams.get("error_description") ?? "Access denied";
    console.warn("[Google OAuth callback] OAuth error:", oauthError, description);
    return NextResponse.redirect(
      appUrl(req, `/?auth_error=${encodeURIComponent(description)}`)
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      appUrl(req, "/?auth_error=Missing+authorization+code")
    );
  }

  try {
    const supabase = createServerAdminClient();

    // ── 1. Exchange the authorization code for a session ──────────────────
    const {
      data: { session },
      error: exchangeError,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !session) {
      console.error("[Google OAuth callback] Code exchange failed:", exchangeError);
      return NextResponse.redirect(
        appUrl(req, `/?auth_error=${encodeURIComponent(exchangeError?.message ?? "Session exchange failed")}`)
      );
    }

    const user = session.user;
    const userId = user.id;

    // Extract Google identity from Supabase user metadata.
    // Supabase stores the provider's sub (user ID) in identities[].
    const googleIdentity = user.identities?.find((id) => id.provider === "google");
    const providerUserId = googleIdentity?.id ?? null;
    const providerEmail =
      (user.email ?? googleIdentity?.identity_data?.email ?? null) as string | null;

    // ── 2. Check/create auth_identity_providers record ────────────────────
    if (providerUserId) {
      // Check whether this Google account is already linked to a *different* user.
      const { data: existingLink } = await supabase
        .from("auth_identity_providers")
        .select("user_id, provider_user_id")
        .eq("provider", "google")
        .eq("provider_user_id", providerUserId)
        .maybeSingle();

      if (existingLink && existingLink.user_id !== userId) {
        // This Google identity is already linked to another GAWA account.
        // Sign out and refuse — do NOT auto-merge.
        await supabase.auth.admin.signOut(session.access_token);
        await logAuditEvent({
          actorId: userId,
          action: "google_sso_identity_conflict",
          entityTable: "auth_identity_providers",
          details: { conflicting_user_id: existingLink.user_id, provider_user_id: providerUserId },
        });
        return NextResponse.redirect(
          appUrl(req, "/?auth_error=This+Google+account+is+already+linked+to+another+GAWA+account")
        );
      }

      if (!existingLink) {
        // Check whether a password-based account with the same email already exists.
        // We surface this to the user rather than silently merging.
        if (providerEmail) {
          const { data: emailUser } = await supabase.auth.admin.listUsers();
          const existingEmailUser = emailUser?.users?.find(
            (u) =>
              u.email?.toLowerCase() === providerEmail.toLowerCase() &&
              u.id !== userId &&
              (u.app_metadata?.provider === "email" || !u.identities?.find((i) => i.provider === "google"))
          );

          if (existingEmailUser) {
            // A password-based account exists with this email.
            // Sign out the Google session and redirect with a flag so the UI
            // can prompt the user to link accounts explicitly.
            await supabase.auth.admin.signOut(session.access_token);
            await logAuditEvent({
              actorId: userId,
              action: "google_sso_email_conflict",
              entityTable: "auth_identity_providers",
              details: { email: providerEmail, existing_user_id: existingEmailUser.id },
            });
            return NextResponse.redirect(
              appUrl(
                req,
                `/?auth_error=An+account+with+this+email+already+exists.+Please+sign+in+with+your+password+and+link+Google+from+your+settings.`
              )
            );
          }
        }

        // No conflict — create the identity provider record.
        const { error: insertError } = await supabase
          .from("auth_identity_providers")
          .insert({
            user_id: userId,
            provider: "google",
            provider_user_id: providerUserId,
            provider_email: providerEmail,
          });

        if (insertError) {
          // Tolerate unique-constraint races (another request beat us).
          if (!insertError.code?.includes("23505")) {
            console.error("[Google OAuth callback] Failed to insert auth_identity_providers:", insertError);
          }
        } else {
          await logAuditEvent({
            actorId: userId,
            action: "google_sso_linked",
            entityTable: "auth_identity_providers",
            details: { provider_email: providerEmail },
          });
        }
      }
    }

    // ── 3. Check whether the user has completed onboarding ────────────────
    const { data: profileData } = await supabase
      .from("account_profiles")
      .select("id, display_name")
      .eq("id", userId)
      .maybeSingle();

    const needsOnboarding = !profileData;

    // ── 4. Check MFA policy ───────────────────────────────────────────────
    // If the user has TOTP enabled, they must verify it before accessing the app.
    const { data: mfaSettings } = await supabase
      .from("auth_mfa_settings" as never) // private schema via service role
      .select("totp_enabled")
      .eq("user_id", userId)
      .maybeSingle() as { data: { totp_enabled: boolean } | null };

    const requiresMfa = mfaSettings?.totp_enabled === true;

    await logAuditEvent({
      actorId: userId,
      action: "google_sso_login",
      entityTable: "auth_identity_providers",
      details: {
        provider_email: providerEmail,
        needs_onboarding: needsOnboarding,
        requires_mfa: requiresMfa,
      },
    });

    // ── 5. Build redirect URL ─────────────────────────────────────────────
    const params = new URLSearchParams({
      auth_success: "true",
      provider: "google",
    });
    if (needsOnboarding) params.set("needs_onboarding", "true");
    if (requiresMfa) params.set("requires_mfa", "true");

    // Set the Supabase session cookie so the browser picks it up.
    // The auth state listener in AuthContext will handle the rest.
    const redirectResponse = NextResponse.redirect(appUrl(req, `/?${params.toString()}`));

    // Forward the session tokens in cookies so the browser client can
    // detect the new session via onAuthStateChange.
    const maxAge = session.expires_in ?? 3600;
    redirectResponse.cookies.set("sb-access-token", session.access_token, {
      httpOnly: false, // Must be readable by Supabase JS client
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
      path: "/",
    });
    if (session.refresh_token) {
      redirectResponse.cookies.set("sb-refresh-token", session.refresh_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });
    }

    return redirectResponse;
  } catch (err) {
    console.error("[Google OAuth callback] Unexpected error:", err);
    return NextResponse.redirect(
      appUrl(req, "/?auth_error=An+unexpected+error+occurred+during+sign+in")
    );
  }
}
