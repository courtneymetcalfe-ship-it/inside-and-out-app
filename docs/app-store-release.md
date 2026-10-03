# App Store release checklist

Last updated: 04-10-2026

## Store listing

- App name: Inside & Out
- Subtitle: Family support, organised
- Primary category: Productivity
- Secondary category: Utilities
- Privacy policy URL: https://github.com/courtneymetcalfe-ship-it/inside-and-out-app/blob/main/docs/privacy.md
- Support URL: https://github.com/courtneymetcalfe-ship-it/inside-and-out-app/blob/main/docs/support.md
- Bundle ID: au.com.insideandout.app
- App Store Connect app ID: 6810744869
- Initial iOS release: iPhone-first (ios.supportsTablet=false)

### Promotional text

Keep court dates, medical notes, visits, calls, tasks and important documents organised for the people supporting someone in custody.

### Description

Inside & Out is a private family organiser designed to keep important information about a loved one in custody together in one place.

Create separate inmate profiles and keep court dates, medical and safety notes, visits, calls, tasks, documents and follow-ups organised. Family access can be enabled for a profile when you want invited relatives or support people to share the same records and task progress.

Features include:
- Separate profiles for different people
- Court, medical, visit, call, task, note and document records
- DD-MM-YYYY date display
- Local reminders
- PDF and CSV timeline exports
- Private document storage for shared profiles
- One admin per shared inmate profile
- Family invitations and activity history
- In-app family account deletion with admin transfer or profile deletion
- Optional app lock with device authentication

Inside & Out is an organisational tool. It is not connected to Corrective Services, courts, hospitals or emergency services and does not provide legal or medical advice.

### Keywords

family,organiser,custody,prison,court,visits,documents,tasks,records,support

## App Review notes

Core device profiles do not require an account or login. Reviewers can create a device profile or use the clearly labelled fictional sample data.

Family access is optional and uses email one-time codes. Account deletion is available from Home > Family access > Delete my family account. An admin deleting their account must either transfer each shared inmate profile to an existing family member or permanently delete that profile and its shared documents.

Privacy and support information is available in-app under Privacy policy & support.

The app does not automatically read phone call history, contacts, messages or government/correctional systems. It contains no advertising and does not track users for advertising.

## App Privacy questionnaire working set

Answer “Yes, we collect data from this app” because optional Family access transmits data to Supabase.

Conservative data-type mapping for the current release:
- Contact Info: Email Address — linked to the account; App Functionality; not tracking.
- Identifiers: User ID — linked; App Functionality; not tracking.
- User Content: Other User Content — shared profile details, notes, tasks and documents; linked; App Functionality; not tracking.
- User Content: Photos — only when a user chooses an image file for a shared profile; linked; App Functionality; not tracking.
- Health & Fitness: Health — only when a user chooses to enter or upload medical information into a shared profile; linked; App Functionality; not tracking.
- Name — profile names may be uploaded as part of shared profile data; linked to that shared profile/account context; App Functionality; not tracking.

No advertising, third-party advertising, developer advertising, or cross-company tracking is used.

Before saving App Privacy answers, compare this working set with the exact data types shown by App Store Connect and the final binary privacy report.

## Screenshots

The first release is iPhone-first, so prepare at least one iPhone screenshot; 3–5 is recommended for a useful listing. Capture screenshots from the final build using fictional sample data only.

Suggested sequence:
1. Home dashboard — Hannah Smith / fictional sample profile.
2. Documents — organised private files.
3. Timeline — dated interactions and events.
4. Tasks — family follow-ups.
5. Family access / profile switching — shared organisation.

Do not use screenshots containing real inmate names, MINs, legal documents, health details, email addresses or access codes.

## Final release gate

- TypeScript check passes.
- Automated tests pass.
- Production iOS bundle exports successfully.
- Supabase security advisor reviewed.
- Account deletion endpoint requires a valid JWT and verifies the signed-in user.
- Two-account family access acceptance test passes.
- Email OTP works on a real device.
- Privacy and support URLs open publicly.
- Final screenshots contain fictional data.
- App Privacy answers are saved in App Store Connect.
- Final production build is built once from main and uploaded to TestFlight.
- Install that exact TestFlight build and run the smoke-test checklist before submitting it to App Review.
