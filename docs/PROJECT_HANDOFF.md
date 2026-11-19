# GAWA — theme, features and AI handoff

Prepared November 19, 2026 (Asia/Manila), from branch `Yap`, source commit `604480f`. This document describes the existing design and intended product behavior. It does not certify that every feature is already implemented correctly.

Read together with `DATABASE_WIRING.md` (table-to-function map) and `DATABASE_WIRING_AUDIT.md` (known implementation defects). The audit takes precedence over old claims that something is fully wired. Preserve the product design; repair defects rather than reproducing them.

## 1. Product identity and boundaries

GAWA connects Filipino students and emerging talent with businesses offering paid, skill-based projects. The product centers on demonstrated skills, real work, a growing portfolio and trustworthy reputation. It is a project collaboration platform, not a generic permanent-employment job board, social network or a seller-service marketplace.

Existing brand messages include “Your skills deserve real opportunities” and “Built for Filipino talent, powered by skills.” Preserve the GAWA name, existing logo, Filipino context, PHP/₱ amounts, project-first language and approachable professional tone. Existing UI copy is primarily English. Use clear descriptions instead of claiming AI ranking, professional certification, verified businesses or secured funds without an actual implementation.

## 2. Visual identity to preserve

The primary visual source of truth is `src/index.css`, including its later overrides. Reuse existing selectors/components before adding new design systems. Colors below come from the source, not an inferred redesign.

### Brand palette

| Purpose | Existing colors | Usage |
|---|---|---|
| Primary brand blue | `#087EAD` | Main actions, selected controls, links, accent text and progress. |
| Deeper action blue | `#066790` | Primary button gradient end. |
| Deep navy | `#073B57` | Sidebar, major headings, footer/brand dark surfaces. |
| Cyan accent | `#22B8E6` | Logo accent, gradient end, active indicator and progress highlights. |
| Main page background | `#F6F9FC` | Dashboard canvas and soft section backgrounds. |
| Surface | `#FFFFFF` | Cards, panels, inputs and header. |
| Main text | `#102A43` | Default body text. |
| Secondary text | `#486779`, `#597285`, `#627D98` | Supporting copy and labels; use existing selector-specific shade. |
| Muted text | `#748897`, `#8095A0` | Supplementary metadata; maintain readable contrast. |
| Borders | `#DCE7ED`, `#DFE9EE` | Buttons/controls and panels respectively. |
| Soft blue surfaces | `#E8F6FC`, `#EAF7FC`, `#EFFAFF` | Information badges, selected/light accent surfaces. |
| Sidebar hover | `#0B4967` | Hovered navigation item. |
| Sidebar active | `#0D5275` | Active navigation background, with cyan inset marker. |
| Sidebar supporting text | `#9BBAC7` | Default navigation text; white when active. |

### Semantic and secondary colors

| Meaning | Foreground / accent | Background |
|---|---|---|
| Information / blue badge | `#087EAD` | `#E8F6FC` |
| Success / verified / complete badge | `#15803D` | `#E9F8EE` |
| Success stat icon | `#16A34A` | `#E8F8EE` |
| Pending / warning badge | `#B66C04` | `#FFF6DF` |
| Warning stat icon | `#D88408` | `#FFF5DF` |
| Purple badge | `#7353B6` | `#F2EDFF` |
| Purple stat icon | `#805AD5` | `#F1EDFC` |
| Error / destructive / reported | `#DC2626` | `#FEECEC` |

Use color with a label/icon, not as the sole status signal. Avatar/demo entity colors also include `#0F9D78`, `#F59E0B`, `#E0527D`, `#2563EB`, `#B7791F`, `#475569`, `#A16207`, `#DB2777`, and `#16A34A`. These are supporting identity/chart accents; they must not replace the blue/navy/cyan brand palette.

### Existing gradients

- Primary button: `linear-gradient(135deg, #087EAD, #066790)`.
- Hero emphasized heading: `linear-gradient(110deg, #087EAD, #22B8E6)`.
- Progress: `linear-gradient(90deg, #087EAD, #22B8E6)`.
- Auth aside: `linear-gradient(145deg, #073B57, #07547A)`.
- Hero backdrop: soft white-to-`#F2FBFE` with a pale `#DFF5FC` radial glow.

### Typography, layout and components

