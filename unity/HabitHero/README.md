# HabitHero Unity Client

This directory is the isolated Unity client boundary for the HabitHero
parallel client rewrite.

## Current contract

- The existing React/Capacitor client remains the production reference until
  Unity reaches feature parity and passes release verification.
- The Supabase backend remains shared. Database tables, RLS, RPCs, Edge
  Functions, user IDs, and server-authoritative game rules are not duplicated
  in Unity.
- The parent web experience remains available on Vercel during migration.
- Production builds must use the existing iOS Bundle ID and Android
  application ID recorded in `config/platform-contract.json`.
- Unity clients may receive only the public Supabase URL and publishable key.
  A service-role key must never be embedded in an app build.
- The checked-in Unity project targets Editor `6000.6.0f1` and already uses the
  existing store identity: product name `習慣冒險島`, iOS Bundle ID
  `com.vvstudiocode.habithero`, and Android application ID
  `com.vvstudiocode.habithero`.
- The first `Assets/Scenes/Bootstrap.unity` entrypoint is checked into Build
  Settings. It creates the initial parent/child login screen and restores a
  Supabase session when a local runtime config is available.
- `com.unity.ugui` `2.6.0` is pinned in the Unity package manifest for the
  bootstrap UI. This is a client dependency; it does not change the shared
  Supabase schema.

## Implementation order

1. Establish the Unity project and platform adapters.
2. Port authentication and session/deep-link handling.
3. Port the parent review and child task, points, reward, wishlist, and
   offline-sync loops.
4. Port the world, pet, adventure, inventory, and decoration runtime.
5. Port realtime social/co-op behavior and native notifications.
6. Verify production update, account continuity, and store builds before
   retiring the existing mobile client.

The pure C# platform slice remains executable without the Unity editor:
`npm run test:unity-platform` compiles and runs the Supabase settings,
authentication callback, and request contracts. With Unity installed locally,
`npm run test:unity-editmode` runs the Editor-side platform contract tests.
`npm run test:unity-playmode` runs a headless Bootstrap smoke test that loads
the login shell, verifies the Canvas/EventSystem/title, and fails on runtime
errors without requiring a real account or writing to Supabase.
The Canvas also remaps top-level UI anchors into `Screen.safeArea` when a
device has a notch or rounded corner; the edge-to-edge background stays
outside that content inset. The mapping is covered by the Unity EditMode
contract tests, while device-specific visual evidence remains required.
The first Bootstrap scene and UGUI login shell now pass the Editor compile and
scene-entrypoint contract. Device builds now select the native iOS Keychain or
Android Keystore session plugin by default; the Editor and non-mobile fallback
uses PlayerPrefs only for local development. Device build, reinstall, and
recovery verification are still required before a production mobile release.
`HabitHeroBootstrap` also consumes the Unity deep-link lifecycle and supports
Supabase token-fragment recovery, PKCE code exchange when the native callback
supplies the original verifier, plus the in-app parent password reset screen.
Code-only callbacks are intentionally rejected: the PKCE verifier must stay on
the client that initiated the flow and cannot be safely reconstructed by Unity.
The iOS and Android post-build hook adds the existing
`com.vvstudiocode.habithero` URL scheme without modifying the current
Capacitor exports.
The child home slice also reads rewards, tickets, point ledger, and wishlist
items; reward redemption uses the server `redeem_reward` RPC, while wishlist
add/cancel uses RLS-scoped PostgREST mutations followed by a fresh snapshot.
The child client exposes the loaded point ledger as a history panel so task
awards, redemptions, and parent adjustments remain auditable without creating
client-side balance calculations.
Child-proposed general adventures can also be abandoned through the server
`abandon_child_adventure` RPC; Unity refreshes the child snapshot after the
mutation and does not change the task status locally.
The parent home slice reads the shared family data, creates and manages tasks
for a selected child through RLS-scoped PostgREST insert/PATCH/DELETE calls,
reviews pending tasks via the existing review RPCs, manages reward records
through RLS-scoped mutations, approves
wishlist items through the server RPC, and fulfills pending reward tickets
through an RLS-scoped update. Manual point changes use the server
`adjust_child_points` RPC; the client never edits balances directly.
The same parent workbench can create general adventures for selected children
through the server `create_general_adventure` RPC, including report mode,
duration, execution window, timer, and review settings; it refreshes the family
snapshot after creation.
The parent workbench also manages recurring daily-adventure schedules through
the existing `task_schedules` boundary. Parents can create schedules for one
or more children, edit future rules, and disable a schedule; the client asks
Supabase to materialize today's occurrences instead of manufacturing tasks
locally.
Child login accounts are managed through the authenticated
`manage-child-account` Edge Function, including creation, password reset, and
deletion; the Unity client never receives or stores a service-role key.
The parent workbench also includes a read-only child-view preview. It selects
one child from the authenticated family snapshot and filters every displayed
task, reward, wishlist, ticket, and ledger row to that child; it does not
impersonate a child session or create a second authorization path. The preview
can now enter an interactive child mode through the same parent Supabase
session, with an explicit family/child scope and the existing RLS/RPC
authorization. Returning to the parent workbench requires re-authenticating
the parent password; social/friend-world controls stay disabled in this parent
child mode because those RPCs are child-actor scoped.
The Unity child world view now resolves the same public authored GLB modules as
the Web client through `HabitHeroWorldAssetCatalog`. Complete authored module
catalogs are available for all five existing scenes (10/12/23/11/12 placements
for Sunrise Village, Forest Valley, Cloud Workshop, Tideglow Archipelago, and
Star-Sand Wasteland), with per-scene placement and scale data preserved;
primitive fallback, server scene gating, and world-entity rendering remain
available. `HabitHeroWorldSceneProfileCatalog` also preserves the Web scene
spawn anchors and movement boundaries. Authored collision flags now start with
an authored-transform rectangle footprint, then replace it with the loaded GLB
renderer bounds and the same navigation inset used by the Web runtime;
Supabase decorations retain their `collision_radius` circle proxies. Safe spawn
selection uses those same shape checks. The camera now uses the Web runtime's
50° perspective framing, follows the child, and supports drag/pinch/scroll
controls. World background music now uses the same per-scene Vercel audio
assets, default volume, loop behavior, and child-scoped on/off preference as
the Web client. A running timer reaching zero also loops the shared
`timer-complete.mp3` alarm until it is dismissed or submitted. Device parity
and visual evidence remain pending. The world client now
reads the existing
`get-weather` Edge Function, falls back to clear weather when unavailable, and
uses the same Open-Meteo fallback as the Web client before falling back to
clear weather. It applies Taipei day/night lighting plus rain particles to the
Unity scene.
Loaded character and pet GLBs attach a runtime animation adapter to glTFast's
Legacy `Animation` output. It prefers the canonical `Idle` and `Walk_InPlace`
clips, accepts the existing Web aliases for legacy assets, configures `Sit` as
hold and `Wave`/`Dance` as looping optional actions, and drives the child
avatar's idle/walk state and facing direction from world movement. Existing
five-action assets and their root-motion contract remain read-only; following
pets and server-bounded roaming NPC pets now use the shared motion and
animation adapters. NPC and pet labels follow the loaded model or fallback
placeholder and face the world camera; character shadows use a generated
transparent ground texture and are released with the scene. Device visual
evidence is still pending.
The portable Unity notification client also reads and updates the shared
`profiles.notifications_enabled` preference, disables the parent's registered
`push_devices` rows when notifications are turned off, and upserts a device
binding through the existing RLS-scoped `(profile_id, token)` boundary. Parent
and child home screens expose the same notification settings flow and
automatically bind the active family/child scope after login or a protected
parent-to-child switch. Unity Mobile Notifications `2.4.2` is pinned for
Unity 6.0; iOS builds request permission and obtain the APNs token, while
Editor/WebGL and Android return an explicit unsupported result. Android push
token/delivery and real-device verification are still pending; the Unity
client now parses the shared APNs payload, deduplicates notification targets,
and opens the related parent review, parent schedule editor, or child task
surface after a cold start, background return, or foreground delivery.
Unity UI, native plugins, and feature flows must not be marked complete until
they pass their own editor/device tests.

