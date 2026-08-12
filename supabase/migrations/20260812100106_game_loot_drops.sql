-- Persistent task rewards. Approval creates available drops; pickup is the
-- only accounting write, so the character can animate immediately while the
-- authoritative wallet/points update happens in the background.

create table if not exists public.game_loot_drops (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  source_task_id uuid not null,
  drop_kind text not null check (drop_kind in ('star', 'scroll')),
  amount bigint not null check (amount > 0),
  position_x numeric(8,3) not null check (position_x between -4.5 and 4.5),
  position_y numeric(8,3) not null check (position_y between -0.1 and 3),
  position_z numeric(8,3) not null check (position_z between -4.5 and 4.5),
  status text not null default 'available' check (status in ('available', 'claimed', 'cancelled')),
  claim_id uuid,
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_task_id, drop_kind),
  unique (child_profile_id, claim_id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade,
  foreign key (family_id, source_task_id)
    references public.tasks (family_id, id) on delete restrict,
  check ((status = 'available' and claim_id is null and claimed_at is null)
    or (status = 'claimed' and claim_id is not null and claimed_at is not null)
    or (status = 'cancelled'))
);

create index if not exists game_loot_drops_child_status_idx
  on public.game_loot_drops (child_profile_id, status, created_at);

create trigger game_loot_drops_updated_at
  before update on public.game_loot_drops
  for each row execute function private.touch_updated_at();

alter table public.game_loot_drops enable row level security;

create policy game_loot_drops_select on public.game_loot_drops for select to authenticated
  using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));

revoke all on table public.game_loot_drops from public, anon, authenticated;
grant select on table public.game_loot_drops to authenticated;

