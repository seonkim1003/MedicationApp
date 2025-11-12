import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import SmartLightService from '../services/SmartLightService';
import LightNameService from '../services/LightNameService';

export default function LightsScreen({ navigation }) {
  const [lights, setLights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const lightNameService = LightNameService.getInstance();

  useEffect(() => {
    loadLights();
    // Set up a refresh interval
    const interval = setInterval(loadLights, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadLights = async () => {
    try {
      const smartLightService = SmartLightService.getInstance();
      const { lights: loadedLights, error } = await smartLightService.getSmartLights();
      if (error) {
        console.warn('Error loading lights:', error);
      } else {
        // Merge custom names with API names
        const lightsWithCustomNames = await Promise.all(
          loadedLights.map(async (light) => {
            const customName = await lightNameService.getDisplayName(light.id, light.name);
            return {
              ...light,
              displayName: customName,
            };
          })
        );
        setLights(lightsWithCustomNames);
      }
    } catch (error) {
      console.error('Error loading lights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading lights...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>💡 Smart Lights</Text>

        <View style={styles.section}>
          {lights.length === 0 ? (
            <Text style={styles.emptyText}>No smart lights found</Text>
          ) : (
            lights.map((light) => (
              <TouchableOpacity
                key={light.id}
                style={styles.lightItem}
                onPress={() => navigation.navigate('LightDetail', { light })}
              >
                <View style={styles.lightHeader}>
                  <Text style={styles.lightName}>{light.displayName || light.name}</Text>
                  <View style={[styles.statusIndicator, { backgroundColor: light.isOnline ? '#4CAF50' : '#F44336' }]} />
                </View>
                <Text style={styles.lightDetails}>
                  Status: {light.isOnline ? '🟢 Online' : '🔴 Offline'} | 
                  Power: {light.isOn ? 'ON' : 'OFF'} | 
                  Brightness: {light.brightness}%
                </Text>
                <View style={[styles.colorPreview, { backgroundColor: light.color }]} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.button} onPress={loadLights}>
            <Text style={styles.buttonText}>Refresh Lights</Text>
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
  emptyText: {
    fontSize: 16,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
    fontWeight: '500',
  },
  lightItem: {
    backgroundColor: '#ecf0f1',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    minHeight: 90,
  },
  lightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lightName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  lightDetails: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 10,
    fontWeight: '500',
  },
  colorPreview: {
    width: '100%',
    height: 24,
    borderRadius: 6,
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
});


