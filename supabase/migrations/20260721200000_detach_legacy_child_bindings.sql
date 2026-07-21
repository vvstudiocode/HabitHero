-- Legacy anonymous child identities are no longer valid after the Auth
-- account migration. Detach only the identity/member rows; child profiles,
-- tasks, rewards, wishlist items, tickets, and ledger entries remain intact.

update public.child_profiles c
   set profile_id = null
 where c.login_name is null
   and c.profile_id is not null;

-- Clear the membership only after the child profile no longer references it;
-- the composite foreign key is ON DELETE CASCADE.
delete from public.family_members m
 where m.role = 'child'
   and not exists (
     select 1
       from public.child_profiles c
      where c.profile_id = m.profile_id
   );
