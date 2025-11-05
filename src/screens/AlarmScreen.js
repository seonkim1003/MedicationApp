import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import MedicationManager from '../services/MedicationManager';

const AlarmScreen = ({ route, navigation }) => {
  const { medicationId, alarmId, medicationName, alarmTime } = route.params || {};
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);

  useEffect(() => {
    playAlarmSound();
    
    // Set up continuous vibration if needed
    if (Platform.OS === 'android') {
      // Android handles vibration through notifications
    }

    return () => {
      stopAlarmSound();
    };
  }, []);

  const playAlarmSound = async () => {
    try {
      // Set audio mode to allow playback even in silent mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // Try to play a simple beep sound repeatedly
      // Note: In production, you should bundle a proper alarm sound file in assets
      // For now, we'll create a simple tone using a data URI or use a fallback
      try {
        // Using a simple approach - create a beep pattern
        // In production, replace this with a bundled alarm sound: require('../assets/alarm.mp3')
        const { sound: alarmSound } = await Audio.Sound.createAsync(
          { uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );

        soundRef.current = alarmSound;
        setSound(alarmSound);
        setIsPlaying(true);

        // Keep playing sound continuously
        alarmSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish && !status.isLooping) {
            // Restart if it somehow stops
            alarmSound.replayAsync();
          }
        });
      } catch (soundError) {
        console.warn('Could not load remote sound, using notification sound only:', soundError);
        // The notification system will handle the sound, but we'll still show the screen
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error setting up alarm sound:', error);
      // Still show the alarm screen even if sound fails
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

      // Dismiss any related notifications
      if (alarmId) {
        // Cancel the specific notification if possible
        const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
        const relatedNotifications = allNotifications.filter(
          (n) => n.request.content.data?.alarmId === alarmId
        );
        
        // Note: We can't cancel recurring notifications easily, but the sound is stopped
      }

      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error('Error turning off alarm:', error);
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
        
        <Text style={styles.title}>Time to take your medication!</Text>
        
        {medicationName && (
          <Text style={styles.medicationName}>{medicationName}</Text>
        )}
        
        {alarmTime && (
          <Text style={styles.alarmTime}>{formatTime(alarmTime)}</Text>
        )}

        <TouchableOpacity 
          style={styles.turnOffButton} 
          onPress={handleTurnOff}
          activeOpacity={0.8}
        >
          <Text style={styles.turnOffButtonText}>Turn Off Alarm</Text>
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
    marginBottom: 30,
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
