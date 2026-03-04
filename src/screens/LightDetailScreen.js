import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, TextInput, Modal, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import SmartLightService from '../services/SmartLightService';
import LightNameService from '../services/LightNameService';
import Toast from 'react-native-toast-message';
import { colors, cardShadow, borderRadius } from '../theme';

export default function LightDetailScreen({ route, navigation }) {
  const { light: initialLight } = route.params;
  const [light, setLight] = useState(initialLight);
  const [isOn, setIsOn] = useState(initialLight.isOn);
  const [brightness, setBrightness] = useState(initialLight.brightness);
  const [color, setColor] = useState(initialLight.color);
  const [isUpdating, setIsUpdating] = useState(false);
  const [displayName, setDisplayName] = useState(initialLight.name);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const lightNameService = LightNameService.getInstance();

  const smartLightService = SmartLightService.getInstance();

  const COLOR_PRESETS = [
    '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF',
    '#4B0082', '#9400D3', '#FF6B6B', '#4ECDC4', '#45B7D1',
    '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#FFFFFF', '#FFD700', '#C0C0C0', '#000000'
  ];

  useEffect(() => {
    // Load custom name on mount
    loadDisplayName();

    // Refresh light state when screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      refreshLight();
      loadDisplayName();
    });
    return unsubscribe;
  }, [navigation]);

  const loadDisplayName = async () => {
    try {
      const customName = await lightNameService.getDisplayName(light.id, light.name);
      setDisplayName(customName);
    } catch (error) {
      console.error('Error loading display name:', error);
      setDisplayName(light.name);
    }
  };

  const refreshLight = async () => {
    try {
      const { lights } = await smartLightService.getSmartLights();
      const updatedLight = lights.find(l => l.id === light.id);
      if (updatedLight) {
        setLight(updatedLight);
        setIsOn(updatedLight.isOn);
        setBrightness(updatedLight.brightness);
        setColor(updatedLight.color);
        // Reload display name in case it changed
        await loadDisplayName();
      }
    } catch (error) {
      console.error('Error refreshing light:', error);
    }
  };

  const handleRename = async () => {
    try {
      if (newName.trim()) {
        await lightNameService.setCustomName(light.id, newName.trim());
        setDisplayName(newName.trim());
        setIsRenameModalVisible(false);
        setNewName('');
        Toast.show({
          type: 'success',
          text1: 'Name Updated',
          text2: `Light renamed to ${newName.trim()}`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Invalid Name',
          text2: 'Please enter a valid name',
        });
      }
    } catch (error) {
      console.error('Error renaming light:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to rename light',
      });
    }
  };

  const openRenameModal = () => {
    setNewName(displayName);
    setIsRenameModalVisible(true);
  };

  const handlePowerToggle = async (value) => {
    setIsOn(value);
    setIsUpdating(true);
    try {
      const success = await smartLightService.setDevicePower(light.id, value);
      if (success) {
        setLight(prev => ({ ...prev, isOn: value }));
        Toast.show({
          type: 'success',
          text1: value ? 'Light Turned On' : 'Light Turned Off',
        });
      } else {
        setIsOn(!value); // Revert on failure
        Toast.show({
          type: 'error',
          text1: 'Failed to control light',
        });
      }
    } catch (error) {
      console.error('Error toggling power:', error);
      setIsOn(!value);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update light',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBrightnessChange = async (value) => {
    const newBrightness = Math.round(value);
    setBrightness(newBrightness);

    // Debounce the API call
    if (isUpdating) return;
    setIsUpdating(true);

    setTimeout(async () => {
      try {
        const success = await smartLightService.setDeviceBrightness(light.id, newBrightness);
        if (success) {
          setLight(prev => ({ ...prev, brightness: newBrightness }));
        } else {
          Toast.show({
            type: 'error',
            text1: 'Failed to update brightness',
          });
        }
      } catch (error) {
        console.error('Error updating brightness:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to update brightness',
        });
      } finally {
        setIsUpdating(false);
      }
    }, 300);
  };

  const handleColorChange = async (newColor) => {
    setColor(newColor);
    setIsUpdating(true);
    try {
      const success = await smartLightService.setDeviceColor(light.id, newColor);
      if (success) {
        setLight(prev => ({ ...prev, color: newColor }));
        // Also turn on the light if it's off
        if (!isOn) {
          await handlePowerToggle(true);
        }
        Toast.show({
          type: 'success',
          text1: 'Color Updated',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed to update color',
        });
      }
    } catch (error) {
      console.error('Error updating color:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update color',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{displayName}</Text>
          <TouchableOpacity
            style={styles.renameButton}
            onPress={openRenameModal}
          >
            <Text style={styles.renameButtonText}>Rename</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>
              {light.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Power</Text>
            <Switch
              value={isOn}
              onValueChange={handlePowerToggle}
              disabled={isUpdating || !light.isOnline}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={isOn ? colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Brightness: {brightness}%</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            value={brightness}
            onValueChange={handleBrightnessChange}
            disabled={isUpdating || !light.isOnline || !isOn}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color</Text>
          <View style={styles.colorPreviewContainer}>
            <View style={[styles.colorPreview, { backgroundColor: color }]} />
            <Text style={styles.colorText}>{color}</Text>
          </View>

          <Text style={styles.label}>Color Presets</Text>
          <View style={styles.colorRow}>
            {COLOR_PRESETS.map((presetColor) => (
              <TouchableOpacity
                key={presetColor}
                style={[
                  styles.colorDot,
                  { backgroundColor: presetColor },
                  color === presetColor && styles.colorDotSelected
                ]}
                onPress={() => handleColorChange(presetColor)}
                disabled={isUpdating || !light.isOnline}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.button}
            onPress={refreshLight}
            disabled={isUpdating}
          >
            <Text style={styles.buttonText}>Refresh Status</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Rename Modal */}
      <Modal
        visible={isRenameModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsRenameModalVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Rename Light</Text>
              <Text style={styles.modalSubtitle}>Enter a custom name (e.g., Bedroom, Bathroom, Kitchen)</Text>

              <Text style={styles.label}>Light Name</Text>
              <TextInput
                placeholder="Enter light name"
                value={newName}
                onChangeText={setNewName}
                style={styles.input}
                autoFocus={true}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => setIsRenameModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleRename}
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    flex: 1,
    color: colors.textPrimary,
    marginRight: 12,
  },
  renameButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  renameButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 24,
    width: '90%',
    maxWidth: 450,
    ...cardShadow,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  label: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 10,
    marginTop: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    fontSize: 18,
    color: colors.textPrimary,
    minHeight: 48,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  secondaryButton: {
    backgroundColor: colors.textSecondary,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 24,
    ...cardShadow,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
    color: colors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  controlLabel: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 44,
    marginTop: 12,
  },
  colorPreviewContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  colorPreview: {
    width: '100%',
    height: 64,
    borderRadius: borderRadius.md,
    marginBottom: 12,
  },
  colorText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  colorDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 2.5,
    borderColor: colors.border,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: colors.primary,
    transform: [{ scale: 1.1 }],
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});

