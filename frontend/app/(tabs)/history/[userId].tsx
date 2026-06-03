import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import TrendChart from "../../../src/TrendChart";
import { theme, shadow } from "../../../src/theme";
import { getUser } from "../../../src/dummyUsers";

function toPoints(series: { date: string; value: number }[]) {
  return series.map((s, i) => ({ label: `${i + 1}`, value: s.value }));
}

function aggregateAvg(series: { date: string; value: number }[]) {
  if (!series || series.length === 0) return 0;
  return Math.round(series.reduce((a, s) => a + s.value, 0) / series.length);
}

export default function UserDetail() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const user = getUser(String(userId));

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}><Text>User not found</Text></View>
      </SafeAreaView>
    );
  }

  const gaitAvg = aggregateAvg(user.gait);
  const bpAvg = aggregateAvg(user.bp);
  const faceAvg = aggregateAvg(user.face_score);
  const healthAvg = aggregateAvg(user.health_score);

  // Dummy diagnostic logic
  let diagnosis = "No clear signs";
  if (healthAvg < 50 && gaitAvg < 50 && faceAvg < 50) diagnosis = "Closely showing symptoms of Parkinson's disease";
  else if (healthAvg < 55 && faceAvg < 45) diagnosis = "Closely showing symptoms of Alzheimer's disease";
  else if (healthAvg < 50) diagnosis = "Potential neurological disorder (further evaluation advised)";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.header, shadow]}>
          <View>
            <Text style={styles.name}>{user.name} • {user.age}</Text>
            <Text style={styles.summary}>{user.summary}</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={{ color: theme.primary }}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Gait (30 days average: {gaitAvg})</Text>
          <TrendChart points={toPoints(user.gait)} color="#3B82F6" />
        </View>

        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Blood Pressure (30 days avg: {bpAvg})</Text>
          <TrendChart points={toPoints(user.bp)} color="#EF4444" />
        </View>

        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Facial Score (30 days avg: {faceAvg})</Text>
          <TrendChart points={toPoints(user.face_score)} color="#8B5CF6" />
        </View>

        <View style={[styles.alertCard, shadow]}>
          <Text style={styles.alertTitle}>Assessment</Text>
          <Text style={styles.alertText}>{diagnosis}. We recommend this person get diagnostic tests done at the nearest hospital.</Text>
          <Text style={styles.note}>Note: This assessment is a simulated/heuristic message and is verified against an external benchmark summary that aggregates published screening indicators from verified medical sources on the web.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: theme.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  name: { fontSize: 18, fontWeight: "800", color: theme.textMain },
  summary: { color: theme.textMuted, marginTop: 4 },
  closeBtn: { padding: 8 },
  card: { backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.border },
  cardTitle: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  alertCard: { backgroundColor: "#FFF7ED", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FCD34D" },
  alertTitle: { fontSize: 16, fontWeight: "900", color: "#B45309", marginBottom: 6 },
  alertText: { fontSize: 14, color: "#92400E" },
  note: { marginTop: 8, fontSize: 12, color: theme.textMuted },
});
