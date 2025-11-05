import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, Pressable, Platform, Dimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Medication, MedicationAlarm, DAYS_OF_WEEK } from '../types';
import MedicationManager from '../services/MedicationManager';
import AlarmService from '../services/AlarmService';
import HistoryService from '../services/HistoryService';
import Toast from 'react-native-toast-message';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MedicationsScreen({ lights, alarmService }) {
  const [medications, setMedications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Medication Modal state
  const [isAddVisible, setIsAddVisible] = useState(false);
  const [medName, setMedName] = useState('');
  const [pillCount, setPillCount] = useState('30');
  const [selectedColor, setSelectedColor] = useState('#FF6B6B');
  const [selectedLightIds, setSelectedLightIds] = useState([]);

  // Add Alarm Modal state
  const [isAlarmVisible, setIsAlarmVisible] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [alarmTime, setAlarmTime] = useState('08:00');
  const [alarmDate, setAlarmDate] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [is24Hour, setIs24Hour] = useState(false); // 12-hour format by default
  const [alarmDays, setAlarmDays] = useState([1, 2, 3, 4, 5]);
  const [alarmLightIds, setAlarmLightIds] = useState([]);
  const [alarmColor, setAlarmColor] = useState('#FF6B6B');

  const COLOR_CHOICES = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  React.useEffect(() => {
    loadMedications();
  }, []);

  const loadMedications = async () => {
    try {
      const medicationManager = MedicationManager.getInstance();
      const loaded = await medicationManager.loadMedications();
      setMedications(loaded);
    } catch (error) {
      console.error('Error loading medications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openAddMedication = () => {
    setMedName('');
    setPillCount('30');
    setSelectedColor('#FF6B6B');
    setSelectedLightIds([]);
    setIsAddVisible(true);
  };

  const openAddAlarm = (medication) => {
    setSelectedMedication(medication);
    // Initialize with 8:00 AM
    const defaultDate = new Date();
    defaultDate.setHours(8, 0, 0, 0);
    setAlarmDate(defaultDate);
    setAlarmTime('08:00 AM');
    setIs24Hour(false); // Use 12-hour format by default
    setAlarmDays([1, 2, 3, 4, 5]);
    setAlarmLightIds([]);
    setAlarmColor('#FF6B6B');
    setShowTimePicker(Platform.OS === 'ios');
    setIsAlarmVisible(true);
  };

  const onTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (event.type === 'dismissed') {
        return; // User cancelled
      }
    }

    if (selectedDate) {
      setAlarmDate(selectedDate);
      formatTimeDisplay(selectedDate);
    }
  };

  const formatTimeDisplay = (date) => {
    if (!date) return;
    
    if (is24Hour) {
      // 24-hour format
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      setAlarmTime(`${hours}:${minutes}`);
    } else {
      // 12-hour format with AM/PM
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      const formattedHours = hours.toString().padStart(2, '0');
      const formattedMinutes = minutes.toString().padStart(2, '0');
      setAlarmTime(`${formattedHours}:${formattedMinutes} ${ampm}`);
    }
  };

  const setAM = () => {
    const currentDate = new Date(alarmDate);
    let hours = currentDate.getHours();
    
    // If currently PM (>= 12), subtract 12 to convert to AM
    if (hours >= 12) {
      hours -= 12;
      currentDate.setHours(hours);
      setAlarmDate(currentDate);
      formatTimeDisplay(currentDate);
    }
  };

  const setPM = () => {
    const currentDate = new Date(alarmDate);
    let hours = currentDate.getHours();
    
    // If currently AM (< 12), add 12 to convert to PM
    if (hours < 12) {
      hours += 12;
      currentDate.setHours(hours);
      setAlarmDate(currentDate);
      formatTimeDisplay(currentDate);
    }
  };

  const toggle24HourFormat = () => {
    setIs24Hour(!is24Hour);
    formatTimeDisplay(alarmDate);
  };

  const showTimePickerHandler = () => {
    setShowTimePicker(true);
  };

  const saveMedication = async () => {
    try {
      const nameTrim = medName.trim();
      if (!nameTrim) {
        Toast.show({ type: 'error', text1: 'Name required', text2: 'Please enter a medication name' });
        return;
      }

      const count = Number.parseInt(pillCount, 10);
      const medicationManager = MedicationManager.getInstance();
      const newMed = {
        id: Date.now().toString(),
        name: nameTrim,
        displayName: nameTrim,
        genericName: nameTrim,
        isActive: true,
        pillCount: Number.isNaN(count) ? 0 : count,
        alarms: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await medicationManager.addMedication(newMed);
      await loadMedications();
      setIsAddVisible(false);
      Toast.show({ type: 'success', text1: 'Medication Added' });
    } catch (e) {
      console.error('Add medication error:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to add medication' });
    }
  };

  const toggleDaySelection = (dayId) => {
    setAlarmDays((prev) => {
      if (prev.includes(dayId)) {
        return prev.filter((id) => id !== dayId);
      }
      return [...prev, dayId];
    });
  };

  const saveAlarm = async () => {
    try {
      if (!selectedMedication) {
        Toast.show({ type: 'error', text1: 'No medication selected' });
        return;
      }

      if (alarmDays.length === 0) {
        Toast.show({ type: 'error', text1: 'Days required', text2: 'Please select at least one day' });
        return;
      }

      // Ensure time is valid (convert to 24-hour format for storage)
      // Always store time in 24-hour format (HH:mm) regardless of display format
      const hours = alarmDate.getHours().toString().padStart(2, '0');
      const minutes = alarmDate.getMinutes().toString().padStart(2, '0');
      const finalTime = `${hours}:${minutes}`;

      const alarmServiceInstance = AlarmService.getInstance();
      
      const newAlarm = {
        medicationName: selectedMedication.name,
        time: finalTime,
        daysOfWeek: alarmDays,
        isEnabled: true,
        lightIds: alarmLightIds,
        lightColor: alarmColor,
      };

      await alarmServiceInstance.createAlarm(selectedMedication.id, newAlarm);
      await loadMedications();
      setIsAlarmVisible(false);
      Toast.show({ type: 'success', text1: 'Alarm Added', text2: `Set for ${finalTime}` });
    } catch (e) {
      console.error('Add alarm error:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to add alarm' });
    }
  };

  const decreasePillCount = async (medicationId) => {
    try {
      const medicationManager = MedicationManager.getInstance();
      const historyService = HistoryService.getInstance();
      
      // Get medication to check current count and find related alarm
      const medication = await medicationManager.getMedication(medicationId);
      if (!medication) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Medication not found',
        });
        return;
      }

      const success = await medicationManager.decreasePillCount(medicationId);
      
      if (success) {
        // Record in history
        const allAlarms = await medicationManager.loadAlarms();
        const medAlarms = allAlarms.filter(a => a.medicationId === medicationId);
        const nearestAlarm = findNearestAlarm(medAlarms);
        
        await historyService.recordMedicationTaken(
          medicationId,
          medication.name,
          nearestAlarm?.id,
          nearestAlarm?.time
        );

        await loadMedications();
        
        // Check for refill reminder
        const updatedMed = await medicationManager.getMedication(medicationId);
        if (updatedMed && updatedMed.pillCount <= 5) {
          Toast.show({
            type: 'warning',
            text1: 'Low Pill Count',
            text2: `Only ${updatedMed.pillCount} pills left for ${medication.name}`,
            visibilityTime: 4000,
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'Pill Count Updated',
            text2: 'Pill count decreased successfully',
          });
        }
      } else {
        Toast.show({
          type: 'warning',
          text1: 'Cannot Decrease',
          text2: 'Pill count is already at 0',
        });
      }
    } catch (error) {
      console.error('Error decreasing pill count:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update pill count',
      });
    }
  };

  const findNearestAlarm = (alarms) => {
    if (!alarms || alarms.length === 0) return null;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Find alarm that's closest to current time (within today's schedule)
    let nearest = null;
    let minDiff = Infinity;
    
    alarms.forEach(alarm => {
      if (!alarm.isEnabled) return;
      const [hours, minutes] = alarm.time.split(':').map(Number);
      const alarmTime = hours * 60 + minutes;
      const diff = Math.abs(alarmTime - currentTime);
      
      if (diff < minDiff) {
        minDiff = diff;
        nearest = alarm;
      }
    });
    
    return nearest;
  };

  const deleteMedication = async (medicationId) => {
    try {
      Alert.alert(
        'Delete Medication',
        'Are you sure you want to delete this medication? This will also remove all associated alarms.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const medicationManager = MedicationManager.getInstance();
                const allAlarms = await medicationManager.loadAlarms();
                const medicationAlarms = allAlarms.filter(alarm => alarm.medicationId === medicationId);
                
                for (const alarm of medicationAlarms) {
                  await medicationManager.deleteAlarm(alarm.id);
                }
                
                await medicationManager.deleteMedication(medicationId);
                
                if (alarmService) {
                  await alarmService.rescheduleAllMedications();
                }
                
                await loadMedications();
                
                Toast.show({
                  type: 'success',
                  text1: 'Medication Deleted',
                  text2: 'Medication and associated alarms removed',
                });
              } catch (error) {
                console.error('Error deleting medication:', error);
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Failed to delete medication',
                });
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error showing delete confirmation:', error);
    }
  };

  const toggleLightSelection = (lightId) => {
    setSelectedLightIds((prev) => {
      if (prev.includes(lightId)) {
        return prev.filter((id) => id !== lightId);
      }
      return [...prev, lightId];
    });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading medications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>My Medications</Text>

        {/* Medications Section */}
        <View style={styles.section}>
          {medications.length === 0 ? (
            <Text style={styles.emptyText}>No medications added yet</Text>
          ) : (
            medications.map((medication) => (
              <View key={medication.id} style={styles.medicationItem}>
                <View style={styles.medicationHeader}>
                  <Text style={styles.medicationName}>{medication.name}</Text>
                  <View style={styles.medicationHeaderButtons}>
                    <TouchableOpacity 
                      style={styles.addAlarmButton}
                      onPress={() => openAddAlarm(medication)}
                    >
                      <Text style={styles.addAlarmButtonText}>+ Alarm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => deleteMedication(medication.id)}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.medicationDetails}>
                  Pills: {medication.pillCount} | 
                  Alarms: {medication.alarms?.length || 0}
                  {medication.pillCount <= 5 && (
                    <Text style={styles.lowPillWarning}> - Low!</Text>
                  )}
                </Text>
                
                {(medication.alarms || []).map((alarm) => (
                  <View key={alarm.id} style={styles.alarmItem}>
                    <View style={styles.alarmHeader}>
                      <Text style={styles.alarmTime}>{alarm.time}</Text>
                      <View style={[styles.alarmColorIndicator, { backgroundColor: alarm.lightColor }]} />
                    </View>
                    <Text style={styles.alarmDetails}>
                      Days: {alarm.daysOfWeek.map(d => DAYS_OF_WEEK.find(day => day.id === d)?.short).join(', ')} | 
                      Lights: {alarm.lightIds.length}
                    </Text>
                  </View>
                ))}
                
                <TouchableOpacity 
                  style={styles.pillButton}
                  onPress={() => decreasePillCount(medication.id)}
                >
                  <Text style={styles.pillButtonText}>Take Pill</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.button} onPress={openAddMedication}>
            <Text style={styles.buttonText}>Add Medication</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Medication Modal */}
      <Modal
        visible={isAddVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAddVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsAddVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <ScrollView 
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                <Text style={styles.modalTitle}>Add Medication</Text>

                <TextInput
                  placeholder="Medication name"
                  value={medName}
                  onChangeText={setMedName}
                  style={styles.input}
                />

                <TextInput
                  placeholder="Pill count"
                  keyboardType="number-pad"
                  value={pillCount}
                  onChangeText={setPillCount}
                  style={styles.input}
                />

                <Text style={styles.label}>Color</Text>
                <View style={styles.colorRow}>
                  {COLOR_CHOICES.map((c) => (
                    <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c, borderWidth: selectedColor === c ? 2 : 0 }]} onPress={() => setSelectedColor(c)} />
                  ))}
                </View>

                <Text style={styles.label}>Select Lights</Text>
                <View style={styles.lightsRow}>
                  {lights.length === 0 ? (
                    <Text style={styles.emptyText}>No lights available</Text>
                  ) : (
                    lights.map((l) => (
                      <TouchableOpacity
                        key={l.id}
                        style={[styles.lightChip, selectedLightIds.includes(l.id) ? styles.lightChipSelected : null]}
                        onPress={() => toggleLightSelection(l.id)}
                      >
                        <Text style={styles.lightChipText}>{l.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setIsAddVisible(false)}>
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={saveMedication}>
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Alarm Modal */}
      <Modal
        visible={isAlarmVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAlarmVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsAlarmVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <ScrollView 
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                <Text style={styles.modalTitle}>Add Alarm for {selectedMedication?.name}</Text>

                <Text style={styles.label}>Time</Text>
                
                {/* Display current selected time */}
                <View style={styles.timeDisplayContainer}>
                  <Text style={styles.selectedTimeText}>Selected: {alarmTime}</Text>
                  
                  <View style={styles.timeControlButtons}>
                    {/* AM/PM Selection (only for 12-hour format) */}
                    {!is24Hour && (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.ampmButton,
                            alarmDate.getHours() < 12 && styles.ampmButtonActive
                          ]}
                          onPress={setAM}
                        >
                          <Text style={[
                            styles.ampmButtonText,
                            alarmDate.getHours() < 12 && styles.ampmButtonTextActive
                          ]}>
                            AM
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.ampmButton,
                            alarmDate.getHours() >= 12 && styles.ampmButtonActive
                          ]}
                          onPress={setPM}
                        >
                          <Text style={[
                            styles.ampmButtonText,
                            alarmDate.getHours() >= 12 && styles.ampmButtonTextActive
                          ]}>
                            PM
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                    
                    {/* 24-hour format toggle */}
                    <TouchableOpacity
                      style={styles.formatToggleButton}
                      onPress={toggle24HourFormat}
                    >
                      <Text style={styles.formatToggleButtonText}>
                        {is24Hour ? '12-Hour' : '24-Hour'}
                      </Text>
                    </TouchableOpacity>

                    {Platform.OS === 'android' && (
                      <TouchableOpacity
                        style={styles.timePickerButton}
                        onPress={showTimePickerHandler}
                      >
                        <Text style={styles.timePickerButtonText}>Change Time</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Native Time Picker */}
                {showTimePicker && (
                  <View style={styles.timePickerWrapper}>
                    <DateTimePicker
                      value={alarmDate}
                      mode="time"
                      is24Hour={is24Hour}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onTimeChange}
                      style={Platform.OS === 'android' ? {} : styles.timePicker}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.timePickerDoneButton}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.timePickerDoneButtonText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <Text style={styles.label}>Days of Week</Text>
                <View style={styles.daysRow}>
                  {DAYS_OF_WEEK.map((day) => (
                    <TouchableOpacity
                      key={day.id}
                      style={[styles.dayChip, alarmDays.includes(day.id) ? styles.dayChipSelected : null]}
                      onPress={() => toggleDaySelection(day.id)}
                    >
                      <Text style={styles.dayChipText}>{day.short}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Alarm Color</Text>
                <View style={styles.colorRow}>
                  {COLOR_CHOICES.map((c) => (
                    <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c, borderWidth: alarmColor === c ? 2 : 0 }]} onPress={() => setAlarmColor(c)} />
                  ))}
                </View>

                <Text style={styles.label}>Select Lights</Text>
                <View style={styles.lightsRow}>
                  {lights.length === 0 ? (
                    <Text style={styles.emptyText}>No lights available</Text>
                  ) : (
                    lights.map((l) => (
                      <TouchableOpacity
                        key={l.id}
                        style={[styles.lightChip, alarmLightIds.includes(l.id) ? styles.lightChipSelected : null]}
                        onPress={() => {
                          if (alarmLightIds.includes(l.id)) {
                            setAlarmLightIds(alarmLightIds.filter(id => id !== l.id));
                          } else {
                            setAlarmLightIds([...alarmLightIds, l.id]);
                          }
                        }}
                      >
                        <Text style={styles.lightChipText}>{l.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setIsAlarmVisible(false)}>
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={saveAlarm}>
                    <Text style={styles.buttonText}>Save Alarm</Text>
                  </TouchableOpacity>
                </View>
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
    backgroundColor: '#f8f9fa',
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
    color: '#6c757d',
    fontWeight: '500',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    color: '#212529',
    letterSpacing: -0.5,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  emptyText: {
    fontSize: 14,
    color: '#adb5bd',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
    marginVertical: 4,
  },
  medicationItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  medicationHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
    letterSpacing: -0.3,
  },
  medicationDetails: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 10,
    lineHeight: 20,
  },
  lowPillWarning: {
    fontSize: 13,
    color: '#dc3545',
    fontWeight: '600',
  },
  alarmItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  alarmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  alarmTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    letterSpacing: 0.5,
  },
  alarmColorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  alarmDetails: {
    fontSize: 12,
    color: '#6c757d',
    lineHeight: 18,
  },
  pillButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  pillButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  button: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 120,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
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
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: SCREEN_HEIGHT * 0.8,
    justifyContent: 'flex-start',
    overflow: 'hidden',
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
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: '#212529',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 15,
    color: '#212529',
  },
  label: {
    fontSize: 14,
    color: '#495057',
    marginTop: 8,
    marginBottom: 8,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    borderColor: '#dee2e6',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  lightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  lightChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#e9ecef',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  lightChipSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  lightChipText: {
    color: '#495057',
    fontSize: 13,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    shadowColor: '#6c757d',
  },
  addAlarmButton: {
    backgroundColor: '#28a745',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  addAlarmButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteButtonText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    height: 200,
  },
  timePickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timePickerLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 5,
    fontWeight: '600',
  },
  pickerWheel: {
    height: 150,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  pickerScrollView: {
    height: 150,
  },
  pickerContent: {
    paddingTop: 50,
    paddingBottom: 50,
  },
  pickerSelectionIndicator: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    height: 50,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#3498db',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  pickerItem: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemText: {
    fontSize: 20,
    color: '#95a5a6',
    fontWeight: '500',
  },
  pickerItemTextSelected: {
    fontSize: 24,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  timeSeparator: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginHorizontal: 10,
    marginTop: 30,
  },
  timeDisplayContainer: {
    marginVertical: 8,
    alignItems: 'center',
  },
  timeControlButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  selectedTimeText: {
    fontSize: 18,
    color: '#3498db',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  timePickerButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  timePickerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ampmButton: {
    backgroundColor: '#ecf0f1',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 8,
    minWidth: 60,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#bdc3c7',
  },
  ampmButtonActive: {
    backgroundColor: '#27ae60',
    borderColor: '#27ae60',
  },
  ampmButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ampmButtonTextActive: {
    color: 'white',
  },
  formatToggleButton: {
    backgroundColor: '#95a5a6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  formatToggleButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  timePickerWrapper: {
    marginVertical: 8,
    alignItems: 'center',
  },
  timePicker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 150 : 200,
  },
  timePickerDoneButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  timePickerDoneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ecf0f1',
    marginRight: 6,
    marginBottom: 6,
  },
  dayChipSelected: {
    backgroundColor: '#3498db',
  },
  dayChipText: {
    color: '#2c3e50',
    fontSize: 12,
  },
});

