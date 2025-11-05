import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import SmartLightService from '../services/SmartLightService';
import Toast from 'react-native-toast-message';

export default function LightDetailScreen({ route, navigation }) {
  const { light: initialLight } = route.params;
  const [light, setLight] = useState(initialLight);
  const [isOn, setIsOn] = useState(initialLight.isOn);
  const [brightness, setBrightness] = useState(initialLight.brightness);
  const [color, setColor] = useState(initialLight.color);
  const [isUpdating, setIsUpdating] = useState(false);

  const smartLightService = SmartLightService.getInstance();

  const COLOR_PRESETS = [
    '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', 
    '#4B0082', '#9400D3', '#FF6B6B', '#4ECDC4', '#45B7D1',
    '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#FFFFFF', '#FFD700', '#C0C0C0', '#000000'
  ];

  useEffect(() => {
    // Refresh light state when screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      refreshLight();
    });
    return unsubscribe;
  }, [navigation]);

  const refreshLight = async () => {
    try {
      const { lights } = await smartLightService.getSmartLights();
      const updatedLight = lights.find(l => l.id === light.id);
      if (updatedLight) {
        setLight(updatedLight);
        setIsOn(updatedLight.isOn);
        setBrightness(updatedLight.brightness);
        setColor(updatedLight.color);
      }
    } catch (error) {
      console.error('Error refreshing light:', error);
    }
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
        <Text style={styles.title}>{light.name}</Text>
        
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2c3e50',
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

