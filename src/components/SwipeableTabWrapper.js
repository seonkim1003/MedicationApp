import React from 'react';
import { View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useNavigation, useRoute } from '@react-navigation/native';

const TAB_ROUTES = ['Home', 'Medications', 'Calendar', 'Statistics', 'Lights'];
const SWIPE_THRESHOLD = 50; // Minimum distance to trigger navigation

export default function SwipeableTabWrapper({ children }) {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get the current route name - handle nested navigators
  const getCurrentRouteName = () => {
    if (route.name === 'MedicationsList') return 'Medications';
    if (route.name === 'LightsList') return 'Lights';
    return route.name;
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      const currentRouteName = getCurrentRouteName();
      const currentIndex = TAB_ROUTES.indexOf(currentRouteName);

      // Determine if swipe was significant enough
      const isSwipeLeft = translationX < -SWIPE_THRESHOLD || velocityX < -500;
      const isSwipeRight = translationX > SWIPE_THRESHOLD || velocityX > 500;

      if ((isSwipeLeft || isSwipeRight) && currentIndex !== -1) {
        // Get parent navigator (tab navigator) if in a nested stack
        const parentNav = navigation.getParent();
        const targetNav = parentNav || navigation;
        
        if (isSwipeLeft && currentIndex < TAB_ROUTES.length - 1) {
          // Swipe left - go to next tab
          targetNav.navigate(TAB_ROUTES[currentIndex + 1]);
        } else if (isSwipeRight && currentIndex > 0) {
          // Swipe right - go to previous tab
          targetNav.navigate(TAB_ROUTES[currentIndex - 1]);
        }
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </GestureDetector>
  );
}
