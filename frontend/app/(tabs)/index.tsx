import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Switch,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/AuthContext";
import { api } from "../../src/api";
import CircularProgress from "../../src/CircularProgress";
import TrendChart from "../../src/TrendChart";
import {
  cancelReminder,
  getReminderState,
  requestNotifPermission,
  scheduleWeeklyReminder,
} from "../../src/notifications";
import { theme, shadow } from "../../src/theme";

function riskColor(score: number) {
  if (score >= 75) return theme.low;
  if (score >= 55) return theme.moderate;
  return theme.high;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  
  const [scan, setScan] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);

  // Live Feed State
  const [dbData, setDbData] = useState<any[]>([]);
  const [dataIndex, setDataIndex] = useState(0);

  // NEW: State to track if cards are clicked/expanded
  const [expandedGait, setExpandedGait] = useState(false);
  const [expandedVitals, setExpandedVitals] = useState(false);

  const load = useCallback(async () => {
    try {
      const [latest, scans, sensorData] = await Promise.all([
        api.latestScan(),
        api.listScans(),
        api.getSensorData(), // Fetching real data from MongoDB
      ]);
      setScan(latest && latest.id ? latest : null);
      setHistory(scans || []);
      setDbData(sensorData || []);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Cycle the Live Data every 2 seconds
  useEffect(() => {
    if (dbData.length === 0) return;
    const interval = setInterval(() => {
      setDataIndex((prevIndex) => (prevIndex + 1) % dbData.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [dbData]);

  // Reminder toggle logic
  useEffect(() => {
    (async () => {
      const r = await getReminderState();
      setReminderOn(r.enabled);
    })();
  }, []);

  const toggleReminder = async (on: boolean) => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Device Only",
        "Reminders require a native device. Try it in the Expo Go app on your phone."
      );
      return;
    }
    if (on) {
      const ok = await requestNotifPermission();
      if (!ok) {
        Alert.alert("Permission denied", "Enable notifications in system settings.");
        return;
      }
      await scheduleWeeklyReminder(9);
      setReminderOn(true);
    } else {
      await cancelReminder();
      setReminderOn(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Safe extraction for the hero circle
  const total = scan?.total_score ?? 0;
  const color = scan ? riskColor(total) : theme.primary;
  const label = scan?.risk_label ?? "No Scan Yet";

  // Safe extraction for live cycling data
  const currentData = dbData.length > 0 ? dbData[dataIndex] : null;
  const heartRate = currentData?.vitals?.heart_rate || 0;
  const spo2 = currentData?.vitals?.spo2 || 0;
  const ecg = currentData?.ecg || 0;
  const gsr = currentData?.gsr || 0;
  const accel = currentData?.accel;

  // Anomaly Detection Logic
  const isHeartRateHigh = heartRate > 100;
  const isSpo2Low = spo2 > 0 && spo2 < 95;
  const hasIssue = isHeartRateHigh || isSpo2Low;

  // NEW: Calculate the rolling window of the last 5 readings for the expanded view
  const liveStreamWindow = dbData.length > 0
    ? [0, 1, 2, 3, 4].map(i => dbData[(dataIndex - i + dbData.length) % dbData.length])
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.name} testID="dashboard-user-name">
              {user?.name ?? "Patient"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={logout}
            testID="logout-button"
          >
            <Ionicons name="log-out-outline" size={22} color={theme.textMain} />
          </TouchableOpacity>
        </View>

        {/* Risk Score Hero */}
        <View style={[styles.heroCard, shadow]} testID="dashboard-risk-score">
          <Text style={styles.cardLabel}>Your Overall Score</Text>
          <View style={styles.hero}>
            <CircularProgress
              score={total}
              color={color}
              label="Health Index"
              size={220}
              stroke={16}
            />
          </View>
          <View style={[styles.pill, { backgroundColor: color + "22" }]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={[styles.pillText, { color }]} testID="dashboard-risk-label">
              {label}
            </Text>
          </View>
          <Text style={styles.heroSub}>
            {scan
              ? `Based on scan from ${new Date(scan.created_at).toLocaleDateString()}`
              : "Run your first NeuroScan to see a personalized score."}
          </Text>
        </View>

        {/* LIVE FEED STATUS BANNER */}
        {dbData.length > 0 && (
          <View style={[styles.alert, { backgroundColor: hasIssue ? theme.high + "14" : theme.low + "14", borderColor: hasIssue ? theme.high + "33" : theme.low + "33" }]}>
            <Ionicons name={hasIssue ? "warning" : "pulse"} size={24} color={hasIssue ? theme.high : theme.low} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertText, { fontWeight: '700', marginBottom: 2, color: hasIssue ? theme.high : theme.low }]}>
                {hasIssue ? "Anomaly Detected" : "Vitals Normal"}
              </Text>
              <Text style={styles.alertText}>
                {hasIssue ? "Irregularities found in live sensor stream." : "Monitoring MongoDB feed actively."}
              </Text>
            </View>
          </View>
        )}

        {/* GROUPED LIVE SENSOR FEED */}
        <Text style={[styles.cardLabel, { marginTop: 8 }]}>Live Sensor Feed (Tap to expand)</Text>
        
        <View style={styles.metricsRow}>
          
          {/* Group 1: Motor & Gait (CLICKABLE) */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setExpandedGait(!expandedGait)}
            style={[styles.metric, shadow, { flex: 1 }]}
          >
            <View style={styles.cardHeaderRow}>
              <View>
                <View style={[styles.metricIcon, { backgroundColor: "#3B82F61A" }]}>
                  <Ionicons name="walk" size={18} color="#3B82F6" />
                </View>
                <Text style={styles.metricLabel}>Motor & Gait</Text>
              </View>
              <Ionicons name={expandedGait ? "chevron-up" : "chevron-down"} size={20} color={theme.textMuted} />
            </View>
            
            {accel ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.subText}><Text style={styles.boldText}>Accel X: </Text>{accel.x}</Text>
                <Text style={styles.subText}><Text style={styles.boldText}>Accel Y: </Text>{accel.y}</Text>
                <Text style={styles.subText}><Text style={styles.boldText}>Accel Z: </Text>{accel.z}</Text>
              </View>
            ) : (
              <Text style={[styles.metricValue, { marginTop: 8 }]}>—</Text>
            )}

            {/* EXPANDED LIVE STREAM */}
            {expandedGait && dbData.length > 0 && (
              <View style={styles.expandedStream}>
                <Text style={styles.streamTitle}>Live Stream</Text>
                {liveStreamWindow.map((d, i) => (
                  <View key={i} style={[styles.streamRow, { opacity: 1 - (i * 0.15) }]}>
                     <Text style={styles.streamText}>
                       X:{d?.accel?.x || 0} Y:{d?.accel?.y || 0} Z:{d?.accel?.z || 0}
                     </Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>

          {/* Group 2: Autonomic Vitals (CLICKABLE) */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setExpandedVitals(!expandedVitals)}
            style={[
              styles.metric, 
              shadow, 
              { flex: 1 },
              hasIssue && { borderColor: theme.high + "55", backgroundColor: theme.high + "0A" }
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View>
                <View style={[styles.metricIcon, { backgroundColor: hasIssue ? theme.high + "1A" : "#10B9811A" }]}>
                  <Ionicons name="heart-half" size={18} color={hasIssue ? theme.high : "#10B981"} />
                </View>
                <Text style={styles.metricLabel}>Vitals & ANS</Text>
              </View>
              <Ionicons name={expandedVitals ? "chevron-up" : "chevron-down"} size={20} color={theme.textMuted} />
            </View>
            
            {heartRate > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.subText, isHeartRateHigh && { color: theme.high, fontWeight: "700" }]}>
                  <Text style={styles.boldText}>HR: </Text>{heartRate} bpm
                </Text>
                <Text style={[styles.subText, isSpo2Low && { color: theme.high, fontWeight: "700" }]}>
                  <Text style={styles.boldText}>SpO2: </Text>{spo2}%
                </Text>
                <Text style={styles.subText}>
                  <Text style={styles.boldText}>GSR/ECG: </Text>{gsr}/{ecg}
                </Text>
              </View>
            ) : (
              <Text style={[styles.metricValue, { marginTop: 8 }]}>—</Text>
            )}

            {/* EXPANDED LIVE STREAM */}
            {expandedVitals && dbData.length > 0 && (
              <View style={styles.expandedStream}>
                <Text style={styles.streamTitle}>Live Stream</Text>
                {liveStreamWindow.map((d, i) => (
                  <View key={i} style={[styles.streamRow, { opacity: 1 - (i * 0.15) }]}>
                     <Text style={styles.streamText}>
                       HR:{d?.vitals?.heart_rate || 0} SpO2:{d?.vitals?.spo2 || 0}%
                     </Text>
                     <Text style={[styles.streamText, { fontSize: 10, marginTop: 2 }]}>
                       GSR:{d?.gsr || 0} ECG:{d?.ecg || 0}
                     </Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>

        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={styles.primaryCta}
          onPress={() => router.push("/(tabs)/scan")}
          testID="start-scan-cta"
        >
          <Ionicons name="scan" size={22} color="#fff" />
          <Text style={styles.primaryCtaText}>Start New Scan</Text>
        </TouchableOpacity>

        {/* Secondary actions */}
        <View style={styles.actionRow}>
          <ActionCard
            icon="chatbubbles"
            title="Chat with AI"
            subtitle="Analyze your results"
            onPress={() => router.push("/(tabs)/chat")}
          />
          <ActionCard
            icon="time-outline"
            title="Scan History"
            subtitle="View past records"
            onPress={() => router.push("/(tabs)/history")}
          />
        </View>

        {scan && total < 60 && (
          <View style={styles.alert} testID="dashboard-alert">
            <Ionicons name="warning" size={20} color={theme.high} />
            <Text style={styles.alertText}>
              Your score indicates elevated risk. Consider reviewing with an AI or real doctor.
            </Text>
          </View>
        )}

        {history.length >= 2 && (
          <View style={[styles.trendCard, shadow]} testID="dashboard-trend">
            <View style={styles.trendHeader}>
              <View>
                <Text style={styles.cardLabel}>Last {Math.min(history.length, 7)} Scans</Text>
                <Text style={styles.trendTitle}>Your Trend</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/history")}
                testID="view-all-trends"
              >
                <Text style={styles.trendLink}>View all</Text>
              </TouchableOpacity>
            </View>
            <TrendChart
              points={[...history]
                .slice(0, 7)
                .reverse()
                .map((s, i) => ({ label: `${i + 1}`, value: s.total_score }))}
              color={color}
              height={140}
            />
          </View>
        )}

        {/* Reminder Toggle */}
        <View style={[styles.reminderCard, shadow]} testID="reminder-card">
          <View style={styles.reminderLeft}>
            <View style={styles.reminderIcon}>
              <Ionicons name="notifications-outline" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderTitle}>Weekly Scan Reminder</Text>
              <Text style={styles.reminderSub}>
                Sundays at 9:00 AM — stay consistent with baseline tracking.
              </Text>
            </View>
          </View>
          <Switch
            value={reminderOn}
            onValueChange={toggleReminder}
            trackColor={{ false: theme.border, true: theme.primaryLight }}
            thumbColor={reminderOn ? theme.primary : "#fff"}
            testID="reminder-switch"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Sub-components
function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.action, shadow]}
      onPress={onPress}
      testID={testID}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSub}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

// Styles
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 20, paddingBottom: 32, gap: 18 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  greeting: { fontSize: 15, color: theme.textMuted, fontWeight: "500" },
  name: { fontSize: 26, fontWeight: "800", color: theme.textMain, letterSpacing: -0.5 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  heroCard: {
    backgroundColor: theme.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  hero: { marginTop: 14, marginBottom: 14 },
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
  heroSub: {
    marginTop: 10,
    fontSize: 13,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  metricsRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  metric: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: { fontSize: 22, fontWeight: "800", color: theme.textMain },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 2,
  },
  subText: { fontSize: 14, color: theme.textMain, marginBottom: 6 },
  boldText: { fontWeight: "700", color: theme.textMuted },
  
  // NEW STYLES FOR THE EXPANDED STREAM
  expandedStream: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: theme.border },
  streamTitle: { fontSize: 10, fontWeight: "800", color: theme.primary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  streamRow: { marginBottom: 8 },
  streamText: { fontSize: 11, color: theme.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  primaryCta: {
    backgroundColor: theme.primary,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...shadow,
  },
  primaryCtaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 12 },
  action: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionTitle: { fontSize: 15, fontWeight: "700", color: theme.textMain, marginBottom: 2 },
  actionSub: { fontSize: 12, color: theme.textMuted },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: theme.high + "14",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.high + "33",
  },
  alertText: { flex: 1, fontSize: 13, color: theme.textMain, lineHeight: 18 },
  trendCard: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  trendTitle: { fontSize: 18, fontWeight: "800", color: theme.textMain },
  trendLink: { fontSize: 13, fontWeight: "700", color: theme.primary },
  reminderCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  reminderLeft: { flex: 1, flexDirection: "row", gap: 12, alignItems: "center" },
  reminderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderTitle: { fontSize: 14, fontWeight: "700", color: theme.textMain },
  reminderSub: { fontSize: 12, color: theme.textMuted, marginTop: 2, lineHeight: 16 },
});