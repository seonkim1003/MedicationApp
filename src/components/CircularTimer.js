import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const CircularTimer = ({ nextAlarmTime, size = 120, strokeWidth = 8 }) => {
  const [timeUntil, setTimeUntil] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!nextAlarmTime) {
      setTimeUntil({ hours: 0, minutes: 0, seconds: 0 });
      setProgress(0);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const alarmDate = new Date(nextAlarmTime);
      const diff = alarmDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntil({ hours: 0, minutes: 0, seconds: 0 });
        setProgress(0);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntil({ hours, minutes, seconds });

      // Calculate progress (assuming 24 hours max)
      const maxTime = 24 * 60 * 60 * 1000;
      const progressValue = Math.min(1, diff / maxTime);
      setProgress(progressValue);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [nextAlarmTime]);

  if (!nextAlarmTime) {
    return (
      <View style={styles.container}>
        <View style={[styles.circleContainer, { width: size, height: size }]}>
          <Text style={styles.noAlarmText}>No alarms scheduled</Text>
        </View>
      </View>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const formatTime = () => {
    if (timeUntil.hours > 0) {
      return `${timeUntil.hours}h ${timeUntil.minutes}m`;
    } else if (timeUntil.minutes > 0) {
      return `${timeUntil.minutes}m ${timeUntil.seconds}s`;
    } else {
      return `${timeUntil.seconds}s`;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.circleContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} style={styles.svg}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e0e0e0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#007bff"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.textContainer}>
          <Text style={styles.timeText}>{formatTime()}</Text>
          <Text style={styles.labelText}>until next alarm</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
    textAlign: 'center',
  },
  labelText: {
    fontSize: 11,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 4,
  },
  noAlarmText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
});

export default CircularTimer;


