# HabitHero Unity Migration Plan

## Objective

Rebuild the existing HabitHero client behavior in Unity while keeping the
existing Supabase backend, production data, parent Web experience, and store
identity intact. This is a parallel client rewrite, not a product redesign.

The current React/Capacitor client remains the behavioral and release
reference until the Unity client passes feature, data, device, and store-update
verification.

## Architecture boundary

```text
GitHub monorepo
├── src/ + existing iOS/Android exports  # current production reference
├── unity/HabitHero                      # Unity child/mobile client
├── supabase/                            # shared schema, RLS, RPC, functions
├── config/platform-contract.json        # cross-client release identity
└── vercel.json                          # parent Web SPA deployment
```

The Unity client must use the same server-authoritative Supabase rules. It may
not copy pricing, permissions, point awards, inventory ownership, or family
authorization into client-only rules.

## Feature parity matrix

| Area | Current behavior to preserve | Unity acceptance gate | Status |
| --- | --- | --- | --- |
| Auth | Parent/child sign-in, session restore, password recovery, parent switch, account deletion | C# contract, native deep link, real Supabase session tests, re-login/update test | Foundation started (child account management) |
| Family | Family selection, child profiles, child preview mode, profile isolation | Same user/profile IDs and RLS behavior across both clients | Foundation started (read-only preview plus guarded interactive parent-child mode) |
| Parent workflow | Task creation, task edit/delete, scheduling, review, return, feedback, growth summary | Existing parent Web remains available; Unity must consume the same resulting data | Foundation started (task CRUD, adventure/schedule creation, review, reward actions) |
| Child habit loop | Today board, task timer, completion report, pending offline state | Online/offline/reconnect tests and server-authoritative point result | Foundation started |
| Points/rewards | Ledger, approvals, scrolls, reward celebration, historical notice handling | Same RPC payloads, idempotency, and displayed-event semantics | Foundation started (child wallet, redeem, wishlist, parent reward/point actions) |
| Adventure | Daily/general adventures, occurrences, reports, timers, abandonment | Contract tests plus device flow for timer and reconnect | Foundation started (timer, completion, abandonment, daily schedule) |
| 3D world | Five scenes, authored terrain, gates, NPCs, weather, day/night, movement | Unity scene and mobile performance evidence at fixed viewports | Foundation started (scene/NPC/offering reads, server-gated source rules, and child world-entity reads/mutations; authored scene placement pending) |
| Pets/characters | GLB assets, five-action animation contract, follow/roam, grounding, labels, shadows | Asset audit plus Unity visual/device evidence; no existing pet asset mutation | Not started |
| Economy | Catalog, wallet, inventory, loadout, decorations, placement, server validation | RLS/RPC contract and rollback tests | Foundation started (catalog/wallet/inventory/loadout client, child shop/backpack UI, NPC source gating, and world-entity place/update/remove/collect RPCs; authored 3D placement pending) |
| Social | Friends, friend worlds, visitors, chat, presence, broadcast, co-op adventures | Realtime authorization and reconnect tests with two accounts | Foundation started (friend code, friend list, requests, server mutations, read-only friend-world snapshot, chat RPC/UI, live Presence, local avatar broadcast, and validated remote-avatar placeholder rendering) |
| Notifications | Push registration, task notifications, taps, device token lifecycle | iOS/Android native plugin test and Edge Function auth | Foundation started (preference/device binding adapter; native token bridge pending) |
| Web/parent | Dashboard, settings, privacy/legal documents, family management | Vercel build and browser regression remain green | Existing client retained |
| Release | Same iOS Bundle ID, Android package, signing, version/build numbers | TestFlight/closed testing update from existing app without data loss | Not started |

## Implementation phases

### Phase 0 — platform and release contract

Completed locally:

- GitHub repository remains the source repository.
- Unity client has an isolated owner path.
- Vercel build/output/history fallback is explicit.
- Existing iOS Bundle ID and Android application ID are locked.
- Client configuration names only the public Supabase URL and publishable key.
- GitHub has a pull-request platform contract workflow.

### Phase 1 — Unity platform foundation

Partially completed locally:

- Unity Editor `6000.6.0f1` project created at `unity/HabitHero`.
- Unity EditMode platform contract tests pass locally.
- Production product name, iOS Bundle ID, Android application ID, and next
  build number are configured in the Unity project.
- `Assets/Scenes/Bootstrap.unity` is generated by an Editor menu/CLI command
  and is the first enabled Build Settings scene.
- The Bootstrap scene has a small parent/child login shell backed by the
  shared Supabase Auth REST endpoints.
- Unity package manifest pins `com.unity.ugui` `2.6.0` for the login shell.

- Pure C# Supabase client configuration validation.
- Auth callback parsing for fragment tokens, OAuth code, login, and recovery;
  PKCE codes exchange through Supabase when the callback includes the verifier.
- Auth request builders, session serialization, restore/refresh, sign-in,
  sign-out, user refresh, password recovery, and password update contracts.
