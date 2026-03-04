// Centralized design tokens for the Medication App
// Warm, calming palette designed for readability by older users

export const colors = {
  // Primary palette
  primary: '#2A9D8F',        // Teal — main accent
  primaryLight: '#E8F5F3',   // Light teal tint for backgrounds
  primaryDark: '#21867A',    // Darker teal for pressed states

  // Secondary / Accent
  accent: '#E76F51',         // Warm coral — attention/alerts
  accentLight: '#FDEEE9',   // Light coral tint

  // Status colors
  success: '#00B894',        // Green — taken, completed
  successLight: '#E6F9F3',
  warning: '#FDCB6E',        // Amber — low pill count, snooze
  warningLight: '#FFF8E7',
  warningText: '#7D6608',
  danger: '#D63031',         // Red — missed, delete
  dangerLight: '#FCE4E4',

  // Neutrals
  background: '#F4F1EB',     // Warm cream background
  card: '#FFFFFF',           // Card surfaces
  cardAlt: '#F8F6F2',       // Slightly tinted card variant
  border: '#E8E4DD',        // Soft warm border
  borderLight: '#F0EDE7',

  // Text
  textPrimary: '#2D3436',    // Near-black for headings
  textSecondary: '#636E72',  // Medium gray for body
  textMuted: '#95A5A6',      // Light gray for labels
  textOnPrimary: '#FFFFFF',  // White text on colored backgrounds
  textOnDanger: '#FFFFFF',

  // Tab bar
  tabActive: '#2A9D8F',
  tabInactive: '#B2BEC3',
  tabBackground: '#FFFFFF',

  // Header
  headerBackground: '#2A9D8F',
  headerText: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  round: 50,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  title: 28,
  hero: 36,
};

// Reusable shadow for cards
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

// Reusable shadow for buttons
export const buttonShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};
