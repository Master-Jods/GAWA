-- Required before releasing the native Supabase Authenticator flow.
-- Existing ownership/moderation policies remain in force; these are additional gates.
begin;
do $$
declare
  target record;
  read_check text;
  mfa_check constant text := '(select auth.jwt()->>''aal'') = ''aal2''';
begin
  for target in select tablename from pg_tables where schemaname = 'public'
    and tablename in (
      'account_profiles','account_roles','account_statuses','account_preferences',
      'catalog_project_categories','catalog_skills','talent_profiles','talent_skills',
      'business_profiles','business_verifications','project_listings','project_moderation',
      'project_required_skills','project_saved_listings','portfolio_items','portfolio_item_skills',
      'portfolio_assets','project_applications','project_application_portfolio','project_contracts',
      'workspace_milestones','workspace_tasks','workspace_deliverables','workspace_deliverable_files',
      'messaging_conversations','messaging_participants','messaging_messages','messaging_attachments',
      'verification_assessments','verification_questions','verification_submissions','review_project_reviews',
      'moderation_reports','billing_customer_accounts','billing_transactions','billing_escrow_accounts',
      'billing_webhook_events','notification_inbox','admin_audit_events','platform_settings',
      'auth_identity_providers'
    )
  loop
    -- Before MFA, AuthContext needs only the caller's basic identity/status/roles.
    read_check := case target.tablename
      when 'account_profiles' then '(' || mfa_check || ') or id = (select auth.uid())'
      when 'account_roles' then '(' || mfa_check || ') or user_id = (select auth.uid())'
      when 'account_statuses' then '(' || mfa_check || ') or user_id = (select auth.uid())'
      when 'catalog_project_categories' then 'true'
      when 'catalog_skills' then 'true'
      else mfa_check end;
    execute format('create policy gawa_mfa_select on public.%I as restrictive for select to authenticated using (%s)', target.tablename, read_check);
    execute format('create policy gawa_mfa_insert on public.%I as restrictive for insert to authenticated with check (%s)', target.tablename, mfa_check);
    execute format('create policy gawa_mfa_update on public.%I as restrictive for update to authenticated using (%s) with check (%s)', target.tablename, mfa_check, mfa_check);
    execute format('create policy gawa_mfa_delete on public.%I as restrictive for delete to authenticated using (%s)', target.tablename, mfa_check);
  end loop;
end $$;


-- Some deployments also contain public copies of the legacy custom-auth tables.
-- They are server-only, even after MFA; never expose OTP/session/recovery hashes.
do $$
declare target record;
begin
  for target in select tablename from pg_tables where schemaname = 'public'
    and tablename in ('auth_mfa_settings','auth_mfa_recovery_codes','otp_challenges','password_reset_tokens','user_sessions')
  loop
    execute format('revoke all on public.%I from public, anon, authenticated', target.tablename);
  end loop;
end $$;

-- Public avatars remain public. Private file access and all browser file mutations
-- also require AAL2, in addition to the existing bucket/path policies.
create policy gawa_mfa_storage_select on storage.objects as restrictive for select to authenticated
using (bucket_id not like 'gawa-%' or bucket_id in ('gawa-profile-media','gawa-avatars-banners') or (select auth.jwt()->>'aal') = 'aal2');
create policy gawa_mfa_storage_insert on storage.objects as restrictive for insert to authenticated
with check (bucket_id not like 'gawa-%' or (select auth.jwt()->>'aal') = 'aal2');
create policy gawa_mfa_storage_update on storage.objects as restrictive for update to authenticated
using (bucket_id not like 'gawa-%' or (select auth.jwt()->>'aal') = 'aal2')
with check (bucket_id not like 'gawa-%' or (select auth.jwt()->>'aal') = 'aal2');
create policy gawa_mfa_storage_delete on storage.objects as restrictive for delete to authenticated
using (bucket_id not like 'gawa-%' or (select auth.jwt()->>'aal') = 'aal2');
commit;
