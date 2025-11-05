import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import MedicationManager from './MedicationManager';
import { Medication, MedicationAlarm } from '../types';

// Configure notification behavior as alarms with sound
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class AlarmService {
  private static instance: AlarmService;
  private isInitialized: boolean = false;
  private isMonitoring: boolean = false;
  private medicationManager: MedicationManager;
  private navigationRef: any = null;
  private notificationHandlersSetup: boolean = false;

  private constructor() {
    this.medicationManager = MedicationManager.getInstance();
  }

  public static getInstance(): AlarmService {
    if (!AlarmService.instance) {
      AlarmService.instance = new AlarmService();
    }
    return AlarmService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Request permissions (iOS-specific options for critical alerts)
      const permissionsRequest: Notifications.NotificationPermissionsRequest = Platform.OS === 'ios' 
        ? {
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              allowAnnouncements: true,
              allowCriticalAlerts: true, // iOS critical alerts for alarms
              provideAppNotificationSettings: true,
            },
          }
        : {};

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync(permissionsRequest);
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Notification permissions not granted');
        return;
      }

      // Configure notification channel for Android (required for alarms with sound)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('alarms', {
          name: 'Medication Alarms',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }

      // Set iOS notification presentation options
      if (Platform.OS === 'ios') {
        await Notifications.setNotificationCategoryAsync('alarm', [
          {
            identifier: 'TAKE_MEDICATION',
            buttonTitle: 'I took the medication',
            options: { opensAppToForeground: true },
          },
        ], {
          intentIdentifiers: [],
          hiddenPreviewsBodyPlaceholder: 'Medication reminder',
          categorySummaryFormat: '%u more notifications',
        });
      }

      this.isInitialized = true;
      this.startMonitoring();
      console.log('Alarm Service initialized successfully');
    } catch (error) {
      console.error('Error initializing alarm service:', error);
      throw error;
    }
  }

  private startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    // Alarms are now scheduled as recurring weekly notifications
    // No need for constant checking - notifications fire automatically at scheduled times
    console.log('Alarm monitoring started');
  }

  async rescheduleAllMedications(): Promise<void> {
    try {
      console.log('Rescheduling all medication alarms...');
      
      // Cancel all existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Load medications
      const medications = await this.medicationManager.loadMedications();
      
      // Ensure medications array exists and is valid
      if (!medications || !Array.isArray(medications)) {
        console.log('No medications to reschedule');
        return;
      }

      // Load all alarms
      const allAlarms = await this.medicationManager.loadAlarms();
      
      // Ensure alarms array exists and is valid
      if (!allAlarms || !Array.isArray(allAlarms)) {
        console.log('No alarms to reschedule');
        return;
      }

      // Schedule alarms for each medication
      for (const medication of medications) {
        if (!medication || !medication.id) {
          continue;
        }

        // Get alarms for this medication
        const medicationAlarms = (allAlarms || []).filter(
          (alarm: MedicationAlarm) => alarm.medicationId === medication.id && alarm.isEnabled
        );

        if (!medicationAlarms || medicationAlarms.length === 0) {
          continue;
        }

        // Schedule each alarm
        for (const alarm of medicationAlarms) {
          if (!alarm || !alarm.time || !alarm.daysOfWeek || !Array.isArray(alarm.daysOfWeek)) {
            continue;
          }

          await this.scheduleAlarmNotification(medication, alarm);
        }
      }

      console.log('All medication alarms rescheduled');
    } catch (error) {
      console.error('Error rescheduling all medication alarms:', error);
      throw error;
    }
  }

  private async scheduleAlarmNotification(medication: Medication, alarm: MedicationAlarm): Promise<void> {
    try {
      if (!alarm.time || !alarm.daysOfWeek || alarm.daysOfWeek.length === 0) {
        return;
      }

      const [hours, minutes] = alarm.time.split(':').map(Number);
      
      // Validate hours and minutes
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.error(`Invalid alarm time format: ${alarm.time}`);
        return;
      }

      let totalScheduled = 0;

      // Schedule recurring weekly alarms for each specified day
      // This creates a single recurring alarm per day instead of scheduling multiple weeks ahead
      for (const dayOfWeek of alarm.daysOfWeek) {
        if (dayOfWeek < 1 || dayOfWeek > 7) {
          continue;
        }

        // Convert our day system (1=Monday, 7=Sunday) to expo-notifications (1=Sunday, 2=Monday, ... 7=Saturday)
        // Our system: 1=Monday, 2=Tuesday, ..., 7=Sunday
        // Expo system: 1=Sunday, 2=Monday, ..., 7=Saturday
        // So: Monday (1) -> 2, Tuesday (2) -> 3, ..., Sunday (7) -> 1
        const expoWeekday = dayOfWeek === 7 ? 1 : dayOfWeek + 1;

        // Schedule as a recurring weekly alarm with sound
        const notificationContent: any = {
          title: `Time to take ${medication.name}`,
          body: `Don't forget your medication!`,
          sound: true, // Play default alarm sound
          data: {
            medicationId: medication.id,
            alarmId: alarm.id,
            alarmTime: alarm.time,
            medicationName: medication.name,
          },
          categoryIdentifier: 'alarm',
        };

        // Platform-specific properties
        if (Platform.OS === 'android') {
          notificationContent.channelId = 'alarms';
          notificationContent.vibrate = [0, 250, 250, 250];
          notificationContent.sound = 'default'; // Explicitly set default sound for Android
        } else if (Platform.OS === 'ios') {
          // iOS-specific properties for critical alarms with sound
          notificationContent.sound = 'default'; // Explicitly set default sound for iOS
          notificationContent.interruptionLevel = 'critical'; // iOS 15+ for time-sensitive notifications
          notificationContent.relevanceSummary = `Medication reminder: ${medication.name}`;
          notificationContent.badge = 1;
        }

        await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: {
            type: 'calendar',
            weekday: expoWeekday, // expo-notifications uses 1-7 where 1 is Sunday
            hour: hours,
            minute: minutes,
            repeats: true, // Recurring weekly alarm
          } as Notifications.CalendarTriggerInput,
          identifier: `alarm_${alarm.id}_${dayOfWeek}`, // Unique identifier for this alarm/day combo
        });

        totalScheduled++;
      }

      console.log(`Scheduled ${totalScheduled} recurring alarms for ${medication.name} at ${alarm.time}`);
      if (totalScheduled === 0) {
        console.warn(`No alarms scheduled for ${medication.name} - check dayOfWeek array and time format`);
      }
    } catch (error) {
      console.error('Error scheduling alarm notification:', error);
      console.error('Alarm details:', { medication: medication.name, alarmTime: alarm.time, daysOfWeek: alarm.daysOfWeek });
    }
  }

  async createAlarm(medicationId: string, alarmData: Partial<MedicationAlarm>): Promise<void> {
    try {
      const medication = await this.medicationManager.getMedication(medicationId);
      if (!medication) {
        throw new Error(`Medication with id ${medicationId} not found`);
      }

      const newAlarm: MedicationAlarm = {
        id: Date.now().toString(),
        medicationId: medicationId,
        medicationName: alarmData.medicationName || medication.name,
        time: alarmData.time || '08:00',
        lightColor: alarmData.lightColor || '#FF6B6B',
        lightIds: alarmData.lightIds || [],
        isEnabled: alarmData.isEnabled !== undefined ? alarmData.isEnabled : true,
        daysOfWeek: alarmData.daysOfWeek || [],
        createdAt: new Date().toISOString(),
      };

      await this.medicationManager.addAlarm(newAlarm);
      
      // Update medication to include this alarm
      const updatedMedication = {
        ...medication,
        alarms: [...(medication.alarms || []), newAlarm],
      };
      await this.medicationManager.updateMedication(updatedMedication);

      // Reschedule all alarms
      await this.rescheduleAllMedications();

      console.log(`Alarm created for ${medication.name}`);
    } catch (error) {
      console.error('Error creating alarm:', error);
      throw error;
    }
  }

  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
  }

  setupNotificationHandlers(): void {
    // Only set up handlers once
    if (this.notificationHandlersSetup) {
      console.log('Notification handlers already set up, skipping...');
      return;
    }
    
    this.notificationHandlersSetup = true;
    console.log('Setting up notification handlers...');
    
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener(async (notification) => {
      console.log('Alarm notification received:', notification);
      const data = notification.request.content.data;
      console.log('Notification data:', data);
      console.log('Navigation ref available:', !!this.navigationRef);
      console.log('Navigation ref current:', !!this.navigationRef?.current);
      
      if (data && data.medicationId) {
        // Use setTimeout to ensure navigation happens after React state updates
        setTimeout(() => {
          if (this.navigationRef && this.navigationRef.current) {
            console.log(`Navigating to alarm screen for medication: ${data.medicationId}`);
            try {
              // Navigate to the Alarm screen in the root stack navigator
              this.navigationRef.current.navigate('Alarm', {
                medicationId: data.medicationId,
                alarmId: data.alarmId,
                medicationName: data.medicationName || 'Medication',
                alarmTime: data.alarmTime,
              });
              console.log('Successfully navigated to alarm screen');
            } catch (error) {
              console.error('Error navigating to alarm screen:', error);
              console.error('Error details:', JSON.stringify(error, null, 2));
            }
          } else {
            console.warn('Navigation ref not available, cannot navigate to alarm screen');
            console.warn('Navigation ref:', this.navigationRef);
          }
        }, 100);
      } else {
        console.warn('Missing medication ID in notification data');
      }
    });

    // Handle notification tapped (when app is in background or closed)
    Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log('Alarm notification tapped/opened app:', response);
      const data = response.notification.request.content.data;
      console.log('Notification tap data:', data);
      console.log('Navigation ref available:', !!this.navigationRef);
      console.log('Navigation ref current:', !!this.navigationRef?.current);
      
      if (data && data.medicationId) {
        // Navigate to alarm screen - use retry logic for when app is closed
        const navigateToAlarm = (retryCount = 0) => {
          const maxRetries = 10;
          
          if (this.navigationRef && this.navigationRef.current) {
            console.log(`Navigating to alarm screen (tap/opened) for medication: ${data.medicationId}`);
            try {
              // Navigate to the Alarm screen in the root stack navigator
              this.navigationRef.current.navigate('Alarm', {
                medicationId: data.medicationId,
                alarmId: data.alarmId,
                medicationName: data.medicationName || 'Medication',
                alarmTime: data.alarmTime,
              });
              console.log('Successfully navigated to alarm screen (tap/opened)');
            } catch (error) {
              console.error('Error navigating to alarm screen (tap/opened):', error);
              console.error('Error details:', JSON.stringify(error, null, 2));
            }
          } else if (retryCount < maxRetries) {
            // Retry if navigation ref not ready yet (app might still be loading)
            console.log(`Navigation ref not ready yet, retrying... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => navigateToAlarm(retryCount + 1), 200);
          } else {
            console.warn('Navigation ref not available after max retries, cannot navigate to alarm screen');
          }
        };
        
        // Start navigation with delay to ensure app is ready
        setTimeout(() => navigateToAlarm(), 500);
      } else {
        console.warn('Missing medication ID in notification tap data');
      }
    });
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring && this.isInitialized;
  }

  async cancelAlarm(alarmId: string): Promise<void> {
    try {
      await this.medicationManager.deleteAlarm(alarmId);
      await this.rescheduleAllMedications();
      console.log(`Alarm ${alarmId} cancelled`);
    } catch (error) {
      console.error('Error cancelling alarm:', error);
      throw error;
    }
  }

  // Test function to trigger a notification immediately (for debugging)
  async testNotification(medicationName: string = 'Test Medication'): Promise<void> {
    try {
      console.log('Testing notification...');
      const notificationContent: any = {
        title: `Time to take ${medicationName}`,
        body: `Test alarm notification`,
        sound: true,
        data: {
          medicationId: 'test',
          alarmId: 'test',
          alarmTime: new Date().toLocaleTimeString(),
          medicationName: medicationName,
        },
        categoryIdentifier: 'alarm',
      };

      // Platform-specific properties
      if (Platform.OS === 'android') {
        notificationContent.channelId = 'alarms';
        notificationContent.vibrate = [0, 250, 250, 250];
        notificationContent.sound = 'default'; // Explicitly set default sound for Android
      } else if (Platform.OS === 'ios') {
        notificationContent.sound = 'default'; // Explicitly set default sound for iOS
        notificationContent.interruptionLevel = 'critical';
        notificationContent.relevanceSummary = `Test medication reminder: ${medicationName}`;
        notificationContent.badge = 1;
      }

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: {
          seconds: 2, // Trigger in 2 seconds
        },
      });
      console.log('Test notification scheduled, will trigger in 2 seconds');
    } catch (error) {
      console.error('Error scheduling test notification:', error);
      throw error;
    }
  }
}

export default AlarmService;

