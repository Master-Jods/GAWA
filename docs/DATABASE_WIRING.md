# GAWA database and wiring guide

## Delivery status

Schema source: `supabase/migrations/202611170001_gawa_baseline.sql`. This baseline is for the features in `src/App.tsx` and `src/data.ts`. It creates 40 domain-specific tables, foreign keys, checks, indexes, RLS policies, signup automation, catalogs, prototype assessment definitions, and five private upload buckets. It does not replace mock UI state or implement API handlers. No sample people, projects, transactions, reviews, or certifications are inserted as real records.

**Applied to the live Supabase project on November 17, 2026 (Asia/Manila).** The database was empty before deployment. Verified 40 tables with RLS enabled on all 40, five private Storage buckets, 44 catalog skills, five categories, and the Auth signup trigger. Live checks passed for anonymous catalog/listing access, private contact/question restrictions, billing/role write denial, and the Supabase REST API.

Local `.env` now uses the supplied Session pooler connection string; it remains ignored by Git. The database connection verified TLS with Supabase's public CA certificate. The secret API key is server-only and bypasses RLS: server handlers must authenticate callers and enforce the workflow checks below.

The baseline has already been applied. **Do not rerun it on this project.** Future changes require new migrations. The following command is for a separate empty database, using a migration runner or Supabase SQL Editor:

```sh
# After exporting DATABASE_URL securely from local env, with psql installed:
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/202611170001_gawa_baseline.sql
```

Alternatively paste the migration into Supabase SQL Editor and run it. It is transactional and deliberately fails on existing application table names rather than overwriting them. Review existing project objects before applying. This does not manage Supabase Auth/Storage internal schemas.

## Names and ownership

UUID IDs replace the numeric mock project IDs. Use `created_at`, `published_at`, and `submitted_at` for relative dates; derive avatar initials from names. Monetary values are exact decimal PHP amounts, never floating point business calculations. Dates/times are `timestamptz`; format for Asia/Manila in the UI. Row ownership uses `auth.users.id` through `account_profiles`.

`account_` = identity/preferences; `catalog_` = shared reference data; `talent_` and `business_` = role profiles; `project_` = listings/recruiting/contracts; `workspace_` = delivery; `portfolio_` = proof of work; `messaging_` = conversations; `verification_` = assessments; `review_`/`moderation_` = trust; `billing_` = money/provider records; `notification_` = user inbox; `admin_`/`platform_` = operations.

## Table → function → screen

| Table | Function / data | Current component |
|---|---|---|
| `account_profiles` | Display name, bio, avatar, location, visibility; public-safe profile fields only | Auth, Onboarding, Shell, SettingsPage, Portfolio |
| `account_roles` | Talent/business/admin membership; trusted assignment only | Auth, role routing, User Management |
| `account_statuses` | Active/suspended/closed and moderation reason | User Management, authorization |
| `account_preferences` | Email/project/message notifications and onboarding save/resume | Onboarding, SettingsPage |
| `catalog_project_categories` | Canonical category labels and slugs | Explore Projects, PostProject filters |
| `catalog_skills` | Canonical searchable skill tags | Onboarding, PostProject, TalentMarket |
| `talent_profiles` | School, course, headline, work setup, duration and budget preferences | Onboarding, Portfolio, TalentMarket |
| `talent_skills` | Talent-to-skill mapping and self-reported proficiency | Onboarding, Portfolio, matching |
| `business_profiles` | Business name, industry, size, brand, contact info | Business onboarding/settings, ProjectDetail |
| `business_verifications` | Business checks, evidence and administrator decision history | Admin trust queue, verified badge |
| `project_listings` | Brief, objectives, deliverables, PHP budget, deadline, work setup and lifecycle | Landing, Explore Projects, ProjectDetail, PostProject, My Projects |
| `project_moderation` | Admin publication approval/hiding and featured placement | Project Moderation, Landing |
| `project_required_skills` | Required skills for a listing | ProjectDetail, PostProject, matching |
| `project_saved_listings` | Talent bookmarks | TalentApp saved projects |
| `project_applications` | Proposal, talent, listing and recruiting stage | Applications, ApplicantBoard |
| `project_application_portfolio` | Portfolio items attached to a proposal | ProjectDetail application modal |
| `project_contracts` | Accepted application, agreed price/fee, collaborators and delivery dates | ActiveProject, Payments, Reviews |
| `workspace_milestones` | Ordered milestones, deadlines and completion status | ActiveProject progress/tasks |
| `workspace_tasks` | Tasks within a milestone, assignee and completion checkbox | ActiveProject Add task |
| `workspace_deliverables` | Submission/revision/approval records with reviewer feedback | ActiveProject Submit deliverable |
| `workspace_deliverable_files` | Uploaded file metadata for a deliverable | ActiveProject attachments |
| `portfolio_items` | Case studies/work samples and optional originating project | Portfolio, application modal |
| `portfolio_item_skills` | Skills demonstrated by a case study | Portfolio skills/tags |
| `portfolio_assets` | Work sample file metadata and display order | Portfolio upload/gallery |
| `messaging_conversations` | Direct/project conversation header and context | Messages |
| `messaging_participants` | Conversation membership and per-user last-read timestamp | Messages inbox/unread counts |
| `messaging_messages` | Sender, body, timestamps and deletion marker | Messages composer/history |
| `messaging_attachments` | Message file metadata | Messages paperclip |
| `verification_assessments` | Skill assessment metadata/version/time limit | Verification cards |
| `verification_questions` | Private question bank and correct answers; backend only | Server assessment delivery/grading |
| `verification_submissions` | Answers, evidence, score, review decision and expiration | Verification results, Admin Skill Verifications |
| `review_project_reviews` | One review per reviewer/contract, 1–5 stars and feedback | Reviews, profile rating |
| `moderation_reports` | Report against exactly one user/project/review/message, resolution | Admin Reviews & Reports, disputes queue |
| `billing_customer_accounts` | Business-to-payment-provider customer reference | Settings Billing, payment setup |
| `billing_transactions` | Funding/release/refund/fee/payout events with idempotency keys | Payments, Admin Transactions |
| `billing_escrow_accounts` | Contract funding/released/refunded totals; backend ledger summary | Payments In escrow |
| `billing_webhook_events` | Private provider events, deduplication and processing errors | Payment webhook backend |
| `notification_inbox` | Recipient alerts and read timestamps | Shell bell, activity notices |
| `admin_audit_events` | Actor/action/record/details audit trail | Admin recent activity / audit log |
| `platform_settings` | Server-controlled default fee and settlement currency | Admin Settings, contract creation |

