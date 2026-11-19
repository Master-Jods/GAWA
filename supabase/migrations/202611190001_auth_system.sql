-- Authentication system: MFA, OTP, password reset, sessions, identity providers
-- banner_path was already added in 202611180001_profile_media_bucket.sql, so skipped here.

BEGIN;

-- ─── Ensure private schema exists ──────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS private;

-- ─── 1. MFA settings (TOTP / 2FA) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.auth_mfa_settings (
    user_id              uuid        PRIMARY KEY REFERENCES public.account_profiles(id) ON DELETE CASCADE,
    totp_enabled         boolean     NOT NULL DEFAULT false,
    totp_secret_encrypted text,
    totp_verified_at     timestamptz,
    totp_last_used_code  text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. MFA recovery codes (hashed, one-time use) ──────────────────────────
CREATE TABLE IF NOT EXISTS private.auth_mfa_recovery_codes (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
    code_hash   text        NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, code_hash)
);

-- ─── 3. OTP challenges (email / SMS) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.otp_challenges (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
    channel       text        NOT NULL CHECK (channel IN ('email', 'sms')),
    code_hash     text        NOT NULL,
    expires_at    timestamptz NOT NULL,
    used_at       timestamptz,
    attempt_count integer     NOT NULL DEFAULT 0,
    ip_address    text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_user_expires ON private.otp_challenges (user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_created_at ON private.otp_challenges (created_at);

-- ─── 4. Password reset tokens ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.password_reset_tokens (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
    token_hash  text        NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    ip_address  text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_expires ON private.password_reset_tokens (user_id, expires_at);

-- ─── 5. Server-side user sessions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.user_sessions (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
    refresh_token_hash  text        NOT NULL UNIQUE,
    mfa_verified        boolean     NOT NULL DEFAULT false,
    otp_verified        boolean     NOT NULL DEFAULT false,
    ip_address          text,
    user_agent          text,
    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    last_active_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires ON private.user_sessions (user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_hash ON private.user_sessions (refresh_token_hash);

-- ─── 6. OAuth / SSO identity provider links ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_identity_providers (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid        NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
    provider          text        NOT NULL CHECK (provider IN ('google', 'github')),
    provider_user_id  text        NOT NULL,
    provider_email    text,
    linked_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id),
    UNIQUE (user_id, provider)
);

ALTER TABLE public.auth_identity_providers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'auth_identity_providers' 
        AND policyname = 'auth_idp_select'
    ) THEN
        CREATE POLICY auth_idp_select
            ON public.auth_identity_providers
            FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- ─── Indexes for auth_mfa_recovery_codes ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_auth_mfa_recovery_codes_user ON private.auth_mfa_recovery_codes (user_id);

COMMIT;
