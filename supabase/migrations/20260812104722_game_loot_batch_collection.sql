-- Collect several nearby drops in one transaction. The client can start all
-- flying-item animations immediately, while this RPC locks and accounts for
-- the batch in the background.

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
  ledger_row public.point_ledger;
  resolved_child_id uuid;
  replay boolean := false;
  current_points_balance bigint;
  current_wallet_balance bigint;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  resolved_child_id := child_row.id;
  if target_drop_id is null or pickup_idempotency_key is null then
    raise exception 'loot pickup details are invalid' using errcode = '22023';
  end if;

  select cp.* into child_row
    from public.child_profiles cp
   where cp.id = resolved_child_id
   for update;
  select drop.* into drop_row
    from public.game_loot_drops drop
   where drop.id = target_drop_id
     and drop.child_profile_id = resolved_child_id
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
    if drop_row.drop_kind = 'star' then
      select pl.* into ledger_row
        from public.point_ledger pl
       where pl.task_id = drop_row.source_task_id
         and pl.entry_type = 'task_approved'
       for update;
      if ledger_row.id is null then
        insert into public.point_ledger (
          family_id, child_profile_id, task_id, entry_type, points_delta, note
        ) values (
          drop_row.family_id, drop_row.child_profile_id, drop_row.source_task_id,
          'task_approved', drop_row.amount::integer, 'task reward pickup'
        );
      else
        update public.point_ledger
           set points_delta = points_delta + drop_row.amount::integer
         where id = ledger_row.id;
      end if;
      update public.child_profiles
         set points_balance = points_balance + drop_row.amount::integer
       where id = resolved_child_id;
    else
      insert into public.child_game_wallets (family_id, child_profile_id)
      values (child_row.family_id, resolved_child_id)
      on conflict (child_profile_id) do nothing;
      select wallet.* into wallet_row
        from public.child_game_wallets wallet
       where wallet.child_profile_id = resolved_child_id
       for update;
      if not exists (
        select 1 from public.game_currency_ledger currency
         where currency.source_task_id = drop_row.source_task_id
           and currency.entry_type = 'task_approved'
      ) then
        insert into public.game_currency_ledger (
          family_id, child_profile_id, entry_type, amount_delta, source_task_id, note
        ) values (
          drop_row.family_id, drop_row.child_profile_id, 'task_approved', drop_row.amount,
          drop_row.source_task_id, 'task reward pickup'
        );
        update public.child_game_wallets
           set scroll_balance = scroll_balance + drop_row.amount
         where child_profile_id = resolved_child_id;
      end if;
    end if;

    update public.game_loot_drops
       set status = 'claimed', claim_id = pickup_idempotency_key,
           claimed_at = timezone('utc', now()), claimed_by = (select auth.uid())
     where id = drop_row.id;
  end if;

  select cp.points_balance into current_points_balance
    from public.child_profiles cp where cp.id = resolved_child_id;
  select coalesce(wallet.scroll_balance, 0) into current_wallet_balance
    from public.child_game_wallets wallet where wallet.child_profile_id = resolved_child_id;
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

