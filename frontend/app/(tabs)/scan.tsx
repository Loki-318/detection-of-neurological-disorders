import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../src/api";
import { theme, shadow } from "../../src/theme";
import { useRouter } from "expo-router";

type FacePartResult = {
  predicted_class: string;
  class_probs: Record<string, number>;
};

type FaceScanResponse = {
  id: string;
  user_id: string;
  type: "face";
  created_at: string;
  result: {
    eye: FacePartResult;
    eyebrow: FacePartResult;
    mouth: FacePartResult;
  };
};

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("Ready to Scan");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<FaceScanResponse | null>(null);
  const [insight, setInsight] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

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

  const getTopConfidence = (part?: FacePartResult) => {
    if (!part?.class_probs) return null;
    const values = Object.values(part.class_probs);
    if (!values.length) return null;
    return Math.max(...values);
  };

  const toPercent = (value?: number | null) => {
    if (value == null || Number.isNaN(value)) return "N/A";
    return `${(value * 100).toFixed(1)}%`;
  };

  const buildInsightText = (data: FaceScanResponse) => {
    const eye = data.result.eye;
    const eyebrow = data.result.eyebrow;
    const mouth = data.result.mouth;

    const eyeConfidence = toPercent(getTopConfidence(eye));
    const eyebrowConfidence = toPercent(getTopConfidence(eyebrow));
    const mouthConfidence = toPercent(getTopConfidence(mouth));

    return [
      `Eye: ${eye.predicted_class} (${eyeConfidence})`,
      `Eyebrow: ${eyebrow.predicted_class} (${eyebrowConfidence})`,
      `Mouth: ${mouth.predicted_class} (${mouthConfidence})`,
    ].join(" • ");
  };

  const analyzeBase64 = async (base64: string) => {
    setIsProcessing(true);
    setInsight(null);
    setScanResult(null);
    setStatus("Running face analysis...");

    try {
      const result: FaceScanResponse = await api.analyzeFace(base64);
      setScanResult(result);
      setInsight(buildInsightText(result));
      setStatus("Analysis Complete");
    } catch (e) {
      console.error("Backend face scan failed:", e);
      setStatus("Network Error or Processing Failed.");
      setInsight(null);
      setScanResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScanPress = async () => {
    if (!isCameraOpen) {
      setCapturedImage(null);
      setInsight(null);
      setScanResult(null);
      setStatus("Camera ready. Click picture to capture.");
      setIsCameraOpen(true);
      return;
    }

    if (cameraRef.current && !isProcessing) {
      try {
        setStatus("Capturing Image...");
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
        });

        if (!photo?.uri || !photo?.base64) {
          throw new Error("No image data returned from camera");
        }

        setCapturedImage(photo.uri);
        setIsCameraOpen(false);
        setStatus("Sending image to server...");

        await analyzeBase64(photo.base64);
      } catch (e) {
        console.warn("Camera Error:", e);
        setStatus("Camera Error. Please try again.");
        setIsCameraOpen(false);
      }
    }
  };

  const uploadImage = async () => {
    try {
      setInsight(null);
      setScanResult(null);
      setStatus("Opening gallery...");
      setIsCameraOpen(false);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        base64: true,
      });

      if (result.canceled) {
        setStatus("Ready to Scan");
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.base64 || !asset?.uri) {
        setStatus("Could not read selected image. Try again.");
        return;
      }

      setCapturedImage(asset.uri);
      setStatus("Sending image to server...");

      await analyzeBase64(asset.base64);
    } catch (e) {
      console.log("Upload image error:", e);
      setStatus("Image upload failed. Try again.");
      setIsProcessing(false);
    }
  };

  const renderResultCard = (
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    part: FacePartResult | undefined
  ) => {
    if (!part) return null;

    return (
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <Ionicons name={icon} size={18} color="#4c8dff" />
          <Text style={styles.resultLabel}>{label}</Text>
        </View>

        <Text style={styles.resultPrediction}>{part.predicted_class}</Text>
        <Text style={styles.resultConfidence}>
          Confidence: {toPercent(getTopConfidence(part))}
        </Text>
      </View>
    );
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.mainRow}>
          <Sidebar active="scan" />
          <View style={[styles.content, { justifyContent: "center" }]}>
            <View style={styles.permWrap}>
              <Ionicons name="camera" size={60} color={theme.primary} />
              <Text style={styles.permTitle}>Camera Permission Required</Text>
              <Text style={styles.permText}>
                NeuroScan requires camera access for facial biomarker analysis.
              </Text>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={requestPermission}
              >
                <Text style={styles.startText}>Allow Camera</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.mainRow}>
        <Sidebar active="scan" />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Facial Biomarker Scan</Text>
              <Text style={styles.subtitle}>
                Real-time facial analysis for neurological cues
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Face Analysis</Text>

              <View style={styles.faceRow}>
                <View style={styles.faceLeft}>
                  <View style={styles.facePreview}>
                    {isCameraOpen ? (
                      <CameraView
                        ref={cameraRef}
                        style={styles.faceImage}
                        facing="front"
                      />
                    ) : capturedImage ? (
                      <Image
                        source={{ uri: capturedImage }}
                        style={styles.faceImage}
                        resizeMode="contain"
                      />
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
                      style={[
                        styles.scanBtn,
                        isProcessing && styles.disabledBtn,
                      ]}
                      onPress={handleScanPress}
                      disabled={isProcessing}
                    >
                      <Ionicons name="camera" size={20} color="#fff" />
                      <Text style={styles.btnText}>
                        {isCameraOpen ? "Click Picture" : "Scan"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.uploadBtn,
                        isProcessing && styles.disabledBtn,
                      ]}
                      onPress={uploadImage}
                      disabled={isProcessing}
                    >
                      <Ionicons name="image" size={20} color="#000" />
                      <Text style={styles.uploadText}>Upload Image</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.faceInfo}>
                  <Text style={styles.faceInfoTitle}>Face Analysis Results</Text>

                  <Text style={styles.faceStatus}>
                    {isProcessing
                      ? "Analyzing facial biomarkers, please wait a few seconds..."
                      : scanResult
                      ? "Analysis complete:"
                      : "Tap Scan or Upload Image to start an analysis."}
                  </Text>

                  {insight && !isProcessing && (
                    <View style={styles.faceInsightBox}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#18a558"
                      />
                      <Text style={styles.faceInsightText}>{insight}</Text>
                    </View>
                  )}

                  {scanResult && !isProcessing && (
                    <View style={styles.resultsGrid}>
                      {renderResultCard("Eye", "eye-outline", scanResult.result.eye)}
                      {renderResultCard(
                        "Eyebrow",
                        "analytics-outline",
                        scanResult.result.eyebrow
                      )}
                      {renderResultCard(
                        "Mouth",
                        "happy-outline",
                        scanResult.result.mouth
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.statusBar}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  mainRow: { flex: 1, flexDirection: "row" },

  scrollContent: {
    flexGrow: 1,
  },

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

  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.textMain,
    letterSpacing: -0.5,
  },
  subtitle: { marginTop: 4, fontSize: 14, color: theme.textMuted },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 18,
    borderRadius: 22,
    padding: 18,
    ...shadow,
  },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#111" },

  faceRow: { flexDirection: "row", marginTop: 20, gap: 16 },
  faceLeft: { flex: 0.9 },
  facePreview: {
    width: "100%",
    height: 260,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  faceImage: { width: "100%", height: "100%" },

  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  placeholderText: { marginTop: 8, color: "#777", fontSize: 13 },

  buttonRowLeft: {
    flexDirection: "row",
    marginTop: 12,
    gap: 12,
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
  disabledBtn: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700" },
  uploadText: { color: "#111", fontWeight: "700" },

  faceInfo: { flex: 1.1, justifyContent: "flex-start" },
  faceInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  faceStatus: { fontSize: 13, color: "#666", marginBottom: 12 },
  faceInsightBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#e8fff1",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  faceInsightText: { color: "#155c31", fontSize: 13, flexShrink: 1 },

  resultsGrid: {
    gap: 10,
  },
  resultCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 12,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  resultPrediction: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  resultConfidence: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },

  statusBar: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 4,
  },
  statusText: { color: theme.textMuted, fontSize: 13 },

  permWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.textMain,
    marginTop: 20,
  },
  permText: {
    textAlign: "center",
    color: theme.textMuted,
    marginTop: 10,
    marginBottom: 30,
  },
  startBtn: {
    backgroundColor: theme.primary,
    borderRadius: 999,
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...shadow,
  },
  startText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});