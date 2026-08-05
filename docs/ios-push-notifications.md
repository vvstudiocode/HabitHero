# iOS Push Notifications

HabitHero uses Capacitor Push Notifications for iOS registration, Supabase for device binding, and a Supabase Edge Function to send APNs notifications. The browser build remains notification-disabled until a native iOS build is running.

## Required Apple setup

1. In Apple Developer, enable **Push Notifications** for App ID `com.vvstudiocode.habithero`.
2. Create an APNs Auth Key (`.p8`) and note its Key ID and the Team IDs used by each iOS configuration. HabitHero uses `T36HZ49H5T` for Debug/sandbox and `94HYTX75L9` for Release/production.
3. Open `ios/App/App.xcodeproj` in Xcode, select the App target, and confirm the Push Notifications capability and `App.entitlements` are included.
4. Test on a physical iPhone. The iOS Simulator cannot validate APNs delivery.

## Required Supabase setup

Apply the migration and deploy the function from the repository root:

```sh
supabase db push
supabase secrets set \
  APNS_KEY_ID="..." \
  APNS_PRIVATE_KEY="$(base64 < AuthKey_XXXXXXXXXX.p8 | tr -d '\\n')" \
  APNS_BUNDLE_ID="com.vvstudiocode.habithero" \
  APNS_SANDBOX_TEAM_ID="T36HZ49H5T" \
  APNS_PRODUCTION_TEAM_ID="94HYTX75L9" \
  APNS_ENVIRONMENT="production"
supabase functions deploy notify-task-created
```

Use `APNS_ENVIRONMENT="sandbox"` for a Debug build signed with the development provisioning profile. Never commit the `.p8` file or these values to the repository.

## Runtime flow

- The parent enables notifications in **設定**.
- The child enables notifications in **背包 → 設定**.
- The app requests iOS permission only after the user enables the switch, then stores the APNs token in `push_devices` with family/profile/child binding.
- A new task invokes `notify-task-created` with the `created` event; the function derives the recipient from the task and family membership, then sends directly to APNs.
- A child completion invokes the same function with the `submitted` event so parents receive a review reminder. A parent review invokes the `reviewed` event so the child receives approval or correction feedback.
- Foreground notifications show an in-app toast; background or closed-app notifications use the iOS system notification.
- When the same device switches profile or logs out, the previous profile's device registration is disabled to prevent cross-profile delivery.

## Edge Function secrets

Set these secrets in the Supabase project that hosts `notify-task-created`:

```text
APNS_KEY_ID=...
APNS_PRIVATE_KEY=base64-encoded-p8-content
APNS_BUNDLE_ID=com.vvstudiocode.habithero
APNS_SANDBOX_TEAM_ID=T36HZ49H5T
APNS_PRODUCTION_TEAM_ID=94HYTX75L9
APNS_ENVIRONMENT=production
```

Use `APNS_ENVIRONMENT=sandbox` when the deployed function is sending to a Debug-signed iOS build. `APNS_TEAM_ID` remains supported as a fallback for existing deployments.
