# RYC Dental Service

Premium dental clinic website + booking platform for **RYC Dental Service** in Abeokuta, Ogun State, Nigeria.

Built with **Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma**.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 App Router (React 19, Server Components) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 design tokens (`src/app/globals.css`) |
| Fonts | Self-hosted Inter (body) + Fraunces (display) via `@fontsource-variable` |
| Database | SQLite for local dev · PostgreSQL for production (provider-switchable) |
| ORM | Prisma 6 (`prisma/schema.prisma`) |
| Validation | zod (server + client) |
| Auth | Server-side DB sessions, bcrypt password hashing (Phase 5) |
| Tests | Vitest (unit) · Playwright (e2e) |
| Icons | lucide-react |

## Getting started

```bash
npm install
cp .env.example .env        # then fill in values
npm run db:push             # create DB from schema
npm run db:seed             # admin account, services, dentists, hours, blocked dates
npm run dev                 # http://localhost:3000
```

### Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint (`eslint .`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright e2e (expects a server on `http://localhost:3101`) |
| `npm run db:push` | Sync DB to schema (local dev) |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:seed` | Idempotent seed |

## Environment variables (`.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | `file:./dev.db` locally; `postgres://…` in production |
| `AUTH_SECRET` | prod ✅ | ≥32 random chars — session signing |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_USERNAME` | seed | Creates the admin account (username optional — staff can then sign in with the username *or* email) |
| `STAFF_EMAIL` / `STAFF_PASSWORD` | seed | Creates the receptionist account |
| `NEXT_PUBLIC_SITE_URL` | prod | Public origin for metadata/canonical URLs |

All secrets stay server-side. Nothing sensitive is shipped to the client.
The dev-only login page shows these demo accounts **only when `NODE_ENV !== "production"`**.

## Staff area & roles (Phase 5)

**Sign in** — `/ryc_login` (restricted to clinic staff; users are created by an admin —
there is no public sign-up). Sessions are HTTP-only cookies backed by the `Session`
table; passwords are bcrypt-hashed. Every authentication event is written to `AuditLog`.

| Area | Receptionist (`STAFF`) | Administrator (`ADMIN`) |
|---|---|---|
| Dashboard overview + upcoming appointments | ✅ | ✅ |
| Appointments — list/filter by date, dentist, service, status; view detail | ✅ | ✅ |
| Appointment actions — confirm / cancel / reschedule / complete / no-show | ✅ | ✅ |
| Patients — search, view details & visit history | ✅ | ✅ |
| Services — manage (add, edit, prices, active/inactive) | — | ✅ |
| Dentists — manage + individual schedules | — | ✅ |
| Clinic schedule — hours, blocked dates | — | ✅ |
| Staff users — invite/disable, **admin-initiated password reset** | — | ✅ |
| Audit log — full history of admin & staff actions | — | ✅ |

Enforcement is **server-side**: API routes and data-access functions check the
role on every request (`src/lib/server/access.ts`), and admin-only pages render a
clear "You don't have access" screen for staff. Hiding nav links is cosmetic only.

**Password recovery** is handled by an admin resetting the password on the staff-user
screen. Email-based self-service recovery is a documented future follow-up.

## Configuration

- **Clinic details** (name, timezone `Africa/Lagos`, address, phone, email, currency): edit `src/lib/site.ts` — flagged `EDIT THESE VALUES`.
- **Photography**: photos live in `public/images/` (`services/`, `team/`, `home/`). Replace the files to swap in the clinic's real photography. Files ending in `.svg` are designed on-brand placeholders — drop the matching `.jpg`/`.webp` over them (update `src/lib/images.ts` and `prisma/seed.ts` accordingly).
- **Open/closed days & hours**: manage the `ClinicHours` and `BlockedDate` tables (DB) or seed defaults in `prisma/seed.ts`.

## Database

Key entities defined in `prisma/schema.prisma`:

- `User` (staff accounts, roles `ADMIN`/`STAFF`) · `Session`
- `Patient` · `Appointment` (status lifecycle, contact snapshots, UTC timestamps)
- `Service` · `Dentist` (many-to-many) · `DentistSchedule`
- `ClinicHours` · `BlockedDate`
- `Enquiry` · `Notification` · `AuditLog`
- All times stored **UTC**; week schedules use clinic-local "minutes since midnight".

## Booking engine

Availability is **computed at query time** (`src/lib/availability.ts`) from clinic hours ∩ dentist schedules − blocked dates − active appointments. No hardcoded slots; no double-booking. The public `/booking` page and home listing render live availability.

## Project structure

```
src/
  app/            routes (home, services, services/[slug], team, about, contact,
                  booking, login, admin/**, api/**)
  components/     ui primitives · layout (header/footer) · home sections ·
                  cards · booking · admin (managers, actions, shell) ·
                  auth (login form)
  lib/            env · site config · prisma · datetime (TZ-safe) ·
                  availability engine · constants · utils · images ·
                  server/ (auth, sessions, access, services, dentists, admin,
                  stats, validators, audit, appointments, patients)
prisma/           schema.prisma · seed.ts
tests/
  backend/        vitest unit tests (services, booking, auth, datetime, utils)
  e2e/            playwright specs (site, design, auth)
  helpers/        vitest harness (server-only stub, DB reset, global setup)
```

## Deployment

Recommended: **Vercel + managed PostgreSQL** (Neon/Supabase).

1. Set `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL` in the hosting dashboard.
2. Add `prisma migrate deploy` as a pre-deploy step (or `npm run db:push` for the initial sync).
3. CI gate before deploy: `npm run lint && npm run typecheck && npm test && npm run build`.

> The seed must not run in production with real credentials; run it locally/once or via a guarded script.

## Phase roadmap

- ✅ **Phase 1** — Discovery & architecture blueprint
- ✅ **Phase 2** — Foundation: scaffold, design system, database, seed, public site
- ✅ **Phase 3** — Booking engine & booking flow
- ✅ **Phase 4** — Contact/enquiry + patient appointment self-service
- ✅ **Phase 5** — Admin dashboard, authentication & authorization
- 🔜 **Phase 6** — Notifications, hardening, e2e tests, launch