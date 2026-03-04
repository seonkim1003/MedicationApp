import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Share } from 'react-native';
import FeedbackService from '../services/FeedbackService';
import Toast from 'react-native-toast-message';
import { colors, cardShadow, borderRadius } from '../theme';

export default function ViewFeedbackScreen({ navigation }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState({ total: 0, averageRating: 0, ratings: {} });
  const [isLoading, setIsLoading] = useState(true);
  const feedbackService = FeedbackService.getInstance();

  useEffect(() => {
    loadFeedbacks();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadFeedbacks();
    });
    return unsubscribe;
  }, [navigation]);

  const loadFeedbacks = async () => {
    try {
      setIsLoading(true);
      const loadedFeedbacks = await feedbackService.loadFeedbacks();
      const loadedStats = await feedbackService.getFeedbackStats();
      setFeedbacks(loadedFeedbacks);
      setStats(loadedStats);
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load feedback',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (feedbackId) => {
    Alert.alert(
      'Delete Feedback',
      'Are you sure you want to delete this feedback?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await feedbackService.deleteFeedback(feedbackId);
              await loadFeedbacks();
              Toast.show({
                type: 'success',
                text1: 'Deleted',
                text2: 'Feedback deleted successfully',
              });
            } catch (error) {
              console.error('Error deleting feedback:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to delete feedback',
              });
            }
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Feedback',
      'Are you sure you want to delete all feedback? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await feedbackService.clearAllFeedbacks();
              await loadFeedbacks();
              Toast.show({
                type: 'success',
                text1: 'Cleared',
                text2: 'All feedback cleared',
              });
            } catch (error) {
              console.error('Error clearing feedbacks:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to clear feedback',
              });
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    try {
      const feedbackText = feedbacks.map((f, index) => {
        const date = new Date(f.timestamp).toLocaleString();
        const stars = '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating);
        return `
Feedback #${index + 1}
Date: ${date}
Rating: ${stars} (${f.rating}/5)
Email: ${f.email || 'Not provided'}
Feedback:
${f.feedback}
${'='.repeat(50)}
        `.trim();
      }).join('\n\n');

      const exportText = `FEEDBACK REPORT
Generated: ${new Date().toLocaleString()}
Total Feedback: ${feedbacks.length}
Average Rating: ${stats.averageRating.toFixed(1)}/5

${feedbackText}
      `;

      await Share.share({
        message: exportText,
        title: 'Feedback Report',
      });
    } catch (error) {
      console.error('Error exporting feedback:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to export feedback',
      });
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text key={i} style={[styles.star, i <= rating && styles.starFilled]}>
          {i <= rating ? '★' : '☆'}
        </Text>
      );
    }
    return stars;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading feedback...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Feedback Review</Text>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total Feedback</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.averageRating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Avg Rating</Text>
            </View>
          </View>
          {Object.keys(stats.ratings).length > 0 && (
            <View style={styles.ratingsBreakdown}>
              <Text style={styles.breakdownTitle}>Ratings Breakdown:</Text>
              {[5, 4, 3, 2, 1].map(rating => (
                <View key={rating} style={styles.ratingRow}>
                  <Text style={styles.ratingLabel}>{rating} stars:</Text>
                  <Text style={styles.ratingCount}>{stats.ratings[rating] || 0}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
              <Text style={styles.exportButtonText}>Export All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feedback List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            All Feedback ({feedbacks.length})
          </Text>
          {feedbacks.length === 0 ? (
            <Text style={styles.emptyText}>No feedback submitted yet</Text>
          ) : (
            feedbacks.map((item) => (
              <View key={item.id} style={styles.feedbackItem}>
                <View style={styles.feedbackHeader}>
                  <View style={styles.feedbackHeaderLeft}>
                    <Text style={styles.feedbackDate}>{formatDate(item.timestamp)}</Text>
                    <View style={styles.starsContainer}>
                      {renderStars(item.rating)}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Text style={styles.deleteButtonText}>X</Text>
                  </TouchableOpacity>
                </View>
                {item.email && (
                  <Text style={styles.feedbackEmail}>Email: {item.email}</Text>
                )}
                <Text style={styles.feedbackText}>{item.feedback}</Text>
              </View>
            ))
          )}
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
  loadingText: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 50,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    color: colors.textPrimary,
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
    marginBottom: 16,
    color: colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  ratingsBreakdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: colors.border,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  ratingCount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  exportButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    padding: 14,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  exportButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  clearButton: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.md,
    padding: 14,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  clearButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackItem: {
    backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  feedbackHeaderLeft: {
    flex: 1,
  },
  feedbackDate: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  star: {
    fontSize: 18,
    color: colors.border,
  },
  starFilled: {
    color: colors.warning,
  },
  deleteButton: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.md,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    minWidth: 36,
    minHeight: 36,
  },
  deleteButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  feedbackEmail: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 10,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  feedbackText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
    fontWeight: '500',
  },
});