- Font: **Plus Jakarta Sans**, weights 400/500/600/700/800, with sans-serif fallback. Do not substitute an unrelated font.
- Keep bold navy headings, clear hierarchy, generous whitespace, compact readable metadata and restrained uppercase eyebrow labels. Later CSS overrides increase older small font sizes; do not restore the tiny initial values.
- Preserve the light dashboard, fixed navy desktop sidebar, white header, rounded white cards, subtle borders and soft blue shadows. The desktop sidebar starts at 246 px wide; reuse responsive rules rather than hardcoding that width everywhere.
- Existing panel radius: 13 px; primary buttons: 10 px, large buttons: 12 px; badges/tags: 7 px. Maintain selector-specific variants.
- Buttons use icon + label where appropriate; primary action is filled blue, secondary action is white with a light border, low-priority actions are ghost buttons. Use `lucide-react` outline icons.
- Preserve project cards with company identity, title/brief, skill tags, budget, duration, applicant count and matching information. Use only real computed metrics in the functional app.
- Maintain existing avatars, brand/company imagery, portfolio covers, skill tags, progress bars, stat cards, application stages, message bubbles, modals and toast styling.
- Existing responsive breakpoints include 1000, 768 and 520 px. Keep navigation usable on mobile, collapse multi-column content appropriately and avoid horizontal overflow.
- Retain restrained hover/press transitions (roughly 0.18–0.28 seconds), visible keyboard focus and disabled/loading states. Respect reduced-motion preferences when extending animations.
- Do not introduce a dark dashboard, neon/glass style, unrelated purple-first branding or a new navigation hierarchy unless explicitly requested.

## 3. Verification of the supplied core-feature picture

The picture is a valid **high-level grouping of ten platform modules**, but it is incomplete as a GAWA-specific feature list. It also describes intended scope, not proof of implementation.

| Picture item | GAWA interpretation / correction |
|---|---|
| 1. User & Profile Management | Correct. Include Supabase Auth, talent/business/admin roles, separate role onboarding, profile visibility/settings and profile media. |
| 2. Job/Service Posting Management | Rename **Project Posting & Management** to match GAWA. Businesses publish project briefs; the current product does not establish a separate talent service-selling marketplace. |
| 3. Job Discovery & Search | Rename **Project Discovery & Skill Matching**. Include search, filters, saved projects and honest skill-overlap indicators. |
| 4. Application & Hiring Management | Correct. Include proposals, optional proof of work, applicant stages and contract creation. |
| 5. Task & Workflow Management | Correct. Include contract workspace, milestones, tasks, deliverables, revisions, acceptance and completion. |
| 6. Messaging & Notifications | Correct. Include conversation membership, project context, unread state and user notification preferences. |
| 7. Transaction & Payment Management | Intended module, but actual payment processing is not implemented in the audited branch. Distinguish contract commitments from funded escrow or money movement. |
| 8. Ratings & Reviews | Included in GAWA's design. Restrict to eligible completed collaborations and authenticated participants. Current authorization needs repair. |
| 9. Admin & Moderation | Correct. Includes users, project moderation, business/skill checks, reports and audit trails. Several management actions remain unimplemented. |
| 10. Dashboard & Analytics | Correct. Role-specific dashboards and real derived metrics; financial analytics must use actual ledger events. |

**Two explicit GAWA core modules must also be listed:**

11. **Portfolio & Skill Passport** — a professional skills record combining profile, self-reported skills, validated achievements, proof of work, completed collaborations and reputation. It is composed from existing related tables; there is no separate `skill_passports` table or named passport screen in this branch. Presenting it as a dedicated passport is product work, not an already completed standalone feature.
12. **Skill Assessment & Verification** — skill-specific assessments/evidence, trustworthy server grading or admin review, result status/expiry and verified badges. This is distinct from selecting skills on a profile and distinct from a government/professional certification.

For a shorter ten-item presentation, put Portfolio/Skill Passport under item 1 and Skill Verification under item 9, but name both explicitly. Otherwise the main differentiator of GAWA disappears from the scope.

## 4. Roles and existing screens

