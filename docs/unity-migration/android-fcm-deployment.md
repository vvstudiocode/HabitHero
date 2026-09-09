# Unity Android FCM deployment boundary

The Unity client includes the Android native FCM bridge and the Supabase Edge
Function delivery path, but credentials are intentionally not committed to the
repository.

## Local Android build

1. In Firebase Console, register an Android app with package ID
   `com.vvstudiocode.habithero`.
2. Download that app's `google-services.json` and place it at
   `unity/HabitHero/Assets/Plugins/Android/google-services.json`.
3. Build the Android target. The Unity post-process copies the file to the
   generated Gradle launcher and enables the Google services plugin. Without
   the file, the APK can still be built for UI/connection testing, but FCM
   registration returns a clear configuration error.
4. On Android 13 or later, grant the app notification permission. Devices and
   emulators must provide Google Play services for FCM token registration.

## Supabase Edge Function secrets

Configure these secrets for `notify-task-created`:

- `FCM_PROJECT_ID`: Firebase project ID.
- `FCM_CLIENT_EMAIL`: service-account client email.
- `FCM_PRIVATE_KEY`: the service-account PKCS#8 private key, retaining PEM
  line breaks or using escaped `\\n` line breaks.

Enable the Firebase Cloud Messaging API and grant the service account the
permission required to send through the FCM HTTP v1 API. Never put the service
account private key in Unity, Vercel, GitHub source, or a mobile bundle.

## Verification boundary

The automated contract verifies the native bridge, Gradle dependency, manifest
service, token registration boundary, and FCM HTTP v1 sender. A real Android
token and notification tap still require the Firebase file, Edge Function
secrets, an authenticated test family, and a physical/Google-Play-services
device.
