import pg from 'pg';
import fs from 'node:fs';

const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function grantPrivileges() {
  await client.connect();
  console.log('Connected to PG');

  await client.query(`
    BEGIN;

    -- Grant table permissions to authenticated, anon, service_role
    -- RLS will enforce actual row security!
    GRANT ALL ON public.auth_mfa_settings TO authenticated, anon, service_role;
    GRANT ALL ON public.auth_mfa_recovery_codes TO authenticated, anon, service_role;
    GRANT ALL ON public.otp_challenges TO authenticated, anon, service_role;
    GRANT ALL ON public.password_reset_tokens TO authenticated, anon, service_role;
    GRANT ALL ON public.user_sessions TO authenticated, anon, service_role;
    GRANT ALL ON public.auth_identity_providers TO authenticated, anon, service_role;

    -- Ensure RLS is enabled on all tables
    ALTER TABLE public.auth_mfa_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.auth_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.auth_identity_providers ENABLE ROW LEVEL SECURITY;

    COMMIT;
  `);

  console.log('✅ Permissions granted! RLS remains strictly active.');
  await client.end();
}

grantPrivileges().catch(console.error);

