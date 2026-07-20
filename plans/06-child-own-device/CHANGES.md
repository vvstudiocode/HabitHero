# Task 06 Changes

## Implemented

- Child dashboard selects `activeChild` only from `state.childLoggedInId`, which the provider derives from the authenticated user's DB membership and child profile. It never falls back to the first child.
- Child task completion submits only `pending`; it does not call the parent-only approval RPC.
- Reward redemption remains delegated to the repository's atomic `redeem_reward` RPC, with the existing client-side affordability check as a UX guard.
- Child login uses only the parent-created password. The browser creates an anonymous Supabase session and calls `authenticate_child`; no child name, email, or invite token is requested.
- Child loading, session/role mismatch, missing-profile, error, retry, logout, and back-navigation states are guarded in the child flow.

## Verification

- `npm run build`: passed.
- `npm run lint`: blocked by pre-existing errors in `src/components/ParentDashboard.tsx` at lines 650, 676, and 677 (`updateChildCode`, `newChildCode`, `setNewChildCode` are undefined).

## Blocker / Risk

- Anonymous child sessions with no successful password binding are rejected before protected family data is loaded. The app also clears an old authenticated session that has no family and returns to the landing page, preventing the stale-session 403 screen.
- The child password is stored only as a bcrypt hash in `private.child_passwords`; parent password reset uses `update_child_password`.
