import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, BackHandler, TextInput, ScrollView, KeyboardAvoidingView } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import MedicationManager from '../services/MedicationManager';
import HistoryService from '../services/HistoryService';
import Toast from 'react-native-toast-message';

const AlarmScreen = ({ route, navigation }) => {
  const { medicationId, alarmId, medicationName, alarmTime } = route.params || {};
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const soundRef = useRef(null);

  useLayoutEffect(() => {
    // Prevent gesture-based dismissal
    navigation.setOptions({
      gestureEnabled: false,
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    playAlarmSound();
    
    // Prevent back button from dismissing the alarm on Android only
    let backHandler = null;
    if (Platform.OS === 'android') {
      backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // Return true to prevent default back behavior
        return true;
      });
    }

    return () => {
      if (backHandler) {
        backHandler.remove();
      }
      stopAlarmSound();
    };
  }, []);

  const playAlarmSound = async () => {
    try {
      // Set audio mode to allow playback even in silent mode (iOS-specific)
      // Only set essential audio mode settings - notification system handles sound
      const audioModeConfig = {
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true, // Important: allows notifications to play in silent mode
        staysActiveInBackground: true,
        // Note: interruptionModeIOS and interruptionModeAndroid are optional
        // Only set them if constants are available
        ...(Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX !== undefined && {
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        }),
        ...(Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX !== undefined && {
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        }),
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      };

      await Audio.setAudioModeAsync(audioModeConfig);

      // The notification system already plays the alarm sound
      // We mark as playing to show the screen is active
      // Optionally, you can add a bundled alarm sound file here:
      // const { sound: alarmSound } = await Audio.Sound.createAsync(
      //   require('../assets/alarm.mp3'),
      //   { shouldPlay: true, isLooping: true, volume: 1.0 }
      // );
      
      setIsPlaying(true);
      
      // Note: The notification sound is already handled by the AlarmService
      // The notification system will play the sound when the alarm triggers
      // This screen is displayed when the alarm notification is received
      
    } catch (error) {
      console.error('Error setting up alarm sound:', error);
      // Still show the alarm screen even if sound setup fails
      // The notification system will still play its sound
      setIsPlaying(true);
    }
  };

  const stopAlarmSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setSound(null);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error stopping alarm sound:', error);
    }
  };

  const handleSnooze = async () => {
    try {
      // Stop the alarm sound temporarily
      await stopAlarmSound();

      // Schedule a new notification for 5 minutes later
      const snoozeMinutes = 5;
      const snoozeTime = new Date();
      snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeMinutes);

      if (medicationId && alarmId) {
        try {
          const notificationContent = {
            title: `TAKE MEDICATION NOW - ${medicationName || 'Medication'}`,
            body: 'Snoozed alarm - Take your medication immediately!',
            sound: true,
            data: {
              medicationId: medicationId,
              alarmId: alarmId,
              alarmTime: alarmTime,
              medicationName: medicationName || 'Medication',
            },
            categoryIdentifier: 'alarm',
          };

          if (Platform.OS === 'android') {
            notificationContent.channelId = 'alarms';
            notificationContent.vibrate = [0, 250, 250, 250];
          } else if (Platform.OS === 'ios') {
            notificationContent.interruptionLevel = 'critical';
          }

          await Notifications.scheduleNotificationAsync({
            content: notificationContent,
            trigger: {
              seconds: snoozeMinutes * 60,
            },
          });

          console.log(`⏰ Alarm snoozed for ${snoozeMinutes} minutes`);
        } catch (notificationError) {
          console.error('Error scheduling snooze notification:', notificationError);
        }
      }

      // Navigate back (alarm will ring again in 5 minutes)
      navigation.goBack();
    } catch (error) {
      console.error('Error snoozing alarm:', error);
      navigation.goBack();
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) {
      Toast.show({
        type: 'info',
        text1: 'No Note',
        text2: 'Please enter a note before adding',
      });
      return;
    }

    try {
      // Save note to history if medication ID is available
      if (medicationId) {
        try {
          const medicationManager = MedicationManager.getInstance();
          const historyService = HistoryService.getInstance();
          
          // Get medication to check if it exists
          const medication = await medicationManager.getMedication(medicationId);
          if (medication) {
            // Record note in history
            await historyService.recordMedicationTaken(
              medicationId,
              medicationName || medication.name,
              alarmId,
              alarmTime,
              note.trim()
            );
            
            Toast.show({
              type: 'success',
              text1: 'Note Added',
              text2: 'Your note has been saved',
            });
            
            // Clear the note input
            setNote('');
            setShowNoteInput(false);
            
            console.log(`✅ Note added for ${medicationName || medication.name}`);
          }
        } catch (noteError) {
          console.error('Error saving note:', noteError);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to save note',
          });
        }
      }
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleTurnOff = async () => {
    try {
      // Stop the alarm sound
      await stopAlarmSound();

      // Decrease pill count and record history if medication ID is available
      if (medicationId) {
        try {
          const medicationManager = MedicationManager.getInstance();
          const historyService = HistoryService.getInstance();
          
          // Get medication to check if it exists and has pills
          const medication = await medicationManager.getMedication(medicationId);
          if (medication && medication.pillCount > 0) {
            // Decrease pill count
            const success = await medicationManager.decreasePillCount(medicationId);
            
            if (success) {
              // Record in history (without note - note is saved separately via Add Note button)
              await historyService.recordMedicationTaken(
                medicationId,
                medicationName || medication.name,
                alarmId,
                alarmTime
              );
              
              console.log(`✅ Medication taken from alarm: ${medicationName || medication.name}`);
            } else {
              console.warn(`⚠️ Cannot decrease pill count for ${medicationName || medication.name}: already at 0`);
            }
          }
        } catch (medicationError) {
          console.error('Error recording medication from alarm:', medicationError);
          // Continue even if medication recording fails
        }
      }

      // Dismiss any related notifications
      if (alarmId) {
        try {
          // Cancel the specific notification if possible
          const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
          const relatedNotifications = allNotifications.filter(
            (n) => n && n.request && n.request.content && n.request.content.data && n.request.content.data.alarmId === alarmId
          );
          
          // Note: We can't cancel recurring notifications easily, but the sound is stopped
          // The notification system will handle the sound automatically
        } catch (notificationError) {
          console.warn('Error handling notifications:', notificationError);
          // Continue even if notification handling fails
        }
      }

      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error('Error turning off alarm:', error);
      // Always navigate back even if there's an error
      navigation.goBack();
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={[styles.alarmIcon, showNoteInput && styles.alarmIconSmall]}>
            <Text style={[styles.alarmIconText, showNoteInput && styles.alarmIconTextSmall]}>!</Text>
          </View>
          
          <Text style={[styles.title, showNoteInput && styles.titleSmall]}>TAKE MEDICATION NOW</Text>
          
          {medicationName && (
            <Text style={[styles.medicationName, showNoteInput && styles.medicationNameSmall]}>
              {medicationName}
            </Text>
          )}
          
          {alarmTime && (
            <Text style={[styles.alarmTime, showNoteInput && styles.alarmTimeSmall]}>
              Scheduled for {formatTime(alarmTime)}
            </Text>
          )}

          <Text style={[styles.instruction, showNoteInput && styles.instructionSmall]}>
            TAKE YOUR MEDICATION IMMEDIATELY
          </Text>

          {/* Note Input Section */}
          <View style={styles.noteSection}>
            <TouchableOpacity 
              style={styles.noteToggleButton}
              onPress={() => setShowNoteInput(!showNoteInput)}
              activeOpacity={0.7}
            >
              <Text style={styles.noteToggleText}>
                {showNoteInput ? '✕ Hide Note' : '+ Add Note (Symptoms/Tracking)'}
              </Text>
            </TouchableOpacity>
            
          {showNoteInput && (
            <View style={styles.noteInputContainer}>
              <Text style={styles.noteLabel}>Track symptoms or observations:</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="e.g., Feeling better, slight headache, no side effects..."
                placeholderTextColor="#95a5a6"
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={500}
                autoFocus={true}
              />
              <Text style={styles.noteCharCount}>{note.length}/500</Text>
              <TouchableOpacity 
                style={[styles.addNoteButton, !note.trim() && styles.addNoteButtonDisabled]}
                onPress={handleAddNote}
                disabled={!note.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.addNoteButtonText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.snoozeButton, showNoteInput && styles.buttonSmall]} 
              onPress={handleSnooze}
              activeOpacity={0.8}
            >
              <Text style={[styles.snoozeButtonText, showNoteInput && styles.buttonTextSmall]}>
                Snooze (5 min)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.turnOffButton, showNoteInput && styles.buttonSmall]} 
              onPress={handleTurnOff}
              activeOpacity={0.8}
            >
              <Text style={[styles.turnOffButtonText, showNoteInput && styles.buttonTextSmall]}>
                I took the medication
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dc3545',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  alarmIcon: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#dc3545',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  alarmIconSmall: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  alarmIconText: {
    fontSize: 96,
    fontWeight: '900',
    color: 'white',
  },
  alarmIconTextSmall: {
    fontSize: 48,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  titleSmall: {
    fontSize: 24,
    marginBottom: 12,
  },
  medicationName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#007bff',
    textAlign: 'center',
    marginBottom: 16,
  },
  medicationNameSmall: {
    fontSize: 20,
    marginBottom: 8,
  },
  alarmTime: {
    fontSize: 26,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  alarmTimeSmall: {
    fontSize: 16,
    marginBottom: 12,
  },
  instruction: {
    fontSize: 28,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  instructionSmall: {
    fontSize: 18,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
    marginTop: 16,
  },
  snoozeButton: {
    backgroundColor: '#ffc107',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  snoozeButtonText: {
    color: '#212529',
    fontSize: 22,
    fontWeight: '700',
  },
  turnOffButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  turnOffButtonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
  },
  buttonSmall: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
  },
  buttonTextSmall: {
    fontSize: 16,
  },
  noteSection: {
    width: '100%',
    marginBottom: 24,
  },
  noteToggleButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
  },
  noteToggleText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '600',
  },
  noteInputContainer: {
    marginTop: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212529',
    borderWidth: 1,
    borderColor: '#ced4da',
    minHeight: 150,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  noteCharCount: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'right',
    marginTop: 4,
  },
  addNoteButton: {
    backgroundColor: '#17a2b8',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 44,
  },
  addNoteButtonDisabled: {
    backgroundColor: '#ced4da',
    opacity: 0.6,
  },
  addNoteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AlarmScreen;
