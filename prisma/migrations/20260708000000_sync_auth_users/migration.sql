-- Mirrors every new Supabase auth user into public."User", keyed by the
-- same id, so existing FKs (PlaidItem.userId, Budget.userId, Goal.userId)
-- keep working unchanged once real auth replaces the DEV_USER_ID stub.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public."User" (id, email, name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
