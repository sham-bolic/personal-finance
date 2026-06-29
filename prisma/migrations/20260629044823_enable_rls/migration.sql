-- Enable Row Level Security on all public tables.
-- With RLS enabled and NO policies, the Supabase anon/authenticated roles
-- (PostgREST API) are denied all access, closing off the auto-generated REST
-- API. Prisma connects as the `postgres` role, which bypasses RLS, so server-
-- side queries are unaffected. Critical here because PlaidItem.accessToken
-- holds live bank credentials.

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PlaidItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Transaction" ENABLE ROW LEVEL SECURITY;