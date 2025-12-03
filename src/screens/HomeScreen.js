import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Modal, Pressable, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import MedicationManager from '../services/MedicationManager';
import HistoryService from '../services/HistoryService';
import FavoritePicturesService from '../services/FavoritePicturesService';
import CircularTimer from '../components/CircularTimer';
import moment from 'moment';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [totalMedications, setTotalMedications] = useState(0);
  const [todayMedications, setTodayMedications] = useState([]);
  const [upcomingAlarms, setUpcomingAlarms] = useState([]);
  const [todayTaken, setTodayTaken] = useState(0);
  const [lowPillCount, setLowPillCount] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [nextAlarmTime, setNextAlarmTime] = useState(null);
  const [yesterdayStatus, setYesterdayStatus] = useState({ total: 0, taken: 0, missed: 0 });
  const [todayStatus, setTodayStatus] = useState({ total: 0, taken: 0, remaining: 0, missed: 0 });
  const [isPictureModalVisible, setIsPictureModalVisible] = useState(false);
  const [favoritePictures, setFavoritePictures] = useState([]);
  const [pictureCount, setPictureCount] = useState(0);
  const [alarmMusicUri, setAlarmMusicUri] = useState(null);
  const [alarmMusicName, setAlarmMusicName] = useState(null);
  const [isSelectingPictures, setIsSelectingPictures] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadFavoritePictures();
    loadAlarmMusic();
    requestPicturePermissions();
    
    // Refresh full dashboard every 30 seconds
    const dashboardInterval = setInterval(loadDashboard, 30000);
    
    // Update next alarm time more frequently (every 5 seconds) for accurate countdown
    const alarmUpdateInterval = setInterval(async () => {
      try {
        const medicationManager = MedicationManager.getInstance();
        const medications = await medicationManager.loadMedications();
        const allAlarms = await medicationManager.loadAlarms();
        const nextAlarm = calculateNextAlarmTime(medications, allAlarms);
        setNextAlarmTime(nextAlarm);
      } catch (error) {
        console.error('Error updating next alarm time:', error);
      }
    }, 5000);
    
    return () => {
      clearInterval(dashboardInterval);
      clearInterval(alarmUpdateInterval);
    };
  }, []);

  const requestPicturePermissions = async () => {
    try {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        // Permissions not granted, but don't show error immediately
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const loadFavoritePictures = async () => {
    try {
      const service = FavoritePicturesService.getInstance();
      const pictures = await service.loadPictures();
      const count = await service.getPictureCount();
      setFavoritePictures(pictures);
      setPictureCount(count);
    } catch (error) {
      console.error('Error loading favorite pictures:', error);
    }
  };

  const handleAddPicture = () => {
    if (isSelectingPictures) {
      return;
    }
    Alert.alert(
      'Add Picture',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: () => openCamera(),
        },
        {
          text: 'Photo Library',
          onPress: () => openImageLibrary(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const openCamera = async () => {
    if (isSelectingPictures) {
      return;
    }
    try {
      setIsSelectingPictures(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        await addPictureToFavorites(uri);
      }
    } catch (error) {
      console.error('Error opening camera:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open camera',
      });
    } finally {
      setIsSelectingPictures(false);
    }
  };

  const openImageLibrary = async () => {
    if (isSelectingPictures) {
      return;
    }
    try {
      setIsSelectingPictures(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false, // Disable editing when selecting multiple
        quality: 0.8,
        allowsMultipleSelection: true, // Enable multiple selection
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Add all selected pictures
        await addMultiplePicturesToFavorites(result.assets.map(asset => asset.uri));
      }
    } catch (error) {
      console.error('Error opening image library:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open photo library',
      });
    } finally {
      setIsSelectingPictures(false);
    }
  };

  const addPictureToFavorites = async (uri) => {
    try {
      const service = FavoritePicturesService.getInstance();
      await service.addPicture(uri);
      await loadFavoritePictures();
      
      Toast.show({
        type: 'success',
        text1: 'Picture Added',
        text2: 'Picture has been added to your favorites',
      });
    } catch (error) {
      console.error('Error adding picture:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add picture',
      });
    }
  };

  const addMultiplePicturesToFavorites = async (uris) => {
    try {
      const service = FavoritePicturesService.getInstance();
      let successCount = 0;
      let errorCount = 0;

      // Add all pictures one by one
      for (const uri of uris) {
        try {
          await service.addPicture(uri);
          successCount++;
        } catch (error) {
          console.error('Error adding picture:', error);
          errorCount++;
        }
      }

      await loadFavoritePictures();
      
      if (errorCount === 0) {
        Toast.show({
          type: 'success',
          text1: 'Pictures Added',
          text2: `${successCount} ${successCount === 1 ? 'picture' : 'pictures'} added to favorites`,
        });
      } else {
        Toast.show({
          type: 'warning',
          text1: 'Partial Success',
          text2: `Added ${successCount} of ${uris.length} pictures`,
        });
      }
    } catch (error) {
      console.error('Error adding multiple pictures:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add some pictures',
      });
    }
  };

  const removePicture = async (pictureId) => {
    try {
      const service = FavoritePicturesService.getInstance();
      await service.removePicture(pictureId);
      await loadFavoritePictures();
      
      Toast.show({
        type: 'success',
        text1: 'Picture Removed',
        text2: 'Picture has been removed from favorites',
      });
    } catch (error) {
      console.error('Error removing picture:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to remove picture',
      });
    }
  };

  const loadAlarmMusic = async () => {
    try {
      const medicationManager = MedicationManager.getInstance();
      const uri = await medicationManager.loadAlarmMusicUri();
      setAlarmMusicUri(uri);
      if (uri) {
        // Extract filename from URI
        const fileName = uri.split('/').pop() || uri.split('\\').pop() || 'Custom Music';
        setAlarmMusicName(fileName);
      } else {
        setAlarmMusicName(null);
      }
    } catch (error) {
      console.error('Error loading alarm music:', error);
    }
  };

  const selectAlarmMusic = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const medicationManager = MedicationManager.getInstance();
        await medicationManager.saveAlarmMusicUri(file.uri);
        await loadAlarmMusic();
        
        Toast.show({
          type: 'success',
          text1: 'Music Selected',
          text2: 'Alarm music has been set',
        });
      }
    } catch (error) {
      console.error('Error selecting music file:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to select music file',
      });
    }
  };

  const removeAlarmMusic = async () => {
    try {
      Alert.alert(
        'Remove Alarm Music',
        'Are you sure you want to remove the alarm music?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              const medicationManager = MedicationManager.getInstance();
              await medicationManager.saveAlarmMusicUri(null);
              await loadAlarmMusic();
              
              Toast.show({
                type: 'success',
                text1: 'Music Removed',
                text2: 'Alarm music has been removed',
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error removing alarm music:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to remove music',
      });
    }
  };

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const medicationManager = MedicationManager.getInstance();
      const historyService = HistoryService.getInstance();

      // Load medications
      const medications = await medicationManager.loadMedications();
      const allAlarms = await medicationManager.loadAlarms();
      
      setTotalMedications(medications.length);

      // Get today's medications
      const today = moment();
      const dayOfWeek = today.day() === 0 ? 7 : today.day(); // Convert to our system
      
      const todayMeds = [];
      medications.forEach(med => {
        const medAlarms = allAlarms.filter(a => 
          a.medicationId === med.id && 
          a.isEnabled &&
          a.daysOfWeek.includes(dayOfWeek)
        );
        if (medAlarms.length > 0) {
          medAlarms.forEach(alarm => {
            todayMeds.push({
              ...alarm,
              medication: med,
            });
          });
        }
      });

      // Sort by time
      todayMeds.sort((a, b) => {
        const timeA = moment(a.time, 'HH:mm');
        const timeB = moment(b.time, 'HH:mm');
        return timeA.diff(timeB);
      });
      
      setTodayMedications(todayMeds);

      // Get upcoming alarms (next 3)
      const now = moment();
      const upcoming = todayMeds
        .filter(med => {
          const alarmTime = moment(med.time, 'HH:mm');
          const todayAlarm = moment(now).set({
            hour: alarmTime.hour(),
            minute: alarmTime.minute(),
            second: 0,
            millisecond: 0
          });
          return todayAlarm.isAfter(now);
        })
        .slice(0, 3);
      
      setUpcomingAlarms(upcoming);

      // Calculate next alarm time for circular timer
      const nextAlarm = calculateNextAlarmTime(medications, allAlarms);
      setNextAlarmTime(nextAlarm);

      // Get today's taken count
      const todayHistory = await historyService.getRecentHistory(1);
      setTodayTaken(todayHistory.length);

      // Get low pill count medications
      const lowCount = medications.filter(m => m.pillCount <= 5 && m.pillCount > 0);
      setLowPillCount(lowCount);

      // Get current streak
      const stats = await historyService.getAllAdherenceStats(medications, allAlarms);
      if (stats.length > 0) {
        const bestStreak = Math.max(...stats.map(s => s.currentStreak));
        setCurrentStreak(bestStreak);
      }

      // Calculate yesterday and today adherence
      try {
        const yesterday = moment().subtract(1, 'day');
        const yesterdayDayOfWeek = yesterday.day() === 0 ? 7 : yesterday.day();
        const todayDayOfWeek = today.day() === 0 ? 7 : today.day();
        
        const allHistory = await historyService.loadHistory();
        
        // Yesterday's status
        const yesterdayAlarms = [];
        medications.forEach(med => {
          const medAlarms = allAlarms.filter(a => 
            a.medicationId === med.id && 
            a.isEnabled &&
            a.daysOfWeek.includes(yesterdayDayOfWeek)
          );
          medAlarms.forEach(alarm => {
            yesterdayAlarms.push({
              ...alarm,
              medication: med,
            });
          });
        });
        
        const yesterdayTaken = yesterdayAlarms.filter(alarm => {
          try {
            const alarmTime = moment(alarm.time, 'HH:mm');
            if (!alarmTime.isValid()) return false;
            const alarmDate = yesterday.clone().set({
              hour: alarmTime.hour(),
              minute: alarmTime.minute(),
            });
            return allHistory.some(h => {
              try {
                const historyDate = moment(h.takenAt);
                if (!historyDate.isValid()) return false;
                const isSameDay = historyDate.isSame(alarmDate, 'day');
                const timeDiff = Math.abs(historyDate.diff(alarmDate, 'minutes'));
                const matchesMedication = h.medicationId === alarm.medicationId;
                const matchesAlarm = alarm.id && h.alarmId ? h.alarmId === alarm.id : true;
                return matchesMedication && isSameDay && timeDiff <= 60 && matchesAlarm;
              } catch (e) {
                return false;
              }
            });
          } catch (e) {
            return false;
          }
        });
        
        setYesterdayStatus({
          total: yesterdayAlarms.length,
          taken: yesterdayTaken.length,
          missed: Math.max(0, yesterdayAlarms.length - yesterdayTaken.length),
        });

        // Today's status
        const todayAlarms = todayMeds;
        const now = moment();
        const todayTaken = todayAlarms.filter(alarm => {
          try {
            const alarmTime = moment(alarm.time, 'HH:mm');
            if (!alarmTime.isValid()) return false;
            const todayAlarm = moment(now).set({
              hour: alarmTime.hour(),
              minute: alarmTime.minute(),
            });
            return allHistory.some(h => {
              try {
                const historyDate = moment(h.takenAt);
                if (!historyDate.isValid()) return false;
                const isSameDay = historyDate.isSame(todayAlarm, 'day');
                const timeDiff = Math.abs(historyDate.diff(todayAlarm, 'minutes'));
                const matchesMedication = h.medicationId === alarm.medicationId;
                const matchesAlarm = alarm.id && h.alarmId ? h.alarmId === alarm.id : true;
                return matchesMedication && isSameDay && timeDiff <= 60 && matchesAlarm;
              } catch (e) {
                return false;
              }
            });
          } catch (e) {
            return false;
          }
        });
        
        // Calculate remaining: medications scheduled for later today (future alarms)
        const todayRemaining = todayAlarms.filter(alarm => {
          try {
            const alarmTime = moment(alarm.time, 'HH:mm');
            if (!alarmTime.isValid()) return false;
            const todayAlarm = moment(now).set({
              hour: alarmTime.hour(),
              minute: alarmTime.minute(),
            });
            // Only count future alarms (not yet due)
            return todayAlarm.isAfter(now);
          } catch (e) {
            return false;
          }
        });
        
        // Calculate missed: medications that were due today but not taken
        const todayMissed = todayAlarms.filter(alarm => {
          try {
            const alarmTime = moment(alarm.time, 'HH:mm');
            if (!alarmTime.isValid()) return false;
            const todayAlarm = moment(now).set({
              hour: alarmTime.hour(),
              minute: alarmTime.minute(),
            });
            const isPast = todayAlarm.isBefore(now);
            const notTaken = !allHistory.some(h => {
              try {
                const historyDate = moment(h.takenAt);
                if (!historyDate.isValid()) return false;
                const isSameDay = historyDate.isSame(todayAlarm, 'day');
                const timeDiff = Math.abs(historyDate.diff(todayAlarm, 'minutes'));
                const matchesMedication = h.medicationId === alarm.medicationId;
                const matchesAlarm = alarm.id && h.alarmId ? h.alarmId === alarm.id : true;
                return matchesMedication && isSameDay && timeDiff <= 60 && matchesAlarm;
              } catch (e) {
                return false;
              }
            });
            return isPast && notTaken;
          } catch (e) {
            return false;
          }
        });
        
        setTodayStatus({
          total: todayAlarms.length,
          taken: todayTaken.length,
          remaining: todayRemaining.length,
          missed: todayMissed.length,
        });
      } catch (adherenceError) {
        console.error('Error calculating adherence:', adherenceError);
        // Set default values if calculation fails
        setYesterdayStatus({ total: 0, taken: 0, missed: 0 });
        setTodayStatus({ total: 0, taken: 0, remaining: 0, missed: 0 });
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load dashboard',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateNextAlarmTime = (medications, allAlarms) => {
    try {
      const now = moment();
      const futureAlarms = [];

      // Collect all future alarms across the next 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const checkDate = moment(now).add(dayOffset, 'days');
        const dayOfWeek = checkDate.day() === 0 ? 7 : checkDate.day();

        medications.forEach(med => {
          const medAlarms = allAlarms.filter(a => 
            a.medicationId === med.id && 
            a.isEnabled &&
            a.daysOfWeek.includes(dayOfWeek)
          );

          medAlarms.forEach(alarm => {
            const [hours, minutes] = alarm.time.split(':').map(Number);
            const alarmMoment = moment(checkDate).set({
              hour: hours,
              minute: minutes,
              second: 0,
              millisecond: 0
            });

            // Only consider future alarms
            if (alarmMoment.isAfter(now)) {
              futureAlarms.push(alarmMoment);
            }
          });
        });
      }

      // Sort all future alarms by time and return the earliest one
      if (futureAlarms.length === 0) {
        return null;
      }

      futureAlarms.sort((a, b) => a.valueOf() - b.valueOf());
      const nextAlarm = futureAlarms[0];
      
      return nextAlarm.toISOString();
    } catch (error) {
      console.error('Error calculating next alarm:', error);
      return null;
    }
  };

  const markAsTaken = async (medication) => {
    try {
      const historyService = HistoryService.getInstance();
      const medicationManager = MedicationManager.getInstance();
      
      // Check if medication has pills available
      if (medication.pillCount <= 0) {
        Toast.show({
          type: 'warning',
          text1: 'No Pills Available',
          text2: `${medication.name} has no pills left`,
        });
        return;
      }

      // Decrease pill count first
      const success = await medicationManager.decreasePillCount(medication.id);
      
      if (success) {
        // Record in history after successful decrease
        await historyService.recordMedicationTaken(
          medication.id,
          medication.name
        );
        
        Toast.show({
          type: 'success',
          text1: 'Medication Taken',
          text2: `${medication.name} recorded`,
        });

        // Reload dashboard to update pill counts
        await loadDashboard();
      } else {
        Toast.show({
          type: 'warning',
          text1: 'Cannot Take Pill',
          text2: `${medication.name} has no pills left`,
        });
      }
    } catch (error) {
      console.error('Error marking as taken:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to record medication',
      });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Dashboard</Text>

        {/* Circular Timer for Next Alarm */}
        <View style={styles.timerSection}>
          <CircularTimer nextAlarmTime={nextAlarmTime} size={160} strokeWidth={12} />
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsContainer}>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{totalMedications}</Text>
            <Text style={styles.quickStatLabel}>Medications</Text>
          </View>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{todayTaken}</Text>
            <Text style={styles.quickStatLabel}>Taken Today</Text>
          </View>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{currentStreak}</Text>
            <Text style={styles.quickStatLabel}>Day Streak</Text>
          </View>
        </View>

        {/* Medication Adherence Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Medication Status</Text>
          
          {/* Yesterday's Status */}
          <View style={styles.adherenceCard}>
            <View style={styles.adherenceHeader}>
              <Text style={styles.adherenceDayTitle}>Yesterday</Text>
              {yesterdayStatus.total > 0 && (
                <View style={[
                  styles.adherenceBadge,
                  yesterdayStatus.missed === 0 ? styles.adherenceBadgeSuccess : styles.adherenceBadgeWarning
                ]}>
                  <Text style={styles.adherenceBadgeText}>
                    {yesterdayStatus.missed === 0 ? '✓ All Taken' : `${yesterdayStatus.missed} Missed`}
                  </Text>
                </View>
              )}
            </View>
            {yesterdayStatus.total > 0 ? (
              <View style={styles.adherenceStats}>
                <View style={styles.adherenceStatItem}>
                  <Text style={styles.adherenceStatValue}>{yesterdayStatus.taken}</Text>
                  <Text style={styles.adherenceStatLabel}>Taken</Text>
                </View>
                <View style={styles.adherenceStatItem}>
                  <Text style={[styles.adherenceStatValue, styles.adherenceStatValueMissed]}>
                    {yesterdayStatus.missed}
                  </Text>
                  <Text style={styles.adherenceStatLabel}>Missed</Text>
                </View>
                <View style={styles.adherenceStatItem}>
                  <Text style={styles.adherenceStatValue}>{yesterdayStatus.total}</Text>
                  <Text style={styles.adherenceStatLabel}>Total</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.adherenceEmptyText}>No medications scheduled yesterday</Text>
            )}
          </View>

          {/* Today's Status */}
          <View style={[styles.adherenceCard, styles.adherenceCardToday]}>
            <View style={styles.adherenceHeader}>
              <Text style={styles.adherenceDayTitle}>Today</Text>
              {todayStatus.total > 0 && (
                <View style={[
                  styles.adherenceBadge,
                  todayStatus.missed === 0 && todayStatus.remaining === 0
                    ? styles.adherenceBadgeSuccess 
                    : todayStatus.missed > 0
                    ? styles.adherenceBadgeWarning
                    : styles.adherenceBadgeInfo
                ]}>
                  <Text style={styles.adherenceBadgeText}>
                    {todayStatus.missed === 0 && todayStatus.remaining === 0
                      ? '✓ All Done'
                      : todayStatus.missed > 0
                      ? `${todayStatus.missed} Missed`
                      : `${todayStatus.remaining} Remaining`}
                  </Text>
                </View>
              )}
            </View>
            {todayStatus.total > 0 ? (
              <View style={styles.adherenceStats}>
                <View style={styles.adherenceStatItem}>
                  <Text style={styles.adherenceStatValue}>{todayStatus.taken}</Text>
                  <Text style={styles.adherenceStatLabel}>Taken</Text>
                </View>
                {todayStatus.missed > 0 && (
                  <View style={styles.adherenceStatItem}>
                    <Text style={[styles.adherenceStatValue, styles.adherenceStatValueMissed]}>
                      {todayStatus.missed}
                    </Text>
                    <Text style={styles.adherenceStatLabel}>Missed</Text>
                  </View>
                )}
                {todayStatus.remaining > 0 && (
                  <View style={styles.adherenceStatItem}>
                    <Text style={[styles.adherenceStatValue, styles.adherenceStatValueRemaining]}>
                      {todayStatus.remaining}
                    </Text>
                    <Text style={styles.adherenceStatLabel}>Remaining</Text>
                  </View>
                )}
                <View style={styles.adherenceStatItem}>
                  <Text style={styles.adherenceStatValue}>{todayStatus.total}</Text>
                  <Text style={styles.adherenceStatLabel}>Total</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.adherenceEmptyText}>No medications scheduled today</Text>
            )}
          </View>
        </View>

        {/* Low Pill Count Alert */}
        {lowPillCount.length > 0 && (
          <View style={[styles.section, styles.alertSection]}>
            <Text style={styles.alertTitle}>Low Pill Count</Text>
            {lowPillCount.map(med => (
              <View key={med.id} style={styles.alertItem}>
                <Text style={styles.alertText}>
                  {med.name}: Only {med.pillCount} pills left!
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Favorite Pictures Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📸 Favorite Pictures</Text>
          <Text style={styles.pictureDescription}>
            Add pictures to display on alarm screen ({pictureCount} {pictureCount === 1 ? 'picture' : 'pictures'})
          </Text>
          <TouchableOpacity 
            style={[
              styles.pictureButton,
              isSelectingPictures && styles.disabledButton
            ]}
            onPress={() => setIsPictureModalVisible(true)}
            activeOpacity={0.8}
            disabled={isSelectingPictures}
          >
            <Text style={styles.pictureButtonText}>Manage Pictures</Text>
          </TouchableOpacity>
        </View>

        {/* Alarm Music Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎵 Alarm Music</Text>
          <Text style={styles.pictureDescription}>
            Select music to play when alarm rings
          </Text>
          {alarmMusicUri ? (
            <View style={styles.musicInfoContainer}>
              <Text style={styles.musicName} numberOfLines={1}>
                {alarmMusicName || 'Custom Music'}
              </Text>
              <View style={styles.musicButtonsRow}>
                <TouchableOpacity 
                  style={[styles.musicButton, styles.musicButtonSecondary]}
                  onPress={selectAlarmMusic}
                  activeOpacity={0.8}
                >
                  <Text style={styles.musicButtonText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.musicButton, styles.musicButtonDanger]}
                  onPress={removeAlarmMusic}
                  activeOpacity={0.8}
                >
                  <Text style={styles.musicButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.pictureButton}
              onPress={selectAlarmMusic}
              activeOpacity={0.8}
            >
              <Text style={styles.pictureButtonText}>Select Music File</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Upcoming Medications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Today</Text>
          {upcomingAlarms.length > 0 ? (
            upcomingAlarms.map((item, index) => (
              <View key={`${item.id}-${index}`} style={styles.medicationCard}>
                <View style={styles.medicationCardHeader}>
                  <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.takeButton}
                    onPress={() => markAsTaken(item.medication)}
                  >
                    <Text style={styles.takeButtonText}>✓ Take</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.medicationName}>{item.medicationName}</Text>
                <View style={styles.medicationDetails}>
                  <View style={[styles.colorDot, { backgroundColor: item.lightColor }]} />
                  <Text style={styles.detailText}>
                    {item.medication.pillCount} pills left
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No upcoming medications today</Text>
          )}
        </View>

        {/* Refresh Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.button} onPress={loadDashboard}>
            <Text style={styles.buttonText}>Refresh Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Picture Management Modal */}
      <Modal
        visible={isPictureModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPictureModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsPictureModalVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <ScrollView 
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.modalScrollContent}
              >
                <Text style={styles.modalTitle}>Manage Favorite Pictures</Text>
                <Text style={styles.modalSubtitle}>
                  Pictures will be randomly displayed on alarm screen
                </Text>

                <TouchableOpacity 
                  style={[
                    styles.addPictureButton,
                    isSelectingPictures && styles.disabledButton
                  ]}
                  onPress={handleAddPicture}
                  activeOpacity={0.8}
                  disabled={isSelectingPictures}
                >
                  <Text style={styles.addPictureButtonText}>+ Add Picture</Text>
                </TouchableOpacity>

                {favoritePictures.length > 0 ? (
                  <View style={styles.picturesGrid}>
                    {favoritePictures.map((picture) => (
                      <View key={picture.id} style={styles.pictureItem}>
                        <Image
                          source={{ uri: picture.uri }}
                          style={styles.pictureThumbnail}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.removePictureButton}
                          onPress={() => {
                            Alert.alert(
                              'Remove Picture',
                              'Are you sure you want to remove this picture?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Remove',
                                  style: 'destructive',
                                  onPress: () => removePicture(picture.id),
                                },
                              ]
                            );
                          }}
                        >
                          <Text style={styles.removePictureButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyPicturesText}>
                    No pictures added yet. Tap "Add Picture" to get started.
                  </Text>
                )}

                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setIsPictureModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  timerSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  quickStatCard: {
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
    minHeight: 100,
  },
  quickStatValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
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
  alertSection: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 5,
    borderLeftColor: '#f39c12',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 10,
  },
  alertItem: {
    marginBottom: 6,
  },
  alertText: {
    fontSize: 16,
    color: '#856404',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2c3e50',
  },
  medicationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  medicationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeContainer: {
    flex: 1,
  },
  timeText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  takeButton: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 100,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  medicationName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  medicationDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  detailText: {
    fontSize: 15,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  adherenceCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  adherenceCardToday: {
    backgroundColor: '#e7f3ff',
    borderLeftColor: '#007bff',
  },
  adherenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  adherenceDayTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
  },
  adherenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minHeight: 28,
    justifyContent: 'center',
  },
  adherenceBadgeSuccess: {
    backgroundColor: '#2ecc71',
  },
  adherenceBadgeWarning: {
    backgroundColor: '#f39c12',
  },
  adherenceBadgeInfo: {
    backgroundColor: '#3498db',
  },
  adherenceBadgeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  adherenceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  adherenceStatItem: {
    alignItems: 'center',
  },
  adherenceStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginBottom: 4,
  },
  adherenceStatValueMissed: {
    color: '#e74c3c',
  },
  adherenceStatValueRemaining: {
    color: '#3498db',
  },
  adherenceStatLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  adherenceEmptyText: {
    fontSize: 15,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 8,
  },
  pictureDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 12,
    textAlign: 'center',
  },
  pictureButton: {
    backgroundColor: '#007bff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  pictureButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 420,
    maxHeight: SCREEN_HEIGHT * 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalScrollContent: {
    paddingBottom: 10,
    flexGrow: 0,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: '#212529',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  addPictureButton: {
    backgroundColor: '#28a745',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addPictureButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  picturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pictureItem: {
    width: '48%',
    marginBottom: 12,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  pictureThumbnail: {
    width: '100%',
    height: 150,
    backgroundColor: '#f8f9fa',
  },
  removePictureButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#dc3545',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  removePictureButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyPicturesText: {
    fontSize: 16,
    color: '#adb5bd',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#6c757d',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  musicInfoContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  musicName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
    textAlign: 'center',
  },
  musicButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  musicButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  musicButtonSecondary: {
    backgroundColor: '#6c757d',
  },
  musicButtonDanger: {
    backgroundColor: '#dc3545',
  },
  musicButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});



