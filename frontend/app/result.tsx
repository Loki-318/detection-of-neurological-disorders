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
import { theme, shadow } from "../src/theme";

function MetricBox({
  label,
  value,
  unit = "",
  icon,
  color,
  testID,
}: {
  label: string;
  value: number | string;
  unit?: string;
  icon: string;
  color: string;
  testID: string;
}) {
  return (
    <View style={[styles.metricBox, shadow]} testID={testID}>
      <View style={[styles.metricIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value}
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </Text>
    </View>
  );
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const s = await api.latestScan();
        setScan(s);
      } catch (err) {
        console.warn("Error fetching scan:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerContainer}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!scan) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No scan data available</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const vitals = scan.vitals_snapshot || {};
  const timestamp = scan.created_at
    ? new Date(scan.created_at).toLocaleString()
    : new Date().toLocaleString();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.replace("/(tabs)")}
          testID="result-close-button"
        >
          <Ionicons name="close" size={22} color={theme.textMain} />
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.heading}>Scan Results</Text>
        <Text style={styles.subheading}>
          {timestamp}
        </Text>

        {/* Live Vitals Section */}
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Live Biometric Data</Text>
          
          <View style={styles.metricsGrid}>
            <MetricBox
              testID="metric-heart-rate"
              label="Heart Rate"
              value={vitals.heartRate || 0}
              unit=" bpm"
              icon="pulse"
              color="#EF4444"
            />
            <MetricBox
              testID="metric-spo2"
              label="SpO2"
              value={vitals.spo2 || 0}
              unit="%"
              icon="water"
              color="#3B82F6"
            />
            <MetricBox
              testID="metric-gsr"
              label="GSR"
              value={vitals.gsr || 0}
              icon="flash"
              color="#10B981"
            />
            <MetricBox
              testID="metric-ecg"
              label="ECG"
              value={vitals.ecg || 0}
              icon="waveform"
              color="#8B5CF6"
            />
          </View>

          {/* Detailed Bars */}
          <View style={styles.barsSection}>
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
        </View>

        {/* Model Predictions Section (Placeholder) */}
        <View style={[styles.card, shadow]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Model Analysis</Text>
            <View style={[styles.badge, { backgroundColor: theme.primaryLight }]}>
              <Text style={styles.badgeText}>Pending</Text>
            </View>
          </View>
          <Text style={styles.placeholderText}>
            Model predictions will be displayed here once the scan image is processed through the analysis pipeline.
          </Text>
          
          {/* Placeholder for model results */}
          <View style={styles.modelResults}>
            <Text style={styles.modelResultLabel}>Classification:</Text>
            <Text style={styles.modelResultValue}>--</Text>
            
            <Text style={styles.modelResultLabel}>Confidence:</Text>
            <Text style={styles.modelResultValue}>--</Text>
            
            <Text style={styles.modelResultLabel}>Processing Time:</Text>
            <Text style={styles.modelResultValue}>--</Text>
          </View>
        </View>

        {/* Raw Data Display */}
        {scan && (
          <View style={[styles.card, shadow]}>
            <Text style={styles.cardTitle}>Raw Scan Data</Text>
            <View style={styles.rawDataContainer}>
              <RawDataRow label="Scan ID" value={scan.id || "N/A"} />
              <RawDataRow label="User ID" value={scan.user_id || "N/A"} />
              <RawDataRow label="Timestamp" value={timestamp} />
              {scan.vitals_score !== undefined && (
                <RawDataRow label="Vitals Score" value={scan.vitals_score} />
              )}
              {scan.gait_score !== undefined && (
                <RawDataRow label="Gait Score" value={scan.gait_score} />
              )}
              {scan.face_score !== undefined && (
                <RawDataRow label="Face Score" value={scan.face_score} />
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.replace("/(tabs)/scan")}
            testID="result-new-scan-button"
          >
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>New Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
            onPress={() => router.replace("/(tabs)/history")}
            testID="result-history-button"
          >
            <Ionicons name="time" size={20} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>View History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RawDataRow({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.rawDataRow}>
      <Text style={styles.rawDataLabel}>{label}</Text>
      <Text style={styles.rawDataValue}>{String(value).substring(0, 40)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 20, gap: 18, paddingBottom: 40 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 16, color: theme.textMain, marginBottom: 20 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.primary,
    borderRadius: 999,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
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
  subheading: { fontSize: 13, color: theme.textMuted, marginTop: -8 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: theme.textMain },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: theme.primary, textTransform: "uppercase" },
  placeholderText: { fontSize: 13, color: theme.textMuted, lineHeight: 18 },
  modelResults: {
    backgroundColor: theme.bg,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  modelResultLabel: { fontSize: 12, fontWeight: "600", color: theme.textMuted, textTransform: "uppercase" },
  modelResultValue: { fontSize: 16, fontWeight: "700", color: theme.textMain },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 8,
  },
  metricBox: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: theme.bg,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricLabel: { fontSize: 11, color: theme.textMuted, fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  metricValue: { fontSize: 18, fontWeight: "800", color: theme.textMain },
  unit: { fontSize: 12, fontWeight: "600" },
  barsSection: { gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border },
  barWrap: { gap: 8 },
  barHeader: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 13, color: theme.textMain, fontWeight: "600" },
  barValue: { fontSize: 13, color: theme.textMain, fontWeight: "700" },
  barTrack: {
    height: 10,
    backgroundColor: theme.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999 },
  rawDataContainer: { gap: 8 },
  rawDataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rawDataLabel: { fontSize: 12, fontWeight: "600", color: theme.textMuted },
  rawDataValue: { fontSize: 12, fontWeight: "700", color: theme.textMain, maxWidth: "60%" },
  actions: { gap: 12, flexDirection: "row" },
  actionBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadow,
  },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});