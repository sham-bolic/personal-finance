# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

An AI-first personal finance app (Next.js App Router + Supabase Auth + Prisma/Postgres + Plaid). Users link bank
accounts via Plaid, transactions sync automatically, and the app surfaces net worth, cash flow, budgets, and goals.

## Commands

```bash
npm run dev            # start dev server
npm run build           # production build
npm run lint            # eslint (flat config, eslint-config-next)
npm run format           # prettier --write .
npm run format:check     # prettier --check .

npx prisma migrate dev --name <name>   # create + apply a migration (uses DIRECT_URL, see prisma.config.ts)
npx prisma generate                    # regenerate client into generated/prisma (also runs on install)
npx prisma studio                      # inspect the DB ``` There is no test suite configured in this repo currently. ## Important: this is not the Next.js you know Per `AGENTS.md`, this project runs a Next.js version with breaking changes vs. training-data Next.js. Before writing framework-adjacent code, check `node_modules/next/dist/docs/`. The one that already bit this codebase: - **`middleware.ts` is renamed `proxy.ts`**, and the exported function is `proxy`, not `middleware`. This repo's `proxy.ts` (project root) is the auth gate — do not recreate a `middleware.ts` file. ## Architecture ### Auth: Supabase, not Prisma, is the source of truth for identity

- Supabase Auth (`auth.users`) owns signup/login/session. A Postgres trigger (see
  `prisma/migrations/20260708000000_sync_auth_users` and the fix in `..._000100_fix_sync_auth_users_trigger`) mirrors
  new `auth.users` rows into the Prisma-managed `public.User` table, keyed on the same UUID.
- `lib/db/user.ts`'s `getCurrentUser()` is the standard entry point for "who is calling": it reads the Supabase
  session, then looks up (or, if the sync trigger hasn't fired yet, upserts as a fallback) the matching `User` row.
  Nearly every API route and server component calls this first.
- Route protection happens in two layers, both required:
  1. `proxy.ts` redirects unauthenticated requests to `/login` for path prefixes in `PROTECTED_PREFIXES`
     (`/dashboard`, `/budgets`, `/goals`, `/piggyai`). It uses `supabase.auth.getUser()` (revalidates against
     Supabase), never `getSession()` (would trust a possibly-stale cookie).
  2. Individual routes/Server Functions must still call `getCurrentUser()` themselves — per the Next.js docs on
     Proxy, a matcher change can silently drop coverage, so proxy is not a substitute for per-route auth checks.
- Two Supabase clients exist for different contexts: `lib/supabase/server.ts` (Server Components/Route Handlers,
  cookie-based) and `lib/supabase/client.ts` (browser). Don't cross-use them.
- Postgres RLS is enabled on every table specifically to lock out the Supabase PostgREST auto-API (anon/authenticated
  roles get zero access). Prisma connects as the `postgres` role and bypasses RLS entirely — RLS is not the
  authorization mechanism for app code, `getCurrentUser()` + scoping queries by `userId` is. Any new table needs an
  `ENABLE ROW LEVEL SECURITY` migration alongside it (see `prisma/migrations/*_enable_rls_*`).

### Data-access layer (`lib/db/`)

- `lib/db/index.ts` is a barrel export — **import from `@/lib/db`** in app code (`import { getCurrentUser, ... }
  from '@/lib/db'`).
- Inside `lib/db/`, modules import each other by direct relative path (e.g. `./items`), never through the barrel —
  avoids circular imports.
- Functions that need to compose across tables in one transaction accept an optional `db: Prisma.TransactionClient |
  typeof prisma = prisma` parameter, defaulting to the global client for standalone calls but allowing the caller to
  pass a `tx` when enrolling in `prisma.$transaction(...)`. See `lib/db/items.ts`'s `linkPlaidItem` for the pattern:
  the transaction boundary lives in the DB layer, not in the route handler.
- `Account.currentBalance` is overwritten in place on every Plaid sync (it's a snapshot of "now"), so net worth
  history is derived separately via `AccountBalanceSnapshot` rows, written by the daily cron
  (`GET /api/sync`, see below) and backfilled once on initial link.

### Plaid integration (`lib/plaid_client.ts`, `lib/plaid_sync.ts`, `lib/crypto.ts`)

- `PlaidItem.accessToken` is encrypted at rest with AES-256-GCM (`lib/crypto.ts`) before being written by
  `upsertPlaidItem`; `ENCRYPTION_KEY` must be a base64-encoded 32-byte key, and rotating it makes existing tokens
  undecryptable (users must re-link).
- Sync uses Plaid's `transactionsSync` cursor pagination (`PlaidItem.syncCursor`). The flow, split across
  `lib/plaid_sync.ts`, deliberately separates "first page" from "remaining pages":
  - `syncItemFirstPage` runs synchronously so the caller (e.g. an API response) can reflect fresh data immediately.
  - `syncItemAllPages` pages through everything from a given cursor; used both to finish a sync in the background and
    for a full from-scratch backfill.
  - `app/api/sync/route.ts`'s `POST` runs the first page inline, then continues remaining pages via Next's `after()`
    so the HTTP response doesn't wait on a potentially long sync.
  - `backfillNewItem` (called right after linking a new item) does a full historical sync then derives balance
    history per account, so the net worth graph doesn't start as a flat line on link day.
- `GET /api/sync` is the Vercel Cron target (`vercel.json`, daily at 06:00 UTC) that snapshots current balances into
  `AccountBalanceSnapshot`; it's authorized via a `Authorization: Bearer $CRON_SECRET` header, not user session.

### App Router structure

- `app/(app)/` is a route group for authenticated, nav-visible pages (`dashboard`, `budgets`, `goals`); its
  `layout.tsx` renders the persistent `SideNav`. `app/login`, `app/signup`, `app/auth/callback` sit outside the group
  since they're pre-auth / auth-flow pages without the app chrome.
- `app/api/**/route.ts` handlers follow a consistent shape: validate input inline, call `getCurrentUser()`, delegate
  all actual data work to `lib/db`, wrap in try/catch returning `Response.json({ error }, { status })`. Follow this
  shape for new routes rather than introducing a different error-handling convention.
- Dynamic segments use bracket folders per Next.js convention (`app/api/budgets/[id]`,
  `app/api/goals/[id]/contributions/[contributionId]`).

## Conventions

- Prettier: 4-space indent, single quotes, semicolons, 80-col print width (`.prettierrc.json`). Run `npm run format`
  before committing.
- Path alias `@/*` maps to the repo root (`tsconfig.json`), used everywhere instead of relative imports across
  top-level dirs (`@/lib/...`, `@/generated/prisma/...`).
- Prisma client is generated into `generated/prisma` (not the default `node_modules/.prisma`) — import types/client
  from `@/generated/prisma/client`, not `@prisma/client`.
- `DATABASE_URL` (pooled, port 6543, `pgbouncer=true`) is for runtime queries; `DIRECT_URL` (port 5432) is for
  `prisma migrate`. Get both wrong and migrations or pooled queries fail in confusing ways — see `.env.example`.
