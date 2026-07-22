-- Follow-up security contract for deployed databases. Keep wishlist approval atomic.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    (select auth.uid()) = id
    or exists (select 1 from public.family_members m where m.profile_id = profiles.id and private.is_family_parent(m.family_id))
  );

drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members for select to authenticated
  using (private.is_family_parent(family_id) or profile_id = (select auth.uid()));

drop policy if exists child_profiles_select on public.child_profiles;
create policy child_profiles_select on public.child_profiles for select to authenticated
  using (private.is_family_parent(family_id) or private.is_child_owner(family_id, id));

drop policy if exists task_templates_select on public.task_templates;
create policy task_templates_select on public.task_templates for select to authenticated
  using (private.is_family_parent(family_id));

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (private.is_family_parent(family_id) or private.is_child_owner(family_id, child_profile_id));

drop policy if exists rewards_select on public.rewards;
create policy rewards_select on public.rewards for select to authenticated
  using (private.is_family_parent(family_id) or private.is_child_owner(family_id, child_profile_id));

drop policy if exists wishlist_select on public.wishlist_items;
create policy wishlist_select on public.wishlist_items for select to authenticated
  using (private.is_family_parent(family_id) or private.is_child_owner(family_id, child_profile_id));

create or replace function public.approve_wishlist_item(
  target_family_id uuid,
  target_child_profile_id uuid,
  target_wishlist_id uuid,
  target_points integer
)
returns public.rewards
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  wishlist_row public.wishlist_items;
  reward_row public.rewards;
begin
  if (select auth.uid()) is null or not private.is_family_parent(target_family_id) then
    raise exception 'wishlist item not found or not authorized' using errcode = '42501';
  end if;
  if target_points <= 0 then
    raise exception 'reward points must be positive' using errcode = '22023';
  end if;
  select * into wishlist_row
    from public.wishlist_items
   where id = target_wishlist_id
     and family_id = target_family_id
     and child_profile_id = target_child_profile_id
   for update;
  if not found then
    raise exception 'wishlist item not found or not authorized' using errcode = '42501';
  end if;
  insert into public.rewards (family_id, child_profile_id, name, points, icon)
    values (wishlist_row.family_id, wishlist_row.child_profile_id, wishlist_row.name, target_points, 'Star')
    returning * into reward_row;
  delete from public.wishlist_items where id = wishlist_row.id;
  return reward_row;
end;
$$;

revoke all on function public.approve_wishlist_item(uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.approve_wishlist_item(uuid, uuid, uuid, integer) to authenticated;
;
