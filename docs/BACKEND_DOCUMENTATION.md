# GAWA Backend Architecture & API Documentation

This document provides a comprehensive technical reference for the GAWA backend, including system architecture, security layers, data models, business rules, and the complete REST API specification.

---

## 1. System Architecture & Tech Stack

```
                                    CLIENT TIER
           ┌────────────────────────────────────────────────────────────┐
           │                   Browser Client (React 19)                │
           │  • Public reads (Catalog, approved listings, public talent) │
           │  • Supabase Auth session management (JWT storage)           │
           └─────────────────────────────┬──────────────────────────────┘
                                         │ HTTPS + Bearer JWT / Cookies
                                         ▼
                                   GATEWAY & API TIER
           ┌────────────────────────────────────────────────────────────┐
           │                 Next.js 16 App Router (Turbopack)           │
           │                                                            │
           │  ┌──────────────────────────────────────────────────────┐  │
           │  │ 1. HTTP Security Headers (HSTS, CSP, Frame, Sniff)   │  │
           │  ├──────────────────────────────────────────────────────┤  │
           │  │ 2. Sliding-Window Rate Limiter (Read/Write/Sensitive)│  │
           │  ├──────────────────────────────────────────────────────┤  │
           │  │ 3. Cryptographic Auth & Status Verification          │  │
           │  ├──────────────────────────────────────────────────────┤  │
           │  │ 4. Input Sanitization & UUID v4 Validation           │  │
           │  ├──────────────────────────────────────────────────────┤  │
           │  │ 5. RBAC & Tenant Isolation Logic                     │  │
           │  └──────────────────────────────────────────────────────┘  │
           └─────────────────────────────┬──────────────────────────────┘
                                         │ Service Role Key (Server-Only)
                                         ▼
                                   DATABASE TIER
           ┌────────────────────────────────────────────────────────────┐
           │                  PostgreSQL 15 (Supabase)                  │
           │  • 40 Domain-specific tables with full RLS                  │
           │  • Relational foreign keys, check constraints, & cascades   │
           │  • Private Supabase Storage buckets                         │
           │  • Append-only admin audit log (`admin_audit_events`)       │
           └────────────────────────────────────────────────────────────┘
```

### Runtime Environment
- **Framework**: Next.js 16.4.6 (Turbopack)
- **Runtime**: Node.js v22.15.0 (ES Modules)
- **Database**: PostgreSQL 15 via Supabase project `hzualfogqsplrvhhzrnv`
- **Storage**: Supabase Storage (`gawa-avatars-banners`, `gawa-portfolio`, `gawa-project-files`, etc.)
- **Security Protocols**: HTTP Strict Transport Security (HSTS), RFC 4122 UUID v4 enforcement, binary magic-byte inspection, token bucket rate limiting.

---

## 2. Security & Protection Model

### 2.1 HTTP Security Headers
Configured in `next.config.mjs`, all API and page responses include:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: SAMEORIGIN` (prevents clickjacking)
- `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `poweredByHeader: false` (removes `X-Powered-By: Next.js` fingerprinting)

### 2.2 Token-Bucket Rate Limiter (`src/lib/server/rate-limit.ts`)
In-memory sliding-window rate limiting keyed by client IP or authenticated user ID:
- **Read Tier** (`120 req/min`): Public queries, listing browsing, profile views.
- **Write Tier** (`40 req/min`): Proposal submissions, milestone edits, messaging.
- **Sensitive Tier** (`15 req/min`): Hiring, escrow payments, media uploads, account status modifications.
- **Exceeded Limit Response**: `HTTP 429 Too Many Requests` with `Retry-After: <seconds>` header.

### 2.3 Authentication & Status Guard (`src/lib/server/auth.ts`)
- **Dual Extraction**: Accepts Bearer tokens from `Authorization: Bearer <token>` or session cookies (`sb-access-token`, `sb-auth-token`).
- **Cryptographic Verification**: Validates the JWT with Supabase Auth via `supabase.auth.getUser(token)`.
- **Status Check**: Enforces `account_statuses.status === 'active'`. Suspended or closed accounts are immediately rejected with `HTTP 401 / 403`.
- **Role Verification**: Queries `account_roles` directly. Prevents client-side role spoofing.
- **Business Profile Verification**: For `business` accounts, fetches and links the verified `business_profiles.id`.