## Authentication and client configuration

Install `@supabase/supabase-js` during the wiring task. Initialize the browser client using **only** `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`. Never import `SUPABASE_SECRET_KEY` into browser code or expose it through Vite `define`. `.env` is ignored; `.env.example` is the commit-safe template.

Replace `Auth.onComplete` mock login with Supabase `auth.signUp`, `signInWithPassword`, `onAuthStateChange`, and `signOut`. Password/reset/MFA/email changes belong to Supabase Auth, not custom tables. Email confirmation may return no session: wait for confirmed sign-in before routing into the app.

Signup metadata supports `display_name`, `role` (`talent` or `business`), and optional `business_name`. A trigger creates profile/preferences/status/role and the matching role profile. Requesting `admin` in metadata produces a talent account, never an admin. Existing Auth users get default talent records on first migration. An operator must reconcile existing business users manually.

Load actual roles/status for navigation. Remove the prototype's public admin role selector. Provision the first admin through SQL Editor using a known existing Auth user ID, not a browser call:

```sql
insert into public.account_roles(user_id, role)
values ('REPLACE_WITH_EXISTING_AUTH_USER_UUID', 'admin');
```

`business_profiles` browser reads require an explicit public-safe column list (not `select('*')`), because contact name/email are private columns. Owner/admin contact reads go through an authenticated backend. Profile discovery is available to signed-in members; hiding a profile removes directory visibility but does not erase contract/message participant identity. Suspended users cannot mutate through browser policies; retained own records remain readable for account history.

## Browser queries and writes

RLS allows approved published listings/categories/skills/business public fields to visitors. Draft/rejected/hidden listings stay private. Owners and assigned contract talent can read their appropriate private project records. Backend queries bypass RLS, so explicitly enforce visibility there too.

Browser mutations are intentionally limited to own safe profile/settings fields, own skill proficiency, bookmarks, portfolio items/assets, message insertion, own last-read timestamp and notification read timestamp. `GRANT UPDATE(column...)` protects ownership and privileged fields. The rest must use authenticated server/Edge Function handlers, implemented during wiring. No admin write privileges come from a browser-selectable role.

Example listing query after client setup:

```ts
const { data, error } = await supabase
  .from('project_listings')
  .select('id,title,description,budget,duration_label,published_at,business_id,category_id')
  .eq('status', 'published')
  .order('published_at', { ascending: false })
  .range(0, 19);
// Related business: explicitly select public columns, e.g. id,name,logo_path,avatar_color.
// Skills: join project_required_skills -> catalog_skills.
const count = await supabase.rpc('project_applicant_count', { pid: projectId });
const match = await supabase.rpc('project_skill_match', { pid: projectId });
```

The count RPC returns only a count and checks project visibility; applicant identities remain private. `project_listing_stats.visible_application_count` counts rows visible under the caller's RLS and is not a public total. Skill match is required-skill overlap, 0–100; it is **not** an AI/verified-skill ranking. Compute verified indicators from nonexpired `verified` submissions. Replace mock `match` values and static fit claims with real calculation/labels.

## Server workflow contracts to implement during wiring

These are required application handlers, not pre-existing SQL RPCs. Authenticate the caller's JWT using Supabase Auth, check active status and database role/ownership, validate input, then perform each workflow atomically in a database transaction/RPC. Never trust a client-supplied owner, amount, reviewer, decision or score.

