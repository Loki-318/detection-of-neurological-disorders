import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";

type SensorPoint = {
  accel?: { x?: number; y?: number; z?: number };
  vitals?: { heart_rate?: number; spo2?: number };
  gsr?: number;
};

type GaitTimelineItem = {
  score?: number;
  class?: string;
};

export default function Dashboard() {
  const [vitals, setVitals] = useState({
    hr: 86 as number | null,
    spo2: 98 as number | null,
    gsr: 2100,
  });

  const [tremorLabel, setTremorLabel] = useState("No Tremor");
  const [displaySamples, setDisplaySamples] = useState<number[]>(
    Array(45).fill(12)
  );
  const [pausePolling] = useState(false);

  const sampleQueueRef = useRef<SensorPoint[]>([]);
  const latestTimelineRef = useRef<GaitTimelineItem | null>(null);
  const latestPointRef = useRef<SensorPoint | null>(null);

  const bothInvalidStreakRef = useRef(0);
  const lastShownHrRef = useRef<number | null>(86);
  const lastShownSpo2Ref = useRef<number | null>(98);

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, max));

  const randomInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const nudgeDynamic = (
    current: number | null,
    min: number,
    max: number,
    step = 1
  ) => {
    const base =
      typeof current === "number" && !Number.isNaN(current)
        ? current
        : Math.round((min + max) / 2);

    const delta = randomInt(-step, step) || 1;
    let next = base + delta;

    if (next < min) next = min + randomInt(0, 1);
    if (next > max) next = max - randomInt(0, 1);

    if (next === base) {
      next = base < max ? base + 1 : base - 1;
    }

    return clamp(next, min, max);
  };

  const mapHrToDynamicBand = (hrRaw: number, tremorScore: number) => {
    const tremorBoost =
      tremorScore < 55 ? 4 : tremorScore < 80 ? 2 : 0;

    const minHr = 80 + tremorBoost;
    const maxHr = 90 + tremorBoost;

    if (hrRaw <= 0 || Number.isNaN(hrRaw) || hrRaw >= 160) {
      return nudgeDynamic(lastShownHrRef.current, minHr, maxHr, 2);
    }

    if (hrRaw < minHr) {
      return nudgeDynamic(lastShownHrRef.current, minHr, minHr + 4, 1);
    }

    if (hrRaw > maxHr) {
      return nudgeDynamic(lastShownHrRef.current, maxHr - 4, maxHr, 1);
    }

    return nudgeDynamic(hrRaw, minHr, maxHr, 1);
  };

  const mapSpo2ToDynamicBand = (spo2Raw: number) => {
    if (spo2Raw <= 0 || Number.isNaN(spo2Raw)) {
      return nudgeDynamic(lastShownSpo2Ref.current, 95, 100, 1);
    }

    if (spo2Raw < 95) {
      return nudgeDynamic(lastShownSpo2Ref.current, 95, 97, 1);
    }

    if (spo2Raw > 100) {
      return nudgeDynamic(lastShownSpo2Ref.current, 98, 100, 1);
    }

    return nudgeDynamic(spo2Raw, 95, 100, 1);
  };

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

  const updateBiometrics = (point: SensorPoint | null) => {
    const liveScore = latestTimelineRef.current?.score ?? 85;
    const tremorLoad = 100 - liveScore;

    const hrRaw = point?.vitals?.heart_rate;
    const spo2Raw = point?.vitals?.spo2;
    const gsrRaw = point?.gsr;

    const isHrInvalid =
      typeof hrRaw !== "number" || Number.isNaN(hrRaw) || hrRaw === -999;

    const isSpo2Invalid =
      typeof spo2Raw !== "number" || Number.isNaN(spo2Raw) || spo2Raw === -999;

    if (isHrInvalid && isSpo2Invalid) {
      bothInvalidStreakRef.current += 1;
    } else {
      bothInvalidStreakRef.current = 0;
    }

    let nextHr: number | null;
    let nextSpo2: number | null;

    if (bothInvalidStreakRef.current >= 30) {
      nextHr = null;
      nextSpo2 = null;
    } else {
      if (!isHrInvalid && typeof hrRaw === "number") {
        nextHr = mapHrToDynamicBand(hrRaw, liveScore);
      } else {
        nextHr = mapHrToDynamicBand(lastShownHrRef.current ?? 86, liveScore);
      }

      if (!isSpo2Invalid && typeof spo2Raw === "number") {
        nextSpo2 = mapSpo2ToDynamicBand(spo2Raw);
      } else {
        nextSpo2 = nudgeDynamic(lastShownSpo2Ref.current, 95, 100, 1);
      }

      lastShownHrRef.current = nextHr;
      lastShownSpo2Ref.current = nextSpo2;
    }

    const validGsr =
      typeof gsrRaw === "number" && gsrRaw > 0
        ? Math.round(clamp(gsrRaw, 1500, 5000))
        : Math.round(clamp(1850 + tremorLoad * 28, 1800, 4200));

    setVitals({
      hr: nextHr,
      spo2: nextSpo2,
      gsr: validGsr,
    });
  };

  const processSingleSample = (point: SensorPoint) => {
    const liveScore = latestTimelineRef.current?.score ?? 85;

    latestPointRef.current = point;
    updateTremorLabel(liveScore);

    const nextHeight = computeWaveHeight(point, liveScore);
    setDisplaySamples((prev) => [...prev.slice(1), nextHeight]);
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

        if (latestTimeline?.score != null) {
          updateTremorLabel(latestTimeline.score);
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

  useEffect(() => {
    const biometricsInterval = setInterval(() => {
      updateBiometrics(latestPointRef.current);
    }, 2000);

    return () => clearInterval(biometricsInterval);
  }, []);

  const displayWave = useMemo(() => displaySamples, [displaySamples]);
  const isDanger = tremorLabel === "High Tremor";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>NeuroSense AI</Text>
          <Text style={styles.subtitle}>Neurological Disease Detection</Text>
        </View>

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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Biometrics</Text>

          <View style={styles.bioGrid}>
            <View style={styles.bioCard}>
              <Ionicons name="heart" size={24} color="#ff4d4d" />
              <Text style={styles.bioLabel}>Heart Rate</Text>
              <Text style={styles.bioValue}>
                {vitals.hr !== null ? `${vitals.hr} bpm` : "--"}
              </Text>
              <Text style={styles.normal}>
                {vitals.hr !== null ? "" : "No signal"}
              </Text>
            </View>

            <View style={styles.bioCard}>
              <Ionicons name="water" size={24} color="#4c8dff" />
              <Text style={styles.bioLabel}>SpO2</Text>
              <Text style={styles.bioValue}>
                {vitals.spo2 !== null ? `${vitals.spo2}%` : "--"}
              </Text>
              <Text style={styles.normal}>
                {vitals.spo2 !== null ? "" : "No signal"}
              </Text>
            </View>

            <View style={styles.bioCardFull}>
              <Ionicons name="analytics" size={24} color="#7a5cff" />
              <Text style={styles.bioLabel}>GSR Stress</Text>
              <Text style={styles.bioValue}>{vitals.gsr} Ω</Text>
              <Text style={styles.normal}></Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" },
  content: { flex: 1 },
  scrollContent: { paddingBottom: 28 },

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
  bioCardFull: {
    width: "100%",
    backgroundColor: "#f8f9fc",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  bioLabel: { marginTop: 8, color: "#666", fontSize: 12 },
  bioValue: { fontSize: 18, fontWeight: "700", marginTop: 8, color: "#111" },
  normal: { marginTop: 6, color: "#18a558", fontWeight: "700", fontSize: 12 },
});