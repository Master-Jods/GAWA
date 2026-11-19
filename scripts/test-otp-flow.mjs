import pg from 'pg';
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function testE2E() {
  await client.connect();
  
  // Find a test user from account_profiles
  const userRes = await client.query('SELECT u.id, u.email FROM auth.users u JOIN public.account_profiles p ON p.id = u.id LIMIT 1;');
  if (userRes.rows.length === 0) {
    console.log('No user in database');
    await client.end();
    return;
  }
  const testUser = userRes.rows[0];
  console.log('Testing with user:', testUser.email, testUser.id);

  // Directly insert an OTP challenge into public.otp_challenges
  const rawCode = '654321';
  const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await client.query(
    'INSERT INTO public.otp_challenges (id, user_id, channel, code_hash, expires_at, attempt_count) VALUES ($1, $2, $3, $4, $5, 0)',
    [challengeId, testUser.id, 'email', codeHash, expiresAt]
  );
  console.log('Inserted challenge:', challengeId);

  // Now call /api/auth/otp/verify via fetch
  const verifyRes = await fetch('http://localhost:3000/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gawa-csrf': '1', 'x-forwarded-for': '10.0.0.99' },
    body: JSON.stringify({
      challenge_id: challengeId,
      code: rawCode,
      user_id: testUser.id,
    }),
  });

  const verifyData = await verifyRes.json();
  console.log('Verify Status:', verifyRes.status);
  console.log('Verify Response (authenticated):', verifyData.authenticated);

  // Check that used_at was set in database
  const checkRes = await client.query('SELECT id, used_at, attempt_count FROM public.otp_challenges WHERE id = $1', [challengeId]);
  console.log('DB row after verify:', checkRes.rows[0]);

  // Try verifying again (replay prevention)
  const replayRes = await fetch('http://localhost:3000/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gawa-csrf': '1', 'x-forwarded-for': '10.0.0.98' },
    body: JSON.stringify({
      challenge_id: challengeId,
      code: rawCode,
      user_id: testUser.id,
    }),
  });
  console.log('Replay Verify Status (should be 410):', replayRes.status);
  const replayData = await replayRes.json();
  console.log('Replay Response error:', replayData.error);

  await client.end();
}

testE2E().catch(console.error);

