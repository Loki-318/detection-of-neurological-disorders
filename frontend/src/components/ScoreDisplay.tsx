import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, shadow } from "../theme";

interface ScoreDisplayProps {
  title: string;
  score: number;
  confidence?: number;
  icon: string;
  color: string;
  testID?: string;
  description?: string;
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 50) return "Poor";
  return "Very Poor";
}

export default function ScoreDisplay({
  title,
  score,
  confidence,
  icon,
  color,
  testID,
  description,
}: ScoreDisplayProps) {
  const label = getScoreLabel(score);
  const percentage = score / 100;

  return (
    <View style={[styles.card, shadow]} testID={testID}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: color + "22" }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
      </View>

      <View style={styles.scoreSection}>
        <View style={styles.scoreDisplay}>
          <Text style={[styles.score, { color }]}>{score}</Text>
          <Text style={styles.scoreLabel}>{label}</Text>
        </View>

        {/* Circular Progress */}
        <View style={styles.circleContainer}>
          <View
            style={[
              styles.circleProgress,
              {
                backgroundColor: color,
                height: "100%",
                width: "100%",
                transform: [
                  {
                    scaleY: percentage,
                  },
                ],
              },
            ]}
          />
        </View>
      </View>

      {/* Confidence Bar */}
      {confidence !== undefined && (
        <View style={styles.confidenceSection}>
          <View style={styles.confidenceHeader}>
            <Text style={styles.confidenceLabel}>Confidence</Text>
            <Text style={styles.confidenceValue}>{Math.round(confidence * 100)}%</Text>
          </View>
          <View style={styles.confidenceTrack}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${confidence * 100}%`,
                  backgroundColor: confidence > 0.8 ? "#10B981" : confidence > 0.6 ? "#F59E0B" : "#EF4444",
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.textMain,
    marginBottom: 2,
  },
  description: {
    fontSize: 11,
    color: theme.textMuted,
  },
  scoreSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 12,
  },
  scoreDisplay: {
    flex: 1,
  },
  score: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
  },
  scoreLabel: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "600",
    marginTop: 2,
  },
  circleContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: theme.border,
  },
  circleProgress: {
    borderRadius: 40,
    originY: 1,
  },
  confidenceSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  confidenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textMain,
  },
  confidenceTrack: {
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 2,
  },
});
