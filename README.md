# Inside & Out

Expo / React Native mobile organiser for court, medical, visits, calls, notes and documents. The app starts empty; fictional samples are opt-in. Records are stored locally and are not synchronised with the separate Floot browser app.

## Development

Use Node 20.19+ or a compatible newer LTS:

```sh
npm ci
npm run typecheck
npm test
npx expo start
```

## Expo project

- Owner: `courtneymetcalfes-team`
- Slug: `inside-and-out`
- EAS project ID: `25168db7-3195-4e64-8ff5-13b4382265e9`
- Expo GitHub base directory: `/` (repository root)
- iOS bundle identifier / Android package: `au.com.insideandout.app`

The EAS configuration includes development, preview and production profiles. The Expo project must be accessed using an authorised account. Apple signing credentials and a signed iOS build are still needed before TestFlight. No build or submission is triggered automatically by this repository.

## Current limits

There are no user accounts, family roles, cloud sync, official service feeds or AI chat. App lock gates access but does not separately encrypt organiser records or exports. JSON exports do not contain attached document bytes, and backup restore is not implemented.

TypeScript and six model tests passed during source preparation. JavaScript bundle export was also checked; this is not an installable native build. Physical-device testing, final branding, privacy/support pages and store preparation remain required before release.