## CLI build smoke test

With the Unity Editor installed, run:

```text
npm run build:unity-webgl
```

The command invokes the checked-in `BuildHabitHero` Editor entrypoint and
writes the ignored output to `unity/HabitHero/Builds/WebGL`. Set
`HABITHERO_UNITY_EDITOR_PATH` when Unity is installed at a different path.
This verifies the Bootstrap scene and WebGL build pipeline; it is not a
replacement for iOS/Android module and device verification.

## Native release preflight and builds

Run the release contract check before a store build:

```text
npm run test:unity-release -- --allow-missing-native
```

The `--allow-missing-native` flag is for CI and development machines that
only have the base Unity Editor. A release candidate must run the strict gate
without that flag:

```text
npm run test:unity-release
```

The strict gate requires the Unity `iOSSupport` and `AndroidPlayer` modules,
checks the existing store identity and version/build number, confirms the
Bootstrap scene and auth callback scheme, and rejects forbidden client-secret
names in tracked Unity files. It does not install modules or change Supabase.

After the modules are installed, native exports can be generated with:

```text
npm run build:unity:ios
npm run build:unity:android
```

The iOS command writes an Xcode project to `unity/HabitHero/Builds/iOS`; the
Android command writes an APK to `unity/HabitHero/Builds/Android/HabitHero.apk`.
Set `HABITHERO_UNITY_EDITOR_PATH` when the Unity Editor is installed elsewhere.
These exports still require signing, real-device checks, TestFlight/closed
testing, and store-review verification before replacing the existing mobile
client.

## Local Supabase configuration

The Unity app never reads a service-role key. Before opening the Bootstrap
scene locally, expose the same public values used by the web client:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Optional for native builds that load the existing public Web GLB assets
HABITHERO_GAME_ASSET_BASE_URL=https://habit-hero-gilt.vercel.app
```

Then run the Unity Editor menu item `HabitHero/Configure Supabase Runtime`.
It creates the ignored asset
`Assets/Resources/SupabaseRuntimeConfig.asset`; do not commit that asset or
paste its contents into source control. WebGL can infer the public asset origin
from the current page when this value is omitted. Native builds should set it
to the public Vercel origin when they need the character, pet, and decoration
models; it is an asset origin only and must never contain a secret.
