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

## Implementation order

1. Establish the Unity project and platform adapters.
2. Port authentication and session/deep-link handling.
3. Port the child task, points, reward, and offline-sync loop.
4. Port the world, pet, adventure, inventory, and decoration runtime.
5. Port realtime social/co-op behavior and native notifications.
6. Verify production update, account continuity, and store builds before
   retiring the existing mobile client.

The pure C# platform slice remains executable without the Unity editor:
`npm run test:unity-platform` compiles and runs the Supabase settings,
authentication callback, and request contracts. With Unity installed locally,
`npm run test:unity-editmode` runs the Editor-side platform contract tests.
Unity UI, native plugins, and feature flows must not be marked complete until
they pass their own editor/device tests.
