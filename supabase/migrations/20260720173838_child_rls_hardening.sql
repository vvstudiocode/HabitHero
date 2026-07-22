-- Anonymous Auth users are still Postgres role `authenticated`. Keep every
-- child policy explicitly scoped to the bound child instead of family-wide.

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id or private.is_family_parent((select family_id from public.family_members where profile_id = profiles.id limit 1)));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists families_select on public.families;
create policy families_select on public.families for select to authenticated
  using (private.is_family_parent(id));
drop policy if exists families_update on public.families;
create policy families_update on public.families for update to authenticated
  using (private.is_family_parent(id)) with check (private.is_family_parent(id));
drop policy if exists families_delete on public.families;
create policy families_delete on public.families for delete to authenticated
  using (private.is_family_parent(id) and created_by = (select auth.uid()));

drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members for select to authenticated
  using (private.is_family_parent(family_id) or profile_id = (select auth.uid()));
drop policy if exists family_members_insert on public.family_members;
create policy family_members_insert on public.family_members for insert to authenticated
  with check (private.is_family_parent(family_id) or (profile_id = (select auth.uid()) and role = 'parent' and exists (select 1 from public.families f where f.id = family_id and f.created_by = (select auth.uid()))));
drop policy if exists family_members_update on public.family_members;
create policy family_members_update on public.family_members for update to authenticated
  using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));
drop policy if exists family_members_delete on public.family_members;
create policy family_members_delete on public.family_members for delete to authenticated
  using (private.is_family_parent(family_id));

drop policy if exists child_profiles_select on public.child_profiles;
create policy child_profiles_select on public.child_profiles for select to authenticated
  using (private.is_family_parent(family_id) or profile_id = (select auth.uid()));
drop policy if exists child_profiles_update on public.child_profiles;
create policy child_profiles_update on public.child_profiles for update to authenticated
  using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));
drop policy if exists child_profiles_delete on public.child_profiles;
create policy child_profiles_delete on public.child_profiles for delete to authenticated
  using (private.is_family_parent(family_id));

drop policy if exists task_templates_select on public.task_templates;
create policy task_templates_select on public.task_templates for select to authenticated using (private.is_family_parent(family_id));
drop policy if exists task_templates_insert on public.task_templates;
create policy task_templates_insert on public.task_templates for insert to authenticated with check (private.is_family_parent(family_id));
drop policy if exists task_templates_update on public.task_templates;
create policy task_templates_update on public.task_templates for update to authenticated using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));
drop policy if exists task_templates_delete on public.task_templates;
create policy task_templates_delete on public.task_templates for delete to authenticated using (private.is_family_parent(family_id));

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (private.is_family_parent(family_id) or private.is_child_owner(family_id, child_profile_id));
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated with check (private.is_family_parent(family_id));
drop policy if exists tasks_update_parent on public.tasks;
create policy tasks_update_parent on public.tasks for update to authenticated using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));
drop policy if exists tasks_update_child on public.tasks;
create policy tasks_update_child on public.tasks for update to authenticated using (private.is_child_owner(family_id, child_profile_id) and status = 'todo') with check (private.is_child_owner(family_id, child_profile_id) and status = 'pending' and completed_at is not null);
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated using (private.is_family_parent(family_id));

drop policy if exists rewards_select on public.rewards;
create policy rewards_select on public.rewards for select to authenticated using (private.is_family_parent(family_id) or private.is_child_owner(family_id, child_profile_id));
drop policy if exists rewards_insert on public.rewards;
create policy rewards_insert on public.rewards for insert to authenticated with check (private.is_family_parent(family_id));
drop policy if exists rewards_update on public.rewards;
create policy rewards_update on public.rewards for update to authenticated using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));
drop policy if exists rewards_delete on public.rewards;
create policy rewards_delete on public.rewards for delete to authenticated using (private.is_family_parent(family_id));

drop policy if exists wishlist_select on public.wishlist_items;
create policy wishlist_select on public.wishlist_items for select to authenticated using (private.is_family_parent(family_id) or private.is_child_owner(family_id, child_profile_id));
drop policy if exists wishlist_insert on public.wishlist_items;
create policy wishlist_insert on public.wishlist_items for insert to authenticated with check (private.is_child_owner(family_id, child_profile_id));
drop policy if exists wishlist_update on public.wishlist_items;
create policy wishlist_update on public.wishlist_items for update to authenticated using (private.is_child_owner(family_id, child_profile_id)) with check (private.is_child_owner(family_id, child_profile_id));
drop policy if exists wishlist_delete on public.wishlist_items;
create policy wishlist_delete on public.wishlist_items for delete to authenticated using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));

drop policy if exists redemptions_select on public.reward_redemptions;
create policy redemptions_select on public.reward_redemptions for select to authenticated using (private.is_family_parent(family_id) or private.is_child_owner(family_id, child_profile_id));
drop policy if exists redemptions_update_parent on public.reward_redemptions;
create policy redemptions_update_parent on public.reward_redemptions for update to authenticated using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));

drop policy if exists ledger_select on public.point_ledger;
create policy ledger_select on public.point_ledger for select to authenticated using (private.is_family_parent(family_id) or private.is_child_owner(family_id, child_profile_id));
;
