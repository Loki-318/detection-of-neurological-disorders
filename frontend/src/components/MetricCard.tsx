import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, shadow } from "../theme";

interface MetricCardProps {
  icon: string;
  label: string;
  value: number | string;
  unit?: string;
  color: string;
  minValue?: number;
  maxValue?: number;
  testID?: string;
  description?: string;
}

export default function MetricCard({
  icon,
  label,
  value,
  unit = "",
  color,
  minValue = 0,
  maxValue = 100,
  testID,
  description,
}: MetricCardProps) {
  // Calculate percentage for visualization
  const percentage = typeof value === "number" 
    ? Math.min(Math.max((value - minValue) / (maxValue - minValue), 0), 1) * 100
    : 0;

  return (
    <View style={[styles.card, shadow]} testID={testID}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: color + "22" }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.label}>{label}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
      </View>

      <View style={styles.content}>
        <Text style={[styles.value, { color }]}>
          {value}
          {unit && <Text style={styles.unit}>{unit}</Text>}
        </Text>

        {typeof value === "number" && maxValue > minValue && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${percentage}%`,
                  backgroundColor: color,
                },
              ]}
            />
          </View>
        )}

        {minValue !== undefined && maxValue !== undefined && (
          <Text style={styles.range}>
            Range: {minValue} - {maxValue}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textMain,
    marginBottom: 2,
  },
  description: {
    fontSize: 11,
    color: theme.textMuted,
  },
  content: {
    gap: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  range: {
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: "500",
  },
});
