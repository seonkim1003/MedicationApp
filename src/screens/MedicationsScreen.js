import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, Pressable, Platform, Dimensions, Keyboard } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Medication, MedicationAlarm, MedicationGroup, DAYS_OF_WEEK } from '../types';
import MedicationManager from '../services/MedicationManager';
import AlarmService from '../services/AlarmService';
import HistoryService from '../services/HistoryService';
import LightNameService from '../services/LightNameService';
import GroupService from '../services/GroupService';
import Toast from 'react-native-toast-message';
import { colors, cardShadow, borderRadius } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MedicationsScreen({ navigation, lights, alarmService }) {
  const [medications, setMedications] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lightsWithCustomNames, setLightsWithCustomNames] = useState([]);
  const lightNameService = LightNameService.getInstance();
  const groupService = GroupService.getInstance();

  // Add Medication Modal state
  const [isAddVisible, setIsAddVisible] = useState(false);
  const [medName, setMedName] = useState('');
  const [pillCount, setPillCount] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  // Edit Medication Modal state
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [selectedMedicationForEdit, setSelectedMedicationForEdit] = useState(null);

  // Connect Lights Modal state
  const [isConnectLightsVisible, setIsConnectLightsVisible] = useState(false);
  const [selectedMedicationForLights, setSelectedMedicationForLights] = useState(null);
  const [selectedLightIds, setSelectedLightIds] = useState([]);
  const [lightColor, setLightColor] = useState('#FF6B6B');

  // Add Alarm Modal state
  const [isAlarmVisible, setIsAlarmVisible] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [alarmTime, setAlarmTime] = useState('08:00');
  const [alarmDate, setAlarmDate] = useState(new Date());

  const [is24Hour, setIs24Hour] = useState(false); // 12-hour format by default
  const [alarmDays, setAlarmDays] = useState([]); // default to none selected

  // Refill Pills Modal state
  const [isRefillVisible, setIsRefillVisible] = useState(false);
  const [selectedMedicationForRefill, setSelectedMedicationForRefill] = useState(null);
  const [refillAmount, setRefillAmount] = useState('');

  // Group Management Modal state
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [isEditGroupModalVisible, setIsEditGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isAssignGroupModalVisible, setIsAssignGroupModalVisible] = useState(false);
  const [selectedMedicationForGroup, setSelectedMedicationForGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({}); // Track which groups are expanded
  const [expandedMedications, setExpandedMedications] = useState({}); // Track which medications are expanded
  const [activeFilterGroup, setActiveFilterGroup] = useState('All'); // 'All' or a groupId

  const COLOR_CHOICES = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  React.useEffect(() => {
    loadMedications();
    loadGroups();
    loadLightsWithCustomNames();
  }, [lights]);

  const loadLightsWithCustomNames = async () => {
    try {
      const lightsWithNames = await Promise.all(
        lights.map(async (light) => {
          const customName = await lightNameService.getDisplayName(light.id, light.name);
          return {
            ...light,
            displayName: customName,
          };
        })
      );
      setLightsWithCustomNames(lightsWithNames);
    } catch (error) {
      console.error('Error loading lights with custom names:', error);
      setLightsWithCustomNames(lights);
    }
  };

  const loadMedications = async () => {
    try {
      const medicationManager = MedicationManager.getInstance();
      const loaded = await medicationManager.loadMedications();
      const allAlarms = await medicationManager.loadAlarms();
      const merged = loaded.map(med => {
        const medAlarms = allAlarms.filter(a => a.medicationId === med.id);
        return { ...med, alarms: medAlarms.length > 0 ? medAlarms : (med.alarms || []) };
      });
      setMedications(merged);
    } catch (error) {
      console.error('Error loading medications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const loaded = await groupService.loadGroups();
      setGroups(loaded);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const organizeMedicationsByGroup = () => {
    const grouped = {};
    const ungrouped = [];

    medications.forEach(med => {
      if (med.groupId) {
        if (!grouped[med.groupId]) {
          grouped[med.groupId] = [];
        }
        grouped[med.groupId].push(med);
      } else {
        ungrouped.push(med);
      }
    });

    return { grouped, ungrouped };
  };

  const getFilteredMedications = () => {
    if (activeFilterGroup === 'All') {
      return medications;
    }
    if (activeFilterGroup === 'Ungrouped') {
      return medications.filter(med => !med.groupId);
    }
    return medications.filter(med => med.groupId === activeFilterGroup);
  };

  const openAddMedication = () => {
    setMedName('');
    setPillCount('');
    setSelectedGroupId(null);
    setAlarmDays([]); // ensure days are cleared when starting fresh
    setIsAddVisible(true);
  };

  const openEditMedication = (medication) => {
    setSelectedMedicationForEdit(medication);
    setMedName(medication.name);
    setPillCount(medication.pillCount.toString());
    setSelectedGroupId(medication.groupId || null);
    setIsEditVisible(true);
  };

  const openCreateGroup = () => {
    setGroupName('');
    setSelectedGroup(null);
    setIsGroupModalVisible(true);
  };

  const openEditGroup = (group) => {
    setGroupName(group.name);
    setSelectedGroup(group);
    setIsEditGroupModalVisible(true);
  };

  const openAssignGroup = (medication) => {
    setSelectedMedicationForGroup(medication);
    setIsAssignGroupModalVisible(true);
  };

  const saveGroup = async () => {
    try {
      if (!groupName.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Name required',
          text2: 'Please enter a group name',
        });
        return;
      }

      const newGroup = {
        id: Date.now().toString(),
        name: groupName.trim(),
        color: COLOR_CHOICES[Math.floor(Math.random() * COLOR_CHOICES.length)],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await groupService.addGroup(newGroup);
      await loadGroups();
      setIsGroupModalVisible(false);
      setGroupName('');
      Toast.show({
        type: 'success',
        text1: 'Group Created',
        text2: `Group "${newGroup.name}" has been created`,
      });
    } catch (error) {
      console.error('Error creating group:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create group',
      });
    }
  };

  const updateGroup = async () => {
    try {
      if (!groupName.trim() || !selectedGroup) {
        Toast.show({
          type: 'error',
          text1: 'Name required',
          text2: 'Please enter a group name',
        });
        return;
      }

      const updatedGroup = {
        ...selectedGroup,
        name: groupName.trim(),
        updatedAt: new Date().toISOString(),
      };

      await groupService.updateGroup(updatedGroup);
      await loadGroups();
      setIsEditGroupModalVisible(false);
      setGroupName('');
      setSelectedGroup(null);
      Toast.show({
        type: 'success',
        text1: 'Group Updated',
        text2: `Group "${updatedGroup.name}" has been updated`,
      });
    } catch (error) {
      console.error('Error updating group:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update group',
      });
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      Alert.alert(
        'Delete Group',
        'Are you sure you want to delete this group? Medications in this group will become ungrouped.',
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
                // Remove groupId from all medications in this group
                const medicationManager = MedicationManager.getInstance();
                const allMedications = await medicationManager.loadMedications();
                const updatedMedications = allMedications.map(med => {
                  if (med.groupId === groupId) {
                    return {
                      ...med,
                      groupId: undefined,
                      updatedAt: new Date().toISOString(),
                    };
                  }
                  return med;
                });
                await medicationManager.saveMedications(updatedMedications);

                // Delete the group
                await groupService.deleteGroup(groupId);
                await loadGroups();
                await loadMedications();
                Toast.show({
                  type: 'success',
                  text1: 'Group Deleted',
                  text2: 'Group has been deleted and medications ungrouped',
                });
              } catch (error) {
                console.error('Error deleting group:', error);
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Failed to delete group',
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

  const assignMedicationToGroup = async (groupId) => {
    try {
      if (!selectedMedicationForGroup) return;

      const medicationManager = MedicationManager.getInstance();
      const medication = await medicationManager.getMedication(selectedMedicationForGroup.id);
      if (!medication) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Medication not found',
        });
        return;
      }

      const updatedMedication = {
        ...medication,
        groupId: groupId || undefined,
        updatedAt: new Date().toISOString(),
      };

      await medicationManager.updateMedication(updatedMedication);
      await loadMedications();
      setIsAssignGroupModalVisible(false);
      setSelectedMedicationForGroup(null);

      const groupName = groupId ? groups.find(g => g.id === groupId)?.name : 'Ungrouped';
      Toast.show({
        type: 'success',
        text1: 'Group Updated',
        text2: `Medication assigned to ${groupName}`,
      });
    } catch (error) {
      console.error('Error assigning medication to group:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to assign medication to group',
      });
    }
  };

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isGroupExpanded = (groupId) => {
    return expandedGroups[groupId] === true;
  };

  const toggleMedicationExpansion = (medicationId) => {
    setExpandedMedications(prev => ({
      ...prev,
      [medicationId]: !prev[medicationId],
    }));
  };

  const isMedicationExpanded = (medicationId) => {
    return expandedMedications[medicationId] === true;
  };

  const openConnectLights = (medication) => {
    setSelectedMedicationForLights(medication);
    // Load existing light connections for this medication
    const existingLightIds = [];
    let existingColor = '#FF6B6B';
    if (medication.alarms && medication.alarms.length > 0) {
      // Get the first alarm's light color if available
      const firstAlarmWithColor = medication.alarms.find(a => a.lightColor);
      if (firstAlarmWithColor) {
        existingColor = firstAlarmWithColor.lightColor;
      }
      medication.alarms.forEach(alarm => {
        if (alarm.lightIds && alarm.lightIds.length > 0) {
          alarm.lightIds.forEach(lightId => {
            if (!existingLightIds.includes(lightId)) {
              existingLightIds.push(lightId);
            }
          });
        }
      });
    }
    setSelectedLightIds(existingLightIds);
    setLightColor(existingColor);
    setIsConnectLightsVisible(true);
  };

  const openAddAlarm = (medication) => {
    setSelectedMedication(medication);
    // Initialize with 8:00 AM
    const defaultDate = new Date();
    defaultDate.setHours(8, 0, 0, 0);
    setAlarmDate(defaultDate);
    setAlarmTime('08:00 AM');
    setIs24Hour(false); // Use 12-hour format by default
    setAlarmDays([1, 2, 3, 4, 5, 6, 7]); // Default to all days selected
    setIsAlarmVisible(true);
  };

  const onTimeChange = (event, selectedDate) => {
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
        groupId: selectedGroupId || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await medicationManager.addMedication(newMed);
      await loadMedications();
      setIsAddVisible(false);
      setSelectedGroupId(null);
      Toast.show({ type: 'success', text1: 'Medication Added' });
    } catch (e) {
      console.error('Add medication error:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to add medication' });
    }
  };

  const updateMedication = async () => {
    try {
      if (!selectedMedicationForEdit) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'No medication selected' });
        return;
      }

      const nameTrim = medName.trim();
      if (!nameTrim) {
        Toast.show({ type: 'error', text1: 'Name required', text2: 'Please enter a medication name' });
        return;
      }

      const count = Number.parseInt(pillCount, 10);
      const medicationManager = MedicationManager.getInstance();
      const updatedMed = {
        ...selectedMedicationForEdit,
        name: nameTrim,
        displayName: nameTrim,
        genericName: nameTrim,
        pillCount: Number.isNaN(count) ? 0 : count,
        groupId: selectedGroupId || undefined,
        updatedAt: new Date().toISOString()
      };

      await medicationManager.updateMedication(updatedMed);
      await loadMedications();
      setIsEditVisible(false);
      setSelectedMedicationForEdit(null);
      setSelectedGroupId(null);
      Toast.show({ type: 'success', text1: 'Medication Updated' });
    } catch (e) {
      console.error('Update medication error:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update medication' });
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

      const existingAlarm = (selectedMedication.alarms || []).find(a => a.lightIds?.length > 0);
      const newAlarm = {
        medicationName: selectedMedication.name,
        time: finalTime,
        daysOfWeek: alarmDays,
        isEnabled: true,
        lightIds: existingAlarm?.lightIds || [],
        lightColor: existingAlarm?.lightColor || '#FF6B6B',
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

  const openRefillModal = (medication) => {
    setSelectedMedicationForRefill(medication);
    setRefillAmount('');
    setIsRefillVisible(true);
  };

  const refillPillCount = async () => {
    try {
      if (!selectedMedicationForRefill) {
        return;
      }

      const pillsToAdd = parseInt(refillAmount, 10);
      if (isNaN(pillsToAdd) || pillsToAdd <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Amount',
          text2: 'Please enter a valid number',
        });
        return;
      }

      const medicationManager = MedicationManager.getInstance();
      const medication = await medicationManager.getMedication(selectedMedicationForRefill.id);
      if (!medication) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Medication not found',
        });
        return;
      }

      const updatedMedication = {
        ...medication,
        pillCount: medication.pillCount + pillsToAdd,
        updatedAt: new Date().toISOString(),
      };

      await medicationManager.updateMedication(updatedMedication);
      await loadMedications();
      setIsRefillVisible(false);
      setRefillAmount('');

      Toast.show({
        type: 'success',
        text1: 'Pills Refilled',
        text2: `Added ${pillsToAdd} pills. Total: ${updatedMedication.pillCount}`,
      });
    } catch (error) {
      console.error('Error refilling pills:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to refill pills',
      });
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

  const deleteAlarm = async (alarmId, medicationId) => {
    try {
      Alert.alert(
        'Delete Alarm',
        'Are you sure you want to delete this alarm?',
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

                // Delete the alarm
                await medicationManager.deleteAlarm(alarmId);

                // Update medication to remove this alarm
                const medication = await medicationManager.getMedication(medicationId);
                if (medication) {
                  const updatedAlarms = (medication.alarms || []).filter(a => a.id !== alarmId);
                  const updatedMedication = {
                    ...medication,
                    alarms: updatedAlarms,
                  };
                  await medicationManager.updateMedication(updatedMedication);
                }

                // Reschedule all alarms to cancel the notification
                if (alarmService) {
                  await alarmService.rescheduleAllMedications();
                }

                await loadMedications();

                Toast.show({
                  type: 'success',
                  text1: 'Alarm Deleted',
                  text2: 'Alarm has been removed',
                });
              } catch (error) {
                console.error('Error deleting alarm:', error);
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Failed to delete alarm',
                });
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error showing delete alarm confirmation:', error);
    }
  };

  const deleteMedication = async (medicationId) => {
    try {
      Alert.alert(
        'Delete Medication',
        'Are you sure you want to delete this medication? This will also remove all associated alarms, schedules, and notes.',
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
                const historyService = HistoryService.getInstance();
                const allAlarms = await medicationManager.loadAlarms();
                const medicationAlarms = allAlarms.filter(alarm => alarm.medicationId === medicationId);

                // Delete all alarms for this medication
                for (const alarm of medicationAlarms) {
                  await medicationManager.deleteAlarm(alarm.id);
                }

                // Delete all history entries (including notes) for this medication
                await historyService.deleteMedicationHistory(medicationId);

                // Delete the medication itself
                await medicationManager.deleteMedication(medicationId);

                if (alarmService) {
                  await alarmService.rescheduleAllMedications();
                }

                await loadMedications();

                Toast.show({
                  type: 'success',
                  text1: 'Medication Deleted',
                  text2: 'Medication, alarms, schedules, and notes removed',
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

  const { grouped, ungrouped } = organizeMedicationsByGroup();
  const filteredMeds = getFilteredMedications();

  const renderMedication = (medication) => {
    const isExpanded = isMedicationExpanded(medication.id);
    const medicationGroup = groups.find(g => g.id === medication.groupId);
    const groupColor = medicationGroup?.color || colors.primary;
    return (
      <View key={medication.id} style={[styles.medicationCard, { borderLeftColor: groupColor }]}>
        <TouchableOpacity
          style={styles.medicationCardHeader}
          onPress={() => toggleMedicationExpansion(medication.id)}
          activeOpacity={0.7}
        >
          <View style={styles.medicationHeaderLeft}>
            <View style={[styles.medGroupIndicator, { backgroundColor: groupColor }]} />
            <Text style={styles.medicationCardTitle}>{medication.name}</Text>
          </View>
          <View style={styles.medicationHeaderRight}>
            <View style={styles.pillBadge}>
              <Text style={styles.pillBadgeText}>{medication.pillCount} Pills</Text>
            </View>
            <Text style={styles.expandIconNew}>{isExpanded ? '▼' : '▶'}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <>
            <View style={styles.medicationHeaderButtons}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditMedication(medication)}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addAlarmButton}
                onPress={() => openAddAlarm(medication)}
              >
                <Text style={styles.addAlarmButtonText}>+ Alarm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.connectLightsButton}
                onPress={() => openConnectLights(medication)}
              >
                <Text style={styles.connectLightsButtonText}>Light</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.groupButton}
                onPress={() => openAssignGroup(medication)}
              >
                <Text style={styles.groupButtonText}>Group</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteMedication(medication.id)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.medicationStatsRow}>
              <Text style={styles.medicationStatText}>
                Alarms: <Text style={styles.medicationStatValue}>{medication.alarms?.length || 0}</Text>
              </Text>
              {medicationGroup && (
                <Text style={styles.medicationStatText}>
                  | Group: <Text style={styles.medicationStatValue}>{medicationGroup.name}</Text>
                </Text>
              )}
            </View>
            {medication.pillCount <= 5 && (
              <View style={styles.lowPillBanner}>
                <Text style={styles.lowPillWarning}>⚠️ Low Pill Count - Please Refill Soon!</Text>
              </View>
            )}

            {(() => {
              const allLightIds = new Set();
              (medication.alarms || []).forEach(alarm => {
                if (alarm.lightIds && alarm.lightIds.length > 0) {
                  alarm.lightIds.forEach(id => allLightIds.add(id));
                }
              });
              const connectedLights = lightsWithCustomNames.filter(light => allLightIds.has(light.id));

              return (
                <View style={styles.connectedLightsContainer}>
                  <Text style={styles.connectedLightsLabel}>
                    {connectedLights.length > 0 ? 'Lights connected to this medication:' : 'No lights connected'}
                  </Text>
                  {connectedLights.length > 0 ? (
                    <View style={styles.connectedLightsList}>
                      {connectedLights.map(light => (
                        <View key={light.id} style={styles.connectedLightChip}>
                          <Text style={styles.connectedLightChipText}>{light.displayName || light.name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noLightsText}>Tap "Light" to connect lights to alarms</Text>
                  )}
                </View>
              );
            })()}

            {(medication.alarms || []).map((alarm) => {
              const alarmLights = (alarm.lightIds || []).map(id => lightsWithCustomNames.find(l => l.id === id)).filter(Boolean);
              return (
                <View key={alarm.id} style={styles.alarmItem}>
                  <View style={styles.alarmHeader}>
                    <View style={styles.alarmHeaderLeft}>
                      <Text style={styles.alarmTime}>{alarm.time}</Text>
                      <View style={[styles.alarmColorIndicator, { backgroundColor: alarm.lightColor }]} />
                    </View>
                    <TouchableOpacity
                      style={styles.deleteAlarmButton}
                      onPress={() => deleteAlarm(alarm.id, medication.id)}
                    >
                      <Text style={styles.deleteAlarmButtonText}>X</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.alarmDetails}>
                    Days: {alarm.daysOfWeek.map(d => DAYS_OF_WEEK.find(day => day.id === d)?.short).join(', ')}
                  </Text>
                  {alarmLights.length > 0 && (
                    <Text style={styles.alarmLightsText}>
                      Lights: {alarmLights.map(l => l.displayName || l.name).join(', ')}
                    </Text>
                  )}
                </View>
              );
            })}

            <View style={styles.pillButtonsContainer}>
              <TouchableOpacity
                style={[styles.pillButton, styles.refillButton]}
                onPress={() => openRefillModal(medication)}
              >
                <Text style={styles.pillButtonText}>Refill Pills</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pillButton}
                onPress={() => decreasePillCount(medication.id)}
              >
                <Text style={styles.pillButtonText}>Take Pill</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Horizontal Group Filter */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[styles.filterPill, activeFilterGroup === 'All' && styles.filterPillActive]}
            onPress={() => setActiveFilterGroup('All')}
          >
            <Text style={[styles.filterPillText, activeFilterGroup === 'All' && styles.filterPillTextActive]}>All</Text>
          </TouchableOpacity>

          {groups.map(group => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.filterPill,
                activeFilterGroup === group.id && styles.filterPillActive,
                activeFilterGroup === group.id && { backgroundColor: group.color, borderColor: group.color }
              ]}
              onPress={() => setActiveFilterGroup(group.id)}
            >
              <Text style={[styles.filterPillText, activeFilterGroup === group.id && styles.filterPillTextActive]}>
                {group.name}
              </Text>
            </TouchableOpacity>
          ))}

          {ungrouped.length > 0 && (
            <TouchableOpacity
              style={[styles.filterPill, activeFilterGroup === 'Ungrouped' && styles.filterPillActive]}
              onPress={() => setActiveFilterGroup('Ungrouped')}
            >
              <Text style={[styles.filterPillText, activeFilterGroup === 'Ungrouped' && styles.filterPillTextActive]}>Ungrouped</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Filtered Medications List */}
        <View style={styles.medicationsList}>
          {filteredMeds.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyText}>No medications found here.</Text>
            </View>
          ) : (
            filteredMeds.map(med => renderMedication(med))
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.primaryActionButton} onPress={openAddMedication}>
            <Text style={styles.primaryActionText}>+ Add New Medication</Text>
          </TouchableOpacity>

          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={() => navigation.navigate('ScanMedication')}
            >
              <Text style={styles.secondaryActionText}>Scan Bottle</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryActionButton} onPress={openCreateGroup}>
              <Text style={styles.secondaryActionText}>New Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Medication Modal */}
      <Modal
        visible={isEditVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsEditVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                <Text style={styles.modalTitle}>Edit Medication</Text>

                <Text style={styles.label}>Medication Name</Text>
                <TextInput
                  placeholder="Enter medication name (e.g., Aspirin, Vitamin D)"
                  value={medName}
                  onChangeText={setMedName}
                  style={styles.input}
                />

                <Text style={styles.label}>Amount of Pills</Text>
                <TextInput
                  placeholder="Enter number of pills you have"
                  keyboardType="numeric"
                  value={pillCount}
                  onChangeText={setPillCount}
                  style={styles.input}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />

                <Text style={styles.label}>Group (Optional)</Text>
                <View style={styles.groupSelectionContainer}>
                  <TouchableOpacity
                    style={[styles.groupOption, !selectedGroupId && styles.groupOptionSelected]}
                    onPress={() => setSelectedGroupId(null)}
                  >
                    <Text style={[styles.groupOptionText, !selectedGroupId && styles.groupOptionTextSelected]}>
                      None (Ungrouped)
                    </Text>
                  </TouchableOpacity>
                  {groups.map(group => (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.groupOption, selectedGroupId === group.id && styles.groupOptionSelected]}
                      onPress={() => setSelectedGroupId(group.id)}
                    >
                      <View style={[styles.groupColorDot, { backgroundColor: group.color || '#3498db' }]} />
                      <Text style={[styles.groupOptionText, selectedGroupId === group.id && styles.groupOptionTextSelected]}>
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => {
                  setIsEditVisible(false);
                  setSelectedMedicationForEdit(null);
                }}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={updateMedication}>
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
                style={styles.modalScrollView}
              >
                <Text style={styles.modalTitle}>Add Medication</Text>

                <Text style={styles.label}>Medication Name</Text>
                <TextInput
                  placeholder="Enter medication name (e.g., Aspirin, Vitamin D)"
                  value={medName}
                  onChangeText={setMedName}
                  style={styles.input}
                />

                <Text style={styles.label}>Amount of Pills</Text>
                <TextInput
                  placeholder="Enter number of pills you have"
                  keyboardType="numeric"
                  value={pillCount}
                  onChangeText={setPillCount}
                  style={styles.input}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />

                <Text style={styles.label}>Group (Optional)</Text>
                <View style={styles.groupSelectionContainer}>
                  <TouchableOpacity
                    style={[styles.groupOption, !selectedGroupId && styles.groupOptionSelected]}
                    onPress={() => setSelectedGroupId(null)}
                  >
                    <Text style={[styles.groupOptionText, !selectedGroupId && styles.groupOptionTextSelected]}>
                      None (Ungrouped)
                    </Text>
                  </TouchableOpacity>
                  {groups.map(group => (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.groupOption, selectedGroupId === group.id && styles.groupOptionSelected]}
                      onPress={() => setSelectedGroupId(group.id)}
                    >
                      <View style={[styles.groupColorDot, { backgroundColor: group.color || '#3498db' }]} />
                      <Text style={[styles.groupOptionText, selectedGroupId === group.id && styles.groupOptionTextSelected]}>
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setIsAddVisible(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={saveMedication}>
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
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

                <View style={styles.timePickerContainer}>
                  <DateTimePicker
                    value={alarmDate}
                    mode="time"
                    is24Hour={is24Hour}
                    display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                    onChange={onTimeChange}
                    style={styles.timePickerWheel}
                    textColor="#212529"
                  />
                </View>

                <View style={styles.timeControlButtons}>
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

                  <TouchableOpacity
                    style={styles.formatToggleButton}
                    onPress={toggle24HourFormat}
                  >
                    <Text style={styles.formatToggleButtonText}>
                      {is24Hour ? '12-Hour' : '24-Hour'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.selectedTimeContainer}>
                  <Text style={styles.selectedTimeLabel}>Selected Time:</Text>
                  <Text style={styles.selectedTimeText}>{alarmTime}</Text>
                </View>

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
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setIsAlarmVisible(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={saveAlarm}>
                  <Text style={styles.buttonText}>Save Alarm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Connect Lights Modal */}
      <Modal
        visible={isConnectLightsVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsConnectLightsVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsConnectLightsVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                <Text style={styles.modalTitle}>Connect Lights to {selectedMedicationForLights?.name}</Text>
                <Text style={styles.modalSubtitle}>Select which lights should flash when alarm rings</Text>

                <Text style={styles.label}>Light Color</Text>
                <View style={styles.colorRow}>
                  {COLOR_CHOICES.map((c) => (
                    <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c, borderWidth: lightColor === c ? 2 : 0 }]} onPress={() => setLightColor(c)} />
                  ))}
                </View>

                <Text style={styles.label}>Available Lights</Text>
                <View style={styles.lightsRow}>
                  {lightsWithCustomNames.length === 0 ? (
                    <Text style={styles.emptyText}>No lights available. Go to Lights tab to add lights.</Text>
                  ) : (
                    lightsWithCustomNames.map((l) => (
                      <TouchableOpacity
                        key={l.id}
                        style={[styles.lightChip, selectedLightIds.includes(l.id) ? styles.lightChipSelected : null]}
                        onPress={() => toggleLightSelection(l.id)}
                      >
                        <Text style={[
                          styles.lightChipText,
                          selectedLightIds.includes(l.id) && styles.lightChipTextSelected
                        ]}>
                          {l.displayName || l.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setIsConnectLightsVisible(false)}>
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={async () => {
                    try {
                      if (!selectedMedicationForLights) return;

                      const medicationManager = MedicationManager.getInstance();
                      const allAlarms = await medicationManager.loadAlarms();
                      const medicationAlarms = allAlarms.filter(a => a.medicationId === selectedMedicationForLights.id);

                      // Update all alarms for this medication with the selected lights
                      for (const alarm of medicationAlarms) {
                        const updatedAlarm = {
                          ...alarm,
                          lightIds: selectedLightIds,
                          lightColor: lightColor,
                        };
                        await medicationManager.updateAlarm(updatedAlarm);
                      }

                      // Reschedule alarms
                      if (alarmService) {
                        await alarmService.rescheduleAllMedications();
                      }

                      await loadMedications();
                      setIsConnectLightsVisible(false);
                      Toast.show({
                        type: 'success',
                        text1: 'Lights Connected',
                        text2: `Connected ${selectedLightIds.length} light(s) to ${selectedMedicationForLights.name}`,
                      });
                    } catch (error) {
                      console.error('Error connecting lights:', error);
                      Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'Failed to connect lights',
                      });
                    }
                  }}>
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Refill Pills Modal */}
      <Modal
        visible={isRefillVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsRefillVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsRefillVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                <Text style={styles.modalTitle}>Refill Pills for {selectedMedicationForRefill?.name}</Text>

                <Text style={styles.label}>Number of Pills to Add</Text>
                <TextInput
                  placeholder="Enter number of pills"
                  keyboardType="numeric"
                  value={refillAmount}
                  onChangeText={setRefillAmount}
                  style={styles.input}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />

                <Text style={styles.modalSubtitle}>
                  Current: {selectedMedicationForRefill?.pillCount || 0} pills
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setIsRefillVisible(false)}>
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={refillPillCount}>
                    <Text style={styles.buttonText}>Refill</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        visible={isGroupModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsGroupModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsGroupModalVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                <Text style={styles.modalTitle}>Create Group</Text>
                <Text style={styles.modalSubtitle}>Organize your medications into groups (e.g., Morning, Evening, Vitamins)</Text>

                <Text style={styles.label}>Group Name</Text>
                <TextInput
                  placeholder="Enter group name (e.g., Morning Meds, Vitamins)"
                  value={groupName}
                  onChangeText={setGroupName}
                  style={styles.input}
                  autoFocus={true}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => setIsGroupModalVisible(false)}
                  >
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={saveGroup}
                  >
                    <Text style={styles.buttonText}>Create</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        visible={isEditGroupModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditGroupModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsEditGroupModalVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                <Text style={styles.modalTitle}>Edit Group</Text>

                <Text style={styles.label}>Group Name</Text>
                <TextInput
                  placeholder="Enter group name"
                  value={groupName}
                  onChangeText={setGroupName}
                  style={styles.input}
                  autoFocus={true}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => setIsEditGroupModalVisible(false)}
                  >
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={updateGroup}
                  >
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Assign Group Modal */}
      <Modal
        visible={isAssignGroupModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAssignGroupModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsAssignGroupModalVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                <Text style={styles.modalTitle}>Assign Group</Text>
                <Text style={styles.modalSubtitle}>
                  Select a group for {selectedMedicationForGroup?.name}
                </Text>

                <Text style={styles.label}>Select Group</Text>
                <View style={styles.groupSelectionContainer}>
                  <TouchableOpacity
                    style={[styles.groupOption, !selectedMedicationForGroup?.groupId && styles.groupOptionSelected]}
                    onPress={() => {
                      assignMedicationToGroup(null);
                    }}
                  >
                    <Text style={[styles.groupOptionText, !selectedMedicationForGroup?.groupId && styles.groupOptionTextSelected]}>
                      None (Ungrouped)
                    </Text>
                  </TouchableOpacity>
                  {groups.map(group => {
                    const isSelected = selectedMedicationForGroup?.groupId === group.id;
                    return (
                      <TouchableOpacity
                        key={group.id}
                        style={[styles.groupOption, isSelected && styles.groupOptionSelected]}
                        onPress={() => {
                          assignMedicationToGroup(group.id);
                        }}
                      >
                        <View style={[styles.groupColorDot, { backgroundColor: group.color || '#3498db' }]} />
                        <Text style={[styles.groupOptionText, isSelected && styles.groupOptionTextSelected]}>
                          {group.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => setIsAssignGroupModalVisible(false)}
                  >
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating Action Button */}
      < TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (medications.length === 0) {
            Toast.show({
              type: 'info',
              text1: 'No Medications',
              text2: 'Please add a medication first',
            });
            return;
          }
          // Open modal to select medication and connect lights
          Alert.alert(
            'Connect Lights',
            'Select a medication to connect lights:',
            [
              ...medications.map(med => ({
                text: med.name,
                onPress: () => openConnectLights(med),
              })),
              {
                text: 'Cancel',
                style: 'cancel',
              },
            ]
          );
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+ Add Lightbulb</Text>
      </TouchableOpacity >
    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 10,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  title: {
    fontSize: 28, // Using theme size roughly
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 18,
    marginBottom: 14,
    ...cardShadow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
    marginVertical: 6,
    fontWeight: '500',
  },

  // --- New Filter Pill Styles ---
  filterContainer: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  filterPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#fff',
  },

  // --- New Medication Card Styles ---
  medicationsList: {
    paddingBottom: 20,
  },
  medicationCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6, // Colored edge for group association
    ...cardShadow,
  },
  medicationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  medicationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  medGroupIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  medicationCardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    flex: 1,
  },
  medicationHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pillBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pillBadgeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  expandIconNew: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textSecondary,
  },

  // --- Stats and Action Area ---
  medicationStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  medicationStatText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  medicationStatValue: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  lowPillBanner: {
    backgroundColor: '#FFEAA7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  lowPillWarning: {
    fontSize: 14,
    color: '#D35400',
    fontWeight: '800',
    textAlign: 'center',
  },
  medicationHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  // removed old medicationDetails and lowPillWarning as they were replaced
  alarmItem: {
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.sm,
    padding: 14,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  alarmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  alarmHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  alarmTime: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  alarmColorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  deleteAlarmButton: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    minWidth: 36,
    minHeight: 36,
  },
  deleteAlarmButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  alarmDetails: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    fontWeight: '500',
  },
  alarmLightsText: {
    fontSize: 14,
    color: colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  // --- Large Action Area Buttons ---
  actionsContainer: {
    marginTop: 20,
    marginBottom: 40,
    gap: 16,
  },
  primaryActionButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  secondaryActionText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },

  pillButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  pillButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 56,
  },
  refillButton: {
    backgroundColor: colors.cardAlt,
    borderWidth: 2,
    borderColor: colors.border,
  },
  pillButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  connectedLightsContainer: {
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectedLightsLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  noLightsText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
    fontWeight: '500',
  },
  connectedLightsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  connectedLightChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 36,
    justifyContent: 'center',
  },
  connectedLightChipText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    flex: 1,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.80,
    ...cardShadow,
  },
  modalContainerFixed: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.75,
    ...cardShadow,
  },
  modalScrollView: {
    flexShrink: 1,
  },
  modalScrollContent: {
    paddingBottom: 10,
    paddingTop: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 24,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 16,
    fontSize: 18,
    color: colors.textPrimary,
    minHeight: 56,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    borderColor: colors.border,
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
    marginBottom: 10,
  },
  lightChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: borderRadius.lg, // Make pills a bit rounder
    backgroundColor: colors.cardAlt,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  lightChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  lightChipText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryButton: {
    backgroundColor: colors.textSecondary,
    shadowColor: colors.textSecondary,
  },
  editButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  editButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  addAlarmButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  addAlarmButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  connectLightsButton: {
    backgroundColor: colors.warning,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  connectLightsButtonText: {
    color: '#2D3436', // Dark text on warning yellow/orange
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 90,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '700',
  },
  timePickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timePickerLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 5,
    fontWeight: '700',
  },
  pickerWheel: {
    height: 150,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
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
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
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
    color: colors.textSecondary,
    fontWeight: '500',
  },
  pickerItemTextSelected: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  timeSeparator: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    marginHorizontal: 10,
    marginTop: 30,
  },
  timePickerContainer: {
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.md,
    padding: 10,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 180,
  },
  timePickerWheel: {
    width: '100%',
    height: 160,
  },
  timeControlButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  selectedTimeContainer: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    padding: 10,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.primary, // using primary as border for selected
  },
  selectedTimeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  selectedTimeText: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ampmButton: {
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 8,
    minWidth: 60,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  ampmButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ampmButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  ampmButtonTextActive: {
    color: 'white',
  },
  formatToggleButton: {
    backgroundColor: colors.textSecondary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  formatToggleButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },

  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.cardAlt,
    marginRight: 6,
    marginBottom: 6,
    minHeight: 40,
    justifyContent: 'center',
  },
  dayChipSelected: {
    backgroundColor: colors.primary,
  },
  dayChipText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: colors.primary, // or accent if you want it to pop more
    borderRadius: 28,
    width: 160,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: -8,
  },
  modalContainerCompact: {
    width: '85%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
  },
  lightChipTextSelected: {
    color: 'white',
  },
  // Group Styles
  groupContainer: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.sm,
    padding: 0,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.card,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
    minHeight: 60,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupColorIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 10,
    flex: 1,
  },
  groupMedicationCount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 8,
  },
  expandIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 8,
    minWidth: 24,
  },
  groupHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  editGroupButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editGroupButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  deleteGroupButton: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteGroupButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  groupMedications: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  groupButton: {
    backgroundColor: '#9b59b6', // or any static color for generic groups as long as the content stands out
    borderRadius: borderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  groupButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  groupSelectionContainer: {
    marginBottom: 10,
  },
  groupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.sm,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 52,
  },
  groupOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  groupColorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  groupOptionText: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  groupOptionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
});

