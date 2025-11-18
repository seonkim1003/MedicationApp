import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { getFirestoreDB, isFirebaseConfigured } from './firebase';

const STORAGE_KEY = 'user_feedback';
const FIRESTORE_COLLECTION = 'feedback';

export interface Feedback {
  id: string;
  feedback: string;
  email?: string;
  rating: number;
  timestamp: string;
}

class FeedbackService {
  private static instance: FeedbackService;

  private constructor() {}

  public static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService();
    }
    return FeedbackService.instance;
  }

  /**
   * Save feedback to both local storage and Firebase Firestore
   * If Firebase is not configured, it falls back to local storage only
   */
  async saveFeedback(feedback: Omit<Feedback, 'id' | 'timestamp'>): Promise<void> {
    const newFeedback: Feedback = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...feedback,
    };

    // Always save to local storage as a backup
    try {
      const feedbacks = await this.loadFeedbacks();
      feedbacks.push(newFeedback);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(feedbacks));
      console.log('Feedback saved locally:', newFeedback.id);
    } catch (error) {
      console.error('Error saving feedback locally:', error);
    }

    // Upload to Firebase if configured
    if (isFirebaseConfigured()) {
      try {
        const db = getFirestoreDB();
        const feedbackCollection = collection(db, FIRESTORE_COLLECTION);
        
        await addDoc(feedbackCollection, {
          feedback: newFeedback.feedback,
          email: newFeedback.email || null,
          rating: newFeedback.rating,
          timestamp: Timestamp.fromDate(new Date(newFeedback.timestamp)),
          createdAt: Timestamp.now(),
        });
        
        console.log('Feedback uploaded to Firebase:', newFeedback.id);
      } catch (error) {
        console.error('Error uploading feedback to Firebase:', error);
        // Don't throw error - local storage is already saved, so this is non-critical
      }
    } else {
      console.warn('Firebase not configured. Feedback saved locally only.');
    }
  }

  /**
   * Load feedbacks from local storage
   * Optionally sync with Firebase if configured
   */
  async loadFeedbacks(): Promise<Feedback[]> {
    try {
      // Try to load from Firebase first if configured
      if (isFirebaseConfigured()) {
        try {
          const db = getFirestoreDB();
          const feedbackCollection = collection(db, FIRESTORE_COLLECTION);
          const q = query(feedbackCollection, orderBy('timestamp', 'desc'));
          const querySnapshot = await getDocs(q);
          
          const firebaseFeedbacks: Feedback[] = [];
          querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const timestamp = data.timestamp?.toDate?.() || new Date(data.createdAt?.toDate?.() || Date.now());
            firebaseFeedbacks.push({
              id: docSnapshot.id,
              feedback: data.feedback || '',
              email: data.email || undefined,
              rating: data.rating || 0,
              timestamp: timestamp.toISOString(),
            });
          });

          // If Firebase has data, use it and sync to local storage
          if (firebaseFeedbacks.length > 0) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(firebaseFeedbacks));
            return firebaseFeedbacks;
          }
        } catch (error) {
          console.error('Error loading feedbacks from Firebase:', error);
          // Fall through to local storage
        }
      }

      // Fallback to local storage
      const jsonString = await AsyncStorage.getItem(STORAGE_KEY);
      if (!jsonString) {
        return [];
      }
      const feedbacks = JSON.parse(jsonString) as Feedback[];
      // Sort by timestamp (newest first)
      return feedbacks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      return [];
    }
  }

  async deleteFeedback(feedbackId: string): Promise<void> {
    try {
      // Delete from local storage
      const feedbacks = await this.loadFeedbacks();
      const filtered = feedbacks.filter(f => f.id !== feedbackId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      console.log('Feedback deleted locally:', feedbackId);

      // Delete from Firebase if configured
      if (isFirebaseConfigured()) {
        try {
          const db = getFirestoreDB();
          const feedbackDoc = doc(db, FIRESTORE_COLLECTION, feedbackId);
          await deleteDoc(feedbackDoc);
          console.log('Feedback deleted from Firebase:', feedbackId);
        } catch (error) {
          console.error('Error deleting feedback from Firebase:', error);
          // Don't throw - local deletion succeeded
        }
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
      throw error;
    }
  }

  async clearAllFeedbacks(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('All feedbacks cleared');
    } catch (error) {
      console.error('Error clearing feedbacks:', error);
      throw error;
    }
  }

  async getFeedbackStats(): Promise<{ total: number; averageRating: number; ratings: Record<number, number> }> {
    try {
      const feedbacks = await this.loadFeedbacks();
      const total = feedbacks.length;
      if (total === 0) {
        return { total: 0, averageRating: 0, ratings: {} };
      }
      const sum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
      const averageRating = sum / total;
      const ratings: Record<number, number> = {};
      for (let i = 1; i <= 5; i++) {
        ratings[i] = feedbacks.filter(f => f.rating === i).length;
      }
      return { total, averageRating, ratings };
    } catch (error) {
      console.error('Error getting feedback stats:', error);
      return { total: 0, averageRating: 0, ratings: {} };
    }
  }
}

export default FeedbackService;

