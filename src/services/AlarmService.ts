import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import MedicationManager from './MedicationManager';
import { Medication, MedicationAlarm } from '../types';

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
      const permissionsRequest: Notifications.NotificationPermissionsRequest = Platform.OS === 'ios' 
        ? {
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              allowAnnouncements: true,
              allowCriticalAlerts: true,
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
    } catch (error) {
      console.error('Error initializing alarm service:', error);
      throw error;
    }
  }

  private startMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
  }

  async rescheduleAllMedications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

      const medications = await this.medicationManager.loadMedications();
      if (!medications || !Array.isArray(medications)) return;

      const allAlarms = await this.medicationManager.loadAlarms();
      if (!allAlarms || !Array.isArray(allAlarms)) return;

      for (const medication of medications) {
        if (!medication || !medication.id) continue;

        const medicationAlarms = (allAlarms || []).filter(
          (alarm: MedicationAlarm) => alarm.medicationId === medication.id && alarm.isEnabled
        );

        if (!medicationAlarms || medicationAlarms.length === 0) continue;

        for (const alarm of medicationAlarms) {
          if (!alarm || !alarm.time || !alarm.daysOfWeek || !Array.isArray(alarm.daysOfWeek)) continue;
          await this.scheduleAlarmNotification(medication, alarm);
        }
      }
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
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.error(`Invalid alarm time format: ${alarm.time}`);
        return;
      }

      for (const dayOfWeek of alarm.daysOfWeek) {
        if (dayOfWeek < 1 || dayOfWeek > 7) continue;

        const expoWeekday = dayOfWeek === 7 ? 1 : dayOfWeek + 1;
        const notificationContent: any = {
          title: `TAKE MEDICATION NOW - ${medication.name}`,
          body: `TAKE YOUR MEDICATION IMMEDIATELY!`,
          sound: true,
          data: {
            medicationId: medication.id,
            alarmId: alarm.id,
            alarmTime: alarm.time,
            medicationName: medication.name,
          },
          categoryIdentifier: 'alarm',
        };

        if (Platform.OS === 'android') {
          notificationContent.channelId = 'alarms';
          notificationContent.vibrate = [0, 250, 250, 250];
          notificationContent.sound = 'default';
        } else if (Platform.OS === 'ios') {
          notificationContent.sound = 'default';
          notificationContent.interruptionLevel = 'critical';
          notificationContent.relevanceSummary = `Medication reminder: ${medication.name}`;
          notificationContent.badge = 1;
        }

        await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: {
            type: 'calendar',
            weekday: expoWeekday,
            hour: hours,
            minute: minutes,
            repeats: true,
          } as Notifications.CalendarTriggerInput,
          identifier: `alarm_${alarm.id}_${dayOfWeek}`,
        });
      }
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
      
      const updatedMedication = {
        ...medication,
        alarms: [...(medication.alarms || []), newAlarm],
      };
      await this.medicationManager.updateMedication(updatedMedication);

      await this.rescheduleAllMedications();
    } catch (error) {
      console.error('Error creating alarm:', error);
      throw error;
    }
  }

  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
  }

  setupNotificationHandlers(): void {
    if (this.notificationHandlersSetup) return;
    
    this.notificationHandlersSetup = true;
    
    Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data;
      
      if (data && data.medicationId) {
        setTimeout(() => {
          if (this.navigationRef && this.navigationRef.current) {
            try {
              this.navigationRef.current.navigate('Alarm', {
                medicationId: data.medicationId,
                alarmId: data.alarmId,
                medicationName: data.medicationName || 'Medication',
                alarmTime: data.alarmTime,
              });
            } catch (error) {
              console.error('Error navigating to alarm screen:', error);
            }
          }
        }, 100);
      }
    });

    Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      
      if (data && data.medicationId) {
        const navigateToAlarm = (retryCount = 0) => {
          const maxRetries = 10;
          
          if (this.navigationRef && this.navigationRef.current) {
            try {
              this.navigationRef.current.navigate('Alarm', {
                medicationId: data.medicationId,
                alarmId: data.alarmId,
                medicationName: data.medicationName || 'Medication',
                alarmTime: data.alarmTime,
              });
            } catch (error) {
              console.error('Error navigating to alarm screen:', error);
            }
          } else if (retryCount < maxRetries) {
            setTimeout(() => navigateToAlarm(retryCount + 1), 200);
          }
        };
        
        setTimeout(() => navigateToAlarm(), 500);
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
    } catch (error) {
      console.error('Error cancelling alarm:', error);
      throw error;
    }
  }

  async testNotification(medicationName: string = 'Test Medication'): Promise<void> {
    try {
      const notificationContent: any = {
        title: `TAKE MEDICATION NOW - ${medicationName}`,
        body: `TAKE YOUR MEDICATION IMMEDIATELY!`,
        sound: true,
        data: {
          medicationId: 'test',
          alarmId: 'test',
          alarmTime: new Date().toLocaleTimeString(),
          medicationName: medicationName,
        },
        categoryIdentifier: 'alarm',
      };

      if (Platform.OS === 'android') {
        notificationContent.channelId = 'alarms';
        notificationContent.vibrate = [0, 250, 250, 250];
        notificationContent.sound = 'default';
      } else if (Platform.OS === 'ios') {
        notificationContent.sound = 'default';
        notificationContent.interruptionLevel = 'critical';
        notificationContent.relevanceSummary = `Test medication reminder: ${medicationName}`;
        notificationContent.badge = 1;
      }

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: {
          seconds: 2,
        },
      });
    } catch (error) {
      console.error('Error scheduling test notification:', error);
      throw error;
    }
  }
}

export default AlarmService;

