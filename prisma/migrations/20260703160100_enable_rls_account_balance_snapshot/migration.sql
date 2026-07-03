-- Close off the auto-generated Supabase REST API for the new table, same as
-- the other public tables (see 20260629044823_enable_rls). Prisma connects
-- as the `postgres` role, which bypasses RLS, so server-side queries are
-- unaffected.

ALTER TABLE public."AccountBalanceSnapshot" ENABLE ROW LEVEL SECURITY;
