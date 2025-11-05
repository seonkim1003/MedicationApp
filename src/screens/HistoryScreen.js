import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import HistoryService from '../services/HistoryService';
import moment from 'moment';
import Toast from 'react-native-toast-message';

export default function HistoryScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'today', 'week', 'month'

  useEffect(() => {
    loadHistory();
  }, [filter]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const historyService = HistoryService.getInstance();

      let loadedHistory = [];
      switch (filter) {
        case 'today':
          loadedHistory = await historyService.getRecentHistory(1);
          break;
        case 'week':
          loadedHistory = await historyService.getRecentHistory(7);
          break;
        case 'month':
          loadedHistory = await historyService.getRecentHistory(30);
          break;
        default:
          loadedHistory = await historyService.loadHistory();
      }

      // Sort by date (newest first)
      loadedHistory.sort((a, b) => 
        moment(b.takenAt).diff(moment(a.takenAt))
      );

      setHistory(loadedHistory);
    } catch (error) {
      console.error('Error loading history:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load history',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const groupByDate = (entries) => {
    const grouped = {};
    entries.forEach(entry => {
      const dateStr = moment(entry.takenAt).format('YYYY-MM-DD');
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(entry);
    });
    return grouped;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  const groupedHistory = groupByDate(history);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>📝 Medication History</Text>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'today' && styles.filterButtonActive]}
            onPress={() => setFilter('today')}
          >
            <Text style={[styles.filterText, filter === 'today' && styles.filterTextActive]}>
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'week' && styles.filterButtonActive]}
            onPress={() => setFilter('week')}
          >
            <Text style={[styles.filterText, filter === 'week' && styles.filterTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'month' && styles.filterButtonActive]}
            onPress={() => setFilter('month')}
          >
            <Text style={[styles.filterText, filter === 'month' && styles.filterTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
        </View>

        {/* History List */}
        {Object.keys(groupedHistory).length > 0 ? (
          Object.keys(groupedHistory)
            .sort((a, b) => moment(b).diff(moment(a)))
            .map(dateStr => (
              <View key={dateStr} style={styles.section}>
                <Text style={styles.dateHeader}>
                  {moment(dateStr).format('MMMM DD, YYYY')} 
                  {' '}
                  ({moment(dateStr).format('dddd')})
                </Text>
                {groupedHistory[dateStr].map(entry => (
                  <View key={entry.id} style={styles.historyItem}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.medicationName}>{entry.medicationName}</Text>
                      <View style={[
                        styles.statusBadge,
                        entry.wasOnTime ? styles.statusBadgeOnTime : styles.statusBadgeLate
                      ]}>
                        <Text style={styles.statusText}>
                          {entry.wasOnTime ? '✓ On Time' : '⚠ Late'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.timeText}>
                      {moment(entry.takenAt).format('h:mm A')}
                    </Text>
                  </View>
                ))}
              </View>
            ))
        ) : (
          <View style={styles.section}>
            <Text style={styles.emptyText}>No history available for this period</Text>
          </View>
        )}

        {/* Refresh Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.button} onPress={loadHistory}>
            <Text style={styles.buttonText}>Refresh History</Text>
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
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  filterText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  filterTextActive: {
    color: 'white',
    fontWeight: 'bold',
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
  dateHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  historyItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeOnTime: {
    backgroundColor: '#2ecc71',
  },
  statusBadgeLate: {
    backgroundColor: '#f39c12',
  },
  statusText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 14,
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



