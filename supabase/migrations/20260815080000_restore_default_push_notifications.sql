-- Push notifications are on by default. The profile flag remains the durable
-- opt-out so an app update or APNs token refresh cannot change user intent.
alter table public.profiles
  alter column notifications_enabled set default true;

-- The original push migration used false as the default. Profiles that still
-- have that untouched value and no device history were never explicitly opted
-- out, so restore the new default for them. Profiles with a device row keep
-- their existing value, including an explicit off state.
update public.profiles
set notifications_enabled = true
where notifications_enabled = false
  and not exists (
    select 1
    from public.push_devices
    where push_devices.profile_id = profiles.id
  );
