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
  unit = "",
  max = 100,
  color,
  testID,
}: {
  label: string;
  value: number;
  unit?: string;
  max?: number;
  color: string;
  testID: string;
}) {
  const w = useSharedValue(0);
  const percentage = Math.min((value / max) * 100, 100);

  useEffect(() => {
    w.value = withTiming(percentage, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [percentage]);

  const style = useAnimatedStyle(() => ({
    width: `${w.value}%`,
  }));

  return (
    <View style={styles.barWrap} testID={testID}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}{unit}</Text>
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
  const vitals = scan.vitals_snapshot || {};

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
          Based on live biometric hardware analysis.
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

        {/* NEW: BIOMARKER BREAKDOWN CARD */}
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Neurological Biomarkers</Text>
          <Bar
            testID="progress-bar-vitals"
            label="Autonomic Vitals Score"
            value={scan.vitals_score || 0}
            color="#10B981" // Green
          />
          <Bar
            testID="progress-bar-gait"
            label="Gait & Motor Control"
            value={scan.gait_score || 0}
            color="#F59E0B" // Amber
          />
          <Bar
            testID="progress-bar-face"
            label="Facial Micro-expressions"
            value={scan.face_score || 0}
            color="#EC4899" // Pink
          />
        </View>

        {/* EXISTING: HARDWARE VITALS CARD */}
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Live Hardware Vitals</Text>
          <Bar
            testID="progress-bar-hr"
            label="Heart Rate"
            value={vitals.heartRate || 0}
            unit=" bpm"
            max={150} 
            color="#EF4444" 
          />
          <Bar
            testID="progress-bar-spo2"
            label="Oxygen Saturation (SpO2)"
            value={vitals.spo2 || 0}
            unit="%"
            max={100} 
            color="#3B82F6" 
          />
          <Bar
            testID="progress-bar-gsr"
            label="Galvanic Skin Response"
            value={vitals.gsr || 0}
            max={4000} 
            color="#10B981" 
          />
          <Bar
            testID="progress-bar-ecg"
            label="Raw ECG Signal"
            value={vitals.ecg || 0}
            max={4000} 
            color="#8B5CF6" 
          />
        </View>

        {scan.ai_summary ? (
          <View style={[styles.aiCard, shadow]} testID="ai-summary-card">
            <View style={styles.aiHeader}>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={14} color={theme.primary} />
                <Text style={styles.aiBadgeText}>System Analysis</Text>
              </View>
            </View>
            <Text style={styles.aiSummary}>{scan.ai_summary}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => router.replace("/(tabs)/chat")}
            testID="result-chat-cta"
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.primaryText}>Ask Dr. Nova</Text>
          </TouchableOpacity>
        </View>
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
});