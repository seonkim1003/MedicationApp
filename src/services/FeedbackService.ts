import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'user_feedback';

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

  async saveFeedback(feedback: Omit<Feedback, 'id' | 'timestamp'>): Promise<void> {
    try {
      const feedbacks = await this.loadFeedbacks();
      const newFeedback: Feedback = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...feedback,
      };
      feedbacks.push(newFeedback);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(feedbacks));
      console.log('Feedback saved:', newFeedback.id);
    } catch (error) {
      console.error('Error saving feedback:', error);
      throw error;
    }
  }

  async loadFeedbacks(): Promise<Feedback[]> {
    try {
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
      const feedbacks = await this.loadFeedbacks();
      const filtered = feedbacks.filter(f => f.id !== feedbackId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      console.log('Feedback deleted:', feedbackId);
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

