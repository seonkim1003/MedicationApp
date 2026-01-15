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
import SmartLightService from './src/services/SmartLightService';
import AlarmService from './src/services/AlarmService';
import { initializeFirebase } from './src/services/firebase';
import HomeScreen from './src/screens/HomeScreen';
import MedicationsScreen from './src/screens/MedicationsScreen';
import LightsScreen from './src/screens/LightsScreen';
import LightDetailScreen from './src/screens/LightDetailScreen';
import AdherenceScreen from './src/screens/AdherenceScreen';
import AlarmScreen from './src/screens/AlarmScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import ViewFeedbackScreen from './src/screens/ViewFeedbackScreen';
import NotesScreen from './src/screens/NotesScreen';
import SwipeableTabWrapper from './src/components/SwipeableTabWrapper';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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
    
    let retryCount = 0;
    const maxRetries = 10;
    
    const setupNavigation = () => {
      if (navigationRef.current) {
        alarmService.setNavigationRef(navigationRef);
        alarmService.setupNotificationHandlers();
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(setupNavigation, 200);
      }
    };
    
    setTimeout(setupNavigation, 300);
  }, [alarmService]);

  useEffect(() => {
    let pendingNotification = null;

    const navigateToAlarmScreen = (data, retryCount = 0) => {
      const maxRetries = 15;
      
      if (!data || !data.medicationId) return;

      if (navigationRef.current && alarmService) {
        try {
          navigationRef.current.navigate('Alarm', {
            medicationId: data.medicationId,
            alarmId: data.alarmId,
            medicationName: data.medicationName || 'Medication',
            alarmTime: data.alarmTime,
          });
          pendingNotification = null;
        } catch (error) {
          if (retryCount < maxRetries) {
            setTimeout(() => navigateToAlarmScreen(data, retryCount + 1), 300);
          }
        }
      } else if (retryCount < maxRetries) {
        setTimeout(() => navigateToAlarmScreen(data, retryCount + 1), 300);
      }
    };

    const checkInitialNotification = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
          const data = response.notification.request.content.data;
          if (data && data.medicationId) {
            pendingNotification = data;
            navigateToAlarmScreen(data);
          }
        }
      } catch (error) {
        console.error('Error checking initial notification:', error);
      }
    };

    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        checkInitialNotification();
        if (pendingNotification) {
          navigateToAlarmScreen(pendingNotification);
        }
      }
    };

    checkInitialNotification();
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [alarmService]);

  const initializeApp = async () => {
    try {
      setIsLoading(true);

      try {
        initializeFirebase();
      } catch (error) {
        console.warn('Firebase initialization failed:', error);
      }

      const smartLightService = SmartLightService.getInstance();
      const alarmServiceInstance = AlarmService.getInstance();

      await alarmServiceInstance.initialize();
      setAlarmService(alarmServiceInstance);

      try {
        await alarmServiceInstance.rescheduleAllMedications();
      } catch (e) {
        console.warn('Failed to reschedule alarms on startup');
      }

      const { lights: loadedLights, error } = await smartLightService.getSmartLights();
      if (error) {
        Toast.show({
          type: 'warning',
          text1: 'Smart Lights',
          text2: 'Some lights may not be available',
        });
      } else {
        setLights(loadedLights);
      }
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
              if (alarmService && navigationRef.current) {
                alarmService.setNavigationRef(navigationRef);
                alarmService.setupNotificationHandlers();
                
                try {
                  const response = await Notifications.getLastNotificationResponseAsync();
                  if (response) {
                    const data = response.notification.request.content.data;
                    if (data && data.medicationId) {
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
              <Stack.Screen 
                name="Notes" 
                component={NotesScreen}
                options={{
                  presentation: 'card',
                  headerShown: true,
                  title: 'Symptom Tracking & Notes',
                  headerStyle: {
                    backgroundColor: '#17a2b8',
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
                name="Adherence" 
                options={{ 
                  tabBarLabel: 'Adherence',
                  tabBarIcon: () => <Text style={styles.tabIcon}>A</Text>
                }}
              >
                {props => (
                  <SwipeableTabWrapper>
                    <AdherenceScreen {...props} />
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
