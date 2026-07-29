-- Theme persistence is intentionally data-only in this migration. The UI can
-- continue resolving catalog defaults until subscription-backed customization
-- is enabled.
alter table public.families
  add column if not exists accent_color text not null default 'amber',
  add column if not exists background_image_mobile_url text,
  add column if not exists background_image_desktop_url text;

alter table public.child_profiles
  add column if not exists accent_color text,
  add column if not exists background_image_mobile_url text,
  add column if not exists background_image_desktop_url text;

alter table public.families
  drop constraint if exists families_accent_color_check,
  drop constraint if exists families_background_image_mobile_url_check,
  drop constraint if exists families_background_image_desktop_url_check,
  add constraint families_accent_color_check
    check (accent_color ~ '^([a-z][a-z0-9-]{0,31}|#[0-9A-Fa-f]{6})$'),
  add constraint families_background_image_mobile_url_check
    check (background_image_mobile_url is null or char_length(background_image_mobile_url) between 1 and 2048),
  add constraint families_background_image_desktop_url_check
    check (background_image_desktop_url is null or char_length(background_image_desktop_url) between 1 and 2048);

alter table public.child_profiles
  drop constraint if exists child_profiles_accent_color_check,
  drop constraint if exists child_profiles_background_image_mobile_url_check,
  drop constraint if exists child_profiles_background_image_desktop_url_check,
  add constraint child_profiles_accent_color_check
    check (accent_color is null or accent_color ~ '^([a-z][a-z0-9-]{0,31}|#[0-9A-Fa-f]{6})$'),
  add constraint child_profiles_background_image_mobile_url_check
    check (background_image_mobile_url is null or char_length(background_image_mobile_url) between 1 and 2048),
  add constraint child_profiles_background_image_desktop_url_check
    check (background_image_desktop_url is null or char_length(background_image_desktop_url) between 1 and 2048);
