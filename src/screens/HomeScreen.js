import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import MedicationManager from '../services/MedicationManager';
import HistoryService from '../services/HistoryService';
import CircularTimer from '../components/CircularTimer';
import moment from 'moment';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [totalMedications, setTotalMedications] = useState(0);
  const [todayMedications, setTodayMedications] = useState([]);
  const [upcomingAlarms, setUpcomingAlarms] = useState([]);
  const [todayTaken, setTodayTaken] = useState(0);
  const [lowPillCount, setLowPillCount] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [nextAlarmTime, setNextAlarmTime] = useState(null);

  useEffect(() => {
    loadDashboard();
    
    // Refresh full dashboard every 30 seconds
    const dashboardInterval = setInterval(loadDashboard, 30000);
    
    // Update next alarm time more frequently (every 5 seconds) for accurate countdown
    const alarmUpdateInterval = setInterval(async () => {
      try {
        const medicationManager = MedicationManager.getInstance();
        const medications = await medicationManager.loadMedications();
        const allAlarms = await medicationManager.loadAlarms();
        const nextAlarm = calculateNextAlarmTime(medications, allAlarms);
        setNextAlarmTime(nextAlarm);
      } catch (error) {
        console.error('Error updating next alarm time:', error);
      }
    }, 5000);
    
    return () => {
      clearInterval(dashboardInterval);
      clearInterval(alarmUpdateInterval);
    };
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const medicationManager = MedicationManager.getInstance();
      const historyService = HistoryService.getInstance();

      // Load medications
      const medications = await medicationManager.loadMedications();
      const allAlarms = await medicationManager.loadAlarms();
      
      setTotalMedications(medications.length);

      // Get today's medications
      const today = moment();
      const dayOfWeek = today.day() === 0 ? 7 : today.day(); // Convert to our system
      
      const todayMeds = [];
      medications.forEach(med => {
        const medAlarms = allAlarms.filter(a => 
          a.medicationId === med.id && 
          a.isEnabled &&
          a.daysOfWeek.includes(dayOfWeek)
        );
        if (medAlarms.length > 0) {
          medAlarms.forEach(alarm => {
            todayMeds.push({
              ...alarm,
              medication: med,
            });
          });
        }
      });

      // Sort by time
      todayMeds.sort((a, b) => {
        const timeA = moment(a.time, 'HH:mm');
        const timeB = moment(b.time, 'HH:mm');
        return timeA.diff(timeB);
      });
      
      setTodayMedications(todayMeds);

      // Get upcoming alarms (next 3)
      const now = moment();
      const upcoming = todayMeds
        .filter(med => {
          const alarmTime = moment(med.time, 'HH:mm');
          const todayAlarm = moment(now).set({
            hour: alarmTime.hour(),
            minute: alarmTime.minute(),
            second: 0,
            millisecond: 0
          });
          return todayAlarm.isAfter(now);
        })
        .slice(0, 3);
      
      setUpcomingAlarms(upcoming);

      // Calculate next alarm time for circular timer
      const nextAlarm = calculateNextAlarmTime(medications, allAlarms);
      setNextAlarmTime(nextAlarm);

      // Get today's taken count
      const todayHistory = await historyService.getRecentHistory(1);
      setTodayTaken(todayHistory.length);

      // Get low pill count medications
      const lowCount = medications.filter(m => m.pillCount <= 5 && m.pillCount > 0);
      setLowPillCount(lowCount);

      // Get current streak
      const stats = await historyService.getAllAdherenceStats(medications, allAlarms);
      if (stats.length > 0) {
        const bestStreak = Math.max(...stats.map(s => s.currentStreak));
        setCurrentStreak(bestStreak);
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load dashboard',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateNextAlarmTime = (medications, allAlarms) => {
    try {
      const now = moment();
      const futureAlarms = [];

      // Collect all future alarms across the next 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const checkDate = moment(now).add(dayOffset, 'days');
        const dayOfWeek = checkDate.day() === 0 ? 7 : checkDate.day();

        medications.forEach(med => {
          const medAlarms = allAlarms.filter(a => 
            a.medicationId === med.id && 
            a.isEnabled &&
            a.daysOfWeek.includes(dayOfWeek)
          );

          medAlarms.forEach(alarm => {
            const [hours, minutes] = alarm.time.split(':').map(Number);
            const alarmMoment = moment(checkDate).set({
              hour: hours,
              minute: minutes,
              second: 0,
              millisecond: 0
            });

            // Only consider future alarms
            if (alarmMoment.isAfter(now)) {
              futureAlarms.push(alarmMoment);
            }
          });
        });
      }

      // Sort all future alarms by time and return the earliest one
      if (futureAlarms.length === 0) {
        return null;
      }

      futureAlarms.sort((a, b) => a.valueOf() - b.valueOf());
      const nextAlarm = futureAlarms[0];
      
      return nextAlarm.toISOString();
    } catch (error) {
      console.error('Error calculating next alarm:', error);
      return null;
    }
  };

  const markAsTaken = async (medication) => {
    try {
      const historyService = HistoryService.getInstance();
      const medicationManager = MedicationManager.getInstance();
      
      // Check if medication has pills available
      if (medication.pillCount <= 0) {
        Toast.show({
          type: 'warning',
          text1: 'No Pills Available',
          text2: `${medication.name} has no pills left`,
        });
        return;
      }

      // Decrease pill count first
      const success = await medicationManager.decreasePillCount(medication.id);
      
      if (success) {
        // Record in history after successful decrease
        await historyService.recordMedicationTaken(
          medication.id,
          medication.name
        );
        
        Toast.show({
          type: 'success',
          text1: 'Medication Taken',
          text2: `${medication.name} recorded`,
        });

        // Reload dashboard to update pill counts
        await loadDashboard();
      } else {
        Toast.show({
          type: 'warning',
          text1: 'Cannot Take Pill',
          text2: `${medication.name} has no pills left`,
        });
      }
    } catch (error) {
      console.error('Error marking as taken:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to record medication',
      });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Dashboard</Text>

        {/* Circular Timer for Next Alarm */}
        <View style={styles.timerSection}>
          <CircularTimer nextAlarmTime={nextAlarmTime} size={140} strokeWidth={10} />
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsContainer}>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{totalMedications}</Text>
            <Text style={styles.quickStatLabel}>Medications</Text>
          </View>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{todayTaken}</Text>
            <Text style={styles.quickStatLabel}>Taken Today</Text>
          </View>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{currentStreak}</Text>
            <Text style={styles.quickStatLabel}>Day Streak</Text>
          </View>
        </View>

        {/* Low Pill Count Alert */}
        {lowPillCount.length > 0 && (
          <View style={[styles.section, styles.alertSection]}>
            <Text style={styles.alertTitle}>Low Pill Count</Text>
            {lowPillCount.map(med => (
              <View key={med.id} style={styles.alertItem}>
                <Text style={styles.alertText}>
                  {med.name}: Only {med.pillCount} pills left!
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Upcoming Medications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Today</Text>
          {upcomingAlarms.length > 0 ? (
            upcomingAlarms.map((item, index) => (
              <View key={`${item.id}-${index}`} style={styles.medicationCard}>
                <View style={styles.medicationCardHeader}>
                  <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.takeButton}
                    onPress={() => markAsTaken(item.medication)}
                  >
                    <Text style={styles.takeButtonText}>✓ Take</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.medicationName}>{item.medicationName}</Text>
                <View style={styles.medicationDetails}>
                  <View style={[styles.colorDot, { backgroundColor: item.lightColor }]} />
                  <Text style={styles.detailText}>
                    {item.medication.pillCount} pills left
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No upcoming medications today</Text>
          )}
        </View>

        {/* Refresh Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.button} onPress={loadDashboard}>
            <Text style={styles.buttonText}>Refresh Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2c3e50',
  },
  timerSection: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  quickStatValue: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 5,
  },
  quickStatLabel: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  alertSection: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  alertItem: {
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    color: '#856404',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  medicationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  medicationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeContainer: {
    flex: 1,
  },
  timeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  takeButton: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  takeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  medicationName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 6,
  },
  medicationDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  emptyText: {
    fontSize: 14,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});



