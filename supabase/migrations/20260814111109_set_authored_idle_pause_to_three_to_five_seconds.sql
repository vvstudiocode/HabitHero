-- Authored idle poses should feel present without making roaming pets look
-- frozen. Use a per-pause three-to-five-second range for every active pet that
-- exposes an Idle clip; walk-only pets keep their separate fallback range.

begin;

update public.game_catalog_items
set metadata = (
      coalesce(metadata, '{}'::jsonb) - 'idlePauseSeconds'
    ) || jsonb_build_object(
      'idlePauseMinSeconds', 3,
      'idlePauseMaxSeconds', 5
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and is_active = true
  and nullif(metadata->>'idleAnimation', '') is not null;

commit;
