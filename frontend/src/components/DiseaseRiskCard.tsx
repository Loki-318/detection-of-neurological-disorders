import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, shadow } from "../theme";

interface DiseaseRiskProps {
  diseaseName: string;
  riskScore: number; // 0-100
  confidence: number; // 0-1
  contributingFactors: string[];
  icon: string;
  color: string;
  testID?: string;
}

function getRiskLevel(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 70) {
    return {
      label: "HIGH RISK",
      color: "#EF4444",
      description: "Consult a neurologist immediately",
    };
  }
  if (score >= 50) {
    return {
      label: "MODERATE RISK",
      color: "#F59E0B",
      description: "Monitor closely and consider medical evaluation",
    };
  }
  if (score >= 30) {
    return {
      label: "MILD RISK",
      color: "#3B82F6",
      description: "Keep baseline scans and track over time",
    };
  }
  return {
    label: "LOW RISK",
    color: "#10B981",
    description: "Normal baseline",
  };
}

export default function DiseaseRiskCard({
  diseaseName,
  riskScore,
  confidence,
  contributingFactors,
  icon,
  color,
  testID,
}: DiseaseRiskProps) {
  const riskLevel = getRiskLevel(riskScore);
  const percentage = riskScore / 100;

  return (
    <View style={[styles.card, shadow]} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: color + "22" }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.diseaseName}>{diseaseName}</Text>
          <View
            style={[styles.riskBadge, { backgroundColor: riskLevel.color + "22" }]}
          >
            <Text style={[styles.riskLabel, { color: riskLevel.color }]}>
              {riskLevel.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Score Section */}
      <View style={styles.scoreSection}>
        <View style={styles.scoreDisplay}>
          <Text style={[styles.riskScore, { color }]}>{riskScore}</Text>
          <Text style={styles.scoreLabel}>Risk Score</Text>
        </View>

        {/* Circular Progress */}
        <View style={styles.circleContainer}>
          <View style={[styles.circleBackground, { borderColor: theme.border }]}>
            {/* Outer ring for background */}
            <View
              style={[
                styles.circleProgress,
                {
                  width: percentage * 100 + "%",
                  backgroundColor: riskLevel.color,
                },
              ]}
            />
          </View>
          <Text style={[styles.percentageText, { color: riskLevel.color }]}>
            {Math.round(percentage * 100)}%
          </Text>
        </View>
      </View>

      {/* Confidence */}
      <View style={styles.confidenceSection}>
        <View style={styles.confidenceHeader}>
          <Text style={styles.confidenceLabel}>Model Confidence</Text>
          <Text style={styles.confidenceValue}>
            {Math.round(confidence * 100)}%
          </Text>
        </View>
        <View style={styles.confidenceBar}>
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

      {/* Description */}
      <Text style={styles.description}>{riskLevel.description}</Text>

      {/* Contributing Factors */}
      {contributingFactors.length > 0 && (
        <View style={styles.factorsSection}>
          <Text style={styles.factorsTitle}>Contributing Factors:</Text>
          {contributingFactors.slice(0, 3).map((factor, index) => (
            <View key={index} style={styles.factorItem}>
              <Text style={styles.factorBullet}>•</Text>
              <Text style={styles.factorText}>{factor}</Text>
            </View>
          ))}
          {contributingFactors.length > 3 && (
            <Text style={styles.moreFactors}>
              +{contributingFactors.length - 3} more factors
            </Text>
          )}
        </View>
      )}

      {/* Action Button */}
      {riskScore >= 50 && (
        <View style={styles.actionSection}>
          <Text style={styles.actionText}>⚠️ Recommendation: Seek medical evaluation</Text>
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
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  diseaseName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.textMain,
    marginBottom: 4,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  riskLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  scoreSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingVertical: 12,
  },
  scoreDisplay: {
    flex: 1,
  },
  riskScore: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
  },
  scoreLabel: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: "600",
    marginTop: 2,
  },

  circleContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  circleBackground: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 8,
    borderColor: theme.border,
  },
  circleProgress: {
    position: "absolute",
    height: 8,
    borderRadius: 4,
    top: -4,
    left: 0,
  },
  percentageText: {
    fontSize: 16,
    fontWeight: "800",
    zIndex: 1,
  },

  confidenceSection: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  confidenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  confidenceBar: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 3,
  },

  description: {
    fontSize: 13,
    color: theme.textMain,
    fontWeight: "500",
    lineHeight: 18,
  },

  factorsSection: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  factorsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textMain,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  factorItem: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  factorBullet: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textMuted,
    marginTop: -2,
  },
  factorText: {
    fontSize: 12,
    color: theme.textMain,
    flex: 1,
    lineHeight: 16,
  },
  moreFactors: {
    fontSize: 11,
    color: theme.textMuted,
    fontStyle: "italic",
    marginTop: 4,
  },

  actionSection: {
    backgroundColor: "#EF444414",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
  },
});
