// Disposable PostgreSQL validation only; never uses DATABASE_URL.
// node scripts/validate-mfa-policy.mjs /path/to/pglite/dist/index.js
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]||'@electric-sql/pglite');
const db=new PGlite();
try {
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create schema storage;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true)) $$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on all functions in schema auth to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
for(const file of ['202611170001_gawa_baseline.sql','202611180001_profile_media_bucket.sql','202611190001_auth_system.sql','20261120103231_mandatory_authenticator.sql']){
 if (file.includes('mandatory_authenticator')) {
   for (const name of ['auth_mfa_settings','auth_mfa_recovery_codes','otp_challenges','password_reset_tokens','user_sessions']) {
     await db.exec(`create table public.${name}(id uuid);grant all on public.${name} to anon,authenticated;`);
   }
 }
 await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
}
assert.equal((await db.query("select has_table_privilege('anon','public.otp_challenges','SELECT') as allowed")).rows[0].allowed,false);
assert.equal((await db.query("select has_table_privilege('authenticated','public.auth_mfa_settings','UPDATE') as allowed")).rows[0].allowed,false);
const uid='00000000-0000-0000-0000-000000000001';
await db.query('insert into auth.users values($1,$2)',[uid,{role:'talent',display_name:'Test'}]);
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${uid}',false);select set_config('request.jwt.claim.aal','aal1',false);`);
assert.equal((await db.query('select * from public.account_roles')).rows.length,1,'Own role is readable before enrollment');
assert.equal((await db.query('select * from public.account_statuses')).rows.length,1);
assert.equal((await db.query('select * from public.catalog_skills')).rows.length,44);
assert.equal((await db.query("update public.account_profiles set bio='blocked' returning id")).rows.length,0,'AAL1 cannot mutate its own profile');
assert.equal((await db.query('select * from public.account_preferences')).rows.length,0,'AAL1 cannot read application preferences');
await db.exec("select set_config('request.jwt.claim.aal','aal2',false)");
assert.equal((await db.query("update public.account_profiles set bio='allowed' returning id")).rows.length,1);
assert.equal((await db.query('select * from public.account_preferences')).rows.length,1);
await db.exec('reset role');
await db.query('insert into auth.users values($1,$2)', ['00000000-0000-0000-0000-000000000002',{display_name:'Other'}]);
// Existing ownership rules still apply at AAL2.
await db.exec(`set role authenticated;`);
assert.equal((await db.query("update public.account_profiles set bio='forged' where id<>$1 returning id",[uid])).rows.length,0);
await db.exec('reset role;set role anon');
assert.equal((await db.query('select * from public.catalog_project_categories')).rows.length,5);
console.log('PASS: baseline and MFA migration, AAL1 bootstrap reads, blocked AAL1 writes/private reads, allowed AAL2 owner access, cross-user denial, and unchanged anonymous catalogs.');
}finally{await db.close();}
