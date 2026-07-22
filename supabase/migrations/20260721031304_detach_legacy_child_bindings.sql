delete from public.family_members m
 where m.role = 'child'
   and exists (
     select 1
       from public.child_profiles c
      where c.profile_id = m.profile_id
        and c.login_name is null
   );

update public.child_profiles c
   set profile_id = null
 where c.login_name is null
   and c.profile_id is not null;;