create or replace function private.create_task_loot_drops(
  target_task_id uuid,
  points_to_award integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  task_row public.tasks;
  loot_seed bigint := abs(hashtext(target_task_id::text)::bigint);
begin
  select * into task_row from public.tasks where id = target_task_id;
  if not found then
    raise exception 'task not found' using errcode = '22023';
  end if;
  if points_to_award is null or points_to_award < 0 then
    raise exception 'loot points are invalid' using errcode = '22023';
  end if;

  if points_to_award > 0 then
    insert into public.game_loot_drops (
      family_id, child_profile_id, source_task_id, drop_kind, amount,
      position_x, position_y, position_z
    ) values (
      task_row.family_id, task_row.child_profile_id, task_row.id, 'star', points_to_award,
      -2.8 + (mod(loot_seed, 4) * 0.3), 0.35,
      1.15 + (mod(loot_seed / 4, 4) * 0.35)
    ) on conflict (source_task_id, drop_kind) do nothing;
    update public.game_loot_drops
       set status = 'available', amount = points_to_award, claim_id = null,
           claimed_at = null, claimed_by = null
     where source_task_id = task_row.id and drop_kind = 'star'
       and status = 'cancelled' and claim_id is null;
  end if;

  insert into public.game_loot_drops (
    family_id, child_profile_id, source_task_id, drop_kind, amount,
    position_x, position_y, position_z
  ) values (
    task_row.family_id, task_row.child_profile_id, task_row.id, 'scroll', 1,
    -1.65 + (mod(loot_seed, 4) * 0.25), 0.22,
    1.65 + (mod(loot_seed / 4, 4) * 0.3)
  ) on conflict (source_task_id, drop_kind) do nothing;
  update public.game_loot_drops
     set status = 'available', amount = 1, claim_id = null,
         claimed_at = null, claimed_by = null
   where source_task_id = task_row.id and drop_kind = 'scroll'
     and status = 'cancelled' and claim_id is null;
end;
$$;

create or replace function public.collect_game_loot(
  target_drop_id uuid,
  pickup_idempotency_key uuid,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  drop_row public.game_loot_drops;
  wallet_row public.child_game_wallets;
  replay boolean := false;
  current_points_balance bigint;
  current_wallet_balance bigint;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  if target_drop_id is null or pickup_idempotency_key is null then
    raise exception 'loot pickup details are invalid' using errcode = '22023';
  end if;

  select * into drop_row
    from public.game_loot_drops
   where id = target_drop_id
     and child_profile_id = child_row.id
   for update;
  if not found then
    raise exception 'loot drop not found or not authorized' using errcode = '42501';
  end if;
  if drop_row.status = 'cancelled' then
    raise exception 'loot drop is no longer available' using errcode = '22023';
  end if;
  if drop_row.status = 'claimed' then
    replay := true;
  else
    insert into public.child_game_wallets (family_id, child_profile_id)
    values (child_row.family_id, child_row.id)
    on conflict (child_profile_id) do nothing;
    select * into wallet_row from public.child_game_wallets
     where child_profile_id = child_row.id for update;

    if drop_row.drop_kind = 'star' then
      if not exists (
        select 1 from public.point_ledger
         where task_id = drop_row.source_task_id
           and entry_type = 'task_approved'
      ) then
        insert into public.point_ledger (
          family_id, child_profile_id, task_id, entry_type, points_delta, note
        ) values (
          drop_row.family_id, drop_row.child_profile_id, drop_row.source_task_id,
          'task_approved', drop_row.amount::integer, 'task reward pickup'
        );
        update public.child_profiles
           set points_balance = points_balance + drop_row.amount::integer
         where id = child_row.id;
      end if;
    else
      if not exists (
        select 1 from public.game_currency_ledger
         where source_task_id = drop_row.source_task_id
           and entry_type = 'task_approved'
      ) then
        insert into public.game_currency_ledger (
          family_id, child_profile_id, entry_type, amount_delta, source_task_id, note
        ) values (
          drop_row.family_id, drop_row.child_profile_id, 'task_approved', drop_row.amount,
          drop_row.source_task_id, 'task reward pickup'
        );
        update public.child_game_wallets
           set scroll_balance = scroll_balance + drop_row.amount
         where child_profile_id = child_row.id;
      end if;
    end if;

    update public.game_loot_drops
       set status = 'claimed', claim_id = pickup_idempotency_key,
           claimed_at = timezone('utc', now()), claimed_by = (select auth.uid())
     where id = drop_row.id;
  end if;

  select points_balance into current_points_balance
    from public.child_profiles where id = child_row.id;
  select coalesce(scroll_balance, 0) into current_wallet_balance
    from public.child_game_wallets where child_profile_id = child_row.id;
  return jsonb_build_object(
    'drop_id', drop_row.id,
    'kind', drop_row.drop_kind,
    'amount', drop_row.amount,
    'points_balance', current_points_balance,
    'wallet_balance', coalesce(current_wallet_balance, 0),
    'idempotent_replay', replay
  );
end;
$$;

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
  normalized_feedback text := nullif(trim(feedback), '');
  normalized_correction text := nullif(trim(correction), '');
  normalized_revision_note text := nullif(trim(revision_note), '');
  normalized_tone text := nullif(trim(tone), '');
  points_to_award integer;
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
  if task_row.status <> 'pending' then raise exception 'task is not pending review' using errcode = '22023'; end if;

  if not approved then
    if normalized_revision_note is null or char_length(normalized_revision_note) > 1000 then
      raise exception 'revision note is required' using errcode = '22023';
    end if;
    update public.game_loot_drops set status = 'cancelled'
     where source_task_id = task_row.id and status = 'available';
    update public.tasks set status = 'revision_requested', reviewed_at = timezone('utc', now()),
      reviewed_by = (select auth.uid()), approved_points = null,
      parent_feedback_text = normalized_feedback, parent_correction_text = normalized_correction,
      feedback_tone = normalized_tone, revision_note = normalized_revision_note
     where id = task_row.id returning * into task_row;
    return task_row;
  end if;

  points_to_award := coalesce(approved_points, task_row.points);
  if points_to_award < 0 then raise exception 'approved points must be nonnegative' using errcode = '22023'; end if;
  select * into child_row from public.child_profiles where id = task_row.child_profile_id for update;
  if not found then raise exception 'child profile not found' using errcode = '22023'; end if;
  insert into public.child_game_wallets (family_id, child_profile_id)
    values (task_row.family_id, task_row.child_profile_id)
    on conflict (child_profile_id) do nothing;
  perform private.create_task_loot_drops(target_task_id, points_to_award);
  update public.tasks set status = 'completed', reviewed_at = timezone('utc', now()),
    reviewed_by = (select auth.uid()), approved_points = points_to_award,
    parent_feedback_text = normalized_feedback, parent_correction_text = normalized_correction,
    feedback_tone = normalized_tone, revision_note = null
   where id = task_row.id returning * into task_row;
  return task_row;
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
  if task_row.status <> 'pending' then raise exception 'task is not pending'; end if;
  select * into child_row from public.child_profiles where id = task_row.child_profile_id for update;
  if not found then raise exception 'child profile not found' using errcode = '22023'; end if;
  insert into public.child_game_wallets (family_id, child_profile_id)
    values (task_row.family_id, task_row.child_profile_id)
    on conflict (child_profile_id) do nothing;
  perform private.create_task_loot_drops(target_task_id, greatest(task_row.points, 0));
  update public.tasks set status = 'completed', approved_points = greatest(task_row.points, 0)
   where id = task_row.id returning * into task_row;
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
  update public.game_loot_drops set status = 'cancelled'
   where source_task_id = target_task_id and status = 'available';
  select * into child_row from public.child_profiles where id = task_row.child_profile_id for update;
  select * into wallet_row from public.child_game_wallets where child_profile_id = task_row.child_profile_id for update;
  select * into original_point from public.point_ledger
   where task_id = target_task_id and entry_type = 'task_approved' limit 1;
  original_scroll := coalesce((select sum(amount_delta) from public.game_currency_ledger
    where source_task_id = target_task_id and entry_type = 'task_approved'), 0);
  points_reversed := least(coalesce(original_point.points_delta, 0), child_row.points_balance);
  scroll_reversed := least(greatest(original_scroll, 0), coalesce(wallet_row.scroll_balance, 0));
  if original_point.id is null and original_scroll = 0 then
    reason := '獎勵尚未撿拾，因此沒有扣除點數或卷軸';
  elsif coalesce(original_point.points_delta, 0) > points_reversed or original_scroll > scroll_reversed then
    reason := '孩子已使用部分獎勵，未追回的部分保留且不會再次發放';
  end if;
  if points_reversed > 0 then
    insert into public.point_ledger (family_id, child_profile_id, task_id, entry_type, points_delta, note, reversal_of_ledger_id)
    values (task_row.family_id, task_row.child_profile_id, task_row.id, 'task_approval_reversal', -points_reversed, 'task approval correction', original_point.id);
    update public.child_profiles set points_balance = points_balance - points_reversed where id = child_row.id;
  end if;
  if scroll_reversed > 0 then
    insert into public.game_currency_ledger (family_id, child_profile_id, entry_type, amount_delta, source_task_id, note)
    values (task_row.family_id, task_row.child_profile_id, 'task_approval_reversal', -scroll_reversed, task_row.id, 'task approval correction');
    update public.child_game_wallets set scroll_balance = scroll_balance - scroll_reversed where child_profile_id = task_row.child_profile_id;
  end if;
  if points_reversed = 0 and scroll_reversed = 0 and reason is null then
    reason := '孩子已使用獎勵，因此不追回，也不會再次發放';
  end if;
  insert into public.task_approval_corrections (
    family_id, child_profile_id, task_id, corrected_by, points_reversed, scroll_reversed, reward_retained_reason
  ) values (
    task_row.family_id, task_row.child_profile_id, task_row.id, (select auth.uid()),
    points_reversed, scroll_reversed, reason
  );
  update public.tasks set status = 'pending', reviewed_at = null, reviewed_by = null, approved_points = null
   where id = task_row.id returning * into task_row;
  return jsonb_build_object(
    'task_id', task_row.id,
    'points_reversed', points_reversed,
    'scroll_reversed', scroll_reversed,
    'message', case when reason is null then '已撤銷並收回獎勵' else reason end
  );
end;
$$;

revoke all on function private.create_task_loot_drops(uuid, integer) from public, anon, authenticated;
revoke all on function public.collect_game_loot(uuid, uuid, uuid) from public, anon;
grant execute on function public.collect_game_loot(uuid, uuid, uuid) to authenticated;
