import React, { useRef, useCallback } from 'react';
import { View, Animated } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

const TAB_ROUTES = ['Home', 'Medications', 'Adherence', 'Lights', 'Feedback'];
const SWIPE_THRESHOLD = 50;

export default function SwipeableTabWrapper({ children }) {
  const navigation = useNavigation();
  const route = useRoute();

  // Create animated values for fade and slide transitions
  const fadeAnim = useRef(new Animated.Value(0.9)).current;
  const translateYAnim = useRef(new Animated.Value(10)).current;

  useFocusEffect(
    useCallback(() => {
      // Reset values before animating
      fadeAnim.setValue(0.9);
      translateYAnim.setValue(10);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        })
      ]).start();

      return () => {
        // Optional: cleanup or reverse animation when blurring
        fadeAnim.setValue(0.9);
        translateYAnim.setValue(10);
      };
    }, [fadeAnim, translateYAnim])
  );

  const getCurrentRouteName = () => {
    if (route.name === 'MedicationsList') return 'Medications';
    if (route.name === 'LightsList') return 'Lights';
    if (route.name === 'Feedback') return 'Feedback';
    return route.name;
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      const currentRouteName = getCurrentRouteName();
      const currentIndex = TAB_ROUTES.indexOf(currentRouteName);

      const isSwipeLeft = translationX < -SWIPE_THRESHOLD || velocityX < -500;
      const isSwipeRight = translationX > SWIPE_THRESHOLD || velocityX > 500;

      if ((isSwipeLeft || isSwipeRight) && currentIndex !== -1) {
        const parentNav = navigation.getParent();
        const targetNav = parentNav || navigation;

        if (isSwipeLeft && currentIndex < TAB_ROUTES.length - 1) {
          targetNav.navigate(TAB_ROUTES[currentIndex + 1]);
        } else if (isSwipeRight && currentIndex > 0) {
          targetNav.navigate(TAB_ROUTES[currentIndex - 1]);
        }
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={{
        flex: 1,
        opacity: fadeAnim,
        transform: [{ translateY: translateYAnim }]
      }}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
