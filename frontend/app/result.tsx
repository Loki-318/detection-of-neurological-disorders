import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from "react-native-reanimated";
import { api } from "../src/api";
import CircularProgress from "../src/CircularProgress";
import { theme, shadow } from "../src/theme";

function riskMeta(score: number) {
  if (score >= 75) return { color: theme.low, label: "Low Risk" };
  if (score >= 55) return { color: theme.moderate, label: "Moderate Risk" };
  return { color: theme.high, label: "High Risk" };
}

function Bar({
  label,
  value,
  color,
  testID,
}: {
  label: string;
  value: number;
  color: string;
  testID: string;
}) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(value, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [value]);
  const style = useAnimatedStyle(() => ({
    width: `${w.value}%`,
  }));
  return (
    <View style={styles.barWrap} testID={testID}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { backgroundColor: color }, style]}
        />
      </View>
    </View>
  );
}

export default function Result() {
  const router = useRouter();
  const [scan, setScan] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.latestScan();
        setScan(s);
      } catch {
        // ignore
      }
    })();
  }, []);

  if (!scan) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  const meta = riskMeta(scan.total_score);
  const lowish = scan.total_score < 60;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.replace("/(tabs)")}
          testID="result-close-button"
        >
          <Ionicons name="close" size={22} color={theme.textMain} />
        </TouchableOpacity>

        <Text style={styles.heading}>Your Scan Results</Text>
        <Text style={styles.subheading}>
          Preliminary screening — not a medical diagnosis.
        </Text>

        <View style={[styles.hero, shadow]} testID="risk-result-total">
          <CircularProgress
            score={scan.total_score}
            color={meta.color}
            label="Overall Health"
            size={220}
            stroke={16}
          />
          <View style={[styles.pill, { backgroundColor: meta.color + "22" }]}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={[styles.pillText, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
        </View>

        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Breakdown</Text>
          <Bar
            testID="progress-bar-gait"
            label="Gait Analysis"
            value={scan.gait_score}
            color="#3B82F6"
          />
          <Bar
            testID="progress-bar-face"
            label="Facial Biomarkers"
            value={scan.face_score}
            color="#8B5CF6"
          />
          <Bar
            testID="progress-bar-behavior"
            label="Behavioral Signals"
            value={scan.behavior_score}
            color={theme.primary}
          />
        </View>

        {scan.ai_summary ? (
          <View style={[styles.aiCard, shadow]} testID="ai-summary-card">
            <View style={styles.aiHeader}>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={14} color={theme.primary} />
                <Text style={styles.aiBadgeText}>AI Analysis</Text>
              </View>
            </View>
            <Text style={styles.aiSummary}>{scan.ai_summary}</Text>
            {scan.ai_recommendations?.length > 0 && (
              <View style={styles.recs}>
                <Text style={styles.recsTitle}>Recommended next steps</Text>
                {scan.ai_recommendations.map((r: string, i: number) => (
                  <View key={i} style={styles.recRow} testID={`ai-rec-${i}`}>
                    <View style={styles.recNum}>
                      <Text style={styles.recNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.recText}>{r}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {lowish && (
          <View style={[styles.alert, { borderColor: meta.color + "44" }]}>
            <Ionicons name="warning" size={22} color={meta.color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Follow-up Recommended</Text>
              <Text style={styles.alertText}>
                Your results suggest early signs that warrant professional review.
                Consider booking an in-person consultation.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => router.replace("/(tabs)/chat")}
            testID="result-chat-cta"
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.primaryText}>Ask Dr. Nova</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => router.replace("/(tabs)/appointments")}
            testID="result-book-cta"
          >
            <Ionicons name="calendar" size={20} color={theme.textMain} />
            <Text style={styles.secondaryText}>Book Appointment</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          NeuroScan AI provides preliminary screening based on behavioral signals.
          Always consult a qualified physician for diagnosis.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 20, gap: 18, paddingBottom: 40 },
  closeBtn: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  heading: { fontSize: 28, fontWeight: "800", color: theme.textMain, letterSpacing: -0.5 },
  subheading: { fontSize: 14, color: theme.textMuted, marginTop: -8 },
  hero: {
    backgroundColor: theme.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    gap: 16,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: "700" },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: theme.textMain, marginBottom: 4 },
  barWrap: { gap: 8 },
  barHeader: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 14, color: theme.textMain, fontWeight: "600" },
  barValue: { fontSize: 14, color: theme.textMain, fontWeight: "700" },
  barTrack: {
    height: 10,
    backgroundColor: theme.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999 },
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
  },
  alertTitle: { fontSize: 15, fontWeight: "800", color: theme.textMain, marginBottom: 2 },
  alertText: { fontSize: 13, color: theme.textMuted, lineHeight: 18 },
  actions: { gap: 10 },
  primary: {
    backgroundColor: theme.primary,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...shadow,
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: {
    backgroundColor: theme.surface,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryText: { color: theme.textMain, fontSize: 15, fontWeight: "700" },
  disclaimer: {
    fontSize: 11,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
  },
  aiCard: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  aiHeader: { flexDirection: "row" },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.primary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  aiSummary: { fontSize: 15, color: theme.textMain, lineHeight: 22 },
  recs: { gap: 10, marginTop: 4 },
  recsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  recRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  recNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  recNumText: { fontSize: 12, fontWeight: "800", color: theme.primary },
  recText: { flex: 1, fontSize: 14, color: theme.textMain, lineHeight: 20 },
});
