import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import TrendChart from "../../src/TrendChart";
import { theme, shadow } from "../../src/theme";

function riskColor(v: number) {
  if (v >= 75) return theme.low;
  if (v >= 55) return theme.moderate;
  return theme.high;
}

export default function History() {
  const router = useRouter();
  const [scans, setScans] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.listScans();
      setScans(s);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Oldest to newest for trend chart
  const ordered = [...scans].reverse();
  const totalPoints = ordered.map((s, i) => ({
    label: `#${i + 1}`,
    value: s.total_score,
  }));
  const gaitPoints = ordered.map((s, i) => ({
    label: `#${i + 1}`,
    value: s.gait_score,
  }));
  const facePoints = ordered.map((s, i) => ({
    label: `#${i + 1}`,
    value: s.face_score,
  }));
  const behaviorPoints = ordered.map((s, i) => ({
    label: `#${i + 1}`,
    value: s.behavior_score,
  }));

  const best = scans.length ? Math.max(...scans.map((s) => s.total_score)) : 0;
  const worst = scans.length ? Math.min(...scans.map((s) => s.total_score)) : 0;
  const avg = scans.length
    ? Math.round(scans.reduce((a, s) => a + s.total_score, 0) / scans.length)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <Text style={styles.title}>Your Trends</Text>
        <Text style={styles.subtitle}>
          Track how your neurological health evolves over time.
        </Text>

        {scans.length === 0 ? (
          <View style={[styles.emptyCard, shadow]} testID="history-empty">
            <Ionicons name="pulse" size={32} color={theme.primary} />
            <Text style={styles.emptyTitle}>No scans yet</Text>
            <Text style={styles.emptyText}>
              Run your first NeuroScan to start tracking your cognitive baseline.
            </Text>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => router.push("/(tabs)/scan")}
              testID="history-start-scan"
            >
              <Text style={styles.emptyCtaText}>Start Scan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.stats}>
              <StatCard label="Scans" value={scans.length} tint={theme.primary} />
              <StatCard label="Average" value={avg} tint="#3B82F6" />
              <StatCard label="Best" value={best} tint={theme.low} />
              <StatCard label="Low" value={worst} tint={theme.high} />
            </View>

            <ChartCard
              testID="chart-total"
              title="Overall Health"
              points={totalPoints}
              color={riskColor(avg)}
              latest={ordered[ordered.length - 1]?.total_score}
            />
            <ChartCard
              testID="chart-gait"
              title="Gait"
              points={gaitPoints}
              color="#3B82F6"
              latest={ordered[ordered.length - 1]?.gait_score}
            />
            <ChartCard
              testID="chart-face"
              title="Facial"
              points={facePoints}
              color="#8B5CF6"
              latest={ordered[ordered.length - 1]?.face_score}
            />
            <ChartCard
              testID="chart-behavior"
              title="Behavioral"
              points={behaviorPoints}
              color={theme.primary}
              latest={ordered[ordered.length - 1]?.behavior_score}
            />

            <View style={[styles.listCard, shadow]}>
              <Text style={styles.cardTitle}>Recent Scans</Text>
              {scans.slice(0, 10).map((s) => (
                <View key={s.id} style={styles.row} testID="history-row">
                  <View style={[styles.rowDot, { backgroundColor: riskColor(s.total_score) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{s.risk_label}</Text>
                    <Text style={styles.rowMeta}>
                      {new Date(s.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={[styles.rowScore, { color: riskColor(s.total_score) }]}>
                    {s.total_score}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={[styles.stat, shadow]}>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ChartCard({
  title,
  points,
  color,
  latest,
  testID,
}: {
  title: string;
  points: { label: string; value: number }[];
  color: string;
  latest?: number;
  testID?: string;
}) {
  return (
    <View style={[styles.chartCard, shadow]} testID={testID}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        {latest !== undefined && (
          <Text style={[styles.chartLatest, { color }]}>{latest}</Text>
        )}
      </View>
      <TrendChart points={points} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", color: theme.textMain, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: theme.textMuted, marginTop: -8 },
  emptyCard: {
    backgroundColor: theme.surface,
    padding: 28,
    borderRadius: 24,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: theme.textMain, marginTop: 4 },
  emptyText: { fontSize: 13, color: theme.textMuted, textAlign: "center" },
  emptyCta: {
    marginTop: 10,
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  emptyCtaText: { color: "#fff", fontWeight: "700" },
  stats: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: theme.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  chartTitle: { fontSize: 14, fontWeight: "700", color: theme.textMain },
  chartLatest: { fontSize: 22, fontWeight: "800" },
  listCard: {
    backgroundColor: theme.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: theme.textMain, marginBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowDot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: theme.textMain },
  rowMeta: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  rowScore: { fontSize: 18, fontWeight: "800" },
});
