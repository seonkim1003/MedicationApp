import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Toast from 'react-native-toast-message';

// Import services
import SmartLightService from './src/services/SmartLightService';
import AlarmService from './src/services/AlarmService';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import MedicationsScreen from './src/screens/MedicationsScreen';
import LightsScreen from './src/screens/LightsScreen';
import LightDetailScreen from './src/screens/LightDetailScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import CalendarScreen from './src/screens/CalendarScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Create a stack navigator for lights (list + detail)
function LightsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="LightsList" 
        component={LightsScreen}
        options={{ title: 'Smart Lights' }}
      />
      <Stack.Screen 
        name="LightDetail" 
        component={LightDetailScreen}
        options={{ title: 'Light Control' }}
      />
    </Stack.Navigator>
  );
}

// Medications stack
function MedicationsStack({ lights, alarmService }) {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MedicationsList" 
        options={{ title: 'Medications' }}
      >
        {props => <MedicationsScreen {...props} lights={lights} alarmService={alarmService} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default function App() {
  const [lights, setLights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alarmService, setAlarmService] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing MedicationRunner App...');
      setIsLoading(true);

      // Initialize services
      const smartLightService = SmartLightService.getInstance();
      const alarmServiceInstance = AlarmService.getInstance();

      // Initialize alarm service
      await alarmServiceInstance.initialize();
      setAlarmService(alarmServiceInstance);

      // Reschedule alarms
      try {
        await alarmServiceInstance.rescheduleAllMedications();
      } catch (e) {
        console.warn('Failed to reschedule alarms on startup');
      }

      // Load smart lights
      console.log('💡 Loading smart lights...');
      const { lights: loadedLights, error } = await smartLightService.getSmartLights();
      if (error) {
        console.warn('⚠️ Error loading lights:', error);
        Toast.show({
          type: 'warning',
          text1: 'Smart Lights',
          text2: 'Some lights may not be available',
        });
      } else {
        setLights(loadedLights);
        console.log(`✅ Loaded ${loadedLights.length} smart lights`);
      }

      // Setup notification handlers
      alarmServiceInstance.setupNotificationHandlers();

      console.log('✅ App initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      Alert.alert(
        'Initialization Error',
        'Failed to initialize the app. Some features may not work properly.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <PaperProvider>
          <View style={styles.container}>
            <Text style={styles.loadingText}>Loading MedicationRunner...</Text>
            <StatusBar style="auto" />
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              tabBarActiveTintColor: '#3498db',
              tabBarInactiveTintColor: '#95a5a6',
              headerStyle: {
                backgroundColor: '#3498db',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          >
            <Tab.Screen 
              name="Home" 
              component={HomeScreen}
              options={{ 
                tabBarLabel: 'Home',
                tabBarIcon: () => <Text style={styles.tabIcon}>🏠</Text>
              }}
            />
            <Tab.Screen 
              name="Medications" 
              options={{ 
                tabBarLabel: 'Medications',
                tabBarIcon: () => <Text style={styles.tabIcon}>💊</Text>
              }}
            >
              {props => <MedicationsStack {...props} lights={lights} alarmService={alarmService} />}
            </Tab.Screen>
            <Tab.Screen 
              name="Calendar" 
              component={CalendarScreen}
              options={{ 
                tabBarLabel: 'Calendar',
                tabBarIcon: () => <Text style={styles.tabIcon}>📅</Text>
              }}
            />
            <Tab.Screen 
              name="Statistics" 
              component={StatisticsScreen}
              options={{ 
                tabBarLabel: 'Stats',
                tabBarIcon: () => <Text style={styles.tabIcon}>📊</Text>
              }}
            />
            <Tab.Screen 
              name="Lights" 
              component={LightsStack}
              options={{ 
                tabBarLabel: 'Lights',
                tabBarIcon: () => <Text style={styles.tabIcon}>💡</Text>
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
        <StatusBar style="auto" />
        <Toast />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
  },
  tabIcon: {
    fontSize: 20,
  },
});
