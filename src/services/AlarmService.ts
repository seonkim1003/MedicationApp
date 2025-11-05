import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import MedicationManager from './MedicationManager';
import { Medication, MedicationAlarm } from '../types';

// Configure notification behavior as alarms with sound
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
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

        // Convert our day system (1=Monday, 7=Sunday) to JS Date system (0=Sunday, 1=Monday)
        const jsDayOfWeek = dayOfWeek === 7 ? 0 : dayOfWeek;

        // Schedule as a recurring weekly alarm with sound
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Time to take ${medication.name}`,
            body: `Don't forget your medication!`,
            sound: true, // Play default alarm sound
            vibrate: [0, 250, 250, 250],
            data: {
              medicationId: medication.id,
              alarmId: alarm.id,
              alarmTime: alarm.time,
              medicationName: medication.name,
            },
            categoryIdentifier: 'alarm',
          },
          trigger: {
            type: 'calendar',
            weekday: jsDayOfWeek + 1, // expo-notifications uses 1-7 where 1 is Sunday
            hour: hours,
            minute: minutes,
            repeats: true, // Recurring weekly alarm
          } as Notifications.CalendarTriggerInput,
          identifier: `alarm_${alarm.id}_${dayOfWeek}`, // Unique identifier for this alarm/day combo
        });

        totalScheduled++;
      }

      console.log(`Scheduled ${totalScheduled} recurring alarms for ${medication.name} at ${alarm.time}`);
    } catch (error) {
      console.error('Error scheduling alarm notification:', error);
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
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener(async (notification) => {
      console.log('Alarm notification received:', notification);
      const data = notification.request.content.data;
      if (data && data.medicationId && this.navigationRef) {
        console.log(`Medication alarm: ${data.medicationId}`);
        // Navigate to alarm screen immediately when notification is received
        this.navigationRef.navigate('Alarm', {
          medicationId: data.medicationId,
          alarmId: data.alarmId,
          medicationName: data.medicationName || 'Medication',
          alarmTime: data.alarmTime,
        });
      }
    });

    // Handle notification tapped (when app is in background)
    Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log('Alarm notification tapped:', response);
      const data = response.notification.request.content.data;
      if (data && data.medicationId && this.navigationRef) {
        // Navigate to alarm screen when user taps notification
        this.navigationRef.navigate('Alarm', {
          medicationId: data.medicationId,
          alarmId: data.alarmId,
          medicationName: data.medicationName || 'Medication',
          alarmTime: data.alarmTime,
        });
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
}

export default AlarmService;

