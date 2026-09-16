# Inmate profiles and family access

Implementation is prepared; a Supabase project must be provisioned before family sharing can be enabled in a release. No existing personal data has been uploaded.

## Behaviour

- Device profiles have separate records and an inmate switcher on every screen.
- On first launch, the v1 organiser migrates to the v2 profile collection. The old key is retained as a recovery copy; it is never overwritten by this feature.
- Family sign-in uses email OTP. The device PIN is still a separate app lock.
- Sharing is explicit: the person confirms upload of the active profile and becomes its single admin. The original device profile remains a separate, unsynchronised copy.
- Each inmate row has exactly one required `admin_id`. There are no global family admin privileges. Direct client writes to ownership, membership, invitations, records and activity are denied.
- The admin maintains records and creates/revokes seven-day email-bound invitations. Invitations appear in the recipient’s account after email verification; this version does not send invitation emails.
- Family members read all shared records and can complete or reopen tasks. Only the admin edits/deletes records. Activity shows who changed task status and when.
- Shared data stays in memory and is cleared on sign-out. Realtime invalidates the active profile; foreground/manual refresh and a 30-second access recheck cover missed events and membership revocation. Server checks apply on every operation.
- Optimistic revisions reject stale updates. Users close stale editing forms and refresh before retrying.
- Shared document bytes/uploads are not implemented. Profiles containing attached files cannot be promoted. Original documents stay in device profiles. Device reminders also remain local.

## Provisioning gate

1. Create/select a Supabase project for Inside & Out, preferably in an Australian region. Confirm plan/cost before any paid creation.
2. Apply `supabase/migrations/202609160001_family.sql` using a privileged migration connection. This creates new `io_*` tables only.
3. Configure email OTP delivery and the email template to include `{{ .Token }}`. Production requires a verified SMTP sender/provider; the default development sender is not suitable for arbitrary family addresses. Keep email confirmation required and configure rate limits.
4. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Expo production. Use the `sb_publishable_` key only. The app rejects missing/other key formats. Never bundle secret/service-role keys.
5. Ensure `io_inmates` is in the `supabase_realtime` publication (migration handles this if the publication exists).
6. Verify with two real test accounts: OTP delivery, admin invitation, acceptance, profile isolation, task updates on two devices, sign-out and revocation. No real inmate records are needed for this gate.
7. Before public account-based release, implement and verify account deletion/ownership-transfer flows and update the privacy policy/App Store privacy declarations for cloud storage and family sharing.
8. Build and submit a new Expo/TestFlight binary after configuration and acceptance tests. Build 15 does not include these changes.

## Verification

`npm test` runs model, migration/isolation and real PostgreSQL permission tests using PGlite. `npm run typecheck` validates the app. `npx expo export --platform ios` validates the JavaScript release bundle, not an on-device login or signing test.

The Supabase plugin was connected during implementation, but its callable tools did not appear in that session. No project, cloud schema or Expo environment values were created, and no claim of cross-device deployment should be made until those steps are verified.
