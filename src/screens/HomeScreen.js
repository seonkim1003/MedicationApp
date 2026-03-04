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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const todayProgressPercent = todayStatus.total > 0
    ? Math.round((todayStatus.taken / todayStatus.total) * 100)
    : 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Greeting */}
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.greetingSub}>{moment().format('dddd, MMMM D')}</Text>

        {/* Hero Timer Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Next Medication</Text>
          <CircularTimer nextAlarmTime={nextAlarmTime} size={150} strokeWidth={10} />
        </View>

        {/* Today's Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Today's Progress</Text>
            <View style={[
              styles.progressBadge,
              todayProgressPercent === 100 && styles.progressBadgeDone,
            ]}>
              <Text style={styles.progressBadgeText}>
                {todayProgressPercent === 100 ? 'Complete' : `${todayProgressPercent}%`}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarOuter}>
            <View style={[
              styles.progressBarInner,
              { width: `${todayProgressPercent}%` },
              todayProgressPercent === 100 && styles.progressBarComplete,
            ]} />
          </View>

          {/* Stat Chips */}
          <View style={styles.statChipsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statChipValue}>{todayStatus.taken}</Text>
              <Text style={styles.statChipLabel}>Taken</Text>
            </View>
            {todayStatus.remaining > 0 && (
              <View style={[styles.statChip, styles.statChipRemaining]}>
                <Text style={[styles.statChipValue, styles.statChipValueAlt]}>{todayStatus.remaining}</Text>
                <Text style={styles.statChipLabel}>Left</Text>
              </View>
            )}
            {todayStatus.missed > 0 && (
              <View style={[styles.statChip, styles.statChipMissed]}>
                <Text style={[styles.statChipValue, styles.statChipValueDanger]}>{todayStatus.missed}</Text>
                <Text style={styles.statChipLabel}>Missed</Text>
              </View>
            )}
            <View style={styles.statChip}>
              <Text style={styles.statChipValue}>{totalMedications}</Text>
              <Text style={styles.statChipLabel}>Total Meds</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={[styles.statChipValue, styles.statChipValueStreak]}>{currentStreak}</Text>
              <Text style={styles.statChipLabel}>Streak</Text>
            </View>
          </View>
        </View>

        {/* Low Pill Alert Banner */}
        {lowPillCount.length > 0 && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertBannerTitle}>Low Supply</Text>
            {lowPillCount.map(med => (
              <Text key={med.id} style={styles.alertBannerText}>
                {med.name} - {med.pillCount} pills left
              </Text>
            ))}
          </View>
        )}

        {/* Yesterday Summary */}
        {yesterdayStatus.total > 0 && (
          <View style={styles.yesterdayCard}>
            <View style={styles.yesterdayHeader}>
              <Text style={styles.yesterdaySectionTitle}>Yesterday</Text>
              <View style={[
                styles.yesterdayBadge,
                yesterdayStatus.missed === 0
                  ? styles.yesterdayBadgeGood
                  : styles.yesterdayBadgeWarn,
              ]}>
                <Text style={styles.yesterdayBadgeText}>
                  {yesterdayStatus.missed === 0 ? 'All Taken' : `${yesterdayStatus.missed} Missed`}
                </Text>
              </View>
            </View>
            <View style={styles.yesterdayStatsRow}>
              <Text style={styles.yesterdayStatText}>{yesterdayStatus.taken} taken</Text>
              <Text style={styles.yesterdayStatDivider}> / </Text>
              <Text style={styles.yesterdayStatText}>{yesterdayStatus.total} total</Text>
            </View>
          </View>
        )}

        {/* Upcoming Medications */}
        <View style={styles.upcomingSection}>
          <Text style={styles.upcomingSectionTitle}>Upcoming</Text>
          {upcomingAlarms.length > 0 ? (
            upcomingAlarms.map((item, index) => (
              <View key={`${item.id}-${index}`} style={styles.upcomingCard}>
                <View style={styles.upcomingCardLeft}>
                  <View style={[styles.upcomingTimeBadge, { borderLeftColor: item.lightColor || colors.primary }]}>
                    <Text style={styles.upcomingTimeText}>{item.time}</Text>
                  </View>
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingMedName}>{item.medicationName}</Text>
                    <Text style={styles.upcomingPillCount}>{item.medication.pillCount} pills left</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.upcomingTakeButton}
                  onPress={() => markAsTaken(item.medication)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.upcomingTakeText}>Take</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyText}>No upcoming medications today</Text>
            </View>
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
    paddingBottom: 40,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 60,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // --- Greeting ---
  greeting: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  greetingSub: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 24,
  },

  // --- Hero Timer ---
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginBottom: 20,
    alignItems: 'center',
    ...cardShadow,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },

  // --- Progress Card ---
  progressCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    ...cardShadow,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  progressBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  progressBadgeDone: {
    backgroundColor: colors.success,
  },
  progressBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  progressBarOuter: {
    height: 12,
    backgroundColor: colors.cardAlt,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  progressBarComplete: {
    backgroundColor: colors.success,
  },

  // --- Stat Chips ---
  statChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statChip: {
    flex: 1,
    minWidth: 60,
    backgroundColor: colors.cardAlt,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statChipRemaining: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  statChipMissed: {
    borderColor: colors.danger,
    borderWidth: 1.5,
  },
  statChipValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 2,
  },
  statChipValueAlt: {
    color: colors.primary,
  },
  statChipValueDanger: {
    color: colors.danger,
  },
  statChipValueStreak: {
    color: colors.accent,
  },
  statChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // --- Alert Banner ---
  alertBanner: {
    backgroundColor: colors.warningLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: colors.accent,
  },
  alertBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.warningText,
    marginBottom: 6,
  },
  alertBannerText: {
    fontSize: 15,
    color: colors.warningText,
    fontWeight: '600',
    lineHeight: 22,
  },

  // --- Yesterday Card ---
  yesterdayCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    ...cardShadow,
  },
  yesterdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  yesterdaySectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  yesterdayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  yesterdayBadgeGood: {
    backgroundColor: colors.successLight,
  },
  yesterdayBadgeWarn: {
    backgroundColor: colors.dangerLight,
  },
  yesterdayBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  yesterdayStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yesterdayStatText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  yesterdayStatDivider: {
    fontSize: 16,
    color: colors.textMuted,
  },

  // --- Upcoming Section ---
  upcomingSection: {
    marginBottom: 20,
  },
  upcomingSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  upcomingCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...cardShadow,
  },
  upcomingCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  upcomingTimeBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    marginRight: 14,
  },
  upcomingTimeText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingMedName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  upcomingPillCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  upcomingTakeButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  upcomingTakeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // --- Empty State ---
  emptyStateCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    ...cardShadow,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
});
