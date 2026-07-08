@AGENTS.md

# Personal Finance

A personal-finance dashboard that links bank accounts through **Plaid**, syncs
transactions and balances into **Postgres** (via **Prisma**), and renders net
worth, cash flow, spending, budgets, and savings goals in a **Next.js** App
Router UI.

> **Read `AGENTS.md` first (imported above).** This repo pins **Next.js
> 16.2.9** and **React 19**, which differ from older App Router conventions.
> When touching framework APIs, consult `node_modules/next/dist/docs/` rather
> than relying on memory.

## Tech Stack

- **Next.js 16.2.9** (App Router) + **React 19**, **TypeScript** (`strict`)
- **Tailwind CSS v4** (via `@tailwindcss/postcss`; config is CSS-first in `app/globals.css`)
- **Prisma 7** with the **`prisma-client` generator** and the **`@prisma/adapter-pg`** driver adapter
- **Postgres** (developed against Supabase)
- **Plaid** (`plaid` SDK + `react-plaid-link`)
- **Recharts** for charts, **axios** for client-side fetching
- Deployed on **Vercel** (cron via `vercel.json`)

## Commands

```bash
npm run dev            # start dev server (localhost:3000)
npm run build          # production build
npm run start          # run the production build
npm run lint           # eslint (eslint-config-next: core-web-vitals + typescript)
npm run format         # prettier --write .
npm run format:check   # prettier --check .

npx prisma generate    # regenerate the client into generated/ (REQUIRED — see below)
npx prisma migrate dev # create/apply a migration in dev
```

There is **no test suite** in this repo. Verify changes by running the app and
exercising the affected flow. After editing `prisma/schema.prisma` or pulling
new code, run `npx prisma generate` before `npm run dev`/`build`.

## Critical Conventions

### Prisma client lives in `generated/`, not `@prisma/client`

The generator outputs to **`generated/prisma`** (see `prisma/schema.prisma`),
and `generated/` is **gitignored**. Consequences:

- Import types/enums from `@/generated/prisma/client` and
  `@/generated/prisma/enums` — **never** from `@prisma/client`.
- The `generated/` dir does not exist on a fresh checkout; run
  `npx prisma generate` first or imports will fail.
- Always go through the singleton in `lib/prisma_client.ts` (`import { prisma }
  from '@/lib/prisma_client'`), which wires up the `PrismaPg` adapter and reuses
  one client across hot reloads.

### Two database URLs

- `DATABASE_URL` — **pooled** connection used at runtime (Supabase: port 6543,
  `?pgbouncer=true`).
- `DIRECT_URL` — **direct** connection used for migrations. `prisma.config.ts`
  points the datasource at `DIRECT_URL`, so migrations bypass the pooler.

### Transaction amount sign convention (Plaid)

**Positive `amount` = money OUT (spending); negative = money IN (income).**
This is Plaid's convention and it is load-bearing across analytics
(`lib/db/analytics.ts`), balance backfill, and UI formatting
(`app/dashboard/page.tsx`). Get the sign wrong and cash flow / net worth
invert. Comments flag it at each site — keep them.

### Single dev user (no real auth yet)

There is no authentication. `getCurrentUser()` (`lib/db/user.ts`) upserts a
seeded user keyed on the `DEV_USER_ID` env var. Every route resolves the user
through `getCurrentUser()` and scopes queries by `userId` — preserve that
scoping when adding routes. Search for the `TODO`s about real auth before
building anything that assumes a session.

### Plaid access tokens are encrypted at rest

`PlaidItem.accessToken` holds live bank credentials. It is encrypted with
**AES-256-GCM** via `lib/crypto.ts` (`encrypt`/`decrypt`) using `ENCRYPTION_KEY`
(base64, must decode to 32 bytes). Encryption happens in `upsertPlaidItem`;
decryption happens in the sync layer. Never log or return the raw token.
Changing `ENCRYPTION_KEY` makes all stored tokens undecryptable (re-link
required).

### Row-Level Security

Migrations enable RLS on public tables with **no policies**. This closes off
Supabase's auto-generated PostgREST API (the anon/authenticated roles are
denied), while Prisma connects as the `postgres` role and bypasses RLS. Every
schema-changing migration is paired with an `enable_rls_*` migration — follow
that pattern for new tables.

## Architecture

### Data-access layer (`lib/db/`)

All database access is centralized here and re-exported from the barrel
`lib/db/index.ts`. Import from the barrel in consumers:
`import { getCurrentUser, listTransactions } from '@/lib/db'`.

- **Within `lib/db`, import sibling modules by direct path** (e.g.
  `./items`), *not* from the barrel — avoids circular imports.
