import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import TrendChart from "../../src/TrendChart";
import { theme, shadow } from "../../src/theme";
import { users } from "../../src/dummyUsers";

function toPoints(series: { date: string; value: number }[]) {
  return series.map((s, i) => ({ label: `${i + 1}`, value: s.value }));
}

export default function History() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Patient History</Text>
        <Text style={styles.subtitle}>Review recent gait, blood pressure and facial metrics.</Text>

        <View style={{ gap: 12 }}>
          {users.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={[styles.userCard, shadow]}
              onPress={() => router.push(`/(tabs)/history/${u.id}`)}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={styles.userName}>{u.name} • {u.age}</Text>
                  <Text style={styles.userSummary}>{u.summary}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.userLatest}>Last 30 days</Text>
                </View>
              </View>

              <View style={styles.miniCharts}>
                <View style={styles.miniChartCard}>
                  <Text style={styles.miniTitle}>Gait</Text>
                  <TrendChart points={toPoints(u.gait)} color="#3B82F6" height={80} />
                </View>
                <View style={styles.miniChartCard}>
                  <Text style={styles.miniTitle}>BP</Text>
                  <TrendChart points={toPoints(u.bp)} color="#EF4444" height={80} />
                </View>
                <View style={styles.miniChartCard}>
                  <Text style={styles.miniTitle}>Face</Text>
                  <TrendChart points={toPoints(u.face_score)} color="#8B5CF6" height={80} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
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
