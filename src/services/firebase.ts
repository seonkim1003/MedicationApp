import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';
import { Platform } from 'react-native';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAUOKtqdgQ9Fwo_hV9KXitF5nfEtGfPQ00",
  authDomain: "medicationapp-7f91e.firebaseapp.com",
  projectId: "medicationapp-7f91e",
  storageBucket: "medicationapp-7f91e.firebasestorage.app",
  messagingSenderId: "301239378574",
  appId: "1:301239378574:web:d582b3aaeaa62652659fdf",
  measurementId: "G-SG667YW6KM"
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let analytics: Analytics | undefined;

/**
 * Initialize Firebase if not already initialized
 * @returns Firebase App instance
 */
export const initializeFirebase = (): FirebaseApp => {
  if (!app && getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
    
    // Initialize Analytics (only on web platform)
    if (Platform.OS === 'web') {
      isSupported().then((supported) => {
        if (supported) {
          try {
            analytics = getAnalytics(app);
            console.log('Firebase Analytics initialized');
          } catch (error) {
            console.warn('Firebase Analytics initialization failed:', error);
          }
        }
      }).catch((error) => {
        console.warn('Firebase Analytics not supported:', error);
      });
    }
  } else if (!app) {
    app = getApps()[0];
  }
  return app;
};

/**
 * Get Firestore database instance
 * @returns Firestore instance
 */
export const getFirestoreDB = (): Firestore => {
  if (!app) {
    initializeFirebase();
  }
  if (!db && app) {
    db = getFirestore(app);
  }
  if (!db) {
    throw new Error('Failed to initialize Firestore');
  }
  return db;
};

/**
 * Check if Firebase is properly configured
 * @returns true if Firebase config is valid, false otherwise
 */
export const isFirebaseConfigured = (): boolean => {
  return (
    firebaseConfig.apiKey !== "" &&
    firebaseConfig.projectId !== "" &&
    firebaseConfig.appId !== ""
  );
};

/**
 * Get Analytics instance (web only)
 * @returns Analytics instance or undefined
 */
export const getAnalyticsInstance = (): Analytics | undefined => {
  return analytics;
};

export default { initializeFirebase, getFirestoreDB, isFirebaseConfigured, getAnalyticsInstance };

