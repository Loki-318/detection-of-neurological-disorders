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
  const [appts, setAppts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);

  const load = useCallback(async () => {
    try {
      const [latest, scans, a] = await Promise.all([
        api.latestScan(),
        api.listScans(),
        api.myAppointments(),
      ]);
      setScan(latest && latest.id ? latest : null);
      setHistory(scans || []);
      setAppts(a || []);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

  const total = scan?.total_score ?? 0;
  const color = scan ? riskColor(total) : theme.primary;
  const label = scan?.risk_label ?? "No Scan Yet";

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
              {user?.name ?? "Friend"}
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

        {/* Metric cards */}
        <View style={styles.metricsRow}>
          <MetricCard
            testID="metric-card-gait"
            icon="walk-outline"
            label="Gait"
            value={scan?.gait_score ?? "—"}
            tint="#3B82F6"
          />
          <MetricCard
            testID="metric-card-face"
            icon="happy-outline"
            label="Face"
            value={scan?.face_score ?? "—"}
            tint="#8B5CF6"
          />
          <MetricCard
            testID="metric-card-behavior"
            icon="pulse-outline"
            label="Behavior"
            value={scan?.behavior_score ?? "—"}
            tint={theme.primary}
          />
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
            testID="action-chat"
            icon="chatbubbles"
            title="Chat with AI Doctor"
            subtitle="Ask questions about your results"
            onPress={() => router.push("/(tabs)/chat")}
          />
          <ActionCard
            testID="action-book"
            icon="calendar"
            title="Book Appointment"
            subtitle={`${appts.length} upcoming`}
            onPress={() => router.push("/(tabs)/appointments")}
          />
        </View>

        {scan && total < 60 && (
          <View style={styles.alert} testID="dashboard-alert">
            <Ionicons name="warning" size={20} color={theme.high} />
            <Text style={styles.alertText}>
              Your score indicates elevated risk. Consider booking an appointment with a neurologist.
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

function MetricCard({
  icon,
  label,
  value,
  tint,
  testID,
}: {
  icon: any;
  label: string;
  value: any;
  tint: string;
  testID?: string;
}) {
  return (
    <View style={[styles.metric, shadow]} testID={testID}>
      <View style={[styles.metricIcon, { backgroundColor: tint + "1A" }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

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
  metricsRow: { flexDirection: "row", gap: 10 },
  metric: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
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
