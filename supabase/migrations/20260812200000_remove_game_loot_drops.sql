-- Retire the world loot-drop presentation. Existing rows remain as history,
-- while any drop that was still visible becomes unavailable immediately.
update public.game_loot_drops
   set status = 'cancelled'
 where status = 'available';

-- Keep the historical helper safe for any older function body that may still
-- reference it during a staged deployment. New rewards are credited directly
-- by the approval functions below.
create or replace function private.create_task_loot_drops(
  target_task_id uuid,
  points_to_award integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return;
  -- no-op: world loot drops are retired.
end;
$$;

drop function if exists public.collect_game_loot(uuid, uuid, uuid);
drop function if exists public.collect_game_loot_batch(uuid[], uuid, uuid);

create or replace function public.review_adventure_completion(
  target_task_id uuid,
  approved boolean,
  approved_points integer default null,
  feedback text default null,
  correction text default null,
  tone text default null,
  revision_note text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  task_row public.tasks;
  child_row public.child_profiles;
  points_to_award integer;
  normalized_feedback text := nullif(trim(feedback), '');
  normalized_correction text := nullif(trim(correction), '');
  normalized_revision_note text := nullif(trim(revision_note), '');
  normalized_tone text := nullif(trim(tone), '');
begin
  if (select auth.uid()) is null or approved is null then
    raise exception 'review decision is required' using errcode = '22023';
  end if;
  if normalized_tone is not null and normalized_tone not in ('encouraging', 'coaching', 'corrective', 'celebratory') then
    raise exception 'feedback tone is invalid' using errcode = '22023';
  end if;
  select * into task_row from public.tasks where id = target_task_id for update;
  if not found or not private.is_family_parent(task_row.family_id) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.status = 'completed' and approved then return task_row; end if;
  if task_row.status <> 'pending' then
    raise exception 'task is not pending review' using errcode = '22023';
  end if;

  if not approved then
    if normalized_revision_note is null or char_length(normalized_revision_note) > 1000 then
      raise exception 'revision note is required' using errcode = '22023';
    end if;
    update public.tasks
       set status = 'revision_requested', reviewed_at = timezone('utc', now()), reviewed_by = (select auth.uid()),
           approved_points = null, parent_feedback_text = normalized_feedback,
           parent_correction_text = normalized_correction, feedback_tone = normalized_tone,
           revision_note = normalized_revision_note
     where id = task_row.id
     returning * into task_row;
    return task_row;
  end if;

  points_to_award := coalesce(approved_points, task_row.points);
  if points_to_award < 0 then
    raise exception 'approved points must be nonnegative' using errcode = '22023';
  end if;
  select * into child_row from public.child_profiles where id = task_row.child_profile_id for update;
  if not found then
    raise exception 'child profile not found' using errcode = '22023';
  end if;

  if points_to_award > 0 and not exists (
    select 1 from public.point_ledger
     where task_id = task_row.id and entry_type = 'task_approved'
  ) then
    insert into public.point_ledger (
      family_id, child_profile_id, task_id, entry_type, points_delta, note
    ) values (
      task_row.family_id, task_row.child_profile_id, task_row.id,
      'task_approved', points_to_award, coalesce(normalized_feedback, 'task approved')
    );
    update public.child_profiles set points_balance = points_balance + points_to_award
     where id = child_row.id;
  end if;

  insert into public.child_game_wallets (family_id, child_profile_id)
  values (task_row.family_id, task_row.child_profile_id)
  on conflict (child_profile_id) do nothing;
  if not exists (
    select 1 from public.game_currency_ledger
     where source_task_id = task_row.id and entry_type = 'task_approved'
  ) then
    insert into public.game_currency_ledger (
      family_id, child_profile_id, entry_type, amount_delta, source_task_id, note
    ) values (
      task_row.family_id, task_row.child_profile_id, 'task_approved', 1,
      task_row.id, 'approved adventure reward'
    );
    update public.child_game_wallets set scroll_balance = scroll_balance + 1
     where child_profile_id = task_row.child_profile_id;
  end if;

  update public.tasks
     set status = 'completed', reviewed_at = timezone('utc', now()), reviewed_by = (select auth.uid()),
         approved_points = points_to_award, parent_feedback_text = normalized_feedback,
         parent_correction_text = normalized_correction, feedback_tone = normalized_tone,
         revision_note = null
   where id = task_row.id
   returning * into task_row;
  return task_row;
end;
$$;

create or replace function public.review_task_completion(
  target_task_id uuid,
  approved boolean,
  approved_points integer,
  feedback text,
  correction text,
  tone text,
  revision_note text
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return public.review_adventure_completion(
    target_task_id, approved, approved_points, feedback, correction, tone, revision_note
  );
end;
$$;

create or replace function public.approve_task_completion(target_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  task_row public.tasks;
  child_row public.child_profiles;
begin
  select * into task_row from public.tasks where id = target_task_id for update;
  if not found or not private.is_family_parent(task_row.family_id) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.status <> 'pending' then
    raise exception 'task is not pending';
  end if;
  select * into child_row from public.child_profiles where id = task_row.child_profile_id for update;
  if task_row.points > 0 and not exists (
    select 1 from public.point_ledger
     where task_id = task_row.id and entry_type = 'task_approved'
  ) then
    insert into public.point_ledger (
      family_id, child_profile_id, task_id, entry_type, points_delta, note
    ) values (
      task_row.family_id, task_row.child_profile_id, task_row.id,
      'task_approved', task_row.points, 'task approved'
    );
    update public.child_profiles set points_balance = points_balance + task_row.points
     where id = child_row.id;
  end if;
  insert into public.child_game_wallets (family_id, child_profile_id)
  values (task_row.family_id, task_row.child_profile_id)
  on conflict (child_profile_id) do nothing;
  if not exists (
    select 1 from public.game_currency_ledger
     where source_task_id = task_row.id and entry_type = 'task_approved'
  ) then
    insert into public.game_currency_ledger (
      family_id, child_profile_id, entry_type, amount_delta, source_task_id, note
    ) values (
      task_row.family_id, task_row.child_profile_id, 'task_approved', 1,
      task_row.id, 'approved task reward'
    );
    update public.child_game_wallets set scroll_balance = scroll_balance + 1
     where child_profile_id = task_row.child_profile_id;
  end if;
  update public.tasks set status = 'completed' where id = task_row.id returning * into task_row;
  return task_row;
end;
$$;

create or replace function public.revoke_task_approval(target_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  task_row public.tasks;
  child_row public.child_profiles;
  wallet_row public.child_game_wallets;
  original_point public.point_ledger;
  original_scroll bigint;
  points_reversed integer;
  scroll_reversed bigint;
  reason text := null;
begin
  select * into task_row from public.tasks where id = target_task_id for update;
  if not found or not private.is_family_parent(task_row.family_id) or task_row.status <> 'completed' then
    raise exception 'task is not an approved task' using errcode = '22023';
  end if;
  if exists (select 1 from public.task_approval_corrections where task_id = target_task_id) then
    raise exception 'task approval has already been corrected' using errcode = '23505';
  end if;
  select * into child_row from public.child_profiles where id = task_row.child_profile_id for update;
  select * into wallet_row from public.child_game_wallets where child_profile_id = task_row.child_profile_id for update;
  select * into original_point from public.point_ledger
   where task_id = target_task_id and entry_type = 'task_approved' limit 1;
  original_scroll := coalesce((select sum(amount_delta) from public.game_currency_ledger
    where source_task_id = target_task_id and entry_type = 'task_approved'), 0);
  points_reversed := least(coalesce(original_point.points_delta, 0), child_row.points_balance);
  scroll_reversed := least(greatest(original_scroll, 0), coalesce(wallet_row.scroll_balance, 0));
  if coalesce(original_point.points_delta, 0) > points_reversed or original_scroll > scroll_reversed then
    reason := '孩子已使用部分獎勵，未追回的部分保留且不會再次發放';
  end if;
  if points_reversed > 0 then
    insert into public.point_ledger (
      family_id, child_profile_id, task_id, entry_type, points_delta, note, reversal_of_ledger_id
    ) values (
      task_row.family_id, task_row.child_profile_id, task_row.id,
      'task_approval_reversal', -points_reversed, 'task approval correction', original_point.id
    );
    update public.child_profiles set points_balance = points_balance - points_reversed
     where id = child_row.id;
  end if;
  if scroll_reversed > 0 then
    insert into public.game_currency_ledger (
      family_id, child_profile_id, entry_type, amount_delta, source_task_id, note
    ) values (
      task_row.family_id, task_row.child_profile_id, 'task_approval_reversal', -scroll_reversed,
      task_row.id, 'task approval correction'
    );
    update public.child_game_wallets set scroll_balance = scroll_balance - scroll_reversed
     where child_profile_id = task_row.child_profile_id;
  end if;
  if points_reversed = 0 and scroll_reversed = 0 then
    reason := coalesce(reason, '孩子已使用獎勵，因此不追回，也不會再次發放');
  end if;
  insert into public.task_approval_corrections (
    family_id, child_profile_id, task_id, corrected_by,
    points_reversed, scroll_reversed, reward_retained_reason
  ) values (
    task_row.family_id, task_row.child_profile_id, task_row.id, (select auth.uid()),
    points_reversed, scroll_reversed, reason
  );
  update public.tasks
     set status = 'pending', reviewed_at = null, reviewed_by = null, approved_points = null
   where id = task_row.id
   returning * into task_row;
  return jsonb_build_object(
    'task_id', task_row.id,
    'points_reversed', points_reversed,
    'scroll_reversed', scroll_reversed,
    'message', case when reason is null then '已撤銷並收回獎勵' else reason end
  );
end;
$$;

revoke all on function private.create_task_loot_drops(uuid, integer) from public, anon, authenticated;
revoke all on function public.revoke_task_approval(uuid) from public, anon;
grant execute on function public.revoke_task_approval(uuid) to authenticated;
revoke all on function public.review_adventure_completion(uuid, boolean, integer, text, text, text, text) from public, anon;
grant execute on function public.review_adventure_completion(uuid, boolean, integer, text, text, text, text) to authenticated;
revoke all on function public.review_task_completion(uuid, boolean, integer, text, text, text, text) from public, anon;
grant execute on function public.review_task_completion(uuid, boolean, integer, text, text, text, text) to authenticated;
revoke all on function public.approve_task_completion(uuid) from public, anon;
grant execute on function public.approve_task_completion(uuid) to authenticated;
