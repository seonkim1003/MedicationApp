import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import MedicationManager from '../services/MedicationManager';
import HistoryService from '../services/HistoryService';
import { DAYS_OF_WEEK } from '../types';
import moment from 'moment';
import Toast from 'react-native-toast-message';
import { colors, cardShadow, borderRadius } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AdherenceScreen() {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [medications, setMedications] = useState([]);
  const [allAlarms, setAllAlarms] = useState([]);
  const [history, setHistory] = useState([]);
  const [adherenceStats, setAdherenceStats] = useState([]);
  const [overallAdherence, setOverallAdherence] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [weeklyData, setWeeklyData] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(moment().startOf('week'));
  const [weekSchedule, setWeekSchedule] = useState({});
  const [adherenceMessage, setAdherenceMessage] = useState('');
  const [adherenceColor, setAdherenceColor] = useState('#3498db');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (medications.length > 0 || allAlarms.length > 0 || history.length > 0) {
      const schedule = buildWeekSchedule(medications, allAlarms, history, currentWeekStart);
      setWeekSchedule(schedule);
    }
  }, [currentWeekStart, medications, allAlarms, history]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const medicationManager = MedicationManager.getInstance();
      const historyService = HistoryService.getInstance();

      const loadedMedications = await medicationManager.loadMedications();
      const loadedAlarms = await medicationManager.loadAlarms();
      const loadedHistory = await historyService.loadHistory();

      setMedications(loadedMedications);
      setAllAlarms(loadedAlarms);
      setHistory(loadedHistory);

      // Calculate adherence stats
      const stats = await historyService.getAllAdherenceStats(loadedMedications, loadedAlarms);
      setAdherenceStats(stats);

      // Calculate overall adherence
      if (stats.length > 0) {
        const totalRate = stats.reduce((sum, stat) => sum + stat.adherenceRate, 0);
        const avgRate = Math.round(totalRate / stats.length);
        setOverallAdherence(avgRate);

        // Calculate best current streak
        const bestStreak = Math.max(...stats.map(s => s.currentStreak));
        setCurrentStreak(bestStreak);

        if (avgRate >= 90) {
          setAdherenceMessage('Excellent! You\'re doing great!');
          setAdherenceColor('#2ecc71');
        } else if (avgRate >= 75) {
          setAdherenceMessage('Good job! Keep it up!');
          setAdherenceColor('#3498db');
        } else if (avgRate >= 50) {
          setAdherenceMessage('You\'re on track! Stay consistent!');
          setAdherenceColor('#f39c12');
        } else {
          setAdherenceMessage('Let\'s improve together! You can do it!');
          setAdherenceColor('#e74c3c');
        }
      }

      // Get weekly data
      const weekly = await getWeeklyData(historyService);
      setWeeklyData(weekly);

      // Build weekly schedule
      const schedule = buildWeekSchedule(loadedMedications, loadedAlarms, loadedHistory, currentWeekStart);
      setWeekSchedule(schedule);
    } catch (error) {
      console.error('Error loading adherence data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load adherence data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getWeeklyData = async (historyService) => {
    try {
      const recentHistory = await historyService.getRecentHistory(7);
      const days = [];

      for (let i = 6; i >= 0; i--) {
        const date = moment().subtract(i, 'days');
        const dateStr = date.format('YYYY-MM-DD');
        const count = recentHistory.filter(h =>
          moment(h.takenAt).format('YYYY-MM-DD') === dateStr
        ).length;

        days.push({
          date: date.format('MMM DD'),
          day: date.format('ddd'),
          count,
        });
      }

      return days;
    } catch (error) {
      console.error('Error getting weekly data:', error);
      return [];
    }
  };

  const buildWeekSchedule = (meds, alarms, hist, weekStartDate = null) => {
    const schedule = {};
    const weekStart = weekStartDate ? weekStartDate.clone() : currentWeekStart.clone();

    for (let i = 0; i < 7; i++) {
      const date = weekStart.clone().add(i, 'days');
      const dateStr = date.format('YYYY-MM-DD');
      const dayOfWeek = date.day() === 0 ? 7 : date.day();

      const daySchedule = [];

      alarms.forEach(alarm => {
        if (!alarm.isEnabled) return;

        if (alarm.daysOfWeek.includes(dayOfWeek)) {
          const medication = meds.find(m => m.id === alarm.medicationId);
          if (medication) {
            const isTaken = hist.some(h => {
              const historyDate = moment(h.takenAt);
              const alarmTime = moment(alarm.time, 'HH:mm');
              const alarmDateTime = date.clone().set({
                hour: alarmTime.hour(),
                minute: alarmTime.minute(),
              });
              return h.medicationId === alarm.medicationId &&
                historyDate.isSame(alarmDateTime, 'day') &&
                Math.abs(historyDate.diff(alarmDateTime, 'minutes')) <= 60;
            });

            daySchedule.push({
              ...alarm,
              medication,
              isTaken,
            });
          }
        }
      });

      daySchedule.sort((a, b) => {
        const timeA = moment(a.time, 'HH:mm');
        const timeB = moment(b.time, 'HH:mm');
        return timeA.diff(timeB);
      });

      schedule[dateStr] = {
        date: date,
        dateStr: dateStr,
        schedule: daySchedule,
        isToday: date.isSame(moment(), 'day'),
      };
    }

    return schedule;
  };

  const changeWeek = (direction) => {
    const newWeekStart = currentWeekStart.clone().add(direction, 'weeks');
    setCurrentWeekStart(newWeekStart);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading adherence data...</Text>
      </View>
    );
  }

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(currentWeekStart.clone().add(i, 'days'));
  }

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
    style: {
      borderRadius: 16,
    },
  };

  const weeklyChartData = {
    labels: weeklyData.map(d => d.day),
    datasets: [
      {
        data: weeklyData.map(d => d.count),
        color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Medication Adherence</Text>

        {/* Overall Status Card */}
        <View style={[styles.statusCard, { borderLeftColor: adherenceColor }]}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusMessage}>{adherenceMessage}</Text>
              <Text style={styles.statusSubtext}>Your adherence journey</Text>
            </View>
          </View>
          <View style={styles.statusStats}>
            <View style={styles.statusStatItem}>
              <Text style={styles.statusStatValue}>{overallAdherence}%</Text>
              <Text style={styles.statusStatLabel}>Overall</Text>
            </View>
            <View style={styles.statusStatItem}>
              <Text style={styles.statusStatValue}>{currentStreak}</Text>
              <Text style={styles.statusStatLabel}>Day Streak</Text>
            </View>
            <View style={styles.statusStatItem}>
              <Text style={styles.statusStatValue}>{medications.length}</Text>
              <Text style={styles.statusStatLabel}>Medications</Text>
            </View>
          </View>
        </View>

        {/* Weekly Activity Chart */}
        {weeklyData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last 7 Days Activity</Text>
            <LineChart
              data={weeklyChartData}
              width={SCREEN_WIDTH - 60}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </View>
        )}

        {/* Weekly Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Weekly Schedule</Text>
            <View style={styles.weekNavigation}>
              <TouchableOpacity style={styles.weekNavButton} onPress={() => changeWeek(-1)}>
                <Text style={styles.weekNavButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.weekRange}>
                {currentWeekStart.format('MMM D')} - {currentWeekStart.clone().add(6, 'days').format('MMM D')}
              </Text>
              <TouchableOpacity style={styles.weekNavButton} onPress={() => changeWeek(1)}>
                <Text style={styles.weekNavButtonText}>→</Text>
              </TouchableOpacity>
            </View>
          </View>

          {weekDays.map((day, index) => {
            const dateStr = day.format('YYYY-MM-DD');
            const dayData = weekSchedule[dateStr];
            const isToday = day.isSame(moment(), 'day');

            if (!dayData || dayData.schedule.length === 0) return null;

            const takenCount = dayData.schedule.filter(item => item.isTaken).length;
            const totalCount = dayData.schedule.length;
            const dayAdherence = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

            return (
              <View key={dateStr} style={[styles.daySection, isToday && styles.daySectionToday]}>
                <View style={styles.dayHeader}>
                  <View>
                    <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                      {DAYS_OF_WEEK.find(d => d.id === (day.day() === 0 ? 7 : day.day()))?.name || day.format('dddd')}
                    </Text>
                    <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>
                      {day.format('MMM D')}
                    </Text>
                  </View>
                  <View style={styles.dayAdherenceBadge}>
                    <Text style={styles.dayAdherenceText}>{dayAdherence}%</Text>
                    <Text style={styles.dayAdherenceLabel}>
                      {takenCount}/{totalCount}
                    </Text>
                  </View>
                </View>

                {dayData.schedule.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.scheduleItem,
                      item.isTaken && styles.scheduleItemTaken
                    ]}
                  >
                    <View style={styles.scheduleHeader}>
                      <Text style={styles.scheduleTime}>{item.time}</Text>
                      {item.isTaken ? (
                        <View style={styles.takenBadge}>
                          <Text style={styles.takenBadgeText}>Taken</Text>
                        </View>
                      ) : (
                        <View style={styles.missedBadge}>
                          <Text style={styles.missedBadgeText}>Missed</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.scheduleMedication}>{item.medicationName}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        {/* Medication Adherence Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medication Performance</Text>
          {adherenceStats.length > 0 ? (
            <View style={styles.adherenceList}>
              {adherenceStats.map((stat) => (
                <View key={stat.medicationId} style={styles.adherenceItem}>
                  <View style={styles.adherenceHeader}>
                    <Text style={styles.medicationName}>{stat.medicationName}</Text>
                    <Text style={[styles.adherenceRate, {
                      color: stat.adherenceRate >= 80 ? '#2ecc71' :
                        stat.adherenceRate >= 50 ? '#f39c12' : '#e74c3c'
                    }]}>
                      {stat.adherenceRate}%
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${stat.adherenceRate}%`,
                          backgroundColor: stat.adherenceRate >= 80 ? '#2ecc71' :
                            stat.adherenceRate >= 50 ? '#f39c12' : '#e74c3c'
                        }
                      ]}
                    />
                  </View>
                  <View style={styles.adherenceDetails}>
                    <Text style={styles.detailText}>
                      Taken: {stat.totalTaken} / {stat.totalAlarms}
                    </Text>
                    <Text style={styles.detailText}>
                      Streak: {stat.currentStreak} days
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No adherence data available</Text>
          )}
        </View>

        {/* Notes Section Link */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.notesButton}
            onPress={() => navigation.navigate('Notes')}
          >
            <Text style={styles.notesButtonText}>View All Notes & Symptom Tracking</Text>
            <Text style={styles.notesButtonSubtext}>
              {history.filter(h => h.note && h.note.trim().length > 0).length} notes available
            </Text>
          </TouchableOpacity>
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
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 24,
    marginBottom: 24,
    borderLeftWidth: 6,
    ...cardShadow,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusMessage: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statusStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statusStatItem: {
    alignItems: 'center',
  },
  statusStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statusStatLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 24,
    ...cardShadow,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: colors.textPrimary,
  },
  chart: {
    marginVertical: 8,
    borderRadius: borderRadius.lg,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  weekNavButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  weekNavButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  weekRange: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  daySection: {
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  daySectionToday: {
    backgroundColor: colors.primaryLight,
    borderLeftColor: colors.primaryDark,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dayNameToday: {
    color: colors.primary,
  },
  dayDate: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  dayDateToday: {
    color: colors.primary,
  },
  dayAdherenceBadge: {
    alignItems: 'flex-end',
  },
  dayAdherenceText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  dayAdherenceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  scheduleItem: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  scheduleItemTaken: {
    backgroundColor: colors.successLight,
    borderLeftColor: colors.success,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  scheduleTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  takenBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  takenBadgeText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  missedBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  missedBadgeText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  scheduleMedication: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  adherenceList: {
    gap: 12,
  },
  adherenceItem: {
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  adherenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  adherenceRate: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  adherenceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
    fontWeight: '500',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  notesButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  notesButtonText: {
    color: colors.textOnPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  notesButtonSubtext: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.9,
  },
});

