import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import MedicationManager from '../services/MedicationManager';
import HistoryService from '../services/HistoryService';
import CircularTimer from '../components/CircularTimer';
import moment from 'moment';
import Toast from 'react-native-toast-message';
import { colors, cardShadow, borderRadius } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [totalMedications, setTotalMedications] = useState(0);
  const [todayMedications, setTodayMedications] = useState([]);
  const [upcomingAlarms, setUpcomingAlarms] = useState([]);
  const [todayTaken, setTodayTaken] = useState(0);
  const [lowPillCount, setLowPillCount] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [nextAlarmTime, setNextAlarmTime] = useState(null);
  const [yesterdayStatus, setYesterdayStatus] = useState({ total: 0, taken: 0, missed: 0 });
  const [todayStatus, setTodayStatus] = useState({ total: 0, taken: 0, remaining: 0, missed: 0 });

  useEffect(() => {
    loadDashboard();

    const dashboardInterval = setInterval(loadDashboard, 30000);

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

      const medications = await medicationManager.loadMedications();
      const allAlarms = await medicationManager.loadAlarms();

      setTotalMedications(medications.length);

      const today = moment();
      const dayOfWeek = today.day() === 0 ? 7 : today.day();

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

      todayMeds.sort((a, b) => {
        const timeA = moment(a.time, 'HH:mm');
        const timeB = moment(b.time, 'HH:mm');
        return timeA.diff(timeB);
      });

      setTodayMedications(todayMeds);

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

      const nextAlarm = calculateNextAlarmTime(medications, allAlarms);
      setNextAlarmTime(nextAlarm);

      const todayHistory = await historyService.getRecentHistory(1);
      setTodayTaken(todayHistory.length);

      const lowCount = medications.filter(m => m.pillCount <= 5 && m.pillCount > 0);
      setLowPillCount(lowCount);

      const stats = await historyService.getAllAdherenceStats(medications, allAlarms);
      if (stats.length > 0) {
        const bestStreak = Math.max(...stats.map(s => s.currentStreak));
        setCurrentStreak(bestStreak);
      }

      try {
        const yesterday = moment().subtract(1, 'day');
        const yesterdayDayOfWeek = yesterday.day() === 0 ? 7 : yesterday.day();
        const todayDayOfWeek = today.day() === 0 ? 7 : today.day();

        const allHistory = await historyService.loadHistory();

        const yesterdayAlarms = [];
        medications.forEach(med => {
          const medAlarms = allAlarms.filter(a =>
            a.medicationId === med.id &&
            a.isEnabled &&
            a.daysOfWeek.includes(yesterdayDayOfWeek)
          );
          medAlarms.forEach(alarm => {
            yesterdayAlarms.push({
              ...alarm,
              medication: med,
            });
          });
        });

        const yesterdayTaken = yesterdayAlarms.filter(alarm => {
          try {
            const alarmTime = moment(alarm.time, 'HH:mm');
            if (!alarmTime.isValid()) return false;
            const alarmDate = yesterday.clone().set({
              hour: alarmTime.hour(),
              minute: alarmTime.minute(),
            });
            return allHistory.some(h => {
              try {
                const historyDate = moment(h.takenAt);
                if (!historyDate.isValid()) return false;
                const isSameDay = historyDate.isSame(alarmDate, 'day');
                const timeDiff = Math.abs(historyDate.diff(alarmDate, 'minutes'));
                const matchesMedication = h.medicationId === alarm.medicationId;
                const matchesAlarm = alarm.id && h.alarmId ? h.alarmId === alarm.id : true;
                return matchesMedication && isSameDay && timeDiff <= 60 && matchesAlarm;
              } catch (e) {
                return false;
              }
            });
          } catch (e) {
            return false;
          }
        });

        setYesterdayStatus({
          total: yesterdayAlarms.length,
          taken: yesterdayTaken.length,
          missed: Math.max(0, yesterdayAlarms.length - yesterdayTaken.length),
        });

        const todayAlarms = todayMeds;
        const now = moment();
        const todayTaken = todayAlarms.filter(alarm => {
          try {
            const alarmTime = moment(alarm.time, 'HH:mm');
            if (!alarmTime.isValid()) return false;
            const todayAlarm = moment(now).set({
              hour: alarmTime.hour(),
              minute: alarmTime.minute(),
            });
            return allHistory.some(h => {
              try {
                const historyDate = moment(h.takenAt);
                if (!historyDate.isValid()) return false;
                const isSameDay = historyDate.isSame(todayAlarm, 'day');
                const timeDiff = Math.abs(historyDate.diff(todayAlarm, 'minutes'));
                const matchesMedication = h.medicationId === alarm.medicationId;
                const matchesAlarm = alarm.id && h.alarmId ? h.alarmId === alarm.id : true;
                return matchesMedication && isSameDay && timeDiff <= 60 && matchesAlarm;
              } catch (e) {
                return false;
              }
            });
          } catch (e) {
            return false;
          }
        });

        const todayRemaining = todayAlarms.filter(alarm => {
          try {
            const alarmTime = moment(alarm.time, 'HH:mm');
            if (!alarmTime.isValid()) return false;
            const todayAlarm = moment(now).set({
              hour: alarmTime.hour(),
              minute: alarmTime.minute(),
            });
            return todayAlarm.isAfter(now);
          } catch (e) {
            return false;
          }
        });

        const todayMissed = todayAlarms.filter(alarm => {
          try {
            const alarmTime = moment(alarm.time, 'HH:mm');
            if (!alarmTime.isValid()) return false;
            const todayAlarm = moment(now).set({
              hour: alarmTime.hour(),
              minute: alarmTime.minute(),
            });
            const isPast = todayAlarm.isBefore(now);
            const notTaken = !allHistory.some(h => {
              try {
                const historyDate = moment(h.takenAt);
                if (!historyDate.isValid()) return false;
                const isSameDay = historyDate.isSame(todayAlarm, 'day');
                const timeDiff = Math.abs(historyDate.diff(todayAlarm, 'minutes'));
                const matchesMedication = h.medicationId === alarm.medicationId;
                const matchesAlarm = alarm.id && h.alarmId ? h.alarmId === alarm.id : true;
                return matchesMedication && isSameDay && timeDiff <= 60 && matchesAlarm;
              } catch (e) {
                return false;
              }
            });
            return isPast && notTaken;
          } catch (e) {
            return false;
          }
        });

        setTodayStatus({
          total: todayAlarms.length,
          taken: todayTaken.length,
          remaining: todayRemaining.length,
          missed: todayMissed.length,
        });
      } catch (adherenceError) {
        console.error('Error calculating adherence:', adherenceError);
        // Set default values if calculation fails
        setYesterdayStatus({ total: 0, taken: 0, missed: 0 });
        setTodayStatus({ total: 0, taken: 0, remaining: 0, missed: 0 });
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

      if (medication.pillCount <= 0) {
        Toast.show({
          type: 'warning',
          text1: 'No Pills Available',
          text2: `${medication.name} has no pills left`,
        });
        return;
      }

      const success = await medicationManager.decreasePillCount(medication.id);

      if (success) {
        await historyService.recordMedicationTaken(
          medication.id,
          medication.name
        );

        Toast.show({
          type: 'success',
          text1: 'Medication Taken',
          text2: `${medication.name} recorded`,
        });

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

        <View style={styles.timerSection}>
          <CircularTimer nextAlarmTime={nextAlarmTime} size={160} strokeWidth={12} />
        </View>

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medication Status</Text>

          <View style={styles.adherenceCard}>
            <View style={styles.adherenceHeader}>
              <Text style={styles.adherenceDayTitle}>Yesterday</Text>
              {yesterdayStatus.total > 0 && (
                <View style={[
                  styles.adherenceBadge,
                  yesterdayStatus.missed === 0 ? styles.adherenceBadgeSuccess : styles.adherenceBadgeWarning
                ]}>
                  <Text style={styles.adherenceBadgeText}>
                    {yesterdayStatus.missed === 0 ? 'All Taken' : `${yesterdayStatus.missed} Missed`}
                  </Text>
                </View>
              )}
            </View>
            {yesterdayStatus.total > 0 ? (
              <View style={styles.adherenceStats}>
                <View style={styles.adherenceStatItem}>
                  <Text style={styles.adherenceStatValue}>{yesterdayStatus.taken}</Text>
                  <Text style={styles.adherenceStatLabel}>Taken</Text>
                </View>
                <View style={styles.adherenceStatItem}>
                  <Text style={[styles.adherenceStatValue, styles.adherenceStatValueMissed]}>
                    {yesterdayStatus.missed}
                  </Text>
                  <Text style={styles.adherenceStatLabel}>Missed</Text>
                </View>
                <View style={styles.adherenceStatItem}>
                  <Text style={styles.adherenceStatValue}>{yesterdayStatus.total}</Text>
                  <Text style={styles.adherenceStatLabel}>Total</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.adherenceEmptyText}>No medications scheduled yesterday</Text>
            )}
          </View>

          <View style={[styles.adherenceCard, styles.adherenceCardToday]}>
            <View style={styles.adherenceHeader}>
              <Text style={styles.adherenceDayTitle}>Today</Text>
              {todayStatus.total > 0 && (
                <View style={[
                  styles.adherenceBadge,
                  todayStatus.missed === 0 && todayStatus.remaining === 0
                    ? styles.adherenceBadgeSuccess
                    : todayStatus.missed > 0
                      ? styles.adherenceBadgeWarning
                      : styles.adherenceBadgeInfo
                ]}>
                  <Text style={styles.adherenceBadgeText}>
                    {todayStatus.missed === 0 && todayStatus.remaining === 0
                      ? 'All Done'
                      : todayStatus.missed > 0
                        ? `${todayStatus.missed} Missed`
                        : `${todayStatus.remaining} Remaining`}
                  </Text>
                </View>
              )}
            </View>
            {todayStatus.total > 0 ? (
              <View style={styles.adherenceStats}>
                <View style={styles.adherenceStatItem}>
                  <Text style={styles.adherenceStatValue}>{todayStatus.taken}</Text>
                  <Text style={styles.adherenceStatLabel}>Taken</Text>
                </View>
                {todayStatus.missed > 0 && (
                  <View style={styles.adherenceStatItem}>
                    <Text style={[styles.adherenceStatValue, styles.adherenceStatValueMissed]}>
                      {todayStatus.missed}
                    </Text>
                    <Text style={styles.adherenceStatLabel}>Missed</Text>
                  </View>
                )}
                {todayStatus.remaining > 0 && (
                  <View style={styles.adherenceStatItem}>
                    <Text style={[styles.adherenceStatValue, styles.adherenceStatValueRemaining]}>
                      {todayStatus.remaining}
                    </Text>
                    <Text style={styles.adherenceStatLabel}>Remaining</Text>
                  </View>
                )}
                <View style={styles.adherenceStatItem}>
                  <Text style={styles.adherenceStatValue}>{todayStatus.total}</Text>
                  <Text style={styles.adherenceStatLabel}>Total</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.adherenceEmptyText}>No medications scheduled today</Text>
            )}
          </View>
        </View>

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
                    <Text style={styles.takeButtonText}>Take</Text>
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

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  loadingText: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 50,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    color: colors.textPrimary,
  },
  timerSection: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    ...cardShadow,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    ...cardShadow,
    minHeight: 100,
  },
  quickStatValue: {
    fontSize: 38,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 24,
    ...cardShadow,
  },
  alertSection: {
    backgroundColor: colors.warningLight,
    borderLeftWidth: 5,
    borderLeftColor: colors.accent,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.warningText,
    marginBottom: 10,
  },
  alertItem: {
    marginBottom: 6,
  },
  alertText: {
    fontSize: 16,
    color: colors.warningText,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: colors.textPrimary,
  },
  medicationCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  medicationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeContainer: {
    flex: 1,
  },
  timeText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  takeButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: borderRadius.xl,
    minWidth: 100,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takeButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  medicationName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  medicationDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  detailText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: 16,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  adherenceCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  adherenceCardToday: {
    backgroundColor: colors.primaryLight,
    borderLeftColor: colors.primaryDark,
  },
  adherenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  adherenceDayTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  adherenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    minHeight: 28,
    justifyContent: 'center',
  },
  adherenceBadgeSuccess: {
    backgroundColor: colors.success,
  },
  adherenceBadgeWarning: {
    backgroundColor: colors.accent,
  },
  adherenceBadgeInfo: {
    backgroundColor: colors.primary,
  },
  adherenceBadgeText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  adherenceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  adherenceStatItem: {
    alignItems: 'center',
  },
  adherenceStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 4,
  },
  adherenceStatValueMissed: {
    color: colors.danger,
  },
  adherenceStatValueRemaining: {
    color: colors.primary,
  },
  adherenceStatLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  adherenceEmptyText: {
    fontSize: 15,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 8,
  },
  musicInfoContainer: {
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.md,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  musicName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  musicButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  musicButton: {
    flex: 1,
    borderRadius: borderRadius.sm,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  musicButtonSecondary: {
    backgroundColor: colors.textSecondary,
  },
  musicButtonDanger: {
    backgroundColor: colors.danger,
  },
  musicButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});



