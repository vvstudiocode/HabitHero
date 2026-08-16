-- Keep point history append-only and make parent adjustments atomic with the
-- child balance update. The client never receives permission to write either
-- the ledger or points_balance directly.

create index if not exists ledger_family_created_idx
  on public.point_ledger (family_id, created_at desc, id desc);

create or replace function public.adjust_child_points(
  target_child_profile_id uuid,
  points_delta integer,
  adjustment_note text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  ledger_row public.point_ledger;
  normalized_note text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if points_delta is null
     or points_delta = 0
     or points_delta < -10000
     or points_delta > 10000 then
    raise exception 'point adjustment must be a non-zero integer between -10000 and 10000' using errcode = '22023';
  end if;

  normalized_note := nullif(btrim(coalesce(adjustment_note, '')), '');
  if normalized_note is null or char_length(normalized_note) > 200 then
    raise exception 'point adjustment note must contain 1 to 200 characters' using errcode = '22023';
  end if;

  select *
    into child_row
    from public.child_profiles
   where id = target_child_profile_id
   for update;

  if not found or not private.is_family_parent(child_row.family_id) then
    raise exception 'child not found or not authorized' using errcode = '42501';
  end if;

  if child_row.points_balance + points_delta < 0 then
    raise exception 'insufficient points for adjustment' using errcode = '22003';
  end if;

  insert into public.point_ledger (
    family_id,
    child_profile_id,
    entry_type,
    points_delta,
    note
  ) values (
    child_row.family_id,
    child_row.id,
    'manual_adjustment',
    points_delta,
    normalized_note
  ) returning * into ledger_row;

  update public.child_profiles
     set points_balance = points_balance + points_delta
   where id = child_row.id
   returning * into child_row;

  return jsonb_build_object(
    'ledger_entry', to_jsonb(ledger_row),
    'points_balance', child_row.points_balance
  );
end;
$$;

revoke all on function public.adjust_child_points(uuid, integer, text) from public, anon;
grant execute on function public.adjust_child_points(uuid, integer, text) to authenticated;

-- Parent profile editing only needs the display name. Removing table-wide
-- update prevents a signed-in client from changing points_balance directly.
revoke update on table public.child_profiles from authenticated;
grant update (display_name) on table public.child_profiles to authenticated;
