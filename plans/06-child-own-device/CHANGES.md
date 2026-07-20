# Task 06 Changes

## Implemented

- Child dashboard selects `activeChild` only from `state.childLoggedInId`, which the provider derives from the authenticated user's DB membership and child profile. It never falls back to the first child.
- Child task completion submits only `pending`; it does not call the parent-only approval RPC.
- Reward redemption remains delegated to the repository's atomic `redeem_reward` RPC, with the existing client-side affordability check as a UX guard.
- Child login accepts an optional one-time invite token in memory and redeems it through `redeem_family_child_invite` after authentication. The token is cleared after success and is never persisted.
- Child loading, session/role mismatch, missing-profile, error, retry, logout, and back-navigation states are guarded in the child flow.

## Verification

- `npm run build`: passed.
- `npm run lint`: blocked by pre-existing errors in `src/components/ParentDashboard.tsx` at lines 650, 676, and 677 (`updateChildCode`, `newChildCode`, `setNewChildCode` are undefined).

## Blocker / Risk

`loadAppData` currently provisions a new authenticated user with no family membership as a parent workspace. A newly authenticated child joining through an invite can race this provider bootstrap before `redeem_family_child_invite` completes. The child UI refuses to render data unless the final DB-derived role is `child` and an owned child profile exists, but resolving the bootstrap race requires a provider/data-access change outside the Task 06 allowed file scope or a backend contract decision.
