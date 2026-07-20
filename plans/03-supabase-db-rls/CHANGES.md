# Follow-up Changes

## 20260720130000: Child device family invites

- Added `private.family_child_invites`; it stores only a 32-byte random token's SHA-256 digest. The raw token is returned once by `create_family_child_invite` and is never persisted.
- `create_family_child_invite` is a `security definer` RPC restricted to an authenticated parent of the target family. It requires an existing target `profiles` row, rejects an existing family membership or child profile, supersedes an open invite for the same family/profile, and limits expiry to 60 seconds through 24 hours.
- `redeem_family_child_invite` is a `security definer` RPC restricted to the authenticated profile bound to the invite. It rejects malformed, unknown, expired, revoked, or already redeemed tokens, then atomically inserts the `child` membership and matching `child_profiles` row before marking the invite redeemed. The existing unique constraints also protect concurrent cross-family child claims.
- The invite table has RLS enabled and no `public`/`anon`/`authenticated` table privileges. Both RPCs use a fixed `search_path`, have public and anon execution revoked, and grant execution only to `authenticated`.

### Schema/flow constraint

The current schema requires `child_profiles` to reference an existing `family_members` row and requires `family_members.profile_id` to reference `profiles`. Therefore this flow assumes the child's Auth account and `profiles` row already exist before the parent creates an invite; the redeem RPC creates the child membership and child profile together. No source changes or production operations are included.

### Verification limits

SQL static security assertions, `npm run lint`, and `npm run build` passed. The build emitted only the existing large-chunk warning. Supabase local migration/RLS/RPC execution was not performed because this workspace has no Supabase CLI, Postgres client, local database, or project credentials. Production was not accessed.
