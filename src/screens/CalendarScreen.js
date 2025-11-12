import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import MedicationManager from '../services/MedicationManager';
import HistoryService from '../services/HistoryService';
import { Medication, MedicationAlarm, DAYS_OF_WEEK } from '../types';
import moment from 'moment';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CalendarScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [medications, setMedications] = useState([]);
  const [allAlarms, setAllAlarms] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(moment().startOf('week'));
  const [weekSchedule, setWeekSchedule] = useState({});

  useEffect(() => {
    loadData();
  }, []);

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

      // Build weekly schedule
      const schedule = buildWeekSchedule(loadedMedications, loadedAlarms, loadedHistory, currentWeekStart);
      setWeekSchedule(schedule);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load calendar data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buildWeekSchedule = (meds, alarms, hist, weekStartDate = null) => {
    const schedule = {};
    const weekStart = weekStartDate ? weekStartDate.clone() : currentWeekStart.clone();
    
    // Build schedule for each day of the week
    for (let i = 0; i < 7; i++) {
      const date = weekStart.clone().add(i, 'days');
      const dateStr = date.format('YYYY-MM-DD');
      const dayOfWeek = date.day() === 0 ? 7 : date.day(); // Convert to our system (1=Monday, 7=Sunday)
      
      const daySchedule = [];
      
      // Get scheduled medications for this day
      alarms.forEach(alarm => {
        if (!alarm.isEnabled) return;
        
        if (alarm.daysOfWeek.includes(dayOfWeek)) {
          const medication = meds.find(m => m.id === alarm.medicationId);
          if (medication) {
            const isTaken = hist.some(h => 
              h.medicationId === alarm.medicationId &&
              moment(h.takenAt).format('YYYY-MM-DD') === dateStr
            );
            
            daySchedule.push({
              ...alarm,
              medication,
              isTaken,
            });
          }
        }
      });
      
      // Sort by time
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

  useEffect(() => {
    if (medications.length > 0 || allAlarms.length > 0 || history.length > 0) {
      const schedule = buildWeekSchedule(medications, allAlarms, history, currentWeekStart);
      setWeekSchedule(schedule);
    }
  }, [currentWeekStart, medications, allAlarms, history]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(currentWeekStart.clone().add(i, 'days'));
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>📅 Weekly Schedule</Text>

        {/* Week Navigation */}
        <View style={styles.weekNavigation}>
          <TouchableOpacity style={styles.weekNavButton} onPress={() => changeWeek(-1)}>
            <Text style={styles.weekNavButtonText}>← Prev</Text>
          </TouchableOpacity>
          <Text style={styles.weekRange}>
            {currentWeekStart.format('MMM D')} - {currentWeekStart.clone().add(6, 'days').format('MMM D, YYYY')}
          </Text>
          <TouchableOpacity style={styles.weekNavButton} onPress={() => changeWeek(1)}>
            <Text style={styles.weekNavButtonText}>Next →</Text>
          </TouchableOpacity>
        </View>

        {/* Weekly Schedule */}
        {weekDays.map((day, index) => {
          const dateStr = day.format('YYYY-MM-DD');
          const dayData = weekSchedule[dateStr];
          const isToday = day.isSame(moment(), 'day');
          
          return (
            <View key={dateStr} style={styles.daySection}>
              <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
                <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                  {DAYS_OF_WEEK.find(d => d.id === (day.day() === 0 ? 7 : day.day()))?.name || day.format('dddd')}
                </Text>
                <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>
                  {day.format('MMM D')}
                </Text>
              </View>
              
              {dayData && dayData.schedule.length > 0 ? (
                dayData.schedule.map((item) => (
                  <View 
                    key={item.id} 
                    style={[
                      styles.scheduleItem,
                      item.isTaken && styles.scheduleItemTaken
                    ]}
                  >
                    <View style={styles.scheduleHeader}>
                      <Text style={styles.scheduleTime}>{item.time}</Text>
                      {item.isTaken && (
                        <View style={styles.takenBadge}>
                          <Text style={styles.takenBadgeText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.scheduleMedication}>{item.medicationName}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyDayText}>No medications scheduled</Text>
              )}
            </View>
          );
        })}

        {/* Refresh Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.button} onPress={loadData}>
            <Text style={styles.buttonText}>Refresh</Text>
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
    fontSize: 20,
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
    fontWeight: '600',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#2c3e50',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  weekNavButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#3498db',
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  weekNavButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  weekRange: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  daySection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#e9ecef',
  },
  dayHeaderToday: {
    backgroundColor: '#e7f3ff',
    marginHorizontal: -16,
    marginTop: -16,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  dayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
  },
  dayNameToday: {
    color: '#3498db',
  },
  dayDate: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  dayDateToday: {
    color: '#3498db',
    fontWeight: '600',
  },
  emptyDayText: {
    fontSize: 14,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2c3e50',
  },
  scheduleItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  scheduleItemTaken: {
    backgroundColor: '#e8f8f5',
    borderLeftColor: '#2ecc71',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleTime: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  takenBadge: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minHeight: 32,
    justifyContent: 'center',
  },
  takenBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scheduleMedication: {
    fontSize: 20,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  scheduleDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  scheduleDetailsText: {
    fontSize: 15,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 16,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
    fontWeight: '500',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});





