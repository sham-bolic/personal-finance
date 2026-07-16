-- Close off the auto-generated Supabase REST API for the new tables, same as
-- the other public tables (see 20260629044823_enable_rls). Prisma connects as
-- the `postgres` role, which bypasses RLS, so server-side queries are
-- unaffected. No policies are added, so anon/authenticated get zero access.
--
-- Holding is user data (scoped transitively via Account -> PlaidItem in app
-- code). Security is public reference data with no tenant, but it still gets
-- RLS enabled here for the same reason: the goal is to deny the PostgREST
-- auto-API, not to enforce per-user tenancy.

ALTER TABLE public."Security" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Holding" ENABLE ROW LEVEL SECURITY;
