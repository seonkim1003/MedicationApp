// Core data models for the medication management app
export interface Medication {
  id: string;
  name: string;
  displayName: string;
  genericName: string;
  isActive: boolean;
  pillCount: number;
  alarms: MedicationAlarm[]; // Array of alarms for this medication
  createdAt: string;
  updatedAt: string;
}

export interface SmartLight {
  id: string;
  name: string;
  isOnline: boolean;
  isOn: boolean;
  brightness: number; // 0-100
  color: string; // Hex color
  colorTemperature: number; // Kelvin
  lastUpdated: string;
}

export interface MedicationAlarm {
  id: string;
  medicationId: string;
  medicationName: string;
  time: string; // Format: "HH:mm"
  lightColor: string; // Hex color
  lightIds: string[]; // Light IDs to control
  isEnabled: boolean;
  daysOfWeek: number[]; // 1=Monday, 7=Sunday
  createdAt: string;
}

export interface AlarmSettings {
  isEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  lightEnabled: boolean;
  snoozeMinutes: number;
  maxSnoozes: number;
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  lightEnabled: boolean;
  persistentNotification: boolean;
}

export interface TuyaDeviceState {
  id: string;
  name: string;
  isOnline: boolean;
  isOn: boolean;
  brightness: number;
  color: string;
  colorTemperature: number;
  workMode: string;
  lastUpdated: string;
}

export interface TuyaCommand {
  deviceId: string;
  commands: Array<{
    code: string;
    value: any;
  }>;
}

export interface TuyaApiResponse {
  success: boolean;
  result?: any;
  error?: string;
  errorCode?: string;
}

// Predefined medication colors inspired by the Android app
export const MEDICATION_COLORS = [
  { name: 'Red', value: '#FF6B6B', description: 'Important medications' },
  { name: 'Teal', value: '#4ECDC4', description: 'Routine medications' },
  { name: 'Blue', value: '#45B7D1', description: 'Clear, easy to distinguish' },
  { name: 'Green', value: '#96CEB4', description: 'Vitamins/supplements' },
  { name: 'Yellow', value: '#FFEAA7', description: 'Bright, attention-grabbing' },
  { name: 'Purple', value: '#DDA0DD', description: 'Distinct, memorable' },
  { name: 'Mint', value: '#98D8C8', description: 'Soothing, gentle reminder' },
  { name: 'Gold', value: '#F7DC6F', description: 'Special medications' },
  { name: 'Lavender', value: '#BB8FCE', description: 'Soft, calming' },
  { name: 'Sky', value: '#85C1E9', description: 'Clear, peaceful' },
];

// Days of the week mapping
export const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 7, name: 'Sunday', short: 'Sun' },
];

// Medication History - tracks when medications were taken
export interface MedicationHistory {
  id: string;
  medicationId: string;
  medicationName: string;
  takenAt: string; // ISO timestamp
  alarmId?: string; // Optional: which alarm this was for
  wasOnTime: boolean; // Whether taken within 30 minutes of alarm
}

// Adherence Statistics
export interface AdherenceStats {
  medicationId: string;
  medicationName: string;
  totalAlarms: number;
  totalTaken: number;
  adherenceRate: number; // 0-100 percentage
  currentStreak: number; // Days in a row
  longestStreak: number;
  lastTaken?: string;
  missedDays: number;
}

// Refill Reminder
export interface RefillReminder {
  medicationId: string;
  medicationName: string;
  currentPillCount: number;
  threshold: number; // Alert when pills <= threshold
  isActive: boolean;
}