create or replace function public.collect_game_loot_batch(
  target_drop_ids uuid[],
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
  wallet_row public.child_game_wallets;
  point_row public.point_ledger;
  collected_drop public.game_loot_drops;
  resolved_child_id uuid;
  collected_ids uuid[] := '{}'::uuid[];
  newly_collected_ids uuid[] := '{}'::uuid[];
  star_total integer := 0;
  scroll_total bigint := 0;
  reported_star_total integer := 0;
  reported_scroll_total bigint := 0;
  current_points_balance bigint;
  current_wallet_balance bigint;
  replay boolean := false;
  task_group record;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  resolved_child_id := child_row.id;
  if pickup_idempotency_key is null
     or target_drop_ids is null
     or coalesce(array_length(target_drop_ids, 1), 0) = 0
     or array_length(target_drop_ids, 1) > 64 then
    raise exception 'loot pickup batch is invalid' using errcode = '22023';
  end if;

  select cp.* into child_row
    from public.child_profiles cp
   where cp.id = resolved_child_id
   for update;
  insert into public.child_game_wallets (family_id, child_profile_id)
  values (child_row.family_id, resolved_child_id)
  on conflict (child_profile_id) do nothing;
  select wallet.* into wallet_row
    from public.child_game_wallets wallet
   where wallet.child_profile_id = resolved_child_id
   for update;

  -- A replay returns the already-claimed rows as successful too, so a lost
  -- response can be retried without leaving the client with visible ghosts.
  select coalesce(array_agg(drop.id order by drop.created_at, drop.id), '{}'::uuid[])
    into collected_ids
    from public.game_loot_drops drop
   where drop.id = any(target_drop_ids)
     and drop.child_profile_id = resolved_child_id
     and drop.status = 'claimed';
  replay := coalesce(array_length(collected_ids, 1), 0) > 0;
  select coalesce(sum(drop.amount) filter (where drop.drop_kind = 'star'), 0)::integer,
         coalesce(sum(drop.amount) filter (where drop.drop_kind = 'scroll'), 0)::bigint
    into reported_star_total, reported_scroll_total
    from public.game_loot_drops drop
   where drop.id = any(collected_ids);

  for collected_drop in
    select drop.*
      from public.game_loot_drops drop
     where drop.id = any(target_drop_ids)
       and drop.child_profile_id = resolved_child_id
       and drop.status = 'available'
     order by drop.created_at, drop.id
     for update
  loop
    collected_ids := array_append(collected_ids, collected_drop.id);
    newly_collected_ids := array_append(newly_collected_ids, collected_drop.id);
    if collected_drop.drop_kind = 'star' then
      star_total := star_total + collected_drop.amount::integer;
      reported_star_total := reported_star_total + collected_drop.amount::integer;
    else
      scroll_total := scroll_total + collected_drop.amount;
      reported_scroll_total := reported_scroll_total + collected_drop.amount;
    end if;
    update public.game_loot_drops
       set status = 'claimed', claim_id = gen_random_uuid(),
           claimed_at = timezone('utc', now()), claimed_by = (select auth.uid())
     where id = collected_drop.id;
  end loop;

  -- Each task keeps one point-ledger row. Picking five one-point stars updates
  -- that row to +5 instead of incorrectly treating the second star as a replay.
  for task_group in
    select drop.source_task_id, sum(drop.amount)::integer as amount,
           min(drop.family_id) as family_id, min(drop.child_profile_id) as child_profile_id
      from public.game_loot_drops drop
     where drop.id = any(collected_ids)
       and drop.id = any(newly_collected_ids)
       and drop.drop_kind = 'star'
     group by drop.source_task_id
  loop
    select pl.* into point_row
      from public.point_ledger pl
     where pl.task_id = task_group.source_task_id
       and pl.entry_type = 'task_approved'
     for update;
    if point_row.id is null then
      insert into public.point_ledger (
        family_id, child_profile_id, task_id, entry_type, points_delta, note
      ) values (
        task_group.family_id, task_group.child_profile_id, task_group.source_task_id,
        'task_approved', task_group.amount, 'task reward pickup'
      );
    else
      update public.point_ledger
         set points_delta = points_delta + task_group.amount
       where id = point_row.id;
    end if;
  end loop;
  if star_total > 0 then
    update public.child_profiles
       set points_balance = points_balance + star_total
     where id = resolved_child_id;
  end if;

  for task_group in
    select drop.source_task_id, sum(drop.amount)::bigint as amount,
           min(drop.family_id) as family_id, min(drop.child_profile_id) as child_profile_id
      from public.game_loot_drops drop
     where drop.id = any(collected_ids)
       and drop.id = any(newly_collected_ids)
       and drop.drop_kind = 'scroll'
     group by drop.source_task_id
  loop
    if not exists (
      select 1 from public.game_currency_ledger currency
       where currency.source_task_id = task_group.source_task_id
         and currency.entry_type = 'task_approved'
    ) then
      insert into public.game_currency_ledger (
        family_id, child_profile_id, entry_type, amount_delta, source_task_id, note
      ) values (
        task_group.family_id, task_group.child_profile_id, 'task_approved', task_group.amount,
        task_group.source_task_id, 'task reward pickup'
      );
    else
      scroll_total := scroll_total - task_group.amount;
    end if;
  end loop;
  if scroll_total > 0 then
    update public.child_game_wallets
       set scroll_balance = scroll_balance + scroll_total
     where child_profile_id = resolved_child_id;
  end if;

  select cp.points_balance into current_points_balance
    from public.child_profiles cp where cp.id = resolved_child_id;
  select coalesce(wallet.scroll_balance, 0) into current_wallet_balance
    from public.child_game_wallets wallet where wallet.child_profile_id = resolved_child_id;
  return jsonb_build_object(
    'drop_ids', collected_ids,
    'star_amount', reported_star_total,
    'scroll_amount', reported_scroll_total,
    'points_balance', current_points_balance,
    'wallet_balance', coalesce(current_wallet_balance, 0),
    'idempotent_replay', replay
  );
end;
$$;

revoke all on function public.collect_game_loot(uuid, uuid, uuid) from public, anon;
grant execute on function public.collect_game_loot(uuid, uuid, uuid) to authenticated;
revoke all on function public.collect_game_loot_batch(uuid[], uuid, uuid) from public, anon;
grant execute on function public.collect_game_loot_batch(uuid[], uuid, uuid) to authenticated;
