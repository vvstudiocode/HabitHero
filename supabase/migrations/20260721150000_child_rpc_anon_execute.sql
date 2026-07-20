-- Anonymous Auth sessions may reach PostgREST as `anon` before the refreshed
-- JWT role is observed. The function itself still requires a valid user id
-- and the is_anonymous JWT claim, so granting EXECUTE does not allow guests
-- to bind a child.

grant execute on function public.authenticate_child(text) to anon;
