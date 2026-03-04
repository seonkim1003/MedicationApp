# App Store Publishing Checklist

## Prerequisites

1. **Apple Developer Account** ($99/year) - [developer.apple.com](https://developer.apple.com)
2. **EAS CLI** - `npm install -g eas-cli`
3. **Expo account** - `eas login`

## Steps to Publish

### 1. Register Bundle ID in Apple Developer Portal

- Go to [developer.apple.com/account](https://developer.apple.com/account) → Certificates, Identifiers & Profiles → Identifiers
- Click + to add new App ID
- Use bundle ID: `com.medicationrunner.app` (or change in app.json first if you prefer a different one)
- Enable capabilities: Push Notifications, Background Modes (audio, fetch, processing)

### 2. Create App in App Store Connect

- Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps → + → New App
- Platform: iOS
- Name: MedicationRunner (or your app name)
- Primary Language, Bundle ID (match the one above), SKU

### 3. Build for Production

```bash
# Build iOS for App Store
eas build --platform ios --profile production
```

This creates a Release build with the embedded bundle (no Metro required).

### 4. Submit to App Store

```bash
# After build completes, submit the latest build
eas submit --platform ios --profile production --latest
```

Or manually: Download the .ipa from the EAS build page, then use Transporter app or Xcode Organizer to upload.

### 5. Complete App Store Listing

In App Store Connect, fill in:

- Screenshots (required sizes: 6.7", 6.5", 5.5" for iPhone)
- Description, Keywords, Support URL
- Privacy Policy URL (required if app collects data)
- Age Rating questionnaire
- Pricing (Free or Paid)

### 6. Submit for Review

- Add build to the app version
- Complete all required metadata
- Submit for Review

## Bundle ID

Current: `com.medicationrunner.app`

To use your own domain (e.g. `com.yourcompany.medicationrunner`), update in:
- `app.json` → `expo.ios.bundleIdentifier`
- `app.json` → `expo.android.package`

Then run `npx expo prebuild --platform ios --clean` before building.

## Notes

- First submission typically takes 24-48 hours for review
- Ensure you have a Privacy Policy URL if the app collects any user data (medications, feedback, etc.)
- Test the production build thoroughly before submitting
