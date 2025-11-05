import AsyncStorage from '@react-native-async-storage/async-storage';
import { Medication, MedicationAlarm, AlarmSettings, NotificationSettings } from '../types';

const STORAGE_KEYS = {
  MEDICATIONS: 'medications',
  ALARMS: 'medication_alarms',
  ALARM_SETTINGS: 'alarm_settings',
  NOTIFICATION_SETTINGS: 'notification_settings',
  SMART_LIGHTS: 'smart_lights',
};

class MedicationManager {
  private static instance: MedicationManager;
  
  private constructor() {}
  
  public static getInstance(): MedicationManager {
    if (!MedicationManager.instance) {
      MedicationManager.instance = new MedicationManager();
    }
    return MedicationManager.instance;
  }

  // Medication Management
  async saveMedications(medications: Medication[]): Promise<void> {
    try {
      const jsonString = JSON.stringify(medications);
      await AsyncStorage.setItem(STORAGE_KEYS.MEDICATIONS, jsonString);
      console.log('💊 Medications saved:', medications.length, 'items');
    } catch (error) {
      console.error('❌ Error saving medications:', error);
      throw error;
    }
  }

  async loadMedications(): Promise<Medication[]> {
    try {
      const jsonString = await AsyncStorage.getItem(STORAGE_KEYS.MEDICATIONS);
      if (!jsonString) {
        return [];
      }
      const medications = JSON.parse(jsonString) as Medication[];
      // Ensure all medications have an alarms property initialized
      const normalizedMedications = medications.map(med => ({
        ...med,
        alarms: med.alarms || []
      }));
      console.log('💊 Medications loaded:', normalizedMedications.length, 'items');
      return normalizedMedications;
    } catch (error) {
      console.error('❌ Error loading medications:', error);
      return [];
    }
  }

  async addMedication(medication: Medication): Promise<void> {
    try {
      const medications = await this.loadMedications();
      medications.push(medication);
      await this.saveMedications(medications);
      console.log('✅ Medication added:', medication.name);
    } catch (error) {
      console.error('❌ Error adding medication:', error);
      throw error;
    }
  }

  async updateMedication(updatedMedication: Medication): Promise<void> {
    try {
      const medications = await this.loadMedications();
      const index = medications.findIndex(m => m.id === updatedMedication.id);
      if (index !== -1) {
        medications[index] = {
          ...updatedMedication,
          updatedAt: new Date().toISOString()
        };
        await this.saveMedications(medications);
        console.log('✅ Medication updated:', updatedMedication.name);
      } else {
        console.log('⚠️ Medication not found for update:', updatedMedication.name);
      }
    } catch (error) {
      console.error('❌ Error updating medication:', error);
      throw error;
    }
  }

  async deleteMedication(medicationId: string): Promise<void> {
    try {
      const medications = await this.loadMedications();
      const filteredMedications = medications.filter(m => m.id !== medicationId);
      await this.saveMedications(filteredMedications);
      console.log('🗑️ Medication deleted:', medicationId);
    } catch (error) {
      console.error('❌ Error deleting medication:', error);
      throw error;
    }
  }

  async getMedication(medicationId: string): Promise<Medication | null> {
    try {
      const medications = await this.loadMedications();
      return medications.find(m => m.id === medicationId) || null;
    } catch (error) {
      console.error('❌ Error getting medication:', error);
      return null;
    }
  }

  async decreasePillCount(medicationId: string): Promise<boolean> {
    try {
      const medications = await this.loadMedications();
      const medicationIndex = medications.findIndex(m => m.id === medicationId);
      
      if (medicationIndex !== -1) {
        const medication = medications[medicationIndex];
        if (medication.pillCount > 0) {
          const updatedMedication = {
            ...medication,
            pillCount: medication.pillCount - 1,
            updatedAt: new Date().toISOString()
          };
          medications[medicationIndex] = updatedMedication;
          await this.saveMedications(medications);
          
          console.log(`💊 Pill count decreased for ${medication.name}: ${medication.pillCount} -> ${updatedMedication.pillCount}`);
          return true;
        } else {
          console.log(`⚠️ Cannot decrease pill count for ${medication.name}: already at 0`);
          return false;
        }
      } else {
        console.log('⚠️ Medication not found:', medicationId);
        return false;
      }
    } catch (error) {
      console.error('❌ Error decreasing pill count:', error);
      return false;
    }
  }

