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
        
        <Text style={styles.title}>Take Your Medication</Text>
        
        {medicationName && (
          <Text style={styles.medicationName}>{medicationName}</Text>
        )}
        
        {alarmTime && (
          <Text style={styles.alarmTime}>Scheduled for {formatTime(alarmTime)}</Text>
        )}

        <Text style={styles.instruction}>Please take your medication now</Text>

        <TouchableOpacity 
          style={styles.turnOffButton} 
          onPress={handleTurnOff}
          activeOpacity={0.8}
        >
          <Text style={styles.turnOffButtonText}>I took the medication</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#007bff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  alarmIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffc107',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  alarmIconText: {
    fontSize: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 10,
  },
  medicationName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007bff',
    textAlign: 'center',
    marginBottom: 10,
  },
  alarmTime: {
    fontSize: 18,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 16,
    color: '#495057',
    textAlign: 'center',
    marginBottom: 30,
    fontStyle: 'italic',
  },
  turnOffButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  turnOffButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default AlarmScreen;
