import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { api } from "../../src/api";
import { theme, shadow } from "../../src/theme";

const SCREEN_HEIGHT = Dimensions.get("window").height;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState("Ready to Scan");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const scanLineY = useSharedValue(0);

  // Cleanup animations when leaving the screen
  useEffect(() => {
    return () => cancelAnimation(scanLineY);
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const startScan = async () => {
    // 1. Reset all states before starting
    setInsight(null);
    setScanning(true);
    setStatus("Capturing Image...");
    let base64Image = "";

    // 2. Snap the picture
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
        });
        if (photo && photo.uri && photo.base64) {
          setCapturedImage(photo.uri);
          base64Image = photo.base64;
        } else {
          throw new Error("No image data returned from camera");
        }
      } catch (e) {
        console.warn("Camera Error:", e);
        setScanning(false);
        setStatus("Camera Error. Please try again.");
        return;
      }
    }

    // 3. Start the visual laser sweep
    scanLineY.value = withRepeat(
      withTiming(SCREEN_HEIGHT * 0.6, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    // 4. Send to Backend
    try {
      setStatus("Running ResNet50 Analysis...");

      const result = await api.analyzeFace(base64Image);

      // 5. Handle Success
      setInsight(result.summary);
      cancelAnimation(scanLineY);
      setScanning(false);
      setStatus("Analysis Complete");
    } catch (e) {
      // 6. Handle Failure
      console.error("Backend Scan failed:", e);
      setStatus("Network Error or Processing Failed.");
      cancelAnimation(scanLineY);
      setScanning(false);
    }
  };

  const resetScanner = () => {
    setCapturedImage(null);
    setInsight(null);
    setStatus("Ready to Scan");
    setScanning(false);
    cancelAnimation(scanLineY);
  };

  if (!permission)
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.permWrap}>
          <Ionicons name="camera" size={60} color={theme.primary} />
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permText}>
            NeuroScan requires camera access for facial biomarker analysis.
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={requestPermission}>
            <Text style={styles.startText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Facial Biomarker Scan</Text>
        <Text style={styles.subtitle}>Center your face in the frame</Text>
      </View>

      <View style={styles.cameraWrap}>
        {capturedImage ? (
          <Image
            source={{ uri: capturedImage }}
            style={styles.camera}
            resizeMode="cover"
          />
        ) : (
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        )}

        {/* Laser Overlay */}
        <View style={styles.overlay} pointerEvents="none">
          {scanning && (
            <Animated.View style={[styles.laserLine, scanLineStyle]} />
          )}
        </View>

        {/* Bottom Status Bar */}
        <View style={styles.statusBar}>
          <ActivityIndicator
            size="small"
            color={scanning ? theme.primary : "transparent"}
          />
          <Text style={styles.statusText}>{status}</Text>
        </View>

        {/* Top Insight Badge */}
        {insight && (
          <View style={styles.insightBadge}>
            <Ionicons name="medical" size={20} color="#fff" />
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {insight ? (
          <TouchableOpacity
            style={[
              styles.startBtn,
              {
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
              },
            ]}
            onPress={resetScanner}
          >
            <Ionicons name="refresh" size={22} color={theme.textMain} />
            <Text style={[styles.startText, { color: theme.textMain }]}>
              Scan Again
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.startBtn,
              scanning && {
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
              },
            ]}
            onPress={startScan}
            disabled={scanning}
          >
            {scanning ? (
              <Text style={[styles.startText, { color: theme.textMain }]}>
                Analyzing...
              </Text>
            ) : (
              <>
                <Ionicons name="scan" size={22} color="#fff" />
                <Text style={styles.startText}>Initiate Scan</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.textMain,
    letterSpacing: -0.5,
  },
  subtitle: { marginTop: 4, fontSize: 14, color: theme.textMuted },

  cameraWrap: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
    flex: 1,
    backgroundColor: "#000",
    ...shadow,
  },
  camera: { flex: 1, width: "100%", height: "100%" },
  overlay: { ...StyleSheet.absoluteFillObject },

  laserLine: {
    width: "100%",
    height: 4,
    backgroundColor: theme.primary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },

  statusBar: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  statusText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  insightBadge: {
    position: "absolute",
    top: 20,
    alignSelf: "center",
    backgroundColor: theme.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  insightText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  controls: { padding: 24 },
  startBtn: {
    backgroundColor: theme.primary,
    borderRadius: 999,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...shadow,
  },
  startText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  permWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  permTitle: { fontSize: 20, fontWeight: "700", color: theme.textMain, marginTop: 20 },
  permText: {
    textAlign: "center",
    color: theme.textMuted,
    marginTop: 10,
    marginBottom: 30,
  },
});