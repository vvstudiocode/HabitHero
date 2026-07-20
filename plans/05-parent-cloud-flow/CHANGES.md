# Task 05 Changes

- Wired parent task, template, reward, task-approval, wishlist-approval, and redemption controls to the async actions exposed by `AppProvider`.
- Parent forms remain open until a successful server reload; failed mutations keep input visible and expose the provider error with a retry action.
- Disabled parent approval/fulfillment/save controls while cloud mutations are in flight.
- Removed the legacy 4-digit child connection-code UI. The invite migration only permits the supplied `create_family_child_invite` RPC and requires an existing target Auth profile; the current client has no safe profile lookup contract, so child creation is shown as blocked instead of fabricating a token or reporting success.
- Family bootstrap remains provided by Task 04's session-aware data provider: a signed-in parent without membership is provisioned into a family before this dashboard loads.

## Verification

- `npm run lint` passes.
- `npm run build` passes; Vite reports only the existing large-chunk advisory.

## Known limitations

- Child invitation cannot complete until a product-approved flow supplies the target Auth profile ID and calls the migration RPC. This is a product/API contract blocker, not a frontend-generated token path.
- The existing data layer's wishlist approval is two writes, as documented by Task 04; production should replace it with a transaction RPC.
- Parent registration now auto-confirms through Supabase Auth; the UI provides a direct login link above the registration form.
- Parent child creation now uses `create_child_profile` with a hashed six-character alphanumeric password; child Auth profiles are not required beforehand.
