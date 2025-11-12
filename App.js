import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, Alert, AppState } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
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
import AlarmScreen from './src/screens/AlarmScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import ViewFeedbackScreen from './src/screens/ViewFeedbackScreen';
import SwipeableTabWrapper from './src/components/SwipeableTabWrapper';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Create a stack navigator for lights (list + detail)
function LightsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="LightsList" 
        options={{ title: 'Smart Lights' }}
      >
        {props => (
          <SwipeableTabWrapper>
            <LightsScreen {...props} />
          </SwipeableTabWrapper>
        )}
      </Stack.Screen>
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
        {props => (
          <SwipeableTabWrapper>
            <MedicationsScreen {...props} lights={lights} alarmService={alarmService} />
          </SwipeableTabWrapper>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default function App() {
  const [lights, setLights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alarmService, setAlarmService] = useState(null);
  const navigationRef = useRef();

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (!alarmService) return;
    
    // Set up navigation ref with retry logic
    let retryCount = 0;
    const maxRetries = 10;
    
    const setupNavigation = () => {
      if (navigationRef.current) {
        console.log('Setting navigation ref for alarm service');
        alarmService.setNavigationRef(navigationRef);
        alarmService.setupNotificationHandlers();
      } else if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Navigation ref not ready yet, retrying... (${retryCount}/${maxRetries})`);
        setTimeout(setupNavigation, 200);
      } else {
        console.warn('Failed to set up navigation ref after maximum retries');
      }
    };
    
    // Small delay to ensure NavigationContainer is mounted
    setTimeout(setupNavigation, 300);
  }, [alarmService]);

  // Handle app opened from notification (when app is closed/background)
  useEffect(() => {
    let pendingNotification = null;

    const navigateToAlarmScreen = (data, retryCount = 0) => {
      const maxRetries = 15;
      
      if (!data || !data.medicationId) {
        return;
      }

      if (navigationRef.current && alarmService) {
        try {
          console.log('Navigating to alarm screen from notification:', data.medicationId);
          navigationRef.current.navigate('Alarm', {
            medicationId: data.medicationId,
            alarmId: data.alarmId,
            medicationName: data.medicationName || 'Medication',
            alarmTime: data.alarmTime,
          });
          console.log('✅ Successfully navigated to alarm screen');
          pendingNotification = null; // Clear after successful navigation
        } catch (error) {
          console.error('Error navigating to alarm screen:', error);
          if (retryCount < maxRetries) {
            setTimeout(() => navigateToAlarmScreen(data, retryCount + 1), 300);
          }
        }
      } else if (retryCount < maxRetries) {
        // Retry if navigation not ready yet
        console.log(`Navigation not ready, retrying... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => navigateToAlarmScreen(data, retryCount + 1), 300);
      } else {
        console.warn('Navigation not available after max retries');
      }
    };

    const checkInitialNotification = async () => {
      try {
        // Check if app was opened from a notification
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
          const data = response.notification.request.content.data;
          console.log('📱 App opened from notification:', data);
          
          if (data && data.medicationId) {
            pendingNotification = data;
            // Try to navigate immediately
            navigateToAlarmScreen(data);
          }
        }
      } catch (error) {
        console.error('Error checking initial notification:', error);
      }
    };

    // Check when app comes to foreground
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground - check for notification
        console.log('App state changed to active, checking for notifications...');
        checkInitialNotification();
        
        // Also try to navigate if we have a pending notification
        if (pendingNotification) {
          navigateToAlarmScreen(pendingNotification);
        }
      }
    };

    // Check immediately on mount
    checkInitialNotification();

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [alarmService]);

  const initializeApp = async () => {
    try {
      console.log('Initializing MedicationRunner App...');
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
      console.log('Loading smart lights...');
      const { lights: loadedLights, error } = await smartLightService.getSmartLights();
      if (error) {
        console.warn('Error loading lights:', error);
        Toast.show({
          type: 'warning',
          text1: 'Smart Lights',
          text2: 'Some lights may not be available',
        });
      } else {
        setLights(loadedLights);
        console.log(`Loaded ${loadedLights.length} smart lights`);
      }

      console.log('App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <NavigationContainer 
            ref={navigationRef}
            onReady={async () => {
              console.log('NavigationContainer is ready');
              if (alarmService && navigationRef.current) {
                console.log('Setting navigation ref after container ready');
                alarmService.setNavigationRef(navigationRef);
                alarmService.setupNotificationHandlers();
                
                // Check for notification that opened the app after navigation is ready
                try {
                  const response = await Notifications.getLastNotificationResponseAsync();
                  if (response) {
                    const data = response.notification.request.content.data;
                    if (data && data.medicationId) {
                      console.log('Navigating to alarm screen after NavigationContainer ready');
                      setTimeout(() => {
                        try {
                          navigationRef.current?.navigate('Alarm', {
                            medicationId: data.medicationId,
                            alarmId: data.alarmId,
                            medicationName: data.medicationName || 'Medication',
                            alarmTime: data.alarmTime,
                          });
                        } catch (error) {
                          console.error('Error navigating after container ready:', error);
                        }
                      }, 500);
                    }
                  }
                } catch (error) {
                  console.error('Error checking notification after container ready:', error);
                }
              }
            }}
          >
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Main">
                {() => <MainTabs lights={lights} alarmService={alarmService} />}
              </Stack.Screen>
              <Stack.Screen 
                name="Alarm" 
                component={AlarmScreen}
                options={{
                  presentation: 'modal',
                  headerShown: false,
                  gestureEnabled: false,
                  animationEnabled: true,
                }}
              />
              <Stack.Screen 
                name="ViewFeedback" 
                component={ViewFeedbackScreen}
                options={{
                  presentation: 'card',
                  headerShown: true,
                  title: 'View Feedback',
                  headerStyle: {
                    backgroundColor: '#007bff',
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: '700',
                  },
                }}
              />
            </Stack.Navigator>
          </NavigationContainer>
          <StatusBar style="auto" />
          <Toast 
            config={{
              warning: ({ text1, text2 }) => (
                <View style={{
                  height: 60,
                  width: '90%',
                  backgroundColor: '#ffc107',
                  borderRadius: 10,
                  padding: 15,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                  elevation: 5,
                }}>
                  <View style={{ flex: 1 }}>
                    {text1 && <Text style={{ fontSize: 16, fontWeight: '700', color: '#212529', marginBottom: 4 }}>{text1}</Text>}
                    {text2 && <Text style={{ fontSize: 14, color: '#212529' }}>{text2}</Text>}
                  </View>
                </View>
              ),
            }}
          />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function MainTabs({ lights, alarmService }) {
  return (
    <Tab.Navigator
      screenOptions={{
                tabBarActiveTintColor: '#007bff',
                tabBarInactiveTintColor: '#6c757d',
                tabBarStyle: {
                  backgroundColor: 'white',
                  borderTopWidth: 1,
                  borderTopColor: '#e9ecef',
                  height: 60,
                  paddingBottom: 8,
                  paddingTop: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: -2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 8,
                },
                tabBarLabelStyle: {
                  fontSize: 12,
                  fontWeight: '600',
                  marginTop: 4,
                },
                headerStyle: {
                  backgroundColor: '#007bff',
                  elevation: 4,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: '700',
                  fontSize: 20,
                  letterSpacing: -0.3,
                },
              }}
            >
              <Tab.Screen 
                name="Home" 
                options={{ 
                  tabBarLabel: 'Home',
                  tabBarIcon: () => <Text style={styles.tabIcon}>H</Text>
                }}
              >
                {props => (
                  <SwipeableTabWrapper>
                    <HomeScreen {...props} />
                  </SwipeableTabWrapper>
                )}
              </Tab.Screen>
              <Tab.Screen 
                name="Medications" 
                options={{ 
                  tabBarLabel: 'Medications',
                  tabBarIcon: () => <Text style={styles.tabIcon}>M</Text>
                }}
              >
                {props => <MedicationsStack {...props} lights={lights} alarmService={alarmService} />}
              </Tab.Screen>
              <Tab.Screen 
                name="Calendar" 
                options={{ 
                  tabBarLabel: 'Calendar',
                  tabBarIcon: () => <Text style={styles.tabIcon}>C</Text>
                }}
              >
                {props => (
                  <SwipeableTabWrapper>
                    <CalendarScreen {...props} />
                  </SwipeableTabWrapper>
                )}
              </Tab.Screen>
              <Tab.Screen 
                name="Statistics" 
                options={{ 
                  tabBarLabel: 'Stats',
                  tabBarIcon: () => <Text style={styles.tabIcon}>S</Text>
                }}
              >
                {props => (
                  <SwipeableTabWrapper>
                    <StatisticsScreen {...props} />
                  </SwipeableTabWrapper>
                )}
              </Tab.Screen>
              <Tab.Screen 
                name="Lights" 
                component={LightsStack}
                options={{ 
                  tabBarLabel: 'Lights',
                  tabBarIcon: () => <Text style={styles.tabIcon}>L</Text>
                }}
              />
              <Tab.Screen 
                name="Feedback" 
                options={{ 
                  tabBarLabel: 'Feedback',
                  tabBarIcon: () => <Text style={styles.tabIcon}>F</Text>
                }}
              >
                {props => (
                  <SwipeableTabWrapper>
                    <FeedbackScreen {...props} />
                  </SwipeableTabWrapper>
                )}
              </Tab.Screen>
            </Tab.Navigator>
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
    fontSize: 22,
    fontWeight: '600',
    color: '#6c757d',
  },
});
