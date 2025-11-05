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
  async calculateAdherenceStats(
    medication: Medication,
    alarms: MedicationAlarm[]
  ): Promise<AdherenceStats> {
    try {
      const medicationHistory = await this.getMedicationHistory(medication.id);
      const historyEntries = medicationHistory;

      if (historyEntries.length === 0) {
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

      // Calculate date range (last 30 days)
      const endDate = moment();
      const startDate = moment().subtract(30, 'days');

      // Get all expected medication days from alarms
      const expectedDays = new Set<string>();
      alarms.forEach(alarm => {
        if (!alarm.isEnabled) return;
        
        const alarmTime = moment(alarm.time, 'HH:mm');
        const dayOfWeek = alarmTime.day(); // 0 = Sunday, 1 = Monday, etc.
        
        // Convert our day system (1=Monday) to JS day system
        const ourDays = alarm.daysOfWeek.map(d => d === 7 ? 0 : d);
        
        let current = startDate.clone();
        while (current.isBefore(endDate)) {
          if (ourDays.includes(current.day())) {
            const dateStr = current.format('YYYY-MM-DD');
            expectedDays.add(dateStr);
          }
          current.add(1, 'day');
        }
      });

      // Get actual taken days
      const takenDays = new Set<string>();
      historyEntries.forEach(entry => {
        const takenDate = moment(entry.takenAt).format('YYYY-MM-DD');
        takenDays.add(takenDate);
      });

      // Calculate adherence
      const totalExpected = expectedDays.size;
      const totalTaken = takenDays.size;
      const missedDays = totalExpected - totalTaken;
      const adherenceRate = totalExpected > 0 
        ? Math.round((totalTaken / totalExpected) * 100) 
        : 0;

      // Calculate current streak
      let currentStreak = 0;
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

      // Calculate longest streak (simplified)
      let longestStreak = 0;
      let tempStreak = 0;
      const sortedHistory = [...historyEntries].sort((a, b) => 
        moment(a.takenAt).diff(moment(b.takenAt))
      );

      for (let i = 0; i < sortedHistory.length; i++) {
        if (i === 0 || 
            moment(sortedHistory[i].takenAt).diff(
              moment(sortedHistory[i-1].takenAt), 'days'
            ) === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);

      const lastTaken = historyEntries.length > 0
        ? historyEntries[historyEntries.length - 1].takenAt
        : undefined;

      return {
        medicationId: medication.id,
        medicationName: medication.name,
        totalAlarms: totalExpected,
        totalTaken,
        adherenceRate,
        currentStreak,
        longestStreak,
        lastTaken,
        missedDays: Math.max(0, missedDays),
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
}

export default HistoryService;

