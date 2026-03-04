import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import FeedbackService from '../services/FeedbackService';
import Toast from 'react-native-toast-message';
import { colors, cardShadow, borderRadius } from '../theme';

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
            Tips for better feedback:
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
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 20,
    ...cardShadow,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 10,
    fontWeight: '500',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 10,
  },
  starButton: {
    padding: 6,
    minWidth: 50,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    fontSize: 44,
    color: colors.border,
  },
  starFilled: {
    color: colors.warning,
  },
  ratingText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textPrimary,
    marginTop: 10,
  },
  feedbackInput: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: 14,
    fontSize: 18,
    color: colors.textPrimary,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  emailInput: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: 14,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 10,
    minHeight: 48,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  viewFeedbackButton: {
    backgroundColor: colors.textSecondary,
    borderRadius: borderRadius.md,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  viewFeedbackButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  infoItem: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 6,
    lineHeight: 24,
    fontWeight: '500',
  },
});

