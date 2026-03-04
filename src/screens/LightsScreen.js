import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import SmartLightService from '../services/SmartLightService';
import LightNameService from '../services/LightNameService';
import { colors, cardShadow, borderRadius } from '../theme';

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

  const loadLights = async (forceReload = false) => {
    try {
      setIsLoading(true);
      const smartLightService = SmartLightService.getInstance();
      // Use reloadLightDiscovery for forced refresh, otherwise use regular getSmartLights
      const { lights: loadedLights, error } = forceReload
        ? await smartLightService.reloadLightDiscovery()
        : await smartLightService.getSmartLights();
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
                  <View style={[styles.statusIndicator, { backgroundColor: light.isOnline ? colors.success : colors.danger }]} />
                </View>
                <Text style={styles.lightDetails}>
                  Status: {light.isOnline ? 'Online' : 'Offline'} |
                  Power: {light.isOn ? 'ON' : 'OFF'} |
                  Brightness: {light.brightness}%
                </Text>
                <View style={[styles.colorPreview, { backgroundColor: light.color }]} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.button} onPress={() => loadLights(true)}>
            <Text style={styles.buttonText}>Reload Light Discovery</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  loadingText: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 50,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    color: colors.textPrimary,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 24,
    ...cardShadow,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
    fontWeight: '500',
  },
  lightItem: {
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.md,
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
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  lightDetails: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 10,
    fontWeight: '500',
  },
  colorPreview: {
    width: '100%',
    height: 24,
    borderRadius: borderRadius.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: 16,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
});


