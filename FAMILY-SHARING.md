# Inmate profiles and family access

Release-readiness checkpoint: 04-10-2026.

The Sydney Supabase project `skygjvroyyqrhvqjjvwg` is active. Family sharing, private profile files and account deletion migrations are deployed. The four public `io_*` tables have row-level security enabled. The `delete-account` Edge Function requires a valid JWT and separately verifies the signed-in user before privileged deletion work.

## Current behaviour

- Device profiles have separate records and an inmate switcher on every screen.
- Family sign-in uses email OTP. The device PIN is a separate app lock.
- Sharing is explicit. The person who uploads a device profile becomes its single admin.
- Admins manage records, files, invitations and member removal.
- Family members can read shared records and documents and update task completion.
- Optimistic revisions reject stale writes.
- Shared files use the private `io-files` bucket.
- The bucket enforces a 20 MB server-side file limit and an allowlist for PDF, Word, text, JPEG, PNG and HEIC.
- Signed download links are requested for 60 seconds. Already-downloaded copies cannot be recalled.
- DD-MM-YYYY is used in the UI and PDF/CSV exports; stored JSON retains ISO dates for compatibility.
- Account deletion is available in Family access. An admin must transfer each shared inmate profile to an existing member or permanently delete that profile and its shared documents before deleting the account.
- Deletion requests are resumable if file cleanup is interrupted.
- Device-only profiles and downloaded/exported copies are not deleted by deleting a family account.
- Privacy and support information is available in-app and through public project pages.

## Security checkpoint

Verified on the live project:

- `public.io_inmates`: RLS enabled.
- `public.io_members`: RLS enabled.
- `public.io_invites`: RLS enabled.
- `public.io_activity`: RLS enabled.
- `storage.buckets.io-files`: private, 20 MB maximum, MIME allowlist configured.
- `delete-account`: active with platform JWT verification.
- The private deletion bookkeeping table is not readable or writable by anonymous or authenticated app roles.

Supabase currently reports one informational RLS notice for the private deletion bookkeeping table because it intentionally has no client policies, plus a password-leak-protection warning. The app uses passwordless email OTP rather than user passwords.

## Release gate

Before App Store submission:

1. Run the full automated test suite and TypeScript check against the final `main` commit.
2. Build one final production iOS binary from `main`.
3. Install that exact TestFlight build and verify:
   - device profile creation/editing;
   - profile switching;
   - email OTP after leaving/returning to the app;
   - invitation acceptance with a second account;
   - task update visibility on both accounts;
   - shared file upload/open/delete;
   - member removal;
   - admin transfer;
   - account deletion;
   - PDF/CSV export;
   - app lock / Face ID.
4. Capture App Store screenshots using fictional sample data only.
5. Complete App Privacy answers and enter the public Privacy Policy and Support URLs in App Store Connect.
6. Submit that exact tested build to App Review.

See `docs/app-store-release.md` for the store listing draft, App Review notes, privacy questionnaire working set and screenshot plan.
