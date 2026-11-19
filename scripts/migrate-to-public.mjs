import pg from 'pg';
import fs from 'node:fs';

const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function createPublicTables() {
  await client.connect();
  console.log('Connected to PG');

  await client.query(`
    BEGIN;

    CREATE TABLE IF NOT EXISTS public.auth_mfa_settings (
        user_id              uuid        PRIMARY KEY REFERENCES public.account_profiles(id) ON DELETE CASCADE,
        totp_enabled         boolean     NOT NULL DEFAULT false,
        totp_secret_encrypted text,
        totp_verified_at     timestamptz,
        totp_last_used_code  text,
        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.auth_mfa_settings ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.auth_mfa_settings FROM anon, authenticated;

    CREATE TABLE IF NOT EXISTS public.auth_mfa_recovery_codes (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid        NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
        code_hash   text        NOT NULL,
        used_at     timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, code_hash)
    );
    ALTER TABLE public.auth_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.auth_mfa_recovery_codes FROM anon, authenticated;

    CREATE TABLE IF NOT EXISTS public.otp_challenges (
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
    ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.otp_challenges FROM anon, authenticated;

    CREATE INDEX IF NOT EXISTS idx_pub_otp_user_expires ON public.otp_challenges (user_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_pub_otp_created_at ON public.otp_challenges (created_at);

    CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid        NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
        token_hash  text        NOT NULL UNIQUE,
        expires_at  timestamptz NOT NULL,
        used_at     timestamptz,
        ip_address  text,
        created_at  timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.password_reset_tokens FROM anon, authenticated;

    CREATE INDEX IF NOT EXISTS idx_pub_pwd_tokens_user_expires ON public.password_reset_tokens (user_id, expires_at);

    CREATE TABLE IF NOT EXISTS public.user_sessions (
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
    ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.user_sessions FROM anon, authenticated;

    CREATE INDEX IF NOT EXISTS idx_pub_user_sessions_user_expires ON public.user_sessions (user_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_pub_user_sessions_refresh_hash ON public.user_sessions (refresh_token_hash);

    COMMIT;
  `);

  console.log('✅ Auth tables created in public schema with RLS protection!');
  await client.end();
}

createPublicTables().catch(console.error);

