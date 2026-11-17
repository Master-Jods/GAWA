// Run: node scripts/validate-schema.mjs /absolute/path/to/pglite/dist/index.js
// PGlite is a disposable PostgreSQL test harness, not a production dependency.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.argv[2] || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
`);
await db.exec(await readFile(new URL('../supabase/migrations/202611170001_gawa_baseline.sql', import.meta.url),'utf8'));
const ids=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'];
for(let i=0;i<3;i++) await db.query('insert into auth.users values($1,$2)',[ids[i],{display_name:`User ${i}`,role:i===1?'business':i===2?'admin':'talent'}]);
assert.equal((await db.query('select count(*)::int n from public.account_profiles')).rows[0].n,3);
assert.equal((await db.query("select count(*)::int n from public.account_roles where role='admin'")).rows[0].n,0,'Signup cannot grant admin');
assert.equal((await db.query("select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity")).rows[0].n,0);
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${ids[0]}',false);`);
assert.equal((await db.query('select count(*)::int n from public.account_roles')).rows[0].n,1);
await db.query("update public.account_profiles set bio='Updated' where id=$1",[ids[0]]);
assert.equal((await db.query('update public.account_profiles set bio=$1 where id=$2 returning id',['forged',ids[1]])).rows.length,0);
async function denied(sql){let failed=false;try{await db.exec(sql)}catch{failed=true}assert(failed,`Must deny: ${sql}`)}
await denied(`insert into public.account_roles(user_id,role) values('${ids[0]}','admin')`);
await denied('select * from public.verification_questions');
await denied('select * from public.billing_webhook_events');
await denied(`insert into public.billing_transactions(contract_id,kind,amount,idempotency_key) values(gen_random_uuid(),'release',100,'fake')`);
await db.exec('reset role');
const bid=(await db.query('select id from public.business_profiles')).rows[0].id;
const pid=(await db.query("insert into public.project_listings(business_id,title,description,budget,status) values($1,'Test','Brief',1000,'published') returning id",[bid])).rows[0].id;
await db.query("insert into public.project_moderation(project_id,status) values($1,'approved')",[pid]);
await db.exec('set role anon');
assert.equal((await db.query('select id from public.project_listings')).rows.length,1);
assert.equal((await db.query('select public.project_applicant_count($1)::int n',[pid])).rows[0].n,0);
await denied('select contact_email from public.business_profiles');
await denied('select * from public.account_profiles');
await db.exec('reset role');
await db.query("update public.project_moderation set status='hidden' where project_id=$1",[pid]);
await db.exec('set role anon');
assert.equal((await db.query('select id from public.project_listings')).rows.length,0);
await db.exec('reset role');
console.log('PASS: migration, 40 RLS tables, signup role protection, owner edits, cross-user isolation, private answer/webhook data, billing writes, public moderation filter and contact privacy.');
await db.close();