| Handler | Required checks and writes |
|---|---|
| Save/publish listing | Business role + owned business; save listing and required skills; set `published_at`; upsert pending moderation. Revisions to an approved brief must reset moderation. Only approved + published listings appear publicly. Set a nonexpired application deadline. |
| Moderate listing / verify business | Active admin only; write decision/reviewer/time and audit event. Derive verified business badge from latest business verification decision. |
| Apply | Talent role; published + approved + deadline open; not business owner; one application per talent/listing. Insert proposal + only caller-owned portfolio attachments together. |
| Change application stage | Talent may withdraw own pending application; business owner may shortlist/interview/reject; terminal state transitions validated. Record notification and audit. |
| Accept/hire | Business owner; lock application/listing; application still eligible; create contract with same project/talent/application and server-copied fee/price; mark application accepted and project active in one transaction. A listing supports multiple talents through separate contracts; close remaining applications when hiring is complete. |
| Create milestone/task | Contract participant; validate task assignee belongs to contract; ordered milestones and task records. Owner controls scope/approvals. |
| Submit/review deliverable | Assigned talent submits only within own active contract; milestone must belong to same contract; owner requests revision/approves. Complete milestones and contract only through validated transitions. |
| Start/submit assessment | Talent role, active version, server-enforced time limit. Deliver question prompts/options without correct answers. Persist attempt; grade on server, not browser. Empty seeded assessments must remain unavailable until real questions exist. |
| Verify skill | Admin or trusted grading service; set score, decision, expiry and reviewer fields. A self-selected proficiency is not verification. |
| Start conversation / invite talent | Validate an allowed business/talent relationship or project participant set. Create conversation + participants together; clients cannot add themselves to arbitrary chats. |
| Send message/file | Active conversation member. Text insert may use browser RLS; validate attachment object path belongs to uploader and conversation. Reject empty messages with no attachment; presence is ephemeral, not a durable status column. |
| Post review | Completed contract; reviewer and reviewee are opposite actual participants. Reviewer from session; unique reviewer/contract. Ratings aggregate only published reviews. |
| File report | Active caller, accessible target, exactly one target and meaningful reason. Admin handles resolution and logs action; private reports never form a public feed. |
| Create payment | Owned contract; price/currency from server; provider adapter returns checkout session. No card/bank credentials stored here. |
| Payment webhook | Verify provider signature before persisting. Deduplicate provider/event ID and idempotency key; transaction + escrow summary update in one database transaction with row lock. Reject duplicate releases/overdraw. Actual escrow/custody is a provider capability, not something this schema creates. |
| Admin action | Active admin; use trusted handler, validate operation and write append-only audit event. Browser has read-only admin policies; no direct audit updates/deletes. |
| Notification | Server-generated recipient/kind/links. Browser can mark own records read only. |

## Storage and realtime

All five buckets are private: `gawa-profile-media` (5 MB images), `gawa-portfolio` (20 MB images/PDF), `gawa-project-files` (50 MB), `gawa-message-files` (20 MB), `gawa-verification-evidence` (20 MB). Upload paths must start with `<auth.uid()>/<random UUID>/<filename>`. Storage RLS permits active users to upload/read their own paths only. Upload through Storage API; save metadata after successful upload, validate paths on server, and clean orphan files through a trusted cleanup job. No user overwrite/delete policies are provided; implement safe replacements and backend cleanup.

For other users, an authenticated backend validates the linked portfolio visibility, contract participation, chat membership or admin evidence access and issues a short-lived signed URL. Never sign an arbitrary caller-provided path. Public landing profile/logo images need a server endpoint that checks approved listing association before signing. Avoid uploading executable content and validate MIME/extension on the backend.

Realtime is not enabled by this migration. If needed, add `messaging_messages` and `notification_inbox` to the `supabase_realtime` publication after checking existing membership. Subscribe to a selected conversation or own user ID; keep RLS and clean up subscriptions. Use Realtime Presence for online indicators.

## Derived dashboards and remaining integration

Build server aggregates with caller-specific scope: business ownership for business dashboards and active admin checks for platform analytics. Derive applications/month from `submitted_at`, project completion from contract/listing states, spending/fees from **succeeded** transactions, escrow from funding minus release/refund, ratings from published reviews, and milestone progress from completed milestone count. Avoid counting both funding and payouts as spending. Do not copy the prototype's fixed sample counts, growth rates or dates into production.

Seeded assessments are inactive until question content is installed. Verification seed data is metadata only and grants no certifications. Payment provider, assessment content, email delivery, retention policy and admin moderation workflows need real implementations during wiring. Billing preferences reference provider customer IDs, never raw card data. `platform_settings` is server/admin-readable; expose only specifically approved public settings through a handler.

## Validation

`node scripts/validate-schema.mjs /path/to/@electric-sql/pglite/dist/index.js` runs the baseline on disposable PostgreSQL with minimal Auth/Storage stubs. It checks migration execution, RLS coverage, signup privilege protection, own/cross-user writes, private answer/webhook access, billing write denial and public moderation/contact restrictions. This is not a full Supabase integration test. Before launching the wired application, verify signup/email confirmation, Storage upload/signed URL behavior, handler authorization, provider signature checks and realtime in the actual project.

Official references: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