| Role | Current navigation to preserve |
|---|---|
| Talent | Overview; Explore Projects; My Applications; Active Projects; Messages; My Portfolio; Skill Verification; Reviews; Settings. |
| Business | Overview; Post a Project; My Projects; Find Talent; Applications; Active Projects; Messages; Payments; Analytics; Settings. |
| Admin | Platform Overview; User Management; Skill Verifications; Project Moderation; Transactions; Reviews & Reports; Platform Analytics; Settings. |
| Visitor | Landing, featured opportunities, explanation of the platform, role-aware signup/login. |

Public signup offers talent or business only. Admin is provisioned by a trusted operator. Database roles and active account status control permissions on the server; selecting a tab or hiding a menu is not authorization.

## 5. Functional contracts to preserve and complete

### Identity, onboarding and settings

Use Supabase Auth for signup, confirmation, login/logout and account security. Keep passwords outside custom app tables. Talent onboarding captures school/course/location, actual skills/proficiency, portfolio and work preferences. Business onboarding captures company name/industry/size, contact details and brand profile. Save partial progress separately from completion, restore saved values, and persist notification/privacy choices. Avatar/banner/logo operations must use consistent request shapes and confirm both Storage and profile updates before reporting success.

Tables: `account_profiles`, `account_roles`, `account_statuses`, `account_preferences`, `talent_profiles`, `talent_skills`, `business_profiles`, `business_verifications`.

### Posting and discovery

Businesses create/edit drafts with title, category, description, objectives, deliverables, required skills, PHP budget, duration, application deadline, work setup and location when relevant. Publishing must follow moderation. Visitors/talents see approved published listings; owners can see their own drafts/private records. Search and filters must reflect actual fields. Preserve saved projects and detail screens. Compute applicant counts without exposing private applicant records, and preserve a genuine 0% skill match rather than replacing it with a flattering score.

Tables: `project_listings`, `project_moderation`, `project_required_skills`, `project_saved_listings`, `catalog_project_categories`, `catalog_skills`.

### Applications, hiring and contracts

A talent applies to an eligible project using a proposal and optional owned portfolio evidence. Enforce open deadline, approved publication, one application per talent/project and no applying to one's own business project. Business owners can review, shortlist, interview, reject and accept eligible applications. Talent can withdraw eligible submissions. Acceptance creates a consistent contract with server-derived parties, agreed budget and snapshotted fee. Validate terminal transitions and make related writes atomic.

Tables: `project_applications`, `project_application_portfolio`, `project_contracts`, plus listing/portfolio/notification/audit tables.

### Workspace and collaboration

Contract participants see the correct project/team, milestones, tasks, due dates, progress and deliverables. Every task/milestone/deliverable ID must belong to the authorized contract. Talent submits real links/files; the owner requests revision or approves. Completion follows acceptance, must not change unrelated contracts and must not imply that money has been released. Scope changes, completion and financial operations need distinct permissions.

Tables: `project_contracts`, `workspace_milestones`, `workspace_tasks`, `workspace_deliverables`, `workspace_deliverable_files`.

### Messaging and notifications

Authorized parties can start appropriate conversations, send messages and, when completed, attach files. Respect hidden profiles, account status, conversation membership and project access. Keep messages refreshed through a receive mechanism, track read state and show honest unread indicators. Trigger user-scoped notifications for applications, hiring, messages and delivery changes. Honor notification preferences; displaying an inbox entry is not the same as sending an email.

Tables: `messaging_conversations`, `messaging_participants`, `messaging_messages`, `messaging_attachments`, `notification_inbox`, `account_preferences`.

### Portfolio, Skill Passport and verification

Combine identity, education, headline, skills/proficiency, verified assessment results, portfolio evidence, completed work and reviews. Link case studies to the skills they demonstrate. Distinguish self-declared skill, pending verification, verified evidence, rejected/expired result and actual professional certification. The browser must never assign authoritative scores or verification status. Use real assessment questions, server grading or admin decisions, and expiry/version handling. Do not retain the current hard-coded 92% verification behavior as a requirement.

Tables: `talent_profiles`, `talent_skills`, `catalog_skills`, `portfolio_items`, `portfolio_item_skills`, `portfolio_assets`, `verification_assessments`, `verification_questions`, `verification_submissions`, `project_contracts`, `review_project_reviews`.

### Reviews and reputation

Eligible participants review the opposite party after completion using 1–5 stars and feedback, with a clear collaboration selector. Enforce participant identity, completed contract and the existing per-reviewer/contract uniqueness. Aggregate only eligible published reviews; new accounts start without invented ratings or completed work counts.

