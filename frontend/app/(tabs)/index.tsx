import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useRouter } from "expo-router";

type SensorPoint = {
  accel?: { x?: number; y?: number; z?: number };
  vitals?: { heart_rate?: number; spo2?: number };
  gsr?: number;
};

export default function Dashboard() {
  const router = useRouter();

  const [vitals, setVitals] = useState({
    hr: 80 as number | null,
    spo2: 98 as number | null,
    gsr: 2100,
  });
  const [tremorLabel, setTremorLabel] = useState("No Tremor");

  const [displaySamples, setDisplaySamples] = useState<number[]>(
    Array(45).fill(12)
  );
  const [pausePolling, setPausePolling] = useState(false);

  const sampleQueueRef = useRef<SensorPoint[]>([]);
  const latestTimelineRef = useRef<any>(null);

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, max));

  const computeWaveHeight = (point: SensorPoint, tremorScore: number) => {
    const ax = Math.abs(point?.accel?.x ?? 0);
    const ay = Math.abs(point?.accel?.y ?? 0);
    const az = Math.abs(point?.accel?.z ?? 0);

    const raw = ax * 0.5 + ay * 0.3 + az * 0.2;
    const tremorLoad = 100 - tremorScore;

    const scaled = raw / 180;
    const tremorBoost = tremorLoad * 0.9;

    return clamp(Math.round(8 + scaled + tremorBoost), 8, 120);
  };

  const updateTremorLabel = (score: number) => {
    if (score >= 80) {
      setTremorLabel("No Tremor");
    } else if (score >= 55) {
      setTremorLabel("Mild Tremor");
    } else {
      setTremorLabel("High Tremor");
    }
  };

  const processSingleSample = (point: SensorPoint) => {
    const liveScore = latestTimelineRef.current?.score ?? 85;
    const tremorLoad = 100 - liveScore;

    updateTremorLabel(liveScore);

    const hrRaw = point?.vitals?.heart_rate;
    const spo2Raw = point?.vitals?.spo2;
    const gsrRaw = point?.gsr;

    const validHr =
      typeof hrRaw === "number" && hrRaw !== -999 && hrRaw > 35 && hrRaw < 160
        ? hrRaw
        : null;

    const validSpo2 =
      typeof spo2Raw === "number" &&
      spo2Raw !== -999 &&
      spo2Raw >= 85 &&
      spo2Raw <= 100
        ? spo2Raw
        : null;

    const validGsr =
      typeof gsrRaw === "number" && gsrRaw > 0
        ? Math.round(clamp(gsrRaw, 1500, 5000))
        : Math.round(clamp(1850 + tremorLoad * 28, 1800, 4200));

    setVitals({
      hr: validHr !== null ? Math.round(validHr) : 80,
      spo2: validSpo2 !== null ? Math.round(validSpo2) : 98,
      gsr: validGsr,
    });

    const nextHeight = computeWaveHeight(point, liveScore);

    setDisplaySamples((prev) => {
      const next = [...prev.slice(1), nextHeight];
      return next;
    });
  };

  useEffect(() => {
    if (pausePolling) return;

    let isMounted = true;

    const fetchLiveStats = async () => {
      try {
        const [bioData, gaitResponse] = await Promise.all([
          api.getSensorData(),
          api.getGaitData(),
        ]);

        if (!isMounted) return;

        const sensorRows = Array.isArray(bioData) ? bioData : [];
        const gaitRows = Array.isArray(gaitResponse?.raw_data)
          ? gaitResponse.raw_data
          : [];
        const timeline = Array.isArray(gaitResponse?.timeline)
          ? gaitResponse.timeline
          : [];

        const latestTimeline =
          timeline.length > 0 ? timeline[timeline.length - 1] : null;

        latestTimelineRef.current = latestTimeline;

        if (latestTimeline) {
          updateTremorLabel(latestTimeline.score ?? 85);
        }

        const incomingRows =
          gaitRows.length > 0 ? gaitRows : sensorRows.length > 0 ? sensorRows : [];

        if (incomingRows.length > 0) {
          sampleQueueRef.current = [...sampleQueueRef.current, ...incomingRows].slice(
            -500
          );
        }
      } catch (error) {
        console.log("Polling error:", error);
      }
    };

    fetchLiveStats();
    const pollInterval = setInterval(fetchLiveStats, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [pausePolling]);

  useEffect(() => {
    const playInterval = setInterval(() => {
      if (sampleQueueRef.current.length === 0) return;

      const nextPoint = sampleQueueRef.current.shift();
      if (!nextPoint) return;

      processSingleSample(nextPoint);
    }, 120);

    return () => clearInterval(playInterval);
  }, []);

  const displayWave = useMemo(() => displaySamples, [displaySamples]);

  const isDanger = tremorLabel === "High Tremor";

  const Sidebar = ({ active }: { active: "home" | "scan" | "history" }) => (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>NeuroSense</Text>

      <TouchableOpacity
        style={active === "home" ? styles.navItemActive : styles.navItem}
        onPress={() => router.push("/")}
      >
        <Ionicons
          name="home"
          size={20}
          color={active === "home" ? "#fff" : "#4c8dff"}
        />
        <Text
          style={active === "home" ? styles.navTextActive : styles.navText}
        >
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={active === "scan" ? styles.navItemActive : styles.navItem}
        onPress={() => router.push("/scan")}
      >
        <Ionicons
          name="scan"
          size={20}
          color={active === "scan" ? "#fff" : "#4c8dff"}
        />
        <Text
          style={active === "scan" ? styles.navTextActive : styles.navText}
        >
          Scan
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={active === "history" ? styles.navItemActive : styles.navItem}
        onPress={() => router.push("/history")}
      >
        <Ionicons
          name="time"
          size={20}
          color={active === "history" ? "#fff" : "#4c8dff"}
        />
        <Text
          style={active === "history" ? styles.navTextActive : styles.navText}
        >
          History
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainRow}>
        <Sidebar active="home" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.content}
        >
          <View style={styles.header}>
            <Text style={styles.title}>NeuroSense AI</Text>
            <Text style={styles.subtitle}>Neurological Disease Detection</Text>
          </View>

          {/* Gait / tremor card */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons
                name="pulse"
                size={22}
                color={isDanger ? "#ff4d4d" : "#4c8dff"}
              />
              <Text style={styles.cardTitle}>Live Gait Analysis</Text>
            </View>
            <Text style={styles.smallText}>Smart Armband Tremor Monitoring</Text>

            <View style={styles.gaitMain}>
              <View style={styles.gaitGraph}>
                <View style={styles.waveContainer}>
                  {displayWave.map((value, index) => (
                    <View
                      key={index}
                      style={[
                        styles.waveBar,
                        {
                          height: value,
                          backgroundColor: isDanger ? "#ff4d4d" : "#4c8dff",
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.gaitStatus}>
                <Text style={styles.statusTitle}>AI Assessment</Text>

                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: isDanger ? "#ffe5e5" : "#e8fff1" },
                  ]}
                >
                  <Text
                    style={{
                      color: isDanger ? "#ff4d4d" : "#18a558",
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    {tremorLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Biometrics */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Live Biometrics</Text>
            <View style={styles.bioGrid}>
              <View style={styles.bioCard}>
                <Ionicons name="heart" size={24} color="#ff4d4d" />
                <Text style={styles.bioLabel}>Heart Rate</Text>
                <Text style={styles.bioValue}>
                  {vitals.hr !== null ? `${vitals.hr} bpm` : "--"}
                </Text>
                <Text style={styles.normal}>Dynamic</Text>
              </View>

              <View style={styles.bioCard}>
                <Ionicons name="water" size={24} color="#4c8dff" />
                <Text style={styles.bioLabel}>SpO2</Text>
                <Text style={styles.bioValue}>
                  {vitals.spo2 !== null ? `${vitals.spo2}%` : "--"}
                </Text>
                <Text style={styles.normal}>Dynamic</Text>
              </View>

              <View style={styles.bioCard}>
                <Ionicons name="analytics" size={24} color="#7a5cff" />
                <Text style={styles.bioLabel}>GSR Stress</Text>
                <Text style={styles.bioValue}>{vitals.gsr} Ω</Text>
                <Text style={styles.normal}>Dynamic</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" },
  mainRow: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 96,
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: "#111827",
  },
  sidebarTitle: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  navItemActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#4c8dff",
  },
  navText: { color: "#e5e7eb", fontSize: 12, fontWeight: "600" },
  navTextActive: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  content: { flex: 1 },

  header: { padding: 20, paddingTop: 10 },
  title: { fontSize: 30, fontWeight: "800", color: "#111" },
  subtitle: { color: "#666", marginTop: 4, fontSize: 15 },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 18,
    borderRadius: 22,
    padding: 18,
    elevation: 3,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#111" },
  smallText: { marginTop: 8, color: "#777" },
  gaitMain: { flexDirection: "row", marginTop: 20, gap: 14 },
  gaitGraph: {
    flex: 1.2,
    backgroundColor: "#f8f9fc",
    borderRadius: 18,
    padding: 12,
    justifyContent: "center",
  },
  gaitStatus: {
    flex: 0.8,
    backgroundColor: "#f8f9fc",
    borderRadius: 18,
    padding: 16,
    justifyContent: "center",
  },
  waveContainer: {
    height: 130,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  waveBar: { width: 4, borderRadius: 10 },
  statusTitle: { fontSize: 14, color: "#666", marginBottom: 12 },
  statusBadge: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  bioGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    flexWrap: "wrap",
    gap: 12,
  },
  bioCard: {
    width: "48%",
    backgroundColor: "#f8f9fc",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  bioLabel: { marginTop: 8, color: "#666", fontSize: 12 },
  bioValue: { fontSize: 18, fontWeight: "700", marginTop: 8, color: "#111" },
  normal: { marginTop: 6, color: "#18a558", fontWeight: "700", fontSize: 12 },
});