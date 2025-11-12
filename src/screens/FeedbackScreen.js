import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import FeedbackService from '../services/FeedbackService';
import Toast from 'react-native-toast-message';

export default function FeedbackScreen({ navigation }) {
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(0);
  const feedbackService = FeedbackService.getInstance();

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Feedback Required',
        text2: 'Please enter your feedback',
      });
      return;
    }

    try {
      // Save feedback to local storage
      await feedbackService.saveFeedback({
        feedback: feedback.trim(),
        email: email.trim() || undefined,
        rating: rating || 0,
      });

      // Show success message
      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted. We appreciate your input!',
        [
          {
            text: 'OK',
            onPress: () => {
              setFeedback('');
              setEmail('');
              setRating(0);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit feedback. Please try again.',
      });
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setRating(i)}
          style={styles.starButton}
        >
          <Text style={[styles.star, i <= rating && styles.starFilled]}>
            {i <= rating ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Feedback</Text>
        <Text style={styles.subtitle}>We'd love to hear your thoughts!</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rating</Text>
          <View style={styles.starsContainer}>
            {renderStars()}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingText}>
              {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Feedback</Text>
          <TextInput
            placeholder="Tell us what you think about the app..."
            value={feedback}
            onChangeText={setFeedback}
            style={styles.feedbackInput}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email (Optional)</Text>
          <Text style={styles.sectionSubtitle}>We'll only use this to follow up on your feedback</Text>
          <TextInput
            placeholder="your.email@example.com"
            value={email}
            onChangeText={setEmail}
            style={styles.emailInput}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit Feedback</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.viewFeedbackButton} 
            onPress={() => navigation.navigate('ViewFeedback')}
          >
            <Text style={styles.viewFeedbackButtonText}>View All Feedback</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.infoText}>
            💡 Tips for better feedback:
          </Text>
          <Text style={styles.infoItem}>• Be specific about what you like or don't like</Text>
          <Text style={styles.infoItem}>• Mention any bugs or issues you've encountered</Text>
          <Text style={styles.infoItem}>• Suggest features you'd like to see</Text>
          <Text style={styles.infoItem}>• Rate your overall experience</Text>
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    color: '#6c757d',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2c3e50',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 40,
    color: '#ddd',
  },
  starFilled: {
    color: '#ffc107',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#2c3e50',
    marginTop: 8,
  },
  feedbackInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212529',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  emailInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212529',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  viewFeedbackButton: {
    backgroundColor: '#6c757d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#6c757d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  viewFeedbackButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
    lineHeight: 20,
  },
});

