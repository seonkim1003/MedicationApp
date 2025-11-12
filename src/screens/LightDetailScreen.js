import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, TextInput, Modal, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import SmartLightService from '../services/SmartLightService';
import LightNameService from '../services/LightNameService';
import Toast from 'react-native-toast-message';

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
            <Text style={styles.renameButtonText}>✏️ Rename</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>
              {light.isOnline ? '🟢 Online' : '🔴 Offline'}
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
              trackColor={{ false: '#767577', true: '#3498db' }}
              thumbColor={isOn ? '#fff' : '#f4f3f4'}
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
            minimumTrackTintColor="#3498db"
            maximumTrackTintColor="#ecf0f1"
            thumbTintColor="#3498db"
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
    backgroundColor: '#f5f5f5',
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
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    flex: 1,
    color: '#2c3e50',
    marginRight: 10,
  },
  renameButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  renameButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    color: '#2c3e50',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    fontSize: 16,
    color: '#212529',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#34495e',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlLabel: {
    fontSize: 16,
    color: '#34495e',
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 10,
  },
  colorPreviewContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  colorPreview: {
    width: '100%',
    height: 60,
    borderRadius: 8,
    marginBottom: 10,
  },
  colorText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    color: '#34495e',
    marginTop: 6,
    marginBottom: 6,
    fontWeight: '600',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#3498db',
    transform: [{ scale: 1.1 }],
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

