import * as Notifications from 'expo-notifications';
import MedicationManager from './MedicationManager';
import { Medication, MedicationAlarm } from '../types';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class AlarmService {
  private static instance: AlarmService;
  private isInitialized: boolean = false;
  private isMonitoring: boolean = false;
  private medicationManager: MedicationManager;

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
        console.warn('⚠️ Notification permissions not granted');
        return;
      }

      this.isInitialized = true;
      this.startMonitoring();
      console.log('✅ Alarm Service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing alarm service:', error);
      throw error;
    }
  }

  private startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.checkAlarms();
    
    // Check alarms every minute
    setInterval(() => {
      this.checkAlarms();
    }, 60000);

    console.log('✅ Alarm monitoring started');
  }

  private async checkAlarms(): Promise<void> {
    try {
      // This method is kept for backward compatibility
      // The actual alarm checking is now handled by expo-notifications
      // which fires notifications daily, and we filter them based on dayOfWeek in the handler
      
      // Get all scheduled notifications to verify they're set up correctly
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log(`📋 Currently scheduled: ${scheduledNotifications.length} notifications`);
    } catch (error) {
      console.error('❌ Error checking alarms:', error);
    }
  }

  private async triggerAlarm(medication: Medication, alarm: MedicationAlarm): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 Time to take ${medication.name}`,
          body: `Don't forget your medication!`,
          sound: true,
          data: {
            medicationId: medication.id,
            alarmId: alarm.id,
          },
        },
        trigger: null, // Immediate notification
      });

      console.log(`🔔 Alarm triggered for ${medication.name} at ${alarm.time}`);
    } catch (error) {
      console.error('❌ Error triggering alarm:', error);
    }
  }

  async rescheduleAllMedications(): Promise<void> {
    try {
      console.log('🔄 Rescheduling all medication alarms...');
      
      // Cancel all existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Load medications
      const medications = await this.medicationManager.loadMedications();
      
      // Ensure medications array exists and is valid
      if (!medications || !Array.isArray(medications)) {
        console.log('⚠️ No medications to reschedule');
        return;
      }

      // Load all alarms
      const allAlarms = await this.medicationManager.loadAlarms();
      
      // Ensure alarms array exists and is valid
      if (!allAlarms || !Array.isArray(allAlarms)) {
        console.log('⚠️ No alarms to reschedule');
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

      console.log('✅ All medication alarms rescheduled');
    } catch (error) {
      console.error('❌ Error rescheduling all medication alarms:', error);
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
        console.error(`❌ Invalid alarm time format: ${alarm.time}`);
        return;
      }

      const now = new Date();
      const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Convert Sunday from 0 to 7

      let totalScheduled = 0;

      // Schedule notifications for the next 12 weeks (3 months) for each specified day
      for (const dayOfWeek of alarm.daysOfWeek) {
        if (dayOfWeek < 1 || dayOfWeek > 7) {
          continue;
        }

        // Convert our day system (1=Monday, 7=Sunday) to JS Date system (0=Sunday, 1=Monday)
        const jsDayOfWeek = dayOfWeek === 7 ? 0 : dayOfWeek;

        // Calculate days until next occurrence of this day
        let daysUntilTarget = (jsDayOfWeek - currentDay + 7) % 7;
        
        // If it's the same day but time has passed, schedule for next week
        if (daysUntilTarget === 0) {
          const currentTime = now.getHours() * 60 + now.getMinutes();
          const alarmTime = hours * 60 + minutes;
          if (currentTime >= alarmTime) {
            daysUntilTarget = 7;
          }
        }

        // Schedule notifications for the next 12 weeks
        for (let week = 0; week < 12; week++) {
          const targetDate = new Date(now);
          targetDate.setHours(hours, minutes, 0, 0);
          targetDate.setDate(targetDate.getDate() + daysUntilTarget + (week * 7));

          // Skip if the date is in the past (with a small buffer to avoid scheduling in the past)
          const timeDiff = targetDate.getTime() - now.getTime();
          if (timeDiff <= 1000) { // Less than 1 second in the past
            continue;
          }

          // Schedule notification at the exact alarm time
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `💊 Time to take ${medication.name}`,
              body: `Don't forget your medication!`,
              sound: true,
              data: {
                medicationId: medication.id,
                alarmId: alarm.id,
                alarmTime: alarm.time,
              },
            },
            trigger: {
              date: targetDate,
            },
          });

          totalScheduled++;
        }
      }

      console.log(`⏰ Scheduled ${totalScheduled} notifications for ${medication.name} at ${alarm.time} on ${alarm.daysOfWeek.length} day(s)`);
    } catch (error) {
      console.error('❌ Error scheduling alarm notification:', error);
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

      console.log(`✅ Alarm created for ${medication.name}`);
    } catch (error) {
      console.error('❌ Error creating alarm:', error);
      throw error;
    }
  }

  setupNotificationHandlers(): void {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('📬 Notification received:', notification);
      const data = notification.request.content.data;
      if (data && data.medicationId) {
        console.log(`💊 Medication reminder: ${data.medicationId}`);
      }
    });

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      const data = response.notification.request.content.data;
      if (data && data.medicationId) {
        // Handle notification tap (e.g., navigate to medication detail)
        console.log(`👆 Tapped medication: ${data.medicationId}`);
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
      console.log(`✅ Alarm ${alarmId} cancelled`);
    } catch (error) {
      console.error('❌ Error cancelling alarm:', error);
      throw error;
    }
  }
}

export default AlarmService;

