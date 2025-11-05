# 💊 MedicationRunner - React Native Medication Management App

A comprehensive React Native application inspired by the Android Kotlin medication management app, featuring smart light integration, alarm notifications, and medication tracking.

## 🚀 Features

### Core Functionality
- **Medication Management**: Add, edit, delete, and track medications with pill counts
- **Smart Light Integration**: Control Tuya smart lights for visual medication reminders
- **Color-coded Reminders**: Each medication gets a unique light color
- **Multi-light Groups**: Multiple lights can be controlled together
- **Background Alarm Service**: Automated medication reminders with notifications
- **Data Persistence**: Local storage using AsyncStorage
- **Real-time Monitoring**: Background service for continuous alarm monitoring

### Smart Light Features
- **Tuya IoT Integration**: Full API integration with KHSUIN smart devices
- **Color-coded Reminders**: Each medication can have a unique light color
- **Brightness Control**: Adjustable brightness levels for different times
- **Multi-device Support**: Control multiple smart lights simultaneously
- **Flash Notifications**: Visual flashing alerts for medication reminders

### Notification System
- **Push Notifications**: Native notification support via Expo
- **Customizable Alerts**: Sound, vibration, and visual notifications
- **Scheduled Alarms**: Recurring medication reminders
- **Background Processing**: Continuous monitoring even when app is closed

## 📱 Technology Stack

- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and tools
- **TypeScript**: Type-safe JavaScript
- **AsyncStorage**: Local data persistence
- **Expo Notifications**: Push notification system
- **Axios**: HTTP client for API calls
- **Crypto-JS**: Cryptographic functions for Tuya API
- **React Native Paper**: Material Design components

## 🏗️ Project Structure

```
src/
├── services/           # Business logic and API services
│   ├── MedicationManager.ts    # Medication CRUD operations
│   ├── SmartLightService.ts    # Tuya IoT integration
│   └── AlarmService.ts         # Notification and alarm system
├── types/             # TypeScript type definitions
│   └── index.ts       # All data models and interfaces
└── components/        # Reusable UI components (future)
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development)

### Installation Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Tuya API credentials**
   - Update `src/services/SmartLightService.ts` with your Tuya API credentials:
     ```typescript
     const TUYA_CONFIG = {
       ACCESS_ID: 'your_access_id',
       ACCESS_SECRET: 'your_access_secret',
       DEVICE_IDS: ['your_device_ids']
     };
     ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on device/simulator**
   ```bash
   npm run android  # For Android
   npm run ios      # For iOS
   ```

## 🔑 Tuya API Configuration

### Getting Tuya API Credentials

1. **Create Tuya IoT Account**
   - Visit [Tuya IoT Platform](https://iot.tuya.com/)
   - Create an account and log in

2. **Create a Cloud Project**
   - Go to Cloud → Development → Create
   - Choose "Smart Home" as the industry
   - Select your region (US/EU/CN)

3. **Get API Credentials**
   - Access ID: Found in Project Overview
   - Access Secret: Found in Project Overview
   - Device IDs: Found in Device Management

4. **Enable Required APIs**
   - Device Management API
   - Device Control API
   - Token Management API

### Device Configuration

The app is pre-configured for KHSUIN smart bulbs with these device IDs:
- `eb0620af64cf53f1dfu4hy`
- `eb0d6f535fa9a1fd42ngda`
- `eb62a25695c44a3a64bnzx`
- `ebae2a6a1599da5bc11t1w`

Update these in `SmartLightService.ts` with your actual device IDs.

## 📋 Usage Guide

### Adding Medications

1. **Tap "Add Sample Medication"** to create a test medication
2. **Configure alarm times** (e.g., "08:00", "20:00")
3. **Assign smart lights** for visual reminders
4. **Set light colors** for each medication

### Testing Smart Lights

1. **Tap "Test Light Control"** to verify light connectivity
2. **Tap "Refresh Lights"** to reload device status
3. **Check light status** in the Smart Lights section

### Testing Notifications

1. **Tap "Test Notification"** to send a test notification
2. **Grant notification permissions** when prompted
3. **Check notification settings** in device settings

## 🎨 Medication Colors

The app includes 10 predefined colors inspired by the Android version:

- 🔴 **Red** (#FF6B6B) - Important medications
- 🔵 **Teal** (#4ECDC4) - Routine medications
- 💙 **Blue** (#45B7D1) - Clear, easy to distinguish
- 💚 **Green** (#96CEB4) - Vitamins/supplements
- 💛 **Yellow** (#FFEAA7) - Bright, attention-grabbing
- 💜 **Purple** (#DDA0DD) - Distinct, memorable
- 🌊 **Mint** (#98D8C8) - Soothing, gentle reminder
- 🌟 **Gold** (#F7DC6F) - Special medications
- 🌸 **Lavender** (#BB8FCE) - Soft, calming
- ☁️ **Sky** (#85C1E9) - Clear, peaceful

## 🔄 Key Differences from Android Version

| Feature | Android (Kotlin) | React Native |
|---------|------------------|--------------|
| Data Storage | SharedPreferences | AsyncStorage |
| Background Service | Android Service | Expo Background Tasks |
| Notifications | Android Notifications | Expo Notifications |
| HTTP Client | OkHttp | Axios |
| Cryptography | Android Crypto | Crypto-JS |
| State Management | ViewModel | React Hooks |

## 🐛 Troubleshooting

### Common Issues

1. **Smart Lights Not Found**
   - Verify Tuya API credentials
   - Check device IDs are correct
   - Ensure devices are online in Tuya app
   - Try different API regions (US/EU/CN)

2. **Notifications Not Working**
   - Grant notification permissions
   - Check device notification settings
   - Verify Expo notification configuration

3. **App Crashes on Startup**
   - Check console logs for errors
   - Verify all dependencies are installed
   - Clear app cache and restart

### Debug Mode

Enable debug logging by checking the console output. All services provide detailed logging for troubleshooting.

## 📱 Platform Support

- **Android**: Full support with native features
- **iOS**: Full support with native features
- **Web**: Limited support (notifications not available)

## 🔒 Security Considerations

- API credentials are stored in code (consider environment variables for production)
- Local data is stored unencrypted (consider encryption for sensitive data)
- Network requests use HTTPS for security

## 🚀 Future Enhancements

- [ ] Medication scanning with camera
- [ ] Voice reminders
- [ ] Medication interaction warnings
- [ ] Doctor/patient communication
- [ ] Medication adherence analytics
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] Widget support
- [ ] Advanced medication scheduling
- [ ] Medication history tracking

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the console logs for error details

## 🎯 Inspiration

This app is inspired by the Android Kotlin medication management app with the following key features replicated:

- **Medication Management**: Complete CRUD operations for medications
- **Smart Light Integration**: Tuya IoT integration with KHSUIN bulbs
- **Color-coded Reminders**: Each medication gets a unique light color
- **Multi-light Groups**: Multiple lights can be controlled together
- **Background Alarm Service**: Continuous monitoring for medication times
- **Notification System**: Push notifications for medication reminders
- **Persistent Storage**: Local data storage for medications and settings

---

**Note**: This app replicates the functionality of the original Android Kotlin medication management app while leveraging React Native's cross-platform capabilities and modern development practices.