- Input/output shapes live in `lib/db/types.ts`. External SDK (Plaid) responses
  are mapped to these shapes **at the route boundary**, so `lib/db` stays
  decoupled from Plaid's wire format.
- Most functions accept an optional trailing `db` parameter
  (`Prisma.TransactionClient | typeof prisma = prisma`) so they can enroll in an
  open `prisma.$transaction(...)` or run standalone.

Modules: `user`, `items` (Plaid items), `accounts`, `transactions`,
`analytics`, `budgets`, `goals`.

### Plaid integration (`lib/plaid_*.ts`)

- `plaid_client.ts` — configured `PlaidApi` singleton (throws if
  `PLAID_CLIENT_ID`/`PLAID_SECRET` missing).
- `plaid_sync.ts` — `transactionsSync` paging. Syncs the **first page
  synchronously**, then continues remaining pages in the background via
  `after()` from `next/server`. `backfillNewItem` does a full historical sync +
  derives balance history for a freshly-linked item.
- `plaid_categories.ts` — maps the `PlaidPrimaryCategory` enum and free-form
  `pfc*` strings to display labels; `BUDGETABLE_CATEGORIES` excludes inflow
  categories.

### API routes (`app/api/**/route.ts`)

Conventions to match when adding routes:

- Resolve the user with `getCurrentUser()`; scope all queries by `user.id`.
- Return `Response.json(body, { status })`. Wrap handlers in `try/catch`,
  `console.error(...)` the failure, and return a generic `{ error }` with a 4xx/5xx.
- Dynamic route params are a **Promise** in Next 16 — `const { id } = await params`.
- Validate input before writing (see `budgets/route.ts`).

Key routes:

| Route | Purpose |
|---|---|
| `POST /api/create_link_token` | Create a Plaid Link token |
| `POST /api/exchange_access_token` | Exchange public token, persist item + accounts, background backfill |
| `POST /api/sync` | Sync transactions for all of the user's items |
| `GET /api/sync` | **Cron target** — daily balance snapshot; requires `Authorization: Bearer $CRON_SECRET` |
| `GET /api/transactions` | List transactions (filters: from/to/accountId/take/cursor) |
| `GET /api/accounts` | List the user's accounts |
| `GET /api/analytics/{net-worth,cashflow,spending,merchants,...}` | Aggregations; `*/history` variants for time series |
| `/api/budgets`, `/api/budgets/[id]` | Budget CRUD |
| `/api/goals`, `/api/goals/[id]`, `.../contributions` | Goals + contributions CRUD |

### Balance history & net worth

`Account.currentBalance` is **overwritten in place** on every Plaid sync, so
history is preserved separately in `AccountBalanceSnapshot`:

- `snapshotAccountBalances` records today's balance per account (run daily by
  the Vercel cron `GET /api/sync`; upsert on `(accountId, date)`).
- `backfillAccountBalanceHistory` reconstructs historical daily balances for a
  newly-linked account by walking `currentBalance` backward through transaction
  deltas (an approximation — see the docstring).
- `getNetWorthHistory` reads snapshots and classifies `credit`/`loan` account
  types as liabilities. Account type is read live (not denormalized onto the
  snapshot) so Plaid reclassifications apply retroactively.

### Frontend (`app/`)

- App Router. `app/layout.tsx` renders the fixed `SideNav` + Geist fonts;
  routes: `/` (connect bank), `/dashboard`, `/budgets`, `/goals` (and a
  planned `/piggyai` nav item).
- Pages that fetch/use hooks are **client components** (`'use client'`) using
  `axios` against the API routes.
- Prisma `Decimal` and `Date` serialize to **strings** over JSON; client code
  defines DTO types that reflect this (e.g. `TransactionDTO` in
  `app/dashboard/page.tsx`) and converts with `Number(...)` at the edge.
- Styling is Tailwind utility classes with explicit light/dark variants
  (`text-black/60 dark:text-white/60`).

## Config & Style

- **Path alias:** `@/*` → repo root (`tsconfig.json`).
- **Prettier:** 4-space tabs, single quotes, semicolons, `printWidth` 80,
  `trailingComma: es5`, always-parens arrows. Run `npm run format` before
  committing.
- **Env:** copy `.env.example` → `.env`. Required: `PLAID_*`, `DATABASE_URL`,
  `DIRECT_URL`, `DEV_USER_ID`, `ENCRYPTION_KEY`, `CRON_SECRET`. `.env*` is
  gitignored except `.env.example`.
- **Migrations:** `prisma/migrations/`; each feature migration is paired with an
  `enable_rls_*` migration.
