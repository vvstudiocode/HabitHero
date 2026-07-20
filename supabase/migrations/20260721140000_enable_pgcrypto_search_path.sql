-- Supabase installs pgcrypto in the `extensions` schema. The password RPCs
-- use SECURITY DEFINER with a restricted search_path, so include that schema
-- explicitly or crypt()/gen_salt() cannot be resolved at runtime.

alter function public.create_child_profile(uuid, text, text)
  set search_path = extensions, pg_catalog, public;
alter function public.update_child_password(uuid, uuid, text)
  set search_path = extensions, pg_catalog, public;
alter function public.authenticate_child(text)
  set search_path = extensions, pg_catalog, public;