- Local C# smoke test: `npm run test:unity-platform`.
- Unity Editor contract test: `npm run test:unity-editmode`.
- Supabase PostgREST table reads and server-authoritative adventure completion
  RPC payloads with idempotency keys.
- Child task completion queue with duplicate protection, offline persistence,
  reconnect drain, and EditMode coverage.
- Child reward redemption through the server-authoritative `redeem_reward` RPC,
  wallet/ledger refresh, and RLS-scoped wishlist add/cancel flows.
- Child point-ledger history view reads the same server-returned ledger rows
  used by wallet refreshes; it does not calculate or mutate balances locally.
- Child adventure abandonment calls the server `abandon_child_adventure` RPC
  and refreshes the same snapshot; the client never mutates adventure status
  locally.
- Parent family/child/task hydration plus task approval or revision through the
  existing server-authoritative review RPCs.
- Parent task creation for a selected child through RLS-scoped PostgREST
  insertion, followed by a fresh family snapshot.
- Parent task management for existing unfinished tasks through family-scoped
  PostgREST PATCH/DELETE operations, with completed and pending history left
  read-only in the Unity workbench.
- Parent general-adventure creation for one or more selected children through
  the server `create_general_adventure` RPC, followed by a fresh family
  snapshot.
- Parent daily-adventure scheduling through the existing `task_schedules`
  read boundary and `create_adventure_schedule`, `update_adventure_schedule`,
  `disable_adventure_schedule`, and `ensure_daily_adventure_occurrences`
  RPCs. Unity now exposes create, edit, and disable actions in the parent
  workbench.
- Parent wishlist approval through the server `approve_wishlist_item` RPC and
  reward-ticket fulfillment through an RLS-scoped redemption update, both
  followed by a fresh family snapshot.
- Parent reward create/update/delete through RLS-scoped PostgREST mutations,
  with the same reward records consumed by the Unity child shop.
- Parent manual point adjustment through the server-authoritative
  `adjust_child_points` RPC and refreshed point balances.
- Parent child-account creation, password reset, and deletion through the
  authenticated `manage-child-account` Edge Function.
- Parent child-view preview with explicit child selection and client-side
  snapshot filtering; preview is read-only and does not impersonate a child
  session or bypass Supabase RLS.
- Child game economy reads the family catalog, family price overrides, child
  quest-scroll wallet, inventory, and loadout through scoped PostgREST calls.
  Purchases, character equipment, following pets, and roaming pets remain
  server-authoritative RPC mutations, with the child shop/backpack UI refreshing
  from Supabase after each successful mutation.
- Child world data reads active scenes, NPCs, NPC offerings, scene unlocks, and
  dialogue progress through scoped PostgREST calls. Scene unlocking and NPC
  dialogue completion use the existing server RPCs. The Unity shop disables
  source-bound purchases until the scene and required NPC dialogue are
  available, hides items without an active offering, and sends the
  server-selected `source_npc_id` with purchases.
- The Unity child home exposes a world hub view for scene unlock attempts and
  NPC dialogue completion. Each successful action reloads the child-scoped
  world data and updates the shop gate without mutating progress locally.
- Unity now has a data-driven 3D world runtime shell: unlocked scenes can open
  a RenderTexture view with Supabase-positioned NPC placeholders, child
  movement controls, and NPC dialogue callbacks. This is interaction and
  lifecycle evidence only; authored environment assets, canonical
  character/pet models, mobile performance, and device visual verification
  remain pending.
- The child game snapshot now also reads the server-owned world revision and
  active world entities. Decoration place, transform, remove, and collect-all
  actions use the existing revision-checked RPCs and reload the snapshot after
  each mutation. It also reads the existing owner projection for shared
  decorations, and the 3D runtime now renders owned/shared world entities from
  server transforms. Existing allowlisted Web GLB assets are resolved at
  runtime through Unity glTFast when a public asset origin is configured, with
  placeholder fallback when loading is unavailable; authored terrain,
  canonical movement/animation parity, and device visual evidence remain
  pending.
- Unity child social foundation now reads the server-provided friend code,
  friend list, and pending requests. Send, accept, decline, remove, and block
  actions call the existing Supabase RPCs and reload the child-scoped social
  data before updating the view; friend-world visits, chat, and live Presence
  are now wired as read-only/server-authoritative flows.
- Unity child social foundation now also loads the existing
  `get_friend_world_snapshot` RPC for an accepted friend and displays the
  server-scoped result as a 3D preview with a local visitor avatar. The same
  slice now carries the server-provided shared-decoration permission and
  capability fields, exposes the owner's friend-list permission toggle, and
  wires visitor-side place, transform, and remove actions through the existing
  revision-checked Supabase RPCs. Live Presence and avatar broadcast still
  update the preview with bounded remote-avatar placeholders.
- Unity child social foundation now reads visible friend-world chat history,
  unread counts, and sends/marks-read/reports messages through the existing
  server RPCs. The chat panel reloads server data after each mutation and opens
  a private Realtime channel for visible `friend_world_messages` inserts; each
  event triggers another server-authoritative history refresh.
