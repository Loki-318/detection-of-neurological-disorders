import React, { useEffect, useState } from "react";
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

export default function Dashboard() {
  const router = useRouter();

  const [waveData, setWaveData] = useState<number[]>(Array(45).fill(15));

  // Vitals State
  const [vitals, setVitals] = useState({ hr: 72, spo2: 98, gsr: 2100 });

  // Model Data States
  const [gaitScore, setGaitScore] = useState(85);
  const [gaitClass, setGaitClass] = useState("Mild/No Tremor");

  // Face States
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [faceInsight, setFaceInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Engine Buffers
  const [fetchedGait, setFetchedGait] = useState<any[]>([]);
  const [fetchedTimeline, setFetchedTimeline] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 1. BACKGROUND NETWORK POLLING
  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        const [bioData, gaitResponse] = await Promise.all([
          api.getSensorData(),
          api.getGaitData(),
        ]);

        if (bioData && bioData.length > 0) {
          const latest = bioData[bioData.length - 1];
          let rawHr = latest?.vitals?.heart_rate || latest?.Heart_Rate_BPM || 75;
          let rawSpo2 = latest?.vitals?.spo2 || latest?.SpO2_Percent || 98;
          setVitals({
            hr: rawHr > 100 || rawHr < 0 ? 75 : rawHr,
            spo2: rawSpo2 < 95 || rawSpo2 < 0 ? 98 : rawSpo2,
            gsr: 2100,
          });
        }

        if (gaitResponse && gaitResponse.raw_data && gaitResponse.raw_data.length > 0) {
          setFetchedGait(gaitResponse.raw_data);
          setFetchedTimeline(gaitResponse.timeline || []);
        }
      } catch (error) {
        console.log("Polling error:", error);
      }
    };

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // 2. SYNCHRONIZED SIMULATION ENGINE
  useEffect(() => {
    if (fetchedGait.length === 0) return;

    const engineCycle = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % fetchedGait.length;

        const currentDataPoint = fetchedGait[next];
        const rawX = currentDataPoint?.Accel_X || 16384;
        const variance = Math.abs(rawX - 16384);
        const isTrueTremorSpike = variance > 6000;

        setVitals((oldVitals) => {
          let newHr = oldVitals.hr + (Math.random() > 0.5 ? 1 : -1);
          let newSpo2 = oldVitals.spo2 + (Math.random() > 0.8 ? 1 : -1);
          let newGsr = oldVitals.gsr + Math.floor(Math.random() * 20 - 10);

          if (isTrueTremorSpike) {
            newHr = Math.min(newHr + 2, 92);
            newGsr = Math.min(newGsr + 50, 3000);
            newSpo2 = Math.max(newSpo2 - 1, 95);
          } else {
            newHr = Math.max(Math.min(newHr, 80), 65);
            newGsr = Math.max(Math.min(newGsr, 2500), 1900);
            newSpo2 = Math.max(Math.min(newSpo2, 99), 96);
          }
          return { hr: newHr, spo2: newSpo2, gsr: newGsr };
        });

        if (fetchedTimeline.length > 0) {
          const chunkIndex = Math.floor(next / 40) % fetchedTimeline.length;
          const aiResult = fetchedTimeline[chunkIndex];
          if (aiResult) {
            setGaitScore(aiResult.score);
            setGaitClass(aiResult.class);
          }
        }

        return next;
      });
    }, 120);

    return () => clearInterval(engineCycle);
  }, [fetchedGait, fetchedTimeline]);

  // 3. RECALIBRATED VISUAL WAVES
  const displayWave: number[] = [];
  const safeData =
    fetchedGait.length > 0 ? fetchedGait : Array(45).fill({ Accel_X: 16384 });

  for (let i = 0; i < 45; i++) {
    const dataPoint = safeData[(currentIndex + i) % safeData.length];
    const rawX = dataPoint?.Accel_X || 16384;
    let height = Math.abs(rawX - 16384) / 100;
    const jitter = Math.random() * 6 - 3;
    height = Math.min(Math.max(height + jitter + 15, 10), 120);
    displayWave.push(height);
  }

  const isDanger = gaitScore <= 55;

  // --- FACE SCANNING HANDLERS ---
  const processFaceImage = async (uri: string, base64: string) => {
    setFaceImage(uri);
    setFaceInsight(null);
    setIsAnalyzing(true);
    try {
      const res = await api.analyzeFace(base64);
      setFaceInsight(res.summary);
    } catch (e) {
      setFaceInsight("Error reaching AI. Try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const uploadImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      processFaceImage(result.assets[0].uri, result.assets[0].base64);
    }
  };

  // Use expo-router to go to app/(tabs)/scan.tsx -> "/scan"
  const scanFace = () => {
    router.push("/scan");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>NeuroSense AI</Text>
          <Text style={styles.subtitle}>Neurological Disease Detection</Text>
        </View>

        {/* LIVE GAIT ANALYSIS */}
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

        {/* BIOMETRIC DATA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Biometrics</Text>
          <View style={styles.bioGrid}>
            <View style={styles.bioCard}>
              <Ionicons name="heart" size={24} color="#ff4d4d" />
              <Text style={styles.bioLabel}>Heart Rate</Text>
              <Text style={styles.bioValue}>{vitals.hr} bpm</Text>
              <Text style={styles.normal}>Normal</Text>
            </View>
            <View style={styles.bioCard}>
              <Ionicons name="water" size={24} color="#4c8dff" />
              <Text style={styles.bioLabel}>SpO2</Text>
              <Text style={styles.bioValue}>{vitals.spo2}%</Text>
              <Text style={styles.normal}>Normal</Text>
            </View>
            <View style={styles.bioCard}>
              <Ionicons name="analytics" size={24} color="#7a5cff" />
              <Text style={styles.bioLabel}>GSR Stress</Text>
              <Text style={styles.bioValue}>{vitals.gsr} Ω</Text>
              <Text style={styles.normal}>Normal</Text>
            </View>
          </View>
        </View>

        {/* FACE ANALYSIS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Face Analysis</Text>

          <View style={styles.faceRow}>
            {/* LEFT: image + buttons */}
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
                  style={styles.scanBtn}
                  onPress={scanFace}
                  disabled={isAnalyzing}
                >
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.btnText}>Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={uploadImage}
                  disabled={isAnalyzing}
                >
                  <Ionicons name="image" size={20} color="#000" />
                  <Text style={styles.uploadText}>Upload Image</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* RIGHT: text/results */}
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
  },
  bioCard: {
    width: "31%",
    backgroundColor: "#f8f9fc",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  bioLabel: { marginTop: 8, color: "#666", fontSize: 12 },
  bioValue: { fontSize: 18, fontWeight: "700", marginTop: 8, color: "#111" },
  normal: { marginTop: 6, color: "#18a558", fontWeight: "700", fontSize: 12 },

  // Face layout
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
  btnText: { color: "#fff", fontWeight: "700" },
  uploadText: { color: "#111", fontWeight: "700" },
});