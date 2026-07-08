-- public."User".updatedAt has no DB-level default (Prisma's @updatedAt is
-- application-managed only), so the raw INSERT from the auth.users trigger
-- must supply it explicitly or it violates the NOT NULL constraint.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public."User" (id, email, name, "updatedAt")
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
