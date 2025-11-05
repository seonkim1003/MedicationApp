import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Calendar } from 'react-native-calendars';
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
  const [markedDates, setMarkedDates] = useState({});
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [selectedDateSchedule, setSelectedDateSchedule] = useState([]);

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

      // Build marked dates
      const marked = buildMarkedDates(loadedMedications, loadedAlarms, loadedHistory);
      setMarkedDates(marked);

      // Set initial selected date schedule
      updateSelectedDateSchedule(moment().format('YYYY-MM-DD'), loadedMedications, loadedAlarms, loadedHistory);
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

  const buildMarkedDates = (meds, alarms, hist) => {
    const marked = {};
    const endDate = moment().add(30, 'days');
    const startDate = moment().subtract(7, 'days');

    // Mark scheduled medication days
    alarms.forEach(alarm => {
      if (!alarm.isEnabled) return;

      const ourDays = alarm.daysOfWeek.map(d => d === 7 ? 0 : d);
      let current = startDate.clone();

      while (current.isBefore(endDate)) {
        if (ourDays.includes(current.day())) {
          const dateStr = current.format('YYYY-MM-DD');
          if (!marked[dateStr]) {
            marked[dateStr] = {
              marked: true,
              dotColor: '#3498db',
              selectedColor: '#3498db',
            };
          }
        }
        current.add(1, 'day');
      }
    });

    // Mark taken medications
    hist.forEach(entry => {
      const dateStr = moment(entry.takenAt).format('YYYY-MM-DD');
      if (!marked[dateStr]) {
        marked[dateStr] = {};
      }
      marked[dateStr].selected = true;
      marked[dateStr].selectedColor = '#2ecc71';
      marked[dateStr].dots = marked[dateStr].dots || [];
      marked[dateStr].dots.push({ color: '#2ecc71', selectedDotColor: '#2ecc71' });
    });

    // Mark today
    const todayStr = moment().format('YYYY-MM-DD');
    if (marked[todayStr]) {
      marked[todayStr].today = true;
      marked[todayStr].marked = true;
      marked[todayStr].textColor = 'white';
    } else {
      marked[todayStr] = {
        today: true,
        selected: true,
        selectedColor: '#3498db',
        textColor: 'white',
      };
    }

    return marked;
  };

  const updateSelectedDateSchedule = (dateStr, meds, alarms, hist) => {
    const date = moment(dateStr);
    const dayOfWeek = date.day() === 0 ? 7 : date.day(); // Convert to our system

    const schedule = [];

    // Get scheduled medications for this day
    alarms.forEach(alarm => {
      if (!alarm.isEnabled) return;
      const ourDays = alarm.daysOfWeek.map(d => d === 7 ? 0 : d);
      const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

      if (ourDays.includes(jsDay)) {
        const medication = meds.find(m => m.id === alarm.medicationId);
        if (medication) {
          schedule.push({
            ...alarm,
            medication,
            isTaken: hist.some(h => 
              h.medicationId === alarm.medicationId &&
              moment(h.takenAt).format('YYYY-MM-DD') === dateStr
            ),
          });
        }
      }
    });

    // Sort by time
    schedule.sort((a, b) => {
      const timeA = moment(a.time, 'HH:mm');
      const timeB = moment(b.time, 'HH:mm');
      return timeA.diff(timeB);
    });

    setSelectedDateSchedule(schedule);
  };

  const onDayPress = (day) => {
    setSelectedDate(day.dateString);
    updateSelectedDateSchedule(day.dateString, medications, allAlarms, history);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>📅 Medication Calendar</Text>

        {/* Calendar */}
        <View style={styles.section}>
          <Calendar
            current={selectedDate}
            markedDates={markedDates}
            onDayPress={onDayPress}
            markingType="multi-dot"
            theme={{
              todayTextColor: '#3498db',
              selectedDayBackgroundColor: '#3498db',
              selectedDayTextColor: '#ffffff',
              arrowColor: '#3498db',
              monthTextColor: '#2c3e50',
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '600',
            }}
            style={styles.calendar}
          />
        </View>

        {/* Selected Date Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Schedule for {moment(selectedDate).format('MMMM DD, YYYY')}
          </Text>
          {selectedDateSchedule.length > 0 ? (
            selectedDateSchedule.map((item) => (
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
                      <Text style={styles.takenBadgeText}>✓ Taken</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.scheduleMedication}>{item.medicationName}</Text>
                <View style={styles.scheduleDetails}>
                  <View style={[styles.colorIndicator, { backgroundColor: item.lightColor }]} />
                  <Text style={styles.scheduleDetailsText}>
                    {item.lightIds.length} light(s) | {item.medication.pillCount} pills left
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No medications scheduled for this day</Text>
          )}
        </View>

        {/* Legend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legend</Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3498db' }]} />
              <Text style={styles.legendText}>Scheduled</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2ecc71' }]} />
              <Text style={styles.legendText}>Taken</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#e74c3c' }]} />
              <Text style={styles.legendText}>Missed</Text>
            </View>
          </View>
        </View>

        {/* Refresh Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.button} onPress={loadData}>
            <Text style={styles.buttonText}>Refresh Calendar</Text>
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
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2c3e50',
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
  calendar: {
    borderRadius: 10,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  scheduleItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
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
    marginBottom: 6,
  },
  scheduleTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  takenBadge: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  takenBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scheduleMedication: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 6,
  },
  scheduleDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  scheduleDetailsText: {
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
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
    fontSize: 14,
    color: '#2c3e50',
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



