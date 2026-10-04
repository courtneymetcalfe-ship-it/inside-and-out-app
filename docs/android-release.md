# Android builds

Package: `au.com.insideandout.app` (same application identity as iOS).

The header, passcode screen, iOS launcher and Android launcher use the selected
`assets/inside-out-app-icon.png`. Android also uses this image for its adaptive
launcher icon. A new native build must be installed to see bundled asset changes.

## Installable test version

Use the Expo project's **Build Android** workflow, or run:

```sh
npx eas-cli@latest build --platform android --profile android-preview
```

This produces a signed APK that can be installed directly on an Android phone.
The profile inherits the production family-access configuration; no development
server is required. The first Android build may require an authorised Expo user
to create or select the Android signing keystore. Keep the same keystore for
future updates.

## Google Play version

```sh
npx eas-cli@latest build --platform android --profile production
```

This produces an AAB for Google Play. Upload it to an internal testing track
first. A Google Play developer account, store listing, privacy/data-safety
answers and review are required to distribute through Google Play. The workflow
does not automatically submit an app to Google Play.

## Device checks before release

- Install the APK and check the launcher, header and passcode-screen icon.
- Create a passcode; test fingerprint/face unlock where the phone supports it.
- Use Android Back from a category to return Home; Back dismisses native sheets.
- Enter and save a record with the keyboard open.
- Pick and open a document, and export PDF, CSV and JSON through Android sharing.
- Allow notifications and confirm a future reminder appears.
- Sign into Family access and check profile switching, shared records and uploads.
- Confirm content and navigation stay above the system gesture/button area.

Source checks and bundle export do not replace testing a signed APK on a phone.
