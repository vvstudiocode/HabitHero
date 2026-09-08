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

## Implementation order

1. Establish the Unity project and platform adapters.
2. Port authentication and session/deep-link handling.
3. Port the child task, points, reward, and offline-sync loop.
4. Port the world, pet, adventure, inventory, and decoration runtime.
5. Port realtime social/co-op behavior and native notifications.
6. Verify production update, account continuity, and store builds before
   retiring the existing mobile client.

The Unity editor project files will be added in the next implementation slice
after the editor version and local build toolchain are available. This README
is intentionally the first owner document so the migration cannot silently
overwrite the current mobile project.
