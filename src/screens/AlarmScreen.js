import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, BackHandler } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import MedicationManager from '../services/MedicationManager';
import HistoryService from '../services/HistoryService';

const AlarmScreen = ({ route, navigation }) => {
  const { medicationId, alarmId, medicationName, alarmTime } = route.params || {};
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
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
              // Record in history
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
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.alarmIcon}>
          <Text style={styles.alarmIconText}>!</Text>
        </View>
        
        <Text style={styles.title}>TAKE MEDICATION NOW</Text>
        
        {medicationName && (
          <Text style={styles.medicationName}>{medicationName}</Text>
        )}
        
        {alarmTime && (
          <Text style={styles.alarmTime}>Scheduled for {formatTime(alarmTime)}</Text>
        )}

        <Text style={styles.instruction}>TAKE YOUR MEDICATION IMMEDIATELY</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.snoozeButton} 
            onPress={handleSnooze}
            activeOpacity={0.8}
          >
            <Text style={styles.snoozeButtonText}>Snooze (5 min)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.turnOffButton} 
            onPress={handleTurnOff}
            activeOpacity={0.8}
          >
            <Text style={styles.turnOffButtonText}>I took the medication</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dc3545',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 40,
    width: '100%',
    maxWidth: 450,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  alarmIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#dc3545',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  alarmIconText: {
    fontSize: 80,
    fontWeight: '900',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  medicationName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007bff',
    textAlign: 'center',
    marginBottom: 15,
  },
  alarmTime: {
    fontSize: 22,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '600',
  },
  instruction: {
    fontSize: 24,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 35,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 15,
    marginTop: 10,
  },
  snoozeButton: {
    backgroundColor: '#ffc107',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 30,
    flex: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  snoozeButtonText: {
    color: '#212529',
    fontSize: 20,
    fontWeight: '700',
  },
  turnOffButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 30,
    flex: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  turnOffButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
});

export default AlarmScreen;
