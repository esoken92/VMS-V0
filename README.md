# VMS — Warehouse Inventory Management (Demo Template)

A mobile-optimized Progressive Web App for industrial warehouse inventory
management: role-based access control, immutable audit trails, tool custody,
blind stock-takes, and Supabase-backed real-time data.

This repository is intended as a **starting template / working prototype** for
teams evaluating or building an inventory management system. Fork it, point it
at your own Supabase project, and adapt it internally.

> **License**: [CC BY-NC-SA 4.0](LICENSE) — free to use, modify, and share for
> **non-commercial** purposes, with attribution, under the same license.
> Commercial use requires separate permission — see LICENSE.

---

## Features

- **Role-Based Access Control** — five roles: `super_admin`, `admin`,
  `manager`, `fleet_dispatch`, `staff`
- **Immutable Audit Trail** — database triggers write every change to
  `activity_logs` (UPDATE/DELETE blocked), with impersonation tracking
- **Tool Custody** — check-in/check-out with condition logging and overdue
  tracking
- **Blind Stock-Takes** — physical counts recorded without revealing system
  quantities
- **Directed Bin Locations** — zone/bin model with weight capacity
- **Unit Conversion Model** — stocking unit vs issuing unit
  (e.g. drum → litre) with `DECIMAL(15,4)` precision
- **Super Admin "View As"** — impersonation with a mandatory reason, logged
  to `impersonation_sessions`
- **PWA** — installable, service-worker precaching via `next-pwa`
- **Row-Level Security** — every table is RLS-protected; data access runs
  through the user's own JWT

## Tech Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Supabase** (Postgres + Auth + Storage) via `@supabase/auth-helpers-nextjs`
- **Tailwind CSS**, Lucide icons, Recharts
- **next-pwa** service worker

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your Supabase credentials (Dashboard → Project Settings → API):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=VMS Inventory Management
```

### 3. Apply the schema

**Option A — Supabase CLI**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**Option B — SQL Editor**

Run each file in `supabase/migrations/` **in numeric order**
(`001` → `009`) in the dashboard SQL Editor.

### 4. (Optional) Seed demo data

`supabase/seed.sql` creates four demo accounts and a full sample dataset
(bin locations, suppliers, products, movements, tool loans, stock takes).

```bash
supabase db reset      # local dev — migrations + seed
# or paste supabase/seed.sql into the SQL Editor on a hosted project
```

> ⚠️ The seed creates **well-known public credentials**. Only use it for
> demos and local development — never on data you care about.

| Role            | Email                        | Password         |
|-----------------|------------------------------|------------------|
| Super Admin     | `demo.admin@vms-demo.com`    | `DemoAdmin123!`  |
| Manager         | `demo.manager@vms-demo.com`  | `DemoManager123!`|
| Fleet Dispatch  | `demo.fleet@vms-demo.com`    | `DemoFleet123!`  |
| Warehouse Staff | `demo.worker@vms-demo.com`   | `DemoWorker123!` |

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with a demo account (or sign up —
new sign-ups get the `staff` role; promote yourself via the SQL in
`docs/`/`SETUP_DATABASE.md` or the Users page as a super admin).

---

## Project Structure

```
├── app/
│   ├── auth/                 # login, signup, password reset
│   ├── dashboard/            # protected pages (one per feature area)
│   ├── scan/                 # public barcode-scan placeholder page
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx              # landing page
├── components/
│   ├── auth/                 # login / signup / reset forms
│   ├── dashboard/            # Sidebar, TopBar, UserMenu
│   └── providers/            # AuthProvider (session, role, impersonation)
├── lib/
│   ├── supabase/             # client, server, generated types
│   └── navigation-config.ts  # role-scoped sidebar items
├── middleware.ts             # auth + role route gating (edge)
├── docs/                     # PROJECT_BRIEF.txt (original requirements)
├── public/                   # PWA manifest + icons
└── supabase/
    ├── migrations/           # 001–009 schema migrations (ordered)
    └── seed.sql              # optional demo users + sample data
```

## How Authorization Works (defense in depth)

1. **`middleware.ts`** redirects unauthenticated users to `/auth/login` and
   gates admin/super-admin routes by role.
2. **RLS policies** (migrations `001`/`006`) scope every table read/write to
   the caller's role — the real enforcement layer.
3. **`SECURITY DEFINER` RPCs** (`005`/`007`) perform their own role checks
   and set actor columns from `auth.uid()` — never from caller input.
   Privileged user-management functions require admin/super_admin;
   `super_admin` grants/deletes are super-admin only.

Sign convention used across schema, policies, and app: a profile's primary
key **is** the auth user id (`profiles.id = auth.users.id`, `user_id` is
kept for joins/FKs).

## Available Scripts

- `npm run dev` — dev server
- `npm run build` — production build (generates the service worker)
- `npm start` — serve the production build
- `npm run lint` — ESLint
- `npm run type-check` — `tsc --noEmit`
- `npm run supabase:generate-types` — regenerate `lib/supabase/types.ts`
  from your linked project

## Notes & Caveats

- `@supabase/auth-helpers-nextjs` is deprecated upstream — it works here,
  but a production fork should migrate to `@supabase/ssr`.
- `app/scan` is a UI placeholder; `html5-qrcode` is wired as a dependency
  for you to build real camera scanning.
- Push notifications and background-sync queues are intentionally not
  included — the surface that exists is the surface that works.
- The audit trigger logs `auth.uid()`; API context (IP, user agent) fields
  exist on `activity_logs` for you to populate.

## Contact

**Kurt Jonathan** — [esoken92@gmail.com](mailto:esoken92@gmail.com)

© 2026 ESO Industries. Licensed under CC BY-NC-SA 4.0.
