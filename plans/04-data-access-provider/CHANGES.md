# Task 04 Changes

## Data access and provider

- Replaced the localStorage-backed authoritative store with an async Supabase repository and session-aware `AppProvider`.
- Kept the existing dashboard action names; mutations reload the family graph after a successful write and preserve state on failure.
- Centralized session, family, active child, loading, error, and retry state.

## Integration blocker

The current SQL migration has no child invite or join token, nor an RPC to safely connect a child Auth account to a parent-created child profile. The provider therefore does not fabricate a code/token or claim that `addChild` succeeded; it returns a recoverable error until the schema/API contract is extended. Recommended follow-up: add a single-use, expiring invite flow backed by a server-side RPC or Edge Function, with parent authorization and child membership validation.

Known implementation risks: a session with no membership is currently provisioned as a parent workspace so the existing parent signup flow remains usable; the product must add an explicit role/workspace bootstrap before child signup is enabled. Wishlist approval is currently two writes because the migration exposes no transaction RPC for that operation; a server-side mutation should replace it before production use.
