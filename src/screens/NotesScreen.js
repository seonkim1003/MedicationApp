import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import HistoryService from '../services/HistoryService';
import moment from 'moment';
import Toast from 'react-native-toast-message';

export default function NotesScreen() {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();

  useFocusEffect(
    React.useCallback(() => {
      loadNotes();
    }, [])
  );

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const historyService = HistoryService.getInstance();
      const allHistory = await historyService.loadHistory();
      
      // Filter to only entries with notes
      const notesWithData = allHistory
        .filter(entry => entry.note && entry.note.trim().length > 0)
        .sort((a, b) => moment(b.takenAt).diff(moment(a.takenAt)));
      
      setNotes(notesWithData);
    } catch (error) {
      console.error('Error loading notes:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load notes',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading notes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>📝 Symptom Tracking & Notes</Text>
        
        {notes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>No notes yet</Text>
            <Text style={styles.emptySubtext}>
              Add notes when taking medication to track symptoms and observations
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{notes.length}</Text>
                <Text style={styles.statLabel}>Total Notes</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {new Set(notes.map(n => n.medicationId)).size}
                </Text>
                <Text style={styles.statLabel}>Medications</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Notes</Text>
              {notes.map((entry) => (
                <View key={entry.id} style={styles.noteItem}>
                  <View style={styles.noteItemHeader}>
                    <View style={styles.noteHeaderLeft}>
                      <Text style={styles.noteMedicationName}>{entry.medicationName}</Text>
                      <Text style={styles.noteDate}>
                        {moment(entry.takenAt).format('MMM D, YYYY')}
                      </Text>
                    </View>
                    <Text style={styles.noteTime}>
                      {moment(entry.takenAt).format('h:mm A')}
                    </Text>
                  </View>
                  <View style={styles.noteContent}>
                    <Text style={styles.noteText}>{entry.note}</Text>
                  </View>
                  {entry.wasOnTime !== undefined && (
                    <View style={styles.noteFooter}>
                      <View style={[
                        styles.statusBadge,
                        entry.wasOnTime ? styles.statusBadgeOnTime : styles.statusBadgeLate
                      ]}>
                        <Text style={styles.statusBadgeText}>
                          {entry.wasOnTime ? '✓ On Time' : '⚠ Late'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.section}>
          <TouchableOpacity style={styles.refreshButton} onPress={loadNotes}>
            <Text style={styles.refreshButtonText}>Refresh Notes</Text>
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
  emptyContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#17a2b8',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '600',
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
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2c3e50',
  },
  notesList: {
    gap: 12,
  },
  noteItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#17a2b8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  noteItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  noteHeaderLeft: {
    flex: 1,
  },
  noteMedicationName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  noteTime: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '600',
    marginLeft: 8,
  },
  noteContent: {
    marginBottom: 10,
  },
  noteText: {
    fontSize: 16,
    color: '#495057',
    lineHeight: 24,
    fontWeight: '500',
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeOnTime: {
    backgroundColor: '#d4edda',
  },
  statusBadgeLate: {
    backgroundColor: '#fff3cd',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#155724',
  },
  refreshButton: {
    backgroundColor: '#17a2b8',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

