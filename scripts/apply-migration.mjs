import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

// Parse DATABASE_URL from .env.local if not in process.env
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (match) {
    dbUrl = match[1].trim();
  }
}

if (!dbUrl) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

console.log("Connecting to Postgres database...");
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected successfully!");

    const migrationPath = path.resolve('supabase/migrations/202611190001_auth_system.sql');
    console.log(`Reading migration from ${migrationPath}...`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log("Executing migration...");
    await client.query(sql);
    console.log("✅ Migration 202611190001_auth_system.sql applied successfully!");

    // Verify created tables
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('auth_mfa_settings', 'auth_mfa_recovery_codes', 'otp_challenges', 'password_reset_tokens', 'user_sessions', 'auth_identity_providers')
      ORDER BY table_schema, table_name;
    `);

    console.log("\nVerified authentication tables:");
    for (const row of res.rows) {
      console.log(` - ${row.table_schema}.${row.table_name}`);
    }

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