Table: `review_project_reviews`, with contracts and moderation where needed.

### Payments and transactions

Keep payment/contract reporting in scope, but clearly state when real payments are unavailable. A real payment integration requires provider checkout/customer references, verified webhook signatures, event deduplication, funding/release/refund/payout/fee records and atomic balance updates. Actual escrow/custody depends on provider capabilities. Do not store raw card data or fabricate balances from contract status. Use PHP currency and server-controlled amounts/fee snapshots.

Tables: `billing_customer_accounts`, `billing_transactions`, `billing_escrow_accounts`, `billing_webhook_events`, `platform_settings`, `project_contracts`.

### Admin, trust and analytics

Require active admin authorization for platform-wide data and all management operations. Implement real user status changes, listing decisions, business checks, skill reviews, report resolution and configuration with audit trails. Scope normal dashboards to their owner. Derive metrics from real records, actual dates and successful financial events. Do not expose admin details to normal users or generate synthetic growth/match/reputation figures.

Tables: `moderation_reports`, `admin_audit_events`, `platform_settings`, role/status/verification/moderation tables and correctly scoped aggregates.

## 6. Main user journey and acceptance baseline

Visitor → talent/business signup and confirmation → saved onboarding → approved project discovery/publication → proposal and applicant review → accepted contract → milestones/tasks → deliverable submission and owner acceptance → completed collaboration → portfolio evidence and review. Payment funding/release is a separate provider-backed flow when supported. Skill assessment/verification contributes evidence to the talent's Skill Passport; it is not automatically earned by submitting a form.

For each screen, verify permissions, save-and-reload persistence, error/loading/empty states, duplicate requests, cross-user/cross-contract access, mobile layout and real database values. Report unsupported functionality explicitly. A success toast requires a confirmed successful operation.

## 7. Technical continuity and database rules

- Current stack: React 19, Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase and Lucide icons. Do not migrate back to Vite or replace the stack without explicit direction.
- Main UI: `src/App.tsx`; design: `src/index.css`; entry/layout: `src/app/page.tsx` and `src/app/layout.tsx`; auth: `src/lib/auth/AuthContext.tsx`; clients: `src/lib/supabase`; route handlers: `src/app/api`; data helpers: `src/lib/api`.
- Browser config uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SECRET_KEY` stays server-only. Never share/commit `.env`, passwords or secret keys with this handoff document.
- Follow the current `AGENTS.md`: use the project's **gawa-db MCP** for database operations; do not use a different project's Supabase server. If unavailable, report that limitation and continue source-only work unless the user authorizes another mechanism.
- Preserve descriptive table prefixes and UUID relationships. The baseline defines 40 tables; the newer migration adds profile media support rather than new domain tables. See the full table/function guide.
- Use new migrations for schema changes; do not rerun the already applied baseline or assume the latest migration has been deployed without checking.
- RLS protects browser access; secret-key handlers must independently enforce caller roles, status, ownership and row relationships. Use transactional workflows and validate every returned error.
- Do not present prototype data, fixed matching scores, fake verification or contract commitments as real operational facts. The audit lists the existing places needing repair.

## 8. Copyable prompt for the next AI

> Continue the existing GAWA project on branch Yap. First read AGENTS.md, docs/PROJECT_HANDOFF.md, docs/DATABASE_WIRING.md and docs/DATABASE_WIRING_AUDIT.md, then inspect the relevant source files. Preserve the existing GAWA identity, Plus Jakarta Sans typography, navy #073B57 sidebar, blue #087EAD actions, cyan #22B8E6 accents, light #F6F9FC background, white rounded cards, Lucide icons and responsive layouts. Preserve the talent/business/admin journeys and the twelve core modules defined in the handoff, including Portfolio/Skill Passport and Skill Assessment/Verification. Treat the existing audit defects as bugs to repair, not functionality to reproduce. Do not redesign the product, invent unrelated features, expose secrets, fabricate verification/match/reputation/payment data or claim a feature works without checking persistence and permissions. Use the project's gawa-db MCP for database work. For my requested change, explain what you changed, what you verified and any remaining limitations.

Append the specific requested task to that prompt. It is a continuity guide, not an instruction to build every unfinished module in one unrequested change.