### 2.4 Input Sanitization & Validation (`src/lib/server/security.ts`)
- `isValidUUID(id)`: Validates that identifiers strictly adhere to the UUID v4 standard regex `^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.
- `sanitizeString(str, maxLen)`: Strips HTML tags, script markers, and ASCII control characters (`\u0000-\u001F`).
- `sanitizeMultiline(str, maxLen)`: Removes executable script tags while preserving safe multiline text formatting.
- `clampNumber(val, min, max, default)`: Guarantees numerical bounds on budgets and ratings.

### 2.5 Binary Magic-Byte Inspection (`src/lib/server/profile/media/route.ts`)
File uploads are inspected at the binary buffer level to prevent executable polyglots disguised as images:
- **JPEG**: `0xFF 0xD8 0xFF`
- **PNG**: `0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`
- **WebP**: `RIFF` header + `WEBP` container format
- Max upload size is strictly capped at **5 MB**.

### 2.6 Append-Only Audit Logging (`src/lib/server/audit.ts`)
All state-altering events (`listing.publish`, `application.submit`, `contract.create`, `escrow.fund`, `admin.user_status`) write immutable audit entries to `public.admin_audit_events`.

---

## 3. Database Schema & Domain Taxonomy

The database schema consists of 40 tables organized by domain prefix:

| Prefix | Domain | Primary Tables |
|---|---|---|
| `account_` | Identity & Preferences | `account_profiles`, `account_roles`, `account_statuses`, `account_preferences` |
| `catalog_` | Shared Taxonomies | `catalog_project_categories`, `catalog_skills` |
| `talent_` | Talent Profiles | `talent_profiles`, `talent_skills` |
| `business_` | Business Profiles | `business_profiles`, `business_verifications` |
| `project_` | Listings & Applications | `project_listings`, `project_moderation`, `project_required_skills`, `project_saved_listings`, `project_applications`, `project_application_portfolio` |
| `workspace_` | Contract Delivery | `project_contracts`, `workspace_milestones`, `workspace_tasks`, `workspace_deliverables`, `workspace_deliverable_files` |
| `portfolio_` | Work Samples | `portfolio_items`, `portfolio_item_skills`, `portfolio_assets` |
| `messaging_` | Conversations & Chat | `messaging_conversations`, `messaging_participants`, `messaging_messages`, `messaging_attachments` |
| `verification_` | Skill Assessments | `verification_assessments`, `verification_questions`, `verification_submissions` |
| `review_` | Reputation & Ratings | `review_project_reviews` |
| `moderation_` | Trust & Safety | `moderation_reports` |
| `billing_` | Escrow & Ledger | `billing_customer_accounts`, `billing_transactions`, `billing_escrow_accounts`, `billing_webhook_events` |
| `notification_`| In-App Alerts | `notification_inbox` |
| `admin_` / `platform_` | Operations | `admin_audit_events`, `platform_settings` |

---

## 4. REST API Specification

### Common Request Headers
```http
Authorization: Bearer <SUPABASE_JWT_ACCESS_TOKEN>
Content-Type: application/json
```

### Common Error Response Format
```json
{
  "error": "Error description message"
}
```

---

### 4.1 Project Listings (`/api/listings`)

#### `GET /api/listings`
Returns public approved listings or caller-owned listings.
- **Auth**: Optional for public; required for `scope=business`.
- **Rate Limit**: Read tier (120/min).
- **Query Parameters**:
  - `scope` (optional): `"business"` returns listings owned by caller's business.
- **Response `200 OK`**:
```json
{
  "listings": [
    {
      "id": "171786ba-f1c2-42d5-b640-5b74b975d4ee",
      "title": "Mobile App UI/UX Redesign",
      "description": "Redesign key user flows for our mobile checkout.",
      "objectives": ["Simplify checkout", "Modernize design system"],
      "expected_deliverables": ["Figma wireframes", "High-fidelity mockups"],
      "budget": 15000,
      "duration_label": "2 weeks",
      "application_deadline": "2026-12-18",
      "work_setup": "hybrid",
      "status": "published",
      "published_at": "2026-11-18T04:36:47.985Z",
      "business": {
        "name": "Acme Corp",
        "avatar_color": "#087EAD",
        "logo_path": "https://.../logo.png"
      },
      "category": { "name": "Design & Creative" },
      "required_skills": [{ "skill": { "name": "Figma" } }]
    }
  ]
}
```

#### `POST /api/listings`
Creates and publishes a new project listing.
- **Auth**: Required (`business` role with verified `business_profiles.id`).
- **Rate Limit**: Write tier (40/min).
- **Request Body**:
```json
{
  "title": "Mobile App UI/UX Redesign",
  "description": "Full redesign of our client portal and mobile app.",
  "budget": 20000,
  "duration_label": "4 weeks",
  "work_setup": "remote",
  "application_deadline": "2026-12-30",
  "category_name": "Design & Creative",
  "skills": ["Figma", "UI Design"],
  "objectives": ["Create clear wireframes", "Deliver components"],
  "expected_deliverables": ["Figma file", "Component library"]
}
```
- **Validation**:
  - `title`: 3–120 characters.
  - `description`: 10–5000 characters.
  - `budget`: ₱500 to ₱10,000,000.
  - `application_deadline`: Cannot be in the past.
- **Response `201 Created`**: Returns `{ success: true, project: { ... } }`.

#### `PATCH /api/listings`
Updates listing details.
- **Auth**: Business owner or Admin.
- **Request Body**: `{ "id": "<UUID>", "title": "...", "budget": 25000 }`
- **Response `200 OK`**: Returns `{ success: true, project: { ... } }`.

#### `DELETE /api/listings?id=<UUID>`
Closes/archives a project listing.
- **Auth**: Business owner or Admin.
- **Business Rule**: Forbids deletion if the project has active contracts.
- **Response `200 OK`**: `{ "success": true, "message": "Project closed successfully" }`.

---

### 4.2 Proposals & Applications (`/api/applications`)

#### `GET /api/applications`
- **Auth**: Required (`talent` gets own applications; `business` with `scope=business` gets proposals for owned projects).
- **Query Parameters**: `scope=business` (optional).
- **Response `200 OK`**: Returns array of applications with candidate/project details.

#### `POST /api/applications`
Submits a proposal for an open project.
- **Auth**: Required (`talent` role).
- **Request Body**:
```json
{
  "project_id": "171786ba-f1c2-42d5-b640-5b74b975d4ee",
  "proposal": "I have 2 years of experience with mobile Figma systems...",
  "proposed_budget": 15000,
  "portfolio_item_ids": ["c1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a"]
}
```
- **Business Rules**:
  - Rejects if caller is the business owner of the project.
  - Rejects if caller already applied (`409 Conflict`).
  - Rejects if application deadline has passed.
  - Verifies that all `portfolio_item_ids` belong to `caller.id`.
- **Response `201 Created`**: Returns `{ success: true, application: { ... } }`.

#### `PATCH /api/applications`
Transitions application stage.
- **Auth**: Required.
- **Request Body**: `{ "application_id": "<UUID>", "status": "shortlisted" }`
- **State Machine Rules**:
  - `talent`: Can only set `"withdrawn"` on own pending application (cannot withdraw if already `accepted` or `rejected`).
  - `business`: Can transition owned applications to `"shortlisted"`, `"interview"`, or `"rejected"`.
- **Response `200 OK`**: Returns `{ success: true, application: { ... } }`.

---

### 4.3 Contracts & Hiring (`/api/contracts/hire` & `/api/contracts`)

#### `POST /api/contracts/hire`
Accepts a proposal and provisions an active contract atomically.
- **Auth**: Required (`business` owner of project).
- **Rate Limit**: Sensitive tier (15/min).
- **Request Body**:
```json
{
  "application_id": "bfa564df-83ab-4656-9cf3-05f750c8346d",
  "close_remaining": true
}
```
- **Server Execution**:
  1. Validates ownership of project.
  2. Copies agreed budget from proposal/listing.
  3. Queries `platform_settings.platform_fee_rate` directly from database.
  4. Inserts `project_contracts` record with status `"active"`.
  5. Updates application status to `"accepted"`.
  6. Updates listing status to `"active"`.
  7. Initializes `billing_escrow_accounts` record.
  8. If `close_remaining: true`, rejects other pending applications.
  9. Notifies talent via `notification_inbox`.
- **Response `201 Created`**: `{ "success": true, "contract": { "id": "...", "status": "active" } }`.

#### `GET /api/contracts`
Fetches contracts for the caller with joined milestones, tasks, deliverables, and escrow.
- **Auth**: Required.
- **SQL Isolation**: Non-admins strictly query where `talent_id == caller.id OR project.business_id == caller.businessId`.

#### `POST /api/contracts` (Workspace Operations)
Executes delivery workflow actions inside a contract.
- **Auth**: Contract participant.
- **Supported Actions**:
  1. `add_milestone`: `{ "action": "add_milestone", "contract_id": "<UUID>", "title": "Milestone 1", "description": "..." }`
  2. `add_task`: `{ "action": "add_task", "contract_id": "<UUID>", "milestone_id": "<UUID>", "title": "Wireframes" }`
  3. `toggle_task`: `{ "action": "toggle_task", "contract_id": "<UUID>", "task_id": "<UUID>", "is_done": true }`
  4. `submit_deliverable`: `{ "action": "submit_deliverable", "contract_id": "<UUID>", "title": "Final Assets", "external_url": "https://figma.com/..." }` (Talent only)
  5. `review_deliverable`: `{ "action": "review_deliverable", "contract_id": "<UUID>", "deliverable_id": "<UUID>", "status": "approved", "review_notes": "Great job!" }` (Business owner only)
  6. `complete_contract`: `{ "action": "complete_contract", "contract_id": "<UUID>" }` (Business owner only)

---

### 4.4 Payments & Escrow Ledger (`/api/payments`)

#### `GET /api/payments`
Fetches caller-scoped billing transactions and escrow accounts.
- **Auth**: Required.

#### `POST /api/payments`
Deposits funds into escrow or releases funds to talent.
- **Auth**: Business owner of contract.
- **Rate Limit**: Sensitive tier (15/min).
- **Actions**:
  - `fund_escrow`:
    ```json
    { "action": "fund_escrow", "contract_id": "<UUID>", "amount": 15000 }
    ```
    Creates `kind = 'funding'` record in `billing_transactions` and increments `billing_escrow_accounts.funded_amount`.
  - `release_escrow`:
    ```json
    { "action": "release_escrow", "contract_id": "<UUID>", "amount": 15000 }
    ```
    **Overdraw Check**: Verifies `funded_amount - released_amount >= amount`. Increments `released_amount` and creates `kind = 'release'` transaction.

---

### 4.5 Talent Discovery Directory (`/api/talents`)

#### `GET /api/talents`
Publicly browses emerging talents with verified skill badges and review scores.
- **Query Parameters**:
  - `q`: Search keyword (name, headline, course, school).
  - `skill`: Filter by skill tag (e.g. `figma`, `ui design`).
  - `school`: Filter by university or location.
- **Privacy Rule**: Only returns profiles where `profile_visible = true`. Private contact emails/phone numbers are withheld.
- **Response `200 OK`**:
```json
{
  "talents": [
    {
      "id": "621ede4a-4163-45ac-a2d1-8694bbf625d9",
      "name": "Rafael Hilario",
      "role": "Emerging Talent",
      "school": "Manila, Philippines",
      "skills": ["UI/UX Design", "Figma"],
      "verifiedSkills": [{ "title": "Figma Assessment", "score": 92 }],
      "rating": 5.0,
      "reviewCount": 1,
      "color": "#087EAD",
      "avatarUrl": "https://.../avatar.png",
      "workSetup": "remote"
    }
  ]
}
```

---

### 4.6 Skill Verifications & Anti-Cheat (`/api/verification`)

#### `GET /api/verification`
Returns active assessments.
- **Anti-Cheat Enforcement**: Delivers prompts, options, and points, but **omits** `correct_answer`.

#### `POST /api/verification`
Submits assessment answers for server grading.
- **Auth**: Required (`talent` role).
- **Request Body**:
```json
{
  "assessment_id": "<UUID>",
  "answers": {
    "<QUESTION_UUID_1>": "option_b",
    "<QUESTION_UUID_2>": "option_a"
  }
}
```
- **Server Execution**:
  1. Compares user answers with `verification_questions.correct_answer`.
  2. Calculates score percentage.
  3. If `score >= passing_score`, updates `verification_submissions.status = 'verified'` and sets `talent_skills.proficiency = 'verified'`.
  4. Returns score and pass/fail status without revealing answer keys.

---

### 4.7 Reputation & Reviews (`/api/reviews`)

#### `GET /api/reviews?user_id=<UUID>`
Fetches published reviews for a talent or business.

#### `POST /api/reviews`
Submits a review after contract completion.
- **Auth**: Contract participant.
- **Request Body**:
```json
{
  "contract_id": "<UUID>",
  "rating": 5,
  "feedback": "Outstanding delivery! Communicated clearly and finished ahead of schedule."
}
```
- **Business Rules**:
  - Contract status must be `"completed"`.
  - Reviewer and reviewee must be counterparties in that specific contract.
  - Enforces uniqueness: only 1 review per contract per participant.
  - `rating`: Integer between 1 and 5 stars.

---

### 4.8 Direct Messaging (`/api/messages`)

#### `GET /api/messages`
Fetches conversations where caller is a participant, unread counts, and safe contact directory.

#### `POST /api/messages`
Starts a conversation or sends a message.
- **Actions**:
  - `start`: `{ "action": "start", "recipient_id": "<UUID>", "subject": "...", "message": "..." }`
  - `send`: `{ "action": "send", "conversation_id": "<UUID>", "message": "Hello!" }`
- **Validation**: Message body cannot be empty; maximum 2000 characters.

---

### 4.9 Profile & Media Management (`/api/profile` & `/api/profile/media`)

#### `PATCH /api/profile`
Updates safe account profile fields.
- **Whitelisted Columns**: `display_name`, `bio`, `location`, `avatar_color`, `profile_visible`, talent preferences (`school`, `course`, `remote_work`), and business attributes (`name`, `industry`, `company_size`).

#### `POST /api/profile/media`
Uploads profile avatar or banner image.
- **Payload**: `multipart/form-data` with `file` and `kind` (`avatar` | `banner`).
- **Binary Inspection**: Rejects non-image payloads via buffer magic bytes.
- **Storage Isolation**: Stores under `<caller_uid>/<kind>-<timestamp>-<uuid>.<ext>` in bucket `gawa-avatars-banners`.

---

### 4.10 Admin Operations (`/api/admin`)

Strictly restricted to users with `role = 'admin'` in `account_roles`.
- `GET /api/admin`: Returns system metrics, moderation queue, user statuses, open reports, and audit trail.
- `POST /api/admin`:
  - `moderate_listing`: Sets status (`approved`, `rejected`, `hidden`, `pending`) and `featured: boolean`.
  - `toggle_user_status`: Sets status (`active`, `suspended`, `closed`) with moderation reason.
  - `resolve_report`: Resolves or dismisses moderation reports with resolution notes.

---

## 5. Security & Audit Logging Reference

All critical state transitions automatically log an entry to `admin_audit_events`:

| Action Key | Entity Table | Logged Metadata |
|---|---|---|
| `listing.publish` | `project_listings` | `title`, `budget`, `business_id` |
| `listing.update` | `project_listings` | Updated field dictionary |
| `listing.close` | `project_listings` | Project ID |
| `application.submit` | `project_applications` | `project_id`, `proposed_budget` |
| `application.<status>` | `project_applications` | `previous_status`, `next_status` |
| `contract.create` | `project_contracts` | `project_id`, `talent_id`, `agreed_amount` |
| `contract.complete` | `project_contracts` | Contract ID |
| `escrow.fund` | `billing_escrow_accounts` | `amount`, `transaction_id` |
| `escrow.release` | `billing_escrow_accounts` | `amount`, `transaction_id` |
| `verification.graded` | `verification_submissions` | `assessment_id`, `score`, `status` |
| `profile.upload_<kind>`| `account_profiles` | `storagePath`, `publicUrl` |
| `admin.moderate_listing`| `project_moderation` | `status`, `featured` |
| `admin.user_status` | `account_statuses` | `status`, `reason` |

---

## 6. Local Development & Testing

### Starting the Server
```sh
pnpm dev
```
Accessible at `http://localhost:3000`.

### Verifying Endpoint Security
```sh
# Public listing test (should succeed with security headers)
curl -i http://localhost:3000/api/listings

# Protected admin test (should return 401 Unauthorized)
curl -i http://localhost:3000/api/admin

# Payments test (should return 401 Unauthorized)
curl -i http://localhost:3000/api/payments

# Directory discovery test (should return HTTP 200 with public profiles)
curl -i http://localhost:3000/api/talents
```
