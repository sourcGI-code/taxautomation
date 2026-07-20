# Tax Portal

A full-stack tax practice management system with online booking, client onboarding, status tracking, and automated communications.

## Features

### 1. Appointment Scheduling
- 24/7 online booking with availability rules (Mon–Fri 9am–5pm by default)
- Calendar slot management with conflict detection
- Cal.com webhook integration (optional)
- Automated confirmation emails and SMS

### 2. Client Onboarding Workflow
- Magic-link client portal (no passwords)
- Secure intake form with auto-progression
- Document upload portal (Supabase Storage)
- Automated welcome sequence after booking

### 3. Status Updates
- Pipeline: Booked → Intake Complete → Documents Received → In Review → Ready for Signature → Filed
- Visual status tracker for clients
- Auto-notifications on every status change
- Staff dashboard with search + filters

### 4. Communication (Email + SMS + Calls)
- Resend for transactional email
- Twilio for SMS reminders and updates
- Manual message sending from admin dashboard
- Call logging with outcomes
- Full communication and activity audit trail
- Sequence map UI at `/admin/sequences`

### 5. Peak ops
- Signed session cookies + rate-limited logins (Upstash Redis optional for multi-instance)
- Multi-staff roles (`owner` / `preparer` / `viewer`) via `STAFF_USERS` + owner password
- Preparer assignment on client files
- Full e-sign (typed + optional drawn pad, consent, IP/UA audit, `e_signatures` table)
- CSV audit exports (clients, activity, communications, signatures)
- AES-256-GCM document encryption at rest
- Privacy + terms templates, health endpoint `version: peak-1.0`
- Unit tests: `npm test`
- **IRS MeF e-file** (sandbox + production gateway), **DocuSign** certified e-sign, **SOC 2 control readiness** — see [COMPLIANCE.md](./COMPLIANCE.md)

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (`client-documents` bucket)
- **Email:** Resend
- **SMS:** Twilio

## Quick Start

**Full setup guide:** See [SETUP.md](./SETUP.md) for step-by-step instructions with screenshots-level detail.

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev                  # start at http://localhost:3000
npm run setup:check          # verify all services
```

### Setup commands

| Command | Purpose |
|---------|---------|
| `npm run setup:check` | Health check (Supabase, tables, storage, Resend, Twilio) |
| `npm run setup:seed` | Create a test client + appointment |
| `npm run cron:reminders` | Run automated reminder sequences |

### Legacy quick start

### 1. Clone and install

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL migration in `supabase/migrations/001_initial.sql` via the SQL Editor
3. Create a storage bucket named `client-documents` (private)
4. Copy your project URL and keys

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in your values in `.env.local`.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

- **Public site:** `/`
- **Book appointment:** `/book`
- **Client portal:** `/login` or `/portal`
- **Staff dashboard:** `/admin` (default password: `admin123`)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `NEXT_PUBLIC_APP_URL` | Public app URL (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_PRACTICE_NAME` | Your practice name |
| `ADMIN_PASSWORD` | Staff dashboard password |
| `RESEND_API_KEY` | Resend API key (optional — logs to console in dev) |
| `FROM_EMAIL` | Sender email address |
| `TWILIO_ACCOUNT_SID` | Twilio SID (optional — logs to console in dev) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |

## Cal.com Integration (Optional)

Point your Cal.com webhook to:

```
POST https://your-domain.com/api/webhooks/cal
```

The webhook triggers the same onboarding automation as the built-in booking page.

## Automation Flow

```
Booking Created
  → Create client record
  → Send welcome email (magic link)
  → Send SMS confirmation
  → Set status: Booked, onboarding: intake_pending

Intake Submitted
  → Update status: Intake Complete
  → Notify client to upload documents

Document Uploaded
  → Update status: Documents Received (on first upload)
  → Log activity

Status Changed (by staff)
  → Email + SMS notification to client
  → Log communication + activity
```

## Project Structure

```
src/
  app/
    page.tsx              # Landing page
    book/                 # Online booking
    login/                # Client magic-link login
    portal/               # Client dashboard, intake, documents
    admin/                # Staff dashboard
    api/                  # API routes
  components/             # UI components
  lib/                    # Business logic, notifications, booking
supabase/
  migrations/             # Database schema
```

## Security Notes

- Client auth uses magic links with 7-day expiry
- Admin auth uses password + HTTP-only cookie
- Documents stored in private Supabase bucket
- Service role key is server-side only
- Change `ADMIN_PASSWORD` before going to production

## License

Private — for your tax practice use.
