# iOS Push Notifications

HabitHero uses Capacitor Push Notifications for iOS registration, Supabase for device binding, and a Supabase Edge Function to send APNs notifications. The browser build remains notification-disabled until a native iOS build is running.

## Required Apple setup

1. In Apple Developer, enable **Push Notifications** for App ID `com.vvstudiocode.habithero`.
2. Create an APNs Auth Key (`.p8`) and note its Key ID and Team ID.
3. Open `ios/App/App.xcworkspace` in Xcode, select the App target, and confirm the Push Notifications capability and `App.entitlements` are included.
4. Test on a physical iPhone. The iOS Simulator cannot validate APNs delivery.

## Required Supabase setup

Apply the migration and deploy the function from the repository root:

```sh
supabase db push
supabase secrets set \
  APNS_KEY_ID="..." \
  APNS_TEAM_ID="..." \
  APNS_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)" \
  APNS_BUNDLE_ID="com.vvstudiocode.habithero" \
  APNS_ENVIRONMENT="production"
supabase functions deploy notify-task-created
```

Use `APNS_ENVIRONMENT="sandbox"` for a Debug build signed with the development provisioning profile. Never commit the `.p8` file or these values to the repository.

## Runtime flow

- The parent enables notifications in **設定**.
- The child enables notifications in **背包 → 設定**.
- The app requests iOS permission only after the user enables the switch, then stores the APNs token in `push_devices` with family/profile/child binding.
- A new task invokes `notify-task-created`; the function derives the recipient from the task and family membership, then sends directly to APNs.
- Foreground notifications show an in-app toast; background or closed-app notifications use the iOS system notification.
- When the same device switches profile or logs out, the previous profile's device registration is disabled to prevent cross-profile delivery.