- Unity now has a Supabase Realtime protocol layer with private-channel join,
  authenticated session token, heartbeat, token refresh, presence,
  broadcast, leave, and incoming envelope parsing. Native platforms use the
  managed WebSocket transport and WebGL uses a browser WebSocket bridge.
  Chat subscription wiring now retries channel join with bounded backoff after
  a socket interruption. The friend-world live foundation now also uses the
  dedicated `friend-world-live:<owner>` private topic, maps Presence state/diff
  and avatar broadcasts, rejects stale or out-of-bounds avatar state, tracks
  Presence again after reconnect, and exposes avatar state/request callbacks.
  Unity now renders bounded remote-avatar placeholders, broadcasts local visitor
  movement, requests the latest peer state on join, keeps Presence visible when
  the preview opens after the socket handshake, and applies the same three-person
  capacity admission rule as the Web client, and reloads newer world snapshots
  after a `world_revision_v1` event. Remote placeholders now interpolate toward
  newer states and are pruned after a bounded stale period. Two-account/device
  verification remains pending.

- Unity now has a portable notification binding client that reads and updates
  `profiles.notifications_enabled`, disables a parent's `push_devices` rows when
  notifications are turned off, and upserts device bindings through the existing
  `(profile_id, token)` conflict boundary. It sends only the public Supabase
  session and remains subject to the existing RLS policies. Native iOS/Android
  token acquisition, permission prompts, notification taps, and device delivery
  are intentionally still pending.

Still required:

- Parent adventure scheduling and general-adventure management parity with the
  existing Web client.
- Device build and recovery verification for the iOS Keychain and Android
  Keystore session plugins.
- Device build and callback verification for the Unity deep-link replacement;
  the runtime handler, token-fragment recovery, and PKCE exchange contract are
  now in place. A code-only callback is rejected because Supabase requires the
  original PKCE verifier.
- Unity co-op flows, plus two-account/device reconnect verification. The current
  live preview intentionally uses bounded placeholder avatars until the
  character asset contract and visual/device evidence are approved.
- Native iOS/Android push and app URL plugins.

### Phase 2 — child core loop

The first data slice is now implemented locally. Continue with the smallest
useful product loop:

1. Authenticated child session.
2. Hydrated child profile and today tasks.
3. Task completion and server result.
4. Points/ledger refresh.
5. Offline queue and reconnect recovery.

The current Unity slice covers items 1–3, timer transport/UI, the child reward
wallet, wishlist mutations, the first game-economy shop/backpack loop, parent
task/reward management, parent task review, parent wishlist approval, parent
reward-ticket fulfillment, and the transport part of item 5. Cached snapshots
for cold-start offline use and post-mutation ledger/wallet refreshes are now
implemented locally. Production mobile release still requires device
verification of encrypted storage, deep links, and recovery.

### Phase 3 — world and game systems

Port the existing scene contracts without changing product behavior:

- authored scene manifests and gates;
- character and pet loadout;
- animation, grounding, movement, camera, joystick, and touch input;
- NPC dialogue, shops, inventory, decorations, weather, and audio;
- performance quality settings and resource disposal.

Existing pet assets, exporters, metadata, migrations, and catalog rows remain
read-only unless a separately approved asset correction plan is created.

### Phase 4 — realtime and social systems

Port friendship, friend-world access, presence, broadcast, chat, remote
avatars, shared decorations, and co-op adventure behavior. The same RLS and
private authorization boundaries must be exercised from Unity; client-side
visibility is not an authorization mechanism.

### Phase 5 — release replacement

- Test Unity builds with development identifiers and a non-production backend.
- Test the update path with the production identifiers only after parity.
- Verify server data continuity, local session behavior, push registration,
  deep links, universal/app links, background audio, and safe-area layouts.
- Submit the Unity binary as an update to the existing store records.
- Retain the React/Capacitor client until the rollout is stable.

## Completion criteria

The migration is not complete until all of the following are true:

- Every row in the feature matrix has a passing automated or device evidence
  record.
- Parent and child accounts can use the same Supabase data from both clients.
- Offline, reconnect, Realtime, idempotency, and RLS behavior are preserved.
- iOS and Android production builds use the existing app identities and signing
  path, with an increased build number.
- TestFlight and closed testing verify update/install behavior before review.
- No service-role key or server secret is present in Unity, Web, GitHub
  artifacts, or a mobile bundle.
- The existing app remains a precise rollback path until release verification
  is complete.

## Current verification notes

The repository baseline currently has pre-existing failures unrelated to this
migration: one of 1151 existing tests fails in the child game panel CSS
contract, and source-size governance reports existing baseline growth in
dashboard/world/CSS hotspots. These must be handled as a separate baseline
repair or evidence task; they are not silently changed as part of the Unity
port.

The local machine has Unity Editor `6000.6.0f1`. Editor compilation and the
platform contract test suite are verified; Unity scene import, mobile export,
and device behavior are intentionally not claimed as verified yet.
