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

The EAS configuration includes development, preview, production and Android preview profiles. The Expo project must be accessed using an authorised account. The manual **Build and Submit iOS** workflow produces an iPhone build and submits it to TestFlight using the project's configured credentials. The manual **Build Android** workflow produces an installable APK; production Android builds produce a Google Play AAB. See [Android build instructions](docs/android-release.md). These workflows do not run automatically on every source change.

## Current limits

Device profiles remain local. Optional Family access supports email sign-in, shared inmate profiles and invitations with one admin per inmate; see [Family sharing](FAMILY-SHARING.md). There are no official service feeds or AI chat. App lock gates access but does not separately encrypt organiser records or exports. JSON exports do not contain attached document bytes, and backup restore is not implemented.

Run TypeScript and the full test suite before release. A successful bundle export or Android native-project generation is not an installable signed build. Physical-device testing and store preparation remain required before release.
