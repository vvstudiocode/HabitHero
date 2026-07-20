# Task 07 Changes

## Implemented

- `loadAppData` now branches by the authenticated member role. Child sessions query only their own `child_profiles` row and the matching `tasks`, `rewards`, `wishlist_items`, `reward_redemptions`, and `point_ledger` rows. Only parent sessions enumerate family members and family-wide child data.
- Added `src/lib/realtime.ts` with role-scoped Supabase realtime filters and cleanup through `removeChannel` on session, family, role, child, or provider changes.
- Added authoritative refetch on realtime events and browser reconnect, plus offline/stale/mutation-pending state in `AppProvider` and dashboard status UI.
- Mutations do not update local domain state optimistically. Offline mutations are rejected, failed mutations keep the last confirmed state and expose retry, and concurrent mutation calls share one in-flight request to prevent duplicate clicks.
- Added loaded ledger view models without permitting client-side ledger writes.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed; Vite reports the existing large-chunk advisory.

## Runtime items not verified here

- Two authenticated Supabase devices receiving realtime events and reconnect refetches.
- RLS visibility under a real child session, including denial of another child's rows.
- Concurrent approve/redeem behavior against the deployed database RPCs and constraints.
