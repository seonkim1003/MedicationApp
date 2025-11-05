import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import MedicationManager from '../services/MedicationManager';
import HistoryService from '../services/HistoryService';
import AlarmService from '../services/AlarmService';
import * as Notifications from 'expo-notifications';
import moment from 'moment';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StatisticsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [adherenceStats, setAdherenceStats] = useState([]);
  const [overallAdherence, setOverallAdherence] = useState(0);
  const [totalMedications, setTotalMedications] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [weeklyData, setWeeklyData] = useState([]);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setIsLoading(true);
      const medicationManager = MedicationManager.getInstance();
      const historyService = HistoryService.getInstance();

      const medications = await medicationManager.loadMedications();
      const allAlarms = await medicationManager.loadAlarms();
      
      setTotalMedications(medications.length);

      // Calculate adherence stats
      const stats = await historyService.getAllAdherenceStats(medications, allAlarms);
      setAdherenceStats(stats);

      // Calculate overall adherence
      if (stats.length > 0) {
        const totalRate = stats.reduce((sum, stat) => sum + stat.adherenceRate, 0);
        const avgRate = Math.round(totalRate / stats.length);
        setOverallAdherence(avgRate);

        // Calculate best current streak
        const bestStreak = Math.max(...stats.map(s => s.currentStreak));
        setCurrentStreak(bestStreak);
      }

      // Get weekly data (last 7 days)
      const weekly = await getWeeklyData(historyService);
      setWeeklyData(weekly);

      // Get today's medication count
      const recentHistory = await historyService.getRecentHistory(1);
      setTodayCount(recentHistory.length);

    } catch (error) {
      console.error('Error loading statistics:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load statistics',
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

  const handleResetData = async () => {
    Alert.alert(
      'Reset All Data',
      'Are you sure you want to delete all data? This will permanently delete:\n\n• All medications\n• All alarms\n• All medication history\n• All settings\n\nThis action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset All Data',
          style: 'destructive',
          onPress: async () => {
            try {
              const medicationManager = MedicationManager.getInstance();
              const historyService = HistoryService.getInstance();
              const alarmService = AlarmService.getInstance();

              // Clear all scheduled notifications
              await Notifications.cancelAllScheduledNotificationsAsync();

              // Clear all medication data (medications, alarms, settings)
              await medicationManager.clearAllData();

              // Clear history
              await historyService.clearHistory();

              // Reschedule alarms (will be empty but ensures clean state)
              try {
                await alarmService.rescheduleAllMedications();
              } catch (e) {
                console.warn('Error rescheduling after reset:', e);
              }

              Toast.show({
                type: 'success',
                text1: 'Data Reset',
                text2: 'All data has been cleared',
              });

              // Reload statistics to show empty state
              setTimeout(() => {
                loadStatistics();
              }, 500);
            } catch (error) {
              console.error('Error resetting data:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to reset data',
              });
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
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
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#3498db',
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

  const adherencePieData = adherenceStats
    .filter(stat => stat.adherenceRate > 0)
    .slice(0, 5)
    .map((stat, index) => {
      const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6'];
      return {
        name: stat.medicationName.length > 10 
          ? stat.medicationName.substring(0, 10) + '...'
          : stat.medicationName,
        adherenceRate: stat.adherenceRate,
        color: colors[index % colors.length],
        legendFontColor: '#2c3e50',
        legendFontSize: 12,
      };
    });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>📊 Statistics</Text>

        {/* Overview Cards */}
        <View style={styles.overviewContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{overallAdherence}%</Text>
            <Text style={styles.statLabel}>Overall Adherence</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Day Streak 🔥</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todayCount}</Text>
            <Text style={styles.statLabel}>Taken Today</Text>
          </View>
        </View>

        {/* Weekly Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 Days Activity</Text>
          {weeklyData.length > 0 ? (
            <LineChart
              data={weeklyChartData}
              width={SCREEN_WIDTH - 60}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          ) : (
            <Text style={styles.emptyText}>No data available</Text>
          )}
        </View>

        {/* Medication Adherence */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medication Adherence</Text>
          {adherenceStats.length > 0 ? (
            <View style={styles.adherenceList}>
              {adherenceStats.map((stat) => (
                <View key={stat.medicationId} style={styles.adherenceItem}>
                  <View style={styles.adherenceHeader}>
                    <Text style={styles.medicationName}>{stat.medicationName}</Text>
                    <Text style={styles.adherenceRate}>{stat.adherenceRate}%</Text>
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
                      Streak: {stat.currentStreak} days | Best: {stat.longestStreak} days
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No adherence data available</Text>
          )}
        </View>

        {/* Top Medications Pie Chart */}
        {adherencePieData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Medications</Text>
            <PieChart
              data={adherencePieData}
              width={SCREEN_WIDTH - 60}
              height={220}
              chartConfig={chartConfig}
              accessor="adherenceRate"
              backgroundColor="transparent"
              paddingLeft="15"
              style={styles.chart}
            />
          </View>
        )}

        {/* Refresh Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.button} onPress={loadStatistics}>
            <Text style={styles.buttonText}>Refresh Statistics</Text>
          </TouchableOpacity>
        </View>

        {/* Reset Data Button */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.button, styles.resetButton]} 
            onPress={() => handleResetData()}
          >
            <Text style={styles.buttonText}>Reset All Data</Text>
          </TouchableOpacity>
          <Text style={styles.resetWarning}>
            This will delete all medications, alarms, history, and settings. This cannot be undone.
          </Text>
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
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2c3e50',
  },
  overviewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
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
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  adherenceList: {
    gap: 12,
  },
  adherenceItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  adherenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  adherenceRate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498db',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  adherenceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 12,
    color: '#7f8c8d',
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
  resetButton: {
    backgroundColor: '#dc3545',
  },
  resetWarning: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});





