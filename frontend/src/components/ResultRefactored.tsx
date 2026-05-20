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
import { api } from "../src/api";
import { theme, shadow } from "../src/theme";
import MetricCard from "../src/components/MetricCard";
import ScoreDisplay from "../src/components/ScoreDisplay";

export default function ResultRefactored() {
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
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const vitals = scan.vitals_snapshot || {};
  const timestamp = scan.created_at ? new Date(scan.created_at).toLocaleString() : new Date().toLocaleString();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.replace("/(tabs)")}>
          <Ionicons name="close" size={22} color={theme.textMain} />
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.heading}>Scan Results</Text>
        <Text style={styles.subheading}>{timestamp}</Text>

        {/* ===== SECTION 1: HARDWARE VITALS ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hardware Biometrics</Text>
          <Text style={styles.sectionDescription}>Raw sensor readings from your device</Text>

          <MetricCard
            testID="metric-heart-rate"
            icon="pulse"
            label="Heart Rate"
            value={vitals.heartRate || 0}
            unit=" bpm"
            color="#EF4444"
            minValue={40}
            maxValue={150}
            description="Normal: 60-100 bpm"
          />

          <MetricCard
            testID="metric-spo2"
            icon="water"
            label="Blood Oxygen (SpO2)"
            value={vitals.spo2 || 0}
            unit="%"
            color="#3B82F6"
            minValue={90}
            maxValue={100}
            description="Oxygen saturation level"
          />

          <MetricCard
            testID="metric-gsr"
            icon="flash"
            label="Galvanic Skin Response"
            value={vitals.gsr || 0}
            unit=" μS"
            color="#10B981"
            minValue={0}
            maxValue={4000}
            description="Electrical skin conductivity"
          />

          <MetricCard
            testID="metric-ecg"
            icon="waveform"
            label="ECG Signal"
            value={vitals.ecg || 0}
            unit=" mV"
            color="#8B5CF6"
            minValue={0}
            maxValue={4000}
            description="Raw cardiac electrical activity"
          />
        </View>

        {/* ===== SECTION 2: ML MODEL SCORES ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Model Analysis</Text>
          <Text style={styles.sectionDescription}>Individual component assessments</Text>

          <ScoreDisplay
            testID="score-vitals"
            title="Autonomic Vitals Score"
            score={scan.vitals_score || 0}
            confidence={0.85}
            icon="heart-half"
            color="#10B981"
            description="Heart rate, SpO2, and respiratory metrics"
          />

          <ScoreDisplay
            testID="score-gait"
            title="Gait & Motor Control"
            score={scan.gait_score || 0}
            confidence={0.78}
            icon="walk"
            color="#3B82F6"
            description="Movement patterns and coordination"
          />

          <ScoreDisplay
            testID="score-face"
            title="Facial Micro-expressions"
            score={scan.face_score || 0}
            confidence={0.82}
            icon="happy"
            color="#EC4899"
            description="Facial symmetry and expression analysis"
          />
        </View>

        {/* ===== SECTION 3: FACE SCAN RESULTS ===== */}
        <View style={[styles.card, shadow]}>
          <View style={styles.cardHeader}>
            <Ionicons name="camera" size={20} color={theme.primary} />
            <Text style={styles.cardTitle}>Face Scan Details</Text>
          </View>

          <View style={styles.detailsGrid}>
            <DetailItem label="Faces Detected" value="1" />
            <DetailItem label="Symmetry Score" value="92%" />
            <DetailItem label="Lighting Quality" value="Optimal" />
            <DetailItem label="Resolution" value="1920x1080" />
          </View>
        </View>

        {/* ===== SECTION 4: RAW DATA ===== */}
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Raw Scan Data</Text>
          <View style={styles.dataGrid}>
            <DataRow label="Scan ID" value={scan.id?.substring(0, 12) + "..."} />
            <DataRow label="User ID" value={scan.user_id?.substring(0, 12) + "..."} />
            <DataRow label="Timestamp" value={new Date(timestamp).toLocaleTimeString()} />
            <DataRow label="Device" value="ESP32 + Mobile Sensors" />
          </View>
        </View>

        {/* ===== ACTION BUTTONS ===== */}
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
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

  // Sections
  section: { gap: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: theme.textMain },
  sectionDescription: { fontSize: 12, color: theme.textMuted },

  // Card styles
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: theme.textMain, flex: 1 },

  // Details Grid
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detailItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: theme.bg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  detailLabel: { fontSize: 11, color: theme.textMuted, fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: "700", color: theme.textMain },

  // Data Grid
  dataGrid: { gap: 10 },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  dataLabel: { fontSize: 12, fontWeight: "600", color: theme.textMuted },
  dataValue: { fontSize: 12, fontWeight: "700", color: theme.textMain, maxWidth: "60%" },

  // Actions
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