  // Alarm Management
  async saveAlarms(alarms: MedicationAlarm[]): Promise<void> {
    try {
      const jsonString = JSON.stringify(alarms);
      await AsyncStorage.setItem(STORAGE_KEYS.ALARMS, jsonString);
      console.log('⏰ Alarms saved:', alarms.length, 'items');
    } catch (error) {
      console.error('❌ Error saving alarms:', error);
      throw error;
    }
  }

  async loadAlarms(): Promise<MedicationAlarm[]> {
    try {
      const jsonString = await AsyncStorage.getItem(STORAGE_KEYS.ALARMS);
      if (!jsonString) {
        return [];
      }
      return JSON.parse(jsonString) as MedicationAlarm[];
    } catch (error) {
      console.error('❌ Error loading alarms:', error);
      return [];
    }
  }

  async addAlarm(alarm: MedicationAlarm): Promise<void> {
    try {
      const alarms = await this.loadAlarms();
      alarms.push(alarm);
      await this.saveAlarms(alarms);
      console.log('✅ Alarm added for:', alarm.medicationName);
    } catch (error) {
      console.error('❌ Error adding alarm:', error);
      throw error;
    }
  }

  async updateAlarm(updatedAlarm: MedicationAlarm): Promise<void> {
    try {
      const alarms = await this.loadAlarms();
      const index = alarms.findIndex(a => a.id === updatedAlarm.id);
      if (index !== -1) {
        alarms[index] = updatedAlarm;
        await this.saveAlarms(alarms);
        console.log('✅ Alarm updated for:', updatedAlarm.medicationName);
      }
    } catch (error) {
      console.error('❌ Error updating alarm:', error);
      throw error;
    }
  }

  async deleteAlarm(alarmId: string): Promise<void> {
    try {
      const alarms = await this.loadAlarms();
      const filteredAlarms = alarms.filter(a => a.id !== alarmId);
      await this.saveAlarms(filteredAlarms);
      console.log('🗑️ Alarm deleted:', alarmId);
    } catch (error) {
      console.error('❌ Error deleting alarm:', error);
      throw error;
    }
  }

  // Settings Management
  async saveAlarmSettings(settings: AlarmSettings): Promise<void> {
    try {
      const jsonString = JSON.stringify(settings);
      await AsyncStorage.setItem(STORAGE_KEYS.ALARM_SETTINGS, jsonString);
    } catch (error) {
      console.error('❌ Error saving alarm settings:', error);
      throw error;
    }
  }

  async loadAlarmSettings(): Promise<AlarmSettings> {
    try {
      const jsonString = await AsyncStorage.getItem(STORAGE_KEYS.ALARM_SETTINGS);
      if (!jsonString) {
        return {
          isEnabled: true,
          soundEnabled: true,
          vibrationEnabled: true,
          lightEnabled: true,
          snoozeMinutes: 5,
          maxSnoozes: 3
        };
      }
      return JSON.parse(jsonString) as AlarmSettings;
    } catch (error) {
      console.error('❌ Error loading alarm settings:', error);
      return {
        isEnabled: true,
        soundEnabled: true,
        vibrationEnabled: true,
        lightEnabled: true,
        snoozeMinutes: 5,
        maxSnoozes: 3
      };
    }
  }

  async saveNotificationSettings(settings: NotificationSettings): Promise<void> {
    try {
      const jsonString = JSON.stringify(settings);
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_SETTINGS, jsonString);
    } catch (error) {
      console.error('❌ Error saving notification settings:', error);
      throw error;
    }
  }

  async loadNotificationSettings(): Promise<NotificationSettings> {
    try {
      const jsonString = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
      if (!jsonString) {
        return {
          enabled: true,
          soundEnabled: true,
          vibrationEnabled: true,
          lightEnabled: true,
          persistentNotification: true
        };
      }
      return JSON.parse(jsonString) as NotificationSettings;
    } catch (error) {
      console.error('❌ Error loading notification settings:', error);
      return {
        enabled: true,
        soundEnabled: true,
        vibrationEnabled: true,
        lightEnabled: true,
        persistentNotification: true
      };
    }
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
      console.log('🗑️ All data cleared');
    } catch (error) {
      console.error('❌ Error clearing all data:', error);
      throw error;
    }
  }
}

export default MedicationManager;

