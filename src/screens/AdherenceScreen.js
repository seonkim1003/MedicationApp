import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import MedicationManager from '../services/MedicationManager';
import HistoryService from '../services/HistoryService';
import { DAYS_OF_WEEK } from '../types';
import moment from 'moment';
import Toast from 'react-native-toast-message';
import { colors, cardShadow, borderRadius, spacing } from '../theme';
import Svg, { Circle } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Custom Circular Progress Component
const CircularProgress = ({ size, strokeWidth, percentage, color, icon }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        {/* Background Circle */}
        <Circle
          stroke={colors.border}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Progress Circle */}
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: colors.textPrimary }}>
          {percentage}%
        </Text>
      </View>
    </View>
  );
};

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

  // Date selection state
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [weekSchedule, setWeekSchedule] = useState({});
  const [weekDays, setWeekDays] = useState([]);

  const [adherenceMessage, setAdherenceMessage] = useState('');
  const [adherenceColor, setAdherenceColor] = useState(colors.primary);

  const scrollViewRef = useRef(null);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    if (medications.length > 0 || allAlarms.length > 0 || history.length > 0) {
      const schedule = buildScheduleForWeek(medications, allAlarms, history, selectedDate);
      setWeekSchedule(schedule.scheduleMap);
      setWeekDays(schedule.daysArray);

      // Attempt to scroll to selected date on load
      setTimeout(() => {
        if (scrollViewRef.current) {
          const todayIndex = schedule.daysArray.findIndex(d => d.dateStr === moment().format('YYYY-MM-DD'));
          if (todayIndex > -1) {
            scrollViewRef.current.scrollTo({ x: Math.max(0, todayIndex * 65 - SCREEN_WIDTH / 2 + 30), animated: true });
          }
        }
      }, 500);
    }
  }, [medications, allAlarms, history]);

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
        const bestStreak = stats.length > 0 ? Math.max(...stats.map(s => s.currentStreak)) : 0;
        setCurrentStreak(bestStreak);

        if (avgRate >= 90) {
          setAdherenceMessage('Excellent! You\'re doing great!');
          setAdherenceColor('#2ecc71');
        } else if (avgRate >= 75) {
          setAdherenceMessage('Good job! Keep it up!');
          setAdherenceColor('#3498db');
        } else if (avgRate >= 50) {
          setAdherenceMessage('You\'re on track! Stay consistent.');
          setAdherenceColor('#f39c12');
        } else {
          setAdherenceMessage('Let\'s improve! You can do it.');
          setAdherenceColor('#e74c3c');
        }
      } else {
        setOverallAdherence(0);
        setCurrentStreak(0);
        setAdherenceMessage('Start tracking to see your stats!');
        setAdherenceColor(colors.textSecondary);
      }

      // Get weekly data
      const weekly = await getWeeklyData(historyService);
      setWeeklyData(weekly);

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

  const buildScheduleForWeek = (meds, alarms, hist, anchorDateStr) => {
    const scheduleMap = {};
    const daysArray = [];

    // Build array of 14 days (7 before today, today, 6 after today)
    const today = moment();
    const startDate = today.clone().subtract(7, 'days');

    for (let i = 0; i < 14; i++) {
      const date = startDate.clone().add(i, 'days');
      const dateStr = date.format('YYYY-MM-DD');
      const dayOfWeek = date.day() === 0 ? 7 : date.day();

      daysArray.push({
        dateObj: date,
        dateStr: dateStr,
        dayName: date.format('dd'),
        dayNum: date.format('DD'),
        isToday: date.isSame(today, 'day')
      });

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

      scheduleMap[dateStr] = daySchedule;
    }

    return { scheduleMap, daysArray };
  };

  const renderScheduleItem = (item) => {
    return (
      <View key={item.id} style={styles.scheduleItemContainer}>
        <View style={styles.timelineColumn}>
          <View style={[styles.timelineDot, item.isTaken ? styles.timelineDotTaken : styles.timelineDotMissed]} />
          <View style={styles.timelineLine} />
        </View>
        <View style={styles.scheduleDetailsCard}>
          <View style={styles.scheduleHeaderRow}>
            <Text style={styles.scheduleTimeText}>{item.time}</Text>
            {item.isTaken ? (
              <View style={styles.badgeTaken}>
                <Icon name="check" size={12} color={colors.textOnPrimary} />
                <Text style={styles.badgeTextTaken}>Taken</Text>
              </View>
            ) : (
              <View style={styles.badgeMissed}>
                <Text style={styles.badgeTextMissed}>Pending/Missed</Text>
              </View>
            )}
          </View>
          <Text style={styles.scheduleMedName}>{item.medicationName}</Text>
          {item.medication?.dosage && (
            <Text style={styles.scheduleMedDosage}>{item.medication.dosage}</Text>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.loadingText}>Loading tracking data...</Text>
      </View>
    );
  }

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(42, 157, 143, ${opacity})`,
    labelColor: (opacity = 1) => colors.textSecondary,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: colors.primary
    },
    fillShadowGradientFrom: colors.primary,
    fillShadowGradientFromOpacity: 0.2,
    fillShadowGradientTo: colors.background,
    fillShadowGradientToOpacity: 0,
  };

  const weeklyChartData = {
    labels: weeklyData.map(d => d.day),
    datasets: [
      {
        data: weeklyData.length > 0 ? weeklyData.map(d => d.count) : [0, 0, 0, 0, 0, 0, 0],
        color: (opacity = 1) => colors.primary,
        strokeWidth: 3,
      },
    ],
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tracking Dashboard</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Dashboard Hero Section (Overall Adherence) */}
        <View style={styles.dashboardHero}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroGreeting}>Overview</Text>
            <Text style={styles.heroMessage}>{adherenceMessage}</Text>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <Icon name="zap" size={20} color={colors.warning} />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.heroStatValue}>{currentStreak}</Text>
                  <Text style={styles.heroStatLabel}>Day Streak</Text>
                </View>
              </View>
              <View style={styles.heroStatItem}>
                <Icon name="package" size={20} color={colors.primary} />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.heroStatValue}>{medications.length}</Text>
                  <Text style={styles.heroStatLabel}>Meds</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.heroRight}>
            <CircularProgress
              size={110}
              strokeWidth={12}
              percentage={overallAdherence}
              color={adherenceColor}
            />
          </View>
        </View>

        {/* Horizontal Calendar Schedule */}
        <View style={styles.scheduleSection}>
          <Text style={styles.sectionTitle}>Daily Schedule</Text>

          <View style={styles.calendarContainer}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.calendarScrollContent}
            >
              {weekDays.map((day) => {
                const isSelected = selectedDate === day.dateStr;
                return (
                  <TouchableOpacity
                    key={day.dateStr}
                    style={[styles.dayButton, isSelected && styles.dayButtonSelected, day.isToday && !isSelected && styles.dayButtonToday]}
                    onPress={() => setSelectedDate(day.dateStr)}
                  >
                    <Text style={[styles.dayButtonTextName, isSelected && styles.dayButtonTextSelected]}>
                      {day.dayName}
                    </Text>
                    <Text style={[styles.dayButtonTextNum, isSelected && styles.dayButtonTextSelected]}>
                      {day.dayNum}
                    </Text>
                    {day.isToday && <View style={[styles.todayIndicator, isSelected && { backgroundColor: colors.card }]} />}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          <View style={styles.timelineContainer}>
            {weekSchedule[selectedDate]?.length > 0 ? (
              weekSchedule[selectedDate].map(renderScheduleItem)
            ) : (
              <View style={styles.emptyTimeline}>
                <Icon name="calendar" size={40} color={colors.border} />
                <Text style={styles.emptyTimelineText}>No medications scheduled for this day.</Text>
              </View>
            )}
          </View>
        </View>

        {/* Weekly Activity Chart */}
        {weeklyData.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Activity (Last 7 Days)</Text>
            <View style={styles.chartCard}>
              <LineChart
                data={weeklyChartData}
                width={SCREEN_WIDTH - 48} // Padding
                height={180}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withVerticalLines={false}
                withHorizontalLines={true}
              />
            </View>
          </View>
        )}

        {/* Medication Performance List */}
        <View style={styles.performanceSection}>
          <Text style={styles.sectionTitle}>Performance by Medication</Text>
          {adherenceStats.length > 0 ? (
            <View style={styles.performanceList}>
              {adherenceStats.map((stat) => (
                <View key={stat.medicationId} style={styles.performanceItem}>
                  <View style={styles.perfHeader}>
                    <Text style={styles.perfMedName}>{stat.medicationName}</Text>
                    <Text style={[styles.perfRate, { color: stat.adherenceRate >= 80 ? colors.success : stat.adherenceRate >= 50 ? colors.warning : colors.danger }]}>
                      {stat.adherenceRate}%
                    </Text>
                  </View>

                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${stat.adherenceRate}%`,
                          backgroundColor: stat.adherenceRate >= 80 ? colors.success : stat.adherenceRate >= 50 ? colors.warning : colors.danger
                        }
                      ]}
                    />
                  </View>

                  <View style={styles.perfFooter}>
                    <Text style={styles.perfFooterText}>Doses: <Text style={{ fontWeight: '700' }}>{stat.totalTaken}/{stat.totalAlarms}</Text></Text>
                    <Text style={styles.perfFooterText}>Streak: <Text style={{ fontWeight: '700' }}>{stat.currentStreak}d</Text></Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Not enough data for individual performance.</Text>
            </View>
          )}
        </View>

        {/* Notes Button */}
        <TouchableOpacity
          style={styles.notesButton}
          onPress={() => navigation.navigate('Notes')}
        >
          <View style={styles.notesButtonContent}>
            <Icon name="file-text" size={24} color={colors.primary} />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={styles.notesButtonTitle}>Symptoms & Notes</Text>
              <Text style={styles.notesButtonSub}>View your logged health journal</Text>
            </View>
            <Icon name="chevron-right" size={24} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // Dashboard Hero
  dashboardHero: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    ...cardShadow,
  },
  heroLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  heroGreeting: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroMessage: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
    lineHeight: 28,
  },
  heroStatsRow: {
    flexDirection: 'column',
    gap: 12,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  heroRight: {
    marginLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Calendar Horizontal
  scheduleSection: {
    marginBottom: 32,
  },
  calendarContainer: {
    marginBottom: 24,
    marginHorizontal: -24, // Pull out of padding
  },
  calendarScrollContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  dayButton: {
    width: 55,
    height: 75,
    borderRadius: 16,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...cardShadow,
    elevation: 2,
  },
  dayButtonToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayButtonSelected: {
    backgroundColor: colors.primary,
  },
  dayButtonTextName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dayButtonTextNum: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dayButtonTextSelected: {
    color: colors.card,
  },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 4,
  },

  // Timeline
  timelineContainer: {
    paddingLeft: 8,
  },
  scheduleItemContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineColumn: {
    width: 20,
    alignItems: 'center',
    marginRight: 16,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: colors.card,
    backgroundColor: colors.border,
    zIndex: 2,
    marginTop: 20,
  },
  timelineDotTaken: {
    backgroundColor: colors.success,
  },
  timelineDotMissed: {
    backgroundColor: colors.danger,
  },
  timelineLine: {
    position: 'absolute',
    top: 34,
    bottom: -16,
    width: 2,
    backgroundColor: colors.borderLight,
    zIndex: 1,
  },
  scheduleDetailsCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    ...cardShadow,
    elevation: 1,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleTimeText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  badgeTaken: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeTextTaken: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textOnPrimary,
    textTransform: 'uppercase',
  },
  badgeMissed: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeTextMissed: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  scheduleMedName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  scheduleMedDosage: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyTimeline: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTimelineText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Chart
  chartSection: {
    marginBottom: 32,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 16,
    paddingLeft: 0,
    ...cardShadow,
  },
  chart: {
    borderRadius: 16,
  },

  // Performance
  performanceSection: {
    marginBottom: 24,
  },
  performanceList: {
    gap: 16,
  },
  performanceItem: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    ...cardShadow,
  },
  perfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  perfMedName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  perfRate: {
    fontSize: 16,
    fontWeight: '800',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  perfFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  perfFooterText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.card,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
  },

  // Notes Button
  notesButton: {
    backgroundColor: colors.card,
    borderRadius: 20,
    ...cardShadow,
  },
  notesButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  notesButtonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  notesButtonSub: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});

