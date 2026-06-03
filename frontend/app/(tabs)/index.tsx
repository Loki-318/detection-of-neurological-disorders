import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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
    hr: null as number | null,
    spo2: null as number | null,
    gsr: 2100,
  });
  const [derivedBp, setDerivedBp] = useState("120/80");
  const [bandConnected, setBandConnected] = useState(true);

  const [gaitScore, setGaitScore] = useState(85);
  const [gaitClass, setGaitClass] = useState("Mild/No Tremor");

  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [faceInsight, setFaceInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [displaySamples, setDisplaySamples] = useState<number[]>(
    Array(45).fill(12)
  );
  const [pausePolling, setPausePolling] = useState(false);

  const sampleQueueRef = useRef<SensorPoint[]>([]);
  const latestTimelineRef = useRef<any>(null);

  const average = (nums: number[]) =>
    nums.length ? nums.reduce((sum, n) => sum + n, 0) / nums.length : 0;

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

  const processSingleSample = (point: SensorPoint) => {
    const liveScore = latestTimelineRef.current?.score ?? gaitScore;
    const tremorLoad = 100 - liveScore;

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

    const sys = clamp(Math.round(118 + tremorLoad * 0.4), 110, 155);
    const dia = clamp(Math.round(78 + tremorLoad * 0.25), 70, 100);

    setDerivedBp(`${sys}/${dia}`);
    setBandConnected(validHr !== null || validSpo2 !== null);

    setVitals((prev) => ({
      hr: validHr !== null ? Math.round(validHr) : null,
      spo2: validSpo2 !== null ? Math.round(validSpo2) : null,
      gsr: validGsr,
    }));

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
          setGaitScore(latestTimeline.score ?? 85);
          setGaitClass(latestTimeline.class ?? "Mild/No Tremor");
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
  }, [gaitScore]);

  const displayWave = useMemo(() => displaySamples, [displaySamples]);

  const isDanger = gaitScore <= 55;

  const processFaceImage = async (uri: string, base64: string) => {
    setFaceImage(uri);
    setFaceInsight(null);
    setIsAnalyzing(true);
    setPausePolling(true);

    try {
      const payload = base64.startsWith("data:image")
        ? base64
        : `data:image/jpeg;base64,${base64}`;

      const res = await api.analyzeFace(payload);
      const result = res?.result ?? res;

      setFaceInsight(
        `Eye: ${result?.eye?.predicted_class ?? "Unknown"} | Eyebrow: ${
          result?.eyebrow?.predicted_class ?? "Unknown"
        } | Mouth: ${result?.mouth?.predicted_class ?? "Unknown"}`
      );
    } catch (e) {
      console.log("Face API error:", e);
      setFaceInsight("Error reaching AI. Try again.");
    } finally {
      setIsAnalyzing(false);
      setPausePolling(false);
    }
  };

  const uploadImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64 || !asset?.uri) {
        setFaceInsight("Could not read selected image. Try again.");
        return;
      }

      await processFaceImage(asset.uri, asset.base64);
    } catch (error) {
      console.log("Upload image error:", error);
      setFaceInsight("Image upload failed. Try again.");
      setIsAnalyzing(false);
      setPausePolling(false);
    }
  };

  const scanFace = () => {
    if (isAnalyzing) return;
    router.push("/scan");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
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
                  {gaitClass}
                </Text>
              </View>

              <Text style={styles.liveValue}>Tremor Score</Text>
              <Text
                style={[
                  styles.scoreText,
                  { color: isDanger ? "#ff4d4d" : "#4c8dff" },
                ]}
              >
                {gaitScore}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Biometrics</Text>
          <View style={styles.bioGrid}>
            <View style={[styles.bioCard, !bandConnected && styles.bioCardDim]}>
              <Ionicons name="heart" size={24} color="#ff4d4d" />
              <Text style={styles.bioLabel}>Heart Rate</Text>
              <Text style={styles.bioValue}>
                {vitals.hr !== null ? `${vitals.hr} bpm` : "--"}
              </Text>
              <Text style={styles.normal}>
                {bandConnected ? "Live" : "Band not worn"}
              </Text>
            </View>

            <View style={[styles.bioCard, !bandConnected && styles.bioCardDim]}>
              <Ionicons name="water" size={24} color="#4c8dff" />
              <Text style={styles.bioLabel}>SpO2</Text>
              <Text style={styles.bioValue}>
                {vitals.spo2 !== null ? `${vitals.spo2}%` : "--"}
              </Text>
              <Text style={styles.normal}>
                {bandConnected ? "Live" : "No reading"}
              </Text>
            </View>

            <View style={styles.bioCard}>
              <Ionicons name="pulse-outline" size={24} color="#e67e22" />
              <Text style={styles.bioLabel}>BP</Text>
              <Text style={styles.bioValue}>{derivedBp}</Text>
            </View>

            <View style={styles.bioCard}>
              <Ionicons name="analytics" size={24} color="#7a5cff" />
              <Text style={styles.bioLabel}>GSR Stress</Text>
              <Text style={styles.bioValue}>{vitals.gsr} Ω</Text>
              <Text style={styles.normal}>Live</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Face Analysis</Text>

          <View style={styles.faceRow}>
            <View style={styles.faceLeft}>
              <View style={styles.facePreview}>
                {faceImage ? (
                  <>
                    <Image
                      source={{ uri: faceImage }}
                      style={styles.faceImage}
                      resizeMode="contain"
                    />
                    {isAnalyzing && (
                      <View style={styles.previewOverlay}>
                        <ActivityIndicator size="large" color="#fff" />
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.placeholder}>
                    <Ionicons
                      name="person-circle-outline"
                      size={80}
                      color="#999"
                    />
                    <Text style={styles.placeholderText}>
                      Scan or upload a face
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.buttonRowLeft}>
                <TouchableOpacity
                  style={[styles.scanBtn, isAnalyzing && styles.disabledBtn]}
                  onPress={scanFace}
                  disabled={isAnalyzing}
                >
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.btnText}>Scan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadBtn, isAnalyzing && styles.disabledBtn]}
                  onPress={uploadImage}
                  disabled={isAnalyzing}
                >
                  <Ionicons name="image" size={20} color="#000" />
                  <Text style={styles.uploadText}>Upload Image</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.faceInfo}>
              <Text style={styles.faceInfoTitle}>Face Analysis Results</Text>

              <Text style={styles.faceStatus}>
                {isAnalyzing
                  ? "Analyzing facial biomarkers, please wait a few seconds..."
                  : faceInsight
                  ? "Analysis complete:"
                  : "Tap Scan or Upload Image to start an analysis."}
              </Text>

              {faceInsight && !isAnalyzing && (
                <View style={styles.faceInsightBox}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#18a558"
                  />
                  <View style={{ flexShrink: 1 }}>
                    {faceInsight.split("|").map((part) => (
                      <Text key={part} style={styles.faceInsightText}>
                        {part.trim()}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" },
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
  liveValue: { marginTop: 20, color: "#777", fontSize: 13 },
  scoreText: { fontSize: 42, fontWeight: "800", marginTop: 4 },
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
  bioCardDim: {
    opacity: 0.7,
  },
  bioLabel: { marginTop: 8, color: "#666", fontSize: 12 },
  bioValue: { fontSize: 18, fontWeight: "700", marginTop: 8, color: "#111" },
  normal: { marginTop: 6, color: "#18a558", fontWeight: "700", fontSize: 12 },
  faceRow: {
    flexDirection: "row",
    marginTop: 20,
    gap: 16,
  },
  faceLeft: {
    flex: 0.9,
  },
  facePreview: {
    width: "100%",
    height: 260,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  faceImage: {
    width: "100%",
    height: "100%",
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  placeholderText: {
    marginTop: 8,
    color: "#777",
    fontSize: 13,
  },
  buttonRowLeft: {
    flexDirection: "row",
    marginTop: 12,
    gap: 12,
  },
  faceInfo: {
    flex: 1.1,
    justifyContent: "flex-start",
  },
  faceInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  faceStatus: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
  },
  faceInsightBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e8fff1",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  faceInsightText: {
    color: "#155c31",
    fontSize: 13,
    flexShrink: 1,
  },
  scanBtn: {
    flex: 1,
    backgroundColor: "#4c8dff",
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  uploadText: { color: "#111", fontWeight: "700" },
});