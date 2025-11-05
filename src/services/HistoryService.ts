import AsyncStorage from '@react-native-async-storage/async-storage';
import { MedicationHistory, AdherenceStats, Medication, MedicationAlarm } from '../types';
import moment from 'moment';

const STORAGE_KEYS = {
  HISTORY: 'medication_history',
};

class HistoryService {
  private static instance: HistoryService;

  private constructor() {}

  public static getInstance(): HistoryService {
    if (!HistoryService.instance) {
      HistoryService.instance = new HistoryService();
    }
    return HistoryService.instance;
  }

  // Save medication history
  async saveHistory(history: MedicationHistory[]): Promise<void> {
    try {
      const jsonString = JSON.stringify(history);
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, jsonString);
      console.log('📝 History saved:', history.length, 'items');
    } catch (error) {
      console.error('❌ Error saving history:', error);
      throw error;
    }
  }

  // Load medication history
  async loadHistory(): Promise<MedicationHistory[]> {
    try {
      const jsonString = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
      if (!jsonString) {
        return [];
      }
      return JSON.parse(jsonString) as MedicationHistory[];
    } catch (error) {
      console.error('❌ Error loading history:', error);
      return [];
    }
  }

  // Record medication taken
  async recordMedicationTaken(
    medicationId: string,
    medicationName: string,
    alarmId?: string,
    alarmTime?: string
  ): Promise<void> {
    try {
      const history = await this.loadHistory();
      const now = new Date();
      
      // Check if taken within 30 minutes of alarm time
      let wasOnTime = true;
      if (alarmTime) {
        const alarmMoment = moment(alarmTime, 'HH:mm');
        const takenMoment = moment(now);
        const diffMinutes = Math.abs(takenMoment.diff(alarmMoment, 'minutes'));
        wasOnTime = diffMinutes <= 30;
      }

      const newEntry: MedicationHistory = {
        id: Date.now().toString(),
        medicationId,
        medicationName,
        takenAt: now.toISOString(),
        alarmId,
        wasOnTime,
      };

      history.push(newEntry);
      await this.saveHistory(history);
      console.log(`✅ Recorded: ${medicationName} taken at ${now.toISOString()}`);
    } catch (error) {
      console.error('❌ Error recording medication:', error);
      throw error;
    }
  }

  // Get history for a specific medication
  async getMedicationHistory(medicationId: string): Promise<MedicationHistory[]> {
    try {
      const history = await this.loadHistory();
      return history.filter(h => h.medicationId === medicationId);
    } catch (error) {
      console.error('❌ Error getting medication history:', error);
      return [];
    }
  }

  // Get recent history (last N days)
  async getRecentHistory(days: number = 7): Promise<MedicationHistory[]> {
    try {
      const history = await this.loadHistory();
      const cutoffDate = moment().subtract(days, 'days');
      return history.filter(h => moment(h.takenAt).isAfter(cutoffDate));
    } catch (error) {
      console.error('❌ Error getting recent history:', error);
      return [];
    }
  }

  // Calculate adherence statistics
  // Adherence = (Number of pills taken / Number of alarms) * 100
  async calculateAdherenceStats(
    medication: Medication,
    alarms: MedicationAlarm[]
  ): Promise<AdherenceStats> {
    try {
      const medicationHistory = await this.getMedicationHistory(medication.id);
      const historyEntries = medicationHistory;

      // Count enabled alarms for this medication
      const enabledAlarms = alarms.filter(alarm => alarm.isEnabled);
      const totalAlarms = enabledAlarms.length;

      // Count unique alarms that had pills taken (friendly for multiple pills per alarm)
      // If alarmId is available, use it to count unique alarms
      // Otherwise, group by date+time window to avoid double-counting
      const alarmsWithPillsTaken = new Set<string>();
      
      historyEntries.forEach(entry => {
        if (entry.alarmId) {
          // If alarmId is available, use it directly
          alarmsWithPillsTaken.add(entry.alarmId);
        } else {
          // If no alarmId, group by date+time window (30-minute window) to approximate alarm
          const takenDate = moment(entry.takenAt).format('YYYY-MM-DD');
          const takenTime = moment(entry.takenAt).format('HH:mm');
          // Round to nearest 30-minute window
          const hour = parseInt(takenTime.split(':')[0], 10);
          const minute = parseInt(takenTime.split(':')[1], 10);
          const roundedMinute = Math.floor(minute / 30) * 30;
          const timeWindow = `${hour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`;
          alarmsWithPillsTaken.add(`${takenDate}_${timeWindow}`);
        }
      });

      // Count unique alarms taken (not total pills)
      const totalTaken = alarmsWithPillsTaken.size;
      
      // Also count total pills for display purposes
      const totalPillsTaken = historyEntries.length;

      // Calculate adherence: unique alarms with pills taken / number of alarms
      // This way, taking multiple pills at one alarm time doesn't inflate adherence
      const adherenceRate = totalAlarms > 0 
        ? Math.round((totalTaken / totalAlarms) * 100) 
        : 0;

      // Calculate missed alarms (alarms - unique alarms taken, but not negative)
      const missedDays = Math.max(0, totalAlarms - totalTaken);

      // Calculate current streak (consecutive days with pills taken)
      let currentStreak = 0;
      if (historyEntries.length > 0) {
        const sortedHistory = [...historyEntries].sort((a, b) => 
          moment(b.takenAt).diff(moment(a.takenAt))
        );
        
        const takenDays = new Set<string>();
        sortedHistory.forEach(entry => {
          const takenDate = moment(entry.takenAt).format('YYYY-MM-DD');
          takenDays.add(takenDate);
        });
        
        const sortedTaken = Array.from(takenDays).sort().reverse();
        let checkDate = moment();
        
        while (true) {
          const dateStr = checkDate.format('YYYY-MM-DD');
          if (sortedTaken.includes(dateStr)) {
            currentStreak++;
            checkDate.subtract(1, 'day');
          } else {
            break;
          }
        }
      }

      // Calculate longest streak (consecutive days)
      let longestStreak = 0;
      if (historyEntries.length > 0) {
        const takenDays = new Set<string>();
        historyEntries.forEach(entry => {
          const takenDate = moment(entry.takenAt).format('YYYY-MM-DD');
          takenDays.add(takenDate);
        });
        
        const sortedDates = Array.from(takenDays).sort();
        let tempStreak = 1;
        
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = moment(sortedDates[i - 1]);
          const currDate = moment(sortedDates[i]);
          const diffDays = currDate.diff(prevDate, 'days');
          
          if (diffDays === 1) {
            tempStreak++;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak);
      }

      const lastTaken = historyEntries.length > 0
        ? historyEntries[historyEntries.length - 1].takenAt
        : undefined;

      return {
        medicationId: medication.id,
        medicationName: medication.name,
        totalAlarms: totalAlarms,
        totalTaken,
        adherenceRate,
        currentStreak,
        longestStreak,
        lastTaken,
        missedDays,
      };
    } catch (error) {
      console.error('❌ Error calculating adherence:', error);
      return {
        medicationId: medication.id,
        medicationName: medication.name,
        totalAlarms: 0,
        totalTaken: 0,
        adherenceRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        missedDays: 0,
      };
    }
  }

  // Get all adherence stats for all medications
  async getAllAdherenceStats(
    medications: Medication[],
    allAlarms: MedicationAlarm[]
  ): Promise<AdherenceStats[]> {
    try {
      const stats = await Promise.all(
        medications.map(async (med) => {
          const medAlarms = allAlarms.filter(a => a.medicationId === med.id);
          return await this.calculateAdherenceStats(med, medAlarms);
        })
      );
      return stats;
    } catch (error) {
      console.error('❌ Error getting all adherence stats:', error);
      return [];
    }
  }

  // Clear all medication history
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.HISTORY);
      console.log('✅ Medication history cleared');
    } catch (error) {
      console.error('❌ Error clearing history:', error);
      throw error;
    }
  }
}

export default HistoryService;





