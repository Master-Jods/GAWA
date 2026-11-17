-- GAWA: baseline for the current React prototype. Apply once through migrations.

begin;

create schema if not exists private;

revoke all on schema private from public;

grant usage on schema private to authenticated, service_role;

create table public.account_profiles (
  id uuid primary key references auth.users(id) on delete cascade, display_name text not null, bio text, avatar_path text, avatar_color text default '#087EAD', location text, profile_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_roles (
  user_id uuid not null references public.account_profiles(id) on delete cascade, role text not null check (role in ('talent','business','admin')), primary key(user_id,role),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_statuses (
  user_id uuid not null references public.account_profiles(id) on delete cascade primary key, status text not null default 'active' check(status in ('active','suspended','closed')), reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_preferences (
  user_id uuid not null references public.account_profiles(id) on delete cascade primary key, email_notifications boolean not null default true, project_notifications boolean not null default true, message_notifications boolean not null default true, onboarding_step integer not null default 1 check(onboarding_step>0), onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_project_categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_skills (
  id uuid primary key default gen_random_uuid(), name text not null unique, category_id uuid references public.catalog_project_categories(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.talent_profiles (
  user_id uuid not null references public.account_profiles(id) on delete cascade primary key, headline text, school text, course text, availability text, remote_work boolean not null default true, onsite_work boolean not null default false, hybrid_work boolean not null default false, short_term_work boolean not null default true, long_term_work boolean not null default true, preferred_location text, minimum_budget numeric(14,2) check(minimum_budget>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.talent_skills (
  talent_id uuid not null references public.account_profiles(id) on delete cascade, skill_id uuid not null references public.catalog_skills(id), proficiency text not null default 'intermediate' check(proficiency in ('beginner','intermediate','advanced')), primary key(talent_id,skill_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_profiles (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.account_profiles(id), name text not null check(length(trim(name))>0), industry text, company_size text, description text, contact_name text, contact_email text, location text, website_url text, logo_path text, avatar_color text default '#087EAD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_verifications (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.business_profiles(id), status text not null default 'pending' check(status in ('pending','verified','rejected')), evidence_paths text[] not null default '{}', reviewed_by uuid references public.account_profiles(id), reviewed_at timestamptz, review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_listings (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.business_profiles(id), category_id uuid references public.catalog_project_categories(id), title text not null check(length(trim(title))>0), description text not null, objectives text[] not null default '{}', expected_deliverables text[] not null default '{}', budget numeric(14,2) not null check(budget>=0), currency text not null default 'PHP' check(currency='PHP'), duration_label text, application_deadline date, work_setup text not null default 'remote' check(work_setup in ('remote','onsite','hybrid')), location text, status text not null default 'draft' check(status in ('draft','published','closed','active','completed','cancelled')), published_at timestamptz, completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_moderation (
  project_id uuid not null references public.project_listings(id) primary key, status text not null default 'pending' check(status in ('pending','approved','rejected','hidden')), featured boolean not null default false, reviewed_by uuid references public.account_profiles(id), reviewed_at timestamptz, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_required_skills (
  project_id uuid not null references public.project_listings(id) on delete cascade, skill_id uuid not null references public.catalog_skills(id), primary key(project_id,skill_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_saved_listings (
  talent_id uuid not null references public.account_profiles(id) on delete cascade, project_id uuid not null references public.project_listings(id) on delete cascade, primary key(talent_id,project_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(), talent_id uuid not null references public.account_profiles(id), project_id uuid references public.project_listings(id), title text not null, description text, cover_path text, external_url text, is_public boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolio_item_skills (
  portfolio_item_id uuid not null references public.portfolio_items(id) on delete cascade, skill_id uuid not null references public.catalog_skills(id), primary key(portfolio_item_id,skill_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolio_assets (
  id uuid primary key default gen_random_uuid(), portfolio_item_id uuid not null references public.portfolio_items(id) on delete cascade, storage_path text not null, file_name text not null, mime_type text, size_bytes bigint check(size_bytes>=0), sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_applications (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.project_listings(id), talent_id uuid not null references public.account_profiles(id), proposal text not null check(length(trim(proposal))>0), status text not null default 'submitted' check(status in ('submitted','shortlisted','interview','accepted','rejected','withdrawn')), proposed_budget numeric(14,2) check(proposed_budget>=0), submitted_at timestamptz not null default now(), unique(project_id,talent_id), unique(id,project_id,talent_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_application_portfolio (
  application_id uuid not null references public.project_applications(id) on delete cascade, portfolio_item_id uuid not null references public.portfolio_items(id), primary key(application_id,portfolio_item_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_contracts (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.project_listings(id), talent_id uuid not null references public.account_profiles(id), application_id uuid not null unique, agreed_amount numeric(14,2) not null check(agreed_amount>=0), platform_fee_rate numeric(5,4) not null default .05 check(platform_fee_rate between 0 and 1), status text not null default 'active' check(status in ('active','completed','cancelled','disputed')), starts_at timestamptz not null default now(), due_at timestamptz, completed_at timestamptz, unique(project_id,talent_id), foreign key(application_id,project_id,talent_id) references public.project_applications(id,project_id,talent_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_milestones (
  id uuid primary key default gen_random_uuid(), contract_id uuid not null references public.project_contracts(id), title text not null, description text, due_at timestamptz, status text not null default 'pending' check(status in ('pending','in_progress','submitted','completed')), sort_order integer not null default 0, completed_at timestamptz, unique(id,contract_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_tasks (
  id uuid primary key default gen_random_uuid(), milestone_id uuid not null references public.workspace_milestones(id) on delete cascade, title text not null, assigned_to uuid references public.account_profiles(id), is_done boolean not null default false, due_at timestamptz, sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_deliverables (
  id uuid primary key default gen_random_uuid(), contract_id uuid not null references public.project_contracts(id), milestone_id uuid, submitted_by uuid not null references public.account_profiles(id), title text not null, notes text, external_url text, status text not null default 'submitted' check(status in ('submitted','revision_requested','approved')), reviewed_by uuid references public.account_profiles(id), reviewed_at timestamptz, review_notes text, foreign key(milestone_id,contract_id) references public.workspace_milestones(id,contract_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_deliverable_files (
  id uuid primary key default gen_random_uuid(), deliverable_id uuid not null references public.workspace_deliverables(id) on delete cascade, storage_path text not null, file_name text not null, mime_type text, size_bytes bigint check(size_bytes>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messaging_conversations (
  id uuid primary key default gen_random_uuid(), project_id uuid references public.project_listings(id), subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messaging_participants (
  conversation_id uuid not null references public.messaging_conversations(id) on delete cascade, user_id uuid not null references public.account_profiles(id), last_read_at timestamptz, primary key(conversation_id,user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messaging_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.messaging_conversations(id), sender_id uuid not null references public.account_profiles(id), body text not null default '', edited_at timestamptz, deleted_at timestamptz, foreign key(conversation_id,sender_id) references public.messaging_participants(conversation_id,user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messaging_attachments (
  id uuid primary key default gen_random_uuid(), message_id uuid not null references public.messaging_messages(id) on delete cascade, storage_path text not null, file_name text not null, mime_type text, size_bytes bigint check(size_bytes>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.verification_assessments (
  id uuid primary key default gen_random_uuid(), skill_id uuid not null references public.catalog_skills(id), title text not null, description text, question_count integer not null default 12 check(question_count>0), duration_minutes integer not null default 15 check(duration_minutes>0), passing_score numeric(5,2) not null default 80 check(passing_score between 0 and 100), is_active boolean not null default true, version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.verification_questions (
  id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.verification_assessments(id), prompt text not null, options jsonb not null default '[]', correct_answer jsonb not null, points integer not null default 1 check(points>0), sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.verification_submissions (
  id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.verification_assessments(id), talent_id uuid not null references public.account_profiles(id), answers jsonb not null default '{}', evidence_paths text[] not null default '{}', status text not null default 'in_progress' check(status in ('in_progress','submitted','in_review','verified','rejected','expired')), score numeric(5,2) check(score between 0 and 100), submitted_at timestamptz, reviewed_by uuid references public.account_profiles(id), reviewed_at timestamptz, review_notes text, expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_project_reviews (
  id uuid primary key default gen_random_uuid(), contract_id uuid not null references public.project_contracts(id), reviewer_id uuid not null references public.account_profiles(id), reviewee_id uuid not null references public.account_profiles(id), rating smallint not null check(rating between 1 and 5), feedback text, status text not null default 'published' check(status in ('published','hidden')), check(reviewer_id<>reviewee_id), unique(contract_id,reviewer_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.account_profiles(id), reported_user_id uuid references public.account_profiles(id), project_id uuid references public.project_listings(id), review_id uuid references public.review_project_reviews(id), message_id uuid references public.messaging_messages(id), reason text not null, details text, status text not null default 'open' check(status in ('open','investigating','resolved','dismissed')), assigned_admin_id uuid references public.account_profiles(id), resolution text, resolved_at timestamptz, check(num_nonnulls(reported_user_id,project_id,review_id,message_id)=1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_customer_accounts (
  id uuid primary key default gen_random_uuid(), business_id uuid not null unique references public.business_profiles(id), provider text not null, provider_customer_id text not null, billing_email text, unique(provider,provider_customer_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_transactions (
  id uuid primary key default gen_random_uuid(), contract_id uuid not null references public.project_contracts(id), kind text not null check(kind in ('funding','release','refund','fee','payout')), status text not null default 'pending' check(status in ('pending','processing','succeeded','failed','cancelled')), amount numeric(14,2) not null check(amount>0), currency text not null default 'PHP' check(currency='PHP'), provider text, provider_reference text, idempotency_key text not null unique, processed_at timestamptz, unique(provider,provider_reference),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_escrow_accounts (
  contract_id uuid not null primary key references public.project_contracts(id), funded_amount numeric(14,2) not null default 0 check(funded_amount>=0), released_amount numeric(14,2) not null default 0 check(released_amount>=0), refunded_amount numeric(14,2) not null default 0 check(refunded_amount>=0), check(released_amount+refunded_amount<=funded_amount),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(), provider text not null, event_id text not null, payload jsonb not null, processed_at timestamptz, error text, unique(provider,event_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_inbox (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.account_profiles(id) on delete cascade, kind text not null, title text not null, body text, project_id uuid references public.project_listings(id), conversation_id uuid references public.messaging_conversations(id), read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.account_profiles(id), action text not null, entity_table text not null, entity_id text, details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key, value jsonb not null, description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end $$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.account_roles r join public.account_statuses s on s.user_id=r.user_id where r.user_id=auth.uid() and r.role='admin' and s.status='active'); $$;
create function private.is_active() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.account_statuses where user_id=auth.uid() and status='active'); $$;
create function private.has_role(wanted text) returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_active() and exists(select 1 from public.account_roles where user_id=auth.uid() and role=wanted); $$;
create function private.owns_business(bid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_active() and exists(select 1 from public.business_profiles where id=bid and owner_id=auth.uid()); $$;
create function private.owns_project(pid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.project_listings where id=pid and private.owns_business(business_id)); $$;
create function private.in_contract(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_active() and exists(select 1 from public.project_contracts where id=cid and (talent_id=auth.uid() or private.owns_project(project_id))); $$;
create function private.in_conversation(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_active() and exists(select 1 from public.messaging_participants where conversation_id=cid and user_id=auth.uid()); $$;
create function private.can_read_project(pid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_admin() or private.owns_project(pid) or exists(select 1 from public.project_listings p join public.project_moderation m on m.project_id=p.id where p.id=pid and p.status='published' and m.status='approved') or (private.is_active() and exists(select 1 from public.project_contracts where project_id=pid and talent_id=auth.uid())); $$;
create function private.can_read_portfolio(pid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.portfolio_items p join public.account_profiles a on a.id=p.talent_id where p.id=pid and (p.talent_id=auth.uid() or (p.is_public and a.profile_visible and private.is_active()))) or private.is_admin(); $$;
create function private.handle_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.account_profiles(id,display_name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'GAWA member'));
 insert into public.account_statuses(user_id) values(new.id);
 insert into public.account_preferences(user_id) values(new.id);
 -- Only talent/business may be selected by signup metadata. Admin is provisioned by a trusted operator.
 insert into public.account_roles(user_id,role) values(new.id,case when new.raw_user_meta_data->>'role'='business' then 'business' else 'talent' end);
 if new.raw_user_meta_data->>'role'='business' then
 insert into public.business_profiles(owner_id,name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'business_name',''),'My business'));
 else insert into public.talent_profiles(user_id) values(new.id); end if;
 return new;
end $$;
create trigger gawa_auth_signup after insert on auth.users for each row execute function private.handle_signup();
-- Existing Auth accounts get a safe default talent identity; operator may assign business separately.
insert into public.account_profiles(id,display_name) select id,coalesce(nullif(raw_user_meta_data->>'display_name',''),'GAWA member') from auth.users on conflict do nothing;
insert into public.account_statuses(user_id) select id from public.account_profiles on conflict do nothing;
insert into public.account_preferences(user_id) select id from public.account_profiles on conflict do nothing;
insert into public.account_roles(user_id,role) select id,'talent' from public.account_profiles on conflict do nothing;
insert into public.talent_profiles(user_id) select id from public.account_profiles on conflict do nothing;


alter table public.account_profiles enable row level security;

revoke all on public.account_profiles from anon, authenticated;

grant all on public.account_profiles to service_role;

create trigger touch_updated_at before update on public.account_profiles for each row execute function private.touch_updated_at();

grant select on public.account_profiles to authenticated;

create policy admin_read on public.account_profiles for select to authenticated using (private.is_admin());

alter table public.account_roles enable row level security;

revoke all on public.account_roles from anon, authenticated;

grant all on public.account_roles to service_role;

create trigger touch_updated_at before update on public.account_roles for each row execute function private.touch_updated_at();

grant select on public.account_roles to authenticated;

create policy admin_read on public.account_roles for select to authenticated using (private.is_admin());

alter table public.account_statuses enable row level security;

revoke all on public.account_statuses from anon, authenticated;

grant all on public.account_statuses to service_role;

create trigger touch_updated_at before update on public.account_statuses for each row execute function private.touch_updated_at();

grant select on public.account_statuses to authenticated;

create policy admin_read on public.account_statuses for select to authenticated using (private.is_admin());

alter table public.account_preferences enable row level security;

revoke all on public.account_preferences from anon, authenticated;

grant all on public.account_preferences to service_role;

create trigger touch_updated_at before update on public.account_preferences for each row execute function private.touch_updated_at();

grant select on public.account_preferences to authenticated;

create policy admin_read on public.account_preferences for select to authenticated using (private.is_admin());

alter table public.catalog_project_categories enable row level security;

revoke all on public.catalog_project_categories from anon, authenticated;

grant all on public.catalog_project_categories to service_role;

create trigger touch_updated_at before update on public.catalog_project_categories for each row execute function private.touch_updated_at();

grant select on public.catalog_project_categories to authenticated;

create policy admin_read on public.catalog_project_categories for select to authenticated using (private.is_admin());

alter table public.catalog_skills enable row level security;

revoke all on public.catalog_skills from anon, authenticated;

grant all on public.catalog_skills to service_role;

create trigger touch_updated_at before update on public.catalog_skills for each row execute function private.touch_updated_at();

grant select on public.catalog_skills to authenticated;

create policy admin_read on public.catalog_skills for select to authenticated using (private.is_admin());

alter table public.talent_profiles enable row level security;

revoke all on public.talent_profiles from anon, authenticated;

grant all on public.talent_profiles to service_role;

create trigger touch_updated_at before update on public.talent_profiles for each row execute function private.touch_updated_at();

grant select on public.talent_profiles to authenticated;

create policy admin_read on public.talent_profiles for select to authenticated using (private.is_admin());

alter table public.talent_skills enable row level security;

revoke all on public.talent_skills from anon, authenticated;

grant all on public.talent_skills to service_role;

create trigger touch_updated_at before update on public.talent_skills for each row execute function private.touch_updated_at();

grant select on public.talent_skills to authenticated;

create policy admin_read on public.talent_skills for select to authenticated using (private.is_admin());

alter table public.business_profiles enable row level security;

revoke all on public.business_profiles from anon, authenticated;

grant all on public.business_profiles to service_role;

create trigger touch_updated_at before update on public.business_profiles for each row execute function private.touch_updated_at();

grant select on public.business_profiles to authenticated;

create policy admin_read on public.business_profiles for select to authenticated using (private.is_admin());

alter table public.business_verifications enable row level security;

revoke all on public.business_verifications from anon, authenticated;

grant all on public.business_verifications to service_role;

create trigger touch_updated_at before update on public.business_verifications for each row execute function private.touch_updated_at();

grant select on public.business_verifications to authenticated;

create policy admin_read on public.business_verifications for select to authenticated using (private.is_admin());

alter table public.project_listings enable row level security;

revoke all on public.project_listings from anon, authenticated;

grant all on public.project_listings to service_role;

create trigger touch_updated_at before update on public.project_listings for each row execute function private.touch_updated_at();

grant select on public.project_listings to authenticated;

create policy admin_read on public.project_listings for select to authenticated using (private.is_admin());

alter table public.project_moderation enable row level security;

revoke all on public.project_moderation from anon, authenticated;

grant all on public.project_moderation to service_role;

create trigger touch_updated_at before update on public.project_moderation for each row execute function private.touch_updated_at();

grant select on public.project_moderation to authenticated;

create policy admin_read on public.project_moderation for select to authenticated using (private.is_admin());

alter table public.project_required_skills enable row level security;

revoke all on public.project_required_skills from anon, authenticated;

grant all on public.project_required_skills to service_role;

create trigger touch_updated_at before update on public.project_required_skills for each row execute function private.touch_updated_at();

grant select on public.project_required_skills to authenticated;

create policy admin_read on public.project_required_skills for select to authenticated using (private.is_admin());

alter table public.project_saved_listings enable row level security;

revoke all on public.project_saved_listings from anon, authenticated;

grant all on public.project_saved_listings to service_role;

create trigger touch_updated_at before update on public.project_saved_listings for each row execute function private.touch_updated_at();

grant select on public.project_saved_listings to authenticated;

create policy admin_read on public.project_saved_listings for select to authenticated using (private.is_admin());

alter table public.portfolio_items enable row level security;

revoke all on public.portfolio_items from anon, authenticated;

grant all on public.portfolio_items to service_role;

create trigger touch_updated_at before update on public.portfolio_items for each row execute function private.touch_updated_at();

grant select on public.portfolio_items to authenticated;

create policy admin_read on public.portfolio_items for select to authenticated using (private.is_admin());

alter table public.portfolio_item_skills enable row level security;

revoke all on public.portfolio_item_skills from anon, authenticated;

grant all on public.portfolio_item_skills to service_role;

create trigger touch_updated_at before update on public.portfolio_item_skills for each row execute function private.touch_updated_at();

grant select on public.portfolio_item_skills to authenticated;

create policy admin_read on public.portfolio_item_skills for select to authenticated using (private.is_admin());

alter table public.portfolio_assets enable row level security;

revoke all on public.portfolio_assets from anon, authenticated;

grant all on public.portfolio_assets to service_role;

create trigger touch_updated_at before update on public.portfolio_assets for each row execute function private.touch_updated_at();

grant select on public.portfolio_assets to authenticated;

create policy admin_read on public.portfolio_assets for select to authenticated using (private.is_admin());

alter table public.project_applications enable row level security;

revoke all on public.project_applications from anon, authenticated;

grant all on public.project_applications to service_role;

create trigger touch_updated_at before update on public.project_applications for each row execute function private.touch_updated_at();

grant select on public.project_applications to authenticated;

create policy admin_read on public.project_applications for select to authenticated using (private.is_admin());

alter table public.project_application_portfolio enable row level security;

revoke all on public.project_application_portfolio from anon, authenticated;

grant all on public.project_application_portfolio to service_role;

create trigger touch_updated_at before update on public.project_application_portfolio for each row execute function private.touch_updated_at();

grant select on public.project_application_portfolio to authenticated;

create policy admin_read on public.project_application_portfolio for select to authenticated using (private.is_admin());

alter table public.project_contracts enable row level security;

revoke all on public.project_contracts from anon, authenticated;

grant all on public.project_contracts to service_role;

create trigger touch_updated_at before update on public.project_contracts for each row execute function private.touch_updated_at();

grant select on public.project_contracts to authenticated;

create policy admin_read on public.project_contracts for select to authenticated using (private.is_admin());

alter table public.workspace_milestones enable row level security;

revoke all on public.workspace_milestones from anon, authenticated;

grant all on public.workspace_milestones to service_role;

create trigger touch_updated_at before update on public.workspace_milestones for each row execute function private.touch_updated_at();

grant select on public.workspace_milestones to authenticated;

create policy admin_read on public.workspace_milestones for select to authenticated using (private.is_admin());

alter table public.workspace_tasks enable row level security;

revoke all on public.workspace_tasks from anon, authenticated;

grant all on public.workspace_tasks to service_role;

create trigger touch_updated_at before update on public.workspace_tasks for each row execute function private.touch_updated_at();

grant select on public.workspace_tasks to authenticated;

create policy admin_read on public.workspace_tasks for select to authenticated using (private.is_admin());

alter table public.workspace_deliverables enable row level security;

revoke all on public.workspace_deliverables from anon, authenticated;

grant all on public.workspace_deliverables to service_role;

create trigger touch_updated_at before update on public.workspace_deliverables for each row execute function private.touch_updated_at();

grant select on public.workspace_deliverables to authenticated;

create policy admin_read on public.workspace_deliverables for select to authenticated using (private.is_admin());

alter table public.workspace_deliverable_files enable row level security;

revoke all on public.workspace_deliverable_files from anon, authenticated;

grant all on public.workspace_deliverable_files to service_role;

create trigger touch_updated_at before update on public.workspace_deliverable_files for each row execute function private.touch_updated_at();

grant select on public.workspace_deliverable_files to authenticated;

create policy admin_read on public.workspace_deliverable_files for select to authenticated using (private.is_admin());

alter table public.messaging_conversations enable row level security;

revoke all on public.messaging_conversations from anon, authenticated;

grant all on public.messaging_conversations to service_role;

create trigger touch_updated_at before update on public.messaging_conversations for each row execute function private.touch_updated_at();

grant select on public.messaging_conversations to authenticated;

create policy admin_read on public.messaging_conversations for select to authenticated using (private.is_admin());

alter table public.messaging_participants enable row level security;

revoke all on public.messaging_participants from anon, authenticated;

grant all on public.messaging_participants to service_role;

create trigger touch_updated_at before update on public.messaging_participants for each row execute function private.touch_updated_at();

grant select on public.messaging_participants to authenticated;

create policy admin_read on public.messaging_participants for select to authenticated using (private.is_admin());

alter table public.messaging_messages enable row level security;

revoke all on public.messaging_messages from anon, authenticated;

grant all on public.messaging_messages to service_role;

create trigger touch_updated_at before update on public.messaging_messages for each row execute function private.touch_updated_at();

grant select on public.messaging_messages to authenticated;

create policy admin_read on public.messaging_messages for select to authenticated using (private.is_admin());

alter table public.messaging_attachments enable row level security;

revoke all on public.messaging_attachments from anon, authenticated;

grant all on public.messaging_attachments to service_role;

create trigger touch_updated_at before update on public.messaging_attachments for each row execute function private.touch_updated_at();

grant select on public.messaging_attachments to authenticated;

create policy admin_read on public.messaging_attachments for select to authenticated using (private.is_admin());

alter table public.verification_assessments enable row level security;

revoke all on public.verification_assessments from anon, authenticated;

grant all on public.verification_assessments to service_role;

create trigger touch_updated_at before update on public.verification_assessments for each row execute function private.touch_updated_at();

grant select on public.verification_assessments to authenticated;

create policy admin_read on public.verification_assessments for select to authenticated using (private.is_admin());

alter table public.verification_questions enable row level security;

revoke all on public.verification_questions from anon, authenticated;

grant all on public.verification_questions to service_role;

create trigger touch_updated_at before update on public.verification_questions for each row execute function private.touch_updated_at();

grant select on public.verification_questions to authenticated;

create policy admin_read on public.verification_questions for select to authenticated using (private.is_admin());

alter table public.verification_submissions enable row level security;

revoke all on public.verification_submissions from anon, authenticated;

grant all on public.verification_submissions to service_role;

create trigger touch_updated_at before update on public.verification_submissions for each row execute function private.touch_updated_at();

grant select on public.verification_submissions to authenticated;

create policy admin_read on public.verification_submissions for select to authenticated using (private.is_admin());

alter table public.review_project_reviews enable row level security;

revoke all on public.review_project_reviews from anon, authenticated;

grant all on public.review_project_reviews to service_role;

create trigger touch_updated_at before update on public.review_project_reviews for each row execute function private.touch_updated_at();

grant select on public.review_project_reviews to authenticated;

create policy admin_read on public.review_project_reviews for select to authenticated using (private.is_admin());

alter table public.moderation_reports enable row level security;

revoke all on public.moderation_reports from anon, authenticated;

grant all on public.moderation_reports to service_role;

create trigger touch_updated_at before update on public.moderation_reports for each row execute function private.touch_updated_at();

grant select on public.moderation_reports to authenticated;

create policy admin_read on public.moderation_reports for select to authenticated using (private.is_admin());

alter table public.billing_customer_accounts enable row level security;

revoke all on public.billing_customer_accounts from anon, authenticated;

grant all on public.billing_customer_accounts to service_role;

create trigger touch_updated_at before update on public.billing_customer_accounts for each row execute function private.touch_updated_at();

grant select on public.billing_customer_accounts to authenticated;

create policy admin_read on public.billing_customer_accounts for select to authenticated using (private.is_admin());

alter table public.billing_transactions enable row level security;

revoke all on public.billing_transactions from anon, authenticated;

grant all on public.billing_transactions to service_role;

create trigger touch_updated_at before update on public.billing_transactions for each row execute function private.touch_updated_at();

grant select on public.billing_transactions to authenticated;

create policy admin_read on public.billing_transactions for select to authenticated using (private.is_admin());

alter table public.billing_escrow_accounts enable row level security;

revoke all on public.billing_escrow_accounts from anon, authenticated;

grant all on public.billing_escrow_accounts to service_role;

create trigger touch_updated_at before update on public.billing_escrow_accounts for each row execute function private.touch_updated_at();

grant select on public.billing_escrow_accounts to authenticated;

create policy admin_read on public.billing_escrow_accounts for select to authenticated using (private.is_admin());

alter table public.billing_webhook_events enable row level security;

revoke all on public.billing_webhook_events from anon, authenticated;

grant all on public.billing_webhook_events to service_role;

create trigger touch_updated_at before update on public.billing_webhook_events for each row execute function private.touch_updated_at();

alter table public.notification_inbox enable row level security;

revoke all on public.notification_inbox from anon, authenticated;

grant all on public.notification_inbox to service_role;

create trigger touch_updated_at before update on public.notification_inbox for each row execute function private.touch_updated_at();

grant select on public.notification_inbox to authenticated;

create policy admin_read on public.notification_inbox for select to authenticated using (private.is_admin());

alter table public.admin_audit_events enable row level security;

revoke all on public.admin_audit_events from anon, authenticated;

grant all on public.admin_audit_events to service_role;

create trigger touch_updated_at before update on public.admin_audit_events for each row execute function private.touch_updated_at();

grant select on public.admin_audit_events to authenticated;

create policy admin_read on public.admin_audit_events for select to authenticated using (private.is_admin());

alter table public.platform_settings enable row level security;

revoke all on public.platform_settings from anon, authenticated;

grant all on public.platform_settings to service_role;

create trigger touch_updated_at before update on public.platform_settings for each row execute function private.touch_updated_at();

grant select on public.platform_settings to authenticated;

create policy admin_read on public.platform_settings for select to authenticated using (private.is_admin());

create policy member_read on public.account_profiles for select to authenticated using (id=auth.uid() or (private.is_active() and profile_visible));

grant update (display_name,bio,avatar_path,avatar_color,location,profile_visible) on public.account_profiles to authenticated;

create policy member_update on public.account_profiles for update to authenticated using (private.is_active() and (id=auth.uid())) with check (private.is_active() and (id=auth.uid()));

create policy member_read on public.account_roles for select to authenticated using (user_id=auth.uid());

create policy member_read on public.account_statuses for select to authenticated using (user_id=auth.uid());

create policy member_read on public.account_preferences for select to authenticated using (user_id=auth.uid());

grant update (email_notifications,project_notifications,message_notifications,onboarding_step,onboarding_completed_at) on public.account_preferences to authenticated;

create policy member_update on public.account_preferences for update to authenticated using (private.is_active() and (user_id=auth.uid())) with check (private.is_active() and (user_id=auth.uid()));

create policy member_read on public.catalog_project_categories for select to authenticated using (true);

grant select on public.catalog_project_categories to anon;

create policy visitor_read on public.catalog_project_categories for select to anon using (true);

create policy member_read on public.catalog_skills for select to authenticated using (true);

grant select on public.catalog_skills to anon;

create policy visitor_read on public.catalog_skills for select to anon using (true);

create policy member_read on public.talent_profiles for select to authenticated using (user_id=auth.uid() or (private.is_active() and exists(select 1 from public.account_profiles where id=user_id and profile_visible)));

grant update (headline,school,course,availability,remote_work,onsite_work,hybrid_work,short_term_work,long_term_work,preferred_location,minimum_budget) on public.talent_profiles to authenticated;

create policy member_update on public.talent_profiles for update to authenticated using (private.is_active() and (user_id=auth.uid())) with check (private.is_active() and (user_id=auth.uid()));

create policy member_read on public.talent_skills for select to authenticated using (talent_id=auth.uid() or (private.is_active() and exists(select 1 from public.account_profiles where id=talent_id and profile_visible)));

grant insert on public.talent_skills to authenticated;

create policy member_insert on public.talent_skills for insert to authenticated with check (private.is_active() and (talent_id=auth.uid() and private.has_role('talent')));

grant update (proficiency) on public.talent_skills to authenticated;

create policy member_update on public.talent_skills for update to authenticated using (private.is_active() and (talent_id=auth.uid() and private.has_role('talent'))) with check (private.is_active() and (talent_id=auth.uid() and private.has_role('talent')));

grant delete on public.talent_skills to authenticated;

create policy member_delete on public.talent_skills for delete to authenticated using (private.is_active() and (talent_id=auth.uid() and private.has_role('talent')));

create policy member_read on public.business_profiles for select to authenticated using (private.is_active() or exists(select 1 from public.project_listings p where p.business_id=business_profiles.id and private.can_read_project(p.id)));

grant select on public.business_profiles to anon;

create policy visitor_read on public.business_profiles for select to anon using (private.is_active() or exists(select 1 from public.project_listings p where p.business_id=business_profiles.id and private.can_read_project(p.id)));

revoke select on public.business_profiles from anon, authenticated;

grant select(id,owner_id,name,industry,company_size,description,location,website_url,logo_path,avatar_color,created_at,updated_at) on public.business_profiles to anon,authenticated;

grant update (name,industry,company_size,description,contact_name,contact_email,location,website_url,logo_path,avatar_color) on public.business_profiles to authenticated;

create policy member_update on public.business_profiles for update to authenticated using (private.is_active() and (private.owns_business(id))) with check (private.is_active() and (private.owns_business(id)));

create policy member_read on public.business_verifications for select to authenticated using (private.owns_business(business_id));

create policy member_read on public.project_listings for select to authenticated using (private.can_read_project(id));

grant select on public.project_listings to anon;

create policy visitor_read on public.project_listings for select to anon using (private.can_read_project(id));

create policy member_read on public.project_required_skills for select to authenticated using (private.can_read_project(project_id));

grant select on public.project_required_skills to anon;

create policy visitor_read on public.project_required_skills for select to anon using (private.can_read_project(project_id));

create policy member_read on public.project_moderation for select to authenticated using (private.can_read_project(project_id));

grant select on public.project_moderation to anon;

create policy visitor_read on public.project_moderation for select to anon using (private.can_read_project(project_id));

create policy member_read on public.project_saved_listings for select to authenticated using (talent_id=auth.uid());

grant insert on public.project_saved_listings to authenticated;

create policy member_insert on public.project_saved_listings for insert to authenticated with check (private.is_active() and (talent_id=auth.uid() and private.has_role('talent') and private.can_read_project(project_id)));

grant delete on public.project_saved_listings to authenticated;

create policy member_delete on public.project_saved_listings for delete to authenticated using (private.is_active() and (talent_id=auth.uid() and private.has_role('talent') and private.can_read_project(project_id)));

create policy member_read on public.portfolio_items for select to authenticated using (private.can_read_portfolio(id));

grant insert on public.portfolio_items to authenticated;

create policy member_insert on public.portfolio_items for insert to authenticated with check (private.is_active() and (talent_id=auth.uid() and private.has_role('talent')));

grant update (title,description,cover_path,external_url,is_public,sort_order) on public.portfolio_items to authenticated;

create policy member_update on public.portfolio_items for update to authenticated using (private.is_active() and (talent_id=auth.uid() and private.has_role('talent'))) with check (private.is_active() and (talent_id=auth.uid() and private.has_role('talent')));

grant delete on public.portfolio_items to authenticated;

create policy member_delete on public.portfolio_items for delete to authenticated using (private.is_active() and (talent_id=auth.uid() and private.has_role('talent')));

create policy member_read on public.portfolio_item_skills for select to authenticated using (private.can_read_portfolio(portfolio_item_id));

grant insert on public.portfolio_item_skills to authenticated;

create policy member_insert on public.portfolio_item_skills for insert to authenticated with check (private.is_active() and (exists(select 1 from public.portfolio_items where id=portfolio_item_id and talent_id=auth.uid())));

grant delete on public.portfolio_item_skills to authenticated;

create policy member_delete on public.portfolio_item_skills for delete to authenticated using (private.is_active() and (exists(select 1 from public.portfolio_items where id=portfolio_item_id and talent_id=auth.uid())));

create policy member_read on public.portfolio_assets for select to authenticated using (private.can_read_portfolio(portfolio_item_id));

grant insert on public.portfolio_assets to authenticated;

create policy member_insert on public.portfolio_assets for insert to authenticated with check (private.is_active() and (exists(select 1 from public.portfolio_items where id=portfolio_item_id and talent_id=auth.uid())));

grant delete on public.portfolio_assets to authenticated;

create policy member_delete on public.portfolio_assets for delete to authenticated using (private.is_active() and (exists(select 1 from public.portfolio_items where id=portfolio_item_id and talent_id=auth.uid())));

create policy member_read on public.project_applications for select to authenticated using (talent_id=auth.uid() or private.owns_project(project_id));

create policy member_read on public.project_application_portfolio for select to authenticated using (exists(select 1 from public.project_applications where id=application_id and (talent_id=auth.uid() or private.owns_project(project_id))));

create policy member_read on public.project_contracts for select to authenticated using (private.in_contract(id));

create policy member_read on public.workspace_milestones for select to authenticated using (private.in_contract(contract_id));

create policy member_read on public.workspace_deliverables for select to authenticated using (private.in_contract(contract_id));

create policy member_read on public.billing_transactions for select to authenticated using (private.in_contract(contract_id));

create policy member_read on public.billing_escrow_accounts for select to authenticated using (private.in_contract(contract_id));

create policy member_read on public.review_project_reviews for select to authenticated using (private.in_contract(contract_id) or (status='published' and private.is_active()));

create policy member_read on public.workspace_tasks for select to authenticated using (exists(select 1 from public.workspace_milestones where id=milestone_id and private.in_contract(contract_id)));

create policy member_read on public.workspace_deliverable_files for select to authenticated using (exists(select 1 from public.workspace_deliverables where id=deliverable_id and private.in_contract(contract_id)));

create policy member_read on public.messaging_conversations for select to authenticated using (private.in_conversation(id));

create policy member_read on public.messaging_participants for select to authenticated using (private.in_conversation(conversation_id));

create policy member_read on public.messaging_messages for select to authenticated using (private.in_conversation(conversation_id));

grant update (last_read_at) on public.messaging_participants to authenticated;

create policy member_update on public.messaging_participants for update to authenticated using (private.is_active() and (user_id=auth.uid() and private.in_conversation(conversation_id))) with check (private.is_active() and (user_id=auth.uid() and private.in_conversation(conversation_id)));

grant insert on public.messaging_messages to authenticated;

create policy member_insert on public.messaging_messages for insert to authenticated with check (private.is_active() and (sender_id=auth.uid() and private.in_conversation(conversation_id)));

create policy member_read on public.messaging_attachments for select to authenticated using (exists(select 1 from public.messaging_messages where id=message_id and private.in_conversation(conversation_id)));

create policy member_read on public.verification_assessments for select to authenticated using (is_active and private.is_active());

revoke select on public.verification_questions from authenticated;

create policy member_read on public.verification_submissions for select to authenticated using (talent_id=auth.uid());

create policy member_read on public.moderation_reports for select to authenticated using (reporter_id=auth.uid());

create policy member_read on public.billing_customer_accounts for select to authenticated using (private.owns_business(business_id));

create policy member_read on public.notification_inbox for select to authenticated using (user_id=auth.uid());

grant update (read_at) on public.notification_inbox to authenticated;

create policy member_update on public.notification_inbox for update to authenticated using (private.is_active() and (user_id=auth.uid())) with check (private.is_active() and (user_id=auth.uid()));

create index on public.account_roles (user_id);

create index on public.account_statuses (user_id);

create index on public.account_preferences (user_id);

create index on public.catalog_skills (category_id);

create index on public.talent_profiles (user_id);

create index on public.talent_skills (talent_id);

create index on public.talent_skills (skill_id);

create index on public.business_profiles (owner_id);

create index on public.business_verifications (business_id);

create index on public.business_verifications (reviewed_by);

create index on public.project_listings (business_id);

create index on public.project_listings (category_id);

create index on public.project_moderation (project_id);

create index on public.project_moderation (reviewed_by);

create index on public.project_required_skills (project_id);

create index on public.project_required_skills (skill_id);

create index on public.project_saved_listings (talent_id);

create index on public.project_saved_listings (project_id);

create index on public.portfolio_items (talent_id);

create index on public.portfolio_items (project_id);

create index on public.portfolio_item_skills (portfolio_item_id);

create index on public.portfolio_item_skills (skill_id);

create index on public.portfolio_assets (portfolio_item_id);

create index on public.project_applications (project_id);

create index on public.project_applications (talent_id);

create index on public.project_application_portfolio (application_id);

create index on public.project_application_portfolio (portfolio_item_id);

create index on public.project_contracts (project_id);

create index on public.project_contracts (talent_id);

create index on public.workspace_milestones (contract_id);

create index on public.workspace_tasks (milestone_id);

create index on public.workspace_tasks (assigned_to);

create index on public.workspace_deliverables (contract_id);

create index on public.workspace_deliverables (submitted_by);

create index on public.workspace_deliverables (reviewed_by);

create index on public.workspace_deliverable_files (deliverable_id);

create index on public.messaging_conversations (project_id);

create index on public.messaging_participants (conversation_id);

create index on public.messaging_participants (user_id);

create index on public.messaging_messages (conversation_id);

create index on public.messaging_messages (sender_id);

create index on public.messaging_attachments (message_id);

create index on public.verification_assessments (skill_id);

create index on public.verification_questions (assessment_id);

create index on public.verification_submissions (assessment_id);

create index on public.verification_submissions (talent_id);

create index on public.verification_submissions (reviewed_by);

create index on public.review_project_reviews (contract_id);

create index on public.review_project_reviews (reviewer_id);

create index on public.review_project_reviews (reviewee_id);

create index on public.moderation_reports (reporter_id);

create index on public.moderation_reports (reported_user_id);

create index on public.moderation_reports (project_id);

create index on public.moderation_reports (review_id);

create index on public.moderation_reports (message_id);

create index on public.moderation_reports (assigned_admin_id);

create index on public.billing_transactions (contract_id);

create index on public.notification_inbox (user_id);

create index on public.notification_inbox (project_id);

create index on public.notification_inbox (conversation_id);

create index on public.admin_audit_events (actor_id);

create index on public.project_listings(status,published_at desc);

create index on public.project_applications(project_id,status);

create index on public.messaging_messages(conversation_id,created_at desc);

create index on public.notification_inbox(user_id,read_at,created_at desc);

create index project_listing_search on public.project_listings using gin(to_tsvector('english',title || ' ' || description));

-- Internal moderation notes/reviewer identity are not public API columns.
revoke select on public.project_moderation from anon,authenticated;
grant select(project_id,status,featured,created_at,updated_at) on public.project_moderation to anon,authenticated;
-- Derived values: no mock applicant counts, ratings, or match scores stored on listings.
create view public.project_listing_stats with (security_invoker=true) as
 select p.id as project_id, (select count(*) from public.project_applications a where a.project_id=p.id and a.status<>'withdrawn') as visible_application_count from public.project_listings p;
grant select on public.project_listing_stats to authenticated;
-- Exact aggregate for approved listings without exposing applicant identities.
create function public.project_applicant_count(pid uuid) returns bigint language sql stable security definer set search_path='' as $$
 select count(*) from public.project_applications where project_id=pid and status<>'withdrawn' and private.can_read_project(pid); $$;
revoke all on function public.project_applicant_count(uuid) from public;
grant execute on function public.project_applicant_count(uuid) to anon,authenticated,service_role;
create function public.project_skill_match(pid uuid) returns numeric language sql stable security definer set search_path='' as $$
 select case when count(*)=0 then 0 else round(100.0*count(*) filter(where exists(select 1 from public.talent_skills t where t.talent_id=auth.uid() and t.skill_id=r.skill_id))/count(*)) end
 from public.project_required_skills r where r.project_id=pid and private.can_read_project(pid); $$;
revoke all on function public.project_skill_match(uuid) from public;
grant execute on function public.project_skill_match(uuid) to authenticated,service_role;
-- Private uploads. Metadata access does not make any object public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('gawa-profile-media','gawa-profile-media',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('gawa-portfolio','gawa-portfolio',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('gawa-project-files','gawa-project-files',false,52428800,null),
 ('gawa-message-files','gawa-message-files',false,20971520,null),
 ('gawa-verification-evidence','gawa-verification-evidence',false,20971520,null)
 on conflict(id) do nothing;
create policy gawa_owner_upload on storage.objects for insert to authenticated with check
 (bucket_id in ('gawa-profile-media','gawa-portfolio','gawa-project-files','gawa-message-files','gawa-verification-evidence') and (storage.foldername(name))[1]=auth.uid()::text and private.is_active());
create policy gawa_owner_read on storage.objects for select to authenticated using
 (bucket_id in ('gawa-profile-media','gawa-portfolio','gawa-project-files','gawa-message-files','gawa-verification-evidence') and (storage.foldername(name))[1]=auth.uid()::text and private.is_active());
-- Other users receive short-lived signed URLs from the backend after checking table permissions.
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_admin(),private.is_active(),private.has_role(text),private.owns_business(uuid),private.owns_project(uuid),private.in_contract(uuid),private.in_conversation(uuid),private.can_read_project(uuid) to anon,authenticated,service_role;
grant execute on function private.can_read_portfolio(uuid) to authenticated,service_role;
grant usage on schema private to anon;
insert into public.catalog_project_categories(slug,name) values
 ('design','Design & Creative'),('development','Web Development'),('marketing','Digital Marketing'),('data','Data & Analytics'),('writing','Writing');
insert into public.catalog_skills(name) values
 ('UI/UX Design'),('UI Design'),('Figma'),('React'),('JavaScript'),('TypeScript'),('Tailwind'),('Web Development'),('Graphic Design'),('Content Writing'),('Canva'),('Branding'),('SQL'),('Power BI'),('Data Analytics'),('Video Editing'),('Motion Graphics'),('Wireframing'),('Prototyping'),('SEO'),('Excel'),('Research'),('Digital Marketing'),('Strategy'),('WordPress'),('CSS'),('Photoshop'),('Retouching'),('Illustrator'),('Python'),('Copywriting'),('Premiere Pro'),('Motion'),('Storytelling'),('Meta Ads'),('Analytics'),('Content'),('Node.js'),('PostgreSQL'),('Layout'),('Testing'),('Insights'),('User Research'),('Content Strategy');
insert into public.verification_assessments(skill_id,title,is_active) select id,name || ' prototype assessment',false from public.catalog_skills where name in ('Figma','UI Design','React','User Research','Data Analytics','Content Strategy');
insert into public.platform_settings(key,value,description) values ('platform_fee_rate','0.05','Default fee; copy into contract at signing'),('currency','"PHP"','Settlement currency');
commit;

