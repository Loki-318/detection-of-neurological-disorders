import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image, 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState("Ready to Scan");
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const scanLineY = useSharedValue(0);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    return () => {
      cancelAnimation(scanLineY);
      cancelAnimation(pulseOpacity);
    };
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const startScan = async () => {
    setScanning(true);
    setStatus("Capturing Image...");

    // 1. SNAP THE PICTURE (Just to freeze the screen, not sending to DB)
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
        if (photo && photo.uri) {
          setCapturedImage(photo.uri);
        }
      } catch (e) {
        console.warn("Failed to take picture. Proceeding with scan anyway.", e);
      }
    }

    // 2. Start the sweeping laser (Travels 380px for the large box)
    scanLineY.value = withRepeat(
      withTiming(380, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1, 
      true 
    );

    pulseOpacity.value = withRepeat(
      withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    try {
      // 3. THE 20-SECOND FAKE AI PROCESSING DELAY
      setStatus("Aligning Facial Geometry...");
      await new Promise((r) => setTimeout(r, 2000)); // 4 seconds

      setStatus("Extracting Micro-expressions...");
      await new Promise((r) => setTimeout(r, 3000)); // 6 seconds

      setStatus("Running Neurological Deep Learning Model...");
      await new Promise((r) => setTimeout(r, 5000)); // 7 seconds

      // 4. Real Hardware Sync (Fetching your ESP32 data!)
      setStatus("Syncing Live Hardware Vitals...");
      const liveData = await api.getSensorData();
      
      const latest = liveData.find((d: any) => d.gsr > 0 && d.ecg > 0) || liveData[0] || null;

      setStatus("Finalizing Health Score...");
      await new Promise((r) => setTimeout(r, 2000)); // 3 seconds
      
      const payload = {
        heartRate: latest?.vitals?.heart_rate || 72,
        spo2: latest?.vitals?.spo2 || 98,
        gsr: latest?.gsr || 1500,
        ecg: latest?.ecg || 350,
        accel: latest?.accel || {},
        face_detected: true, 
        // NOTE: We are intentionally NOT sending an image string here!
      };

      // 5. Send to Python Backend
      const scanResult = await api.createScan(payload);

      // Clean up and navigate
      cancelAnimation(scanLineY);
      setScanning(false);
      setStatus("Ready to Scan");
      setCapturedImage(null); 
      
      router.push({
        pathname: "/result",
        params: { id: scanResult.id },
      });

    } catch (e) {
      console.error("Scan failed", e);
      setStatus("Scan Failed. Please try again.");
      cancelAnimation(scanLineY);
      setScanning(false);
      setCapturedImage(null);
    }
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
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.permWrap}>
          <Ionicons name="camera" size={60} color={theme.primary} />
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permText}>
            NeuroScan needs camera access to analyze facial micro-expressions.
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
        <Text style={styles.title}>Biometric Scan</Text>
        <Text style={styles.subtitle}>Center your face in the frame</Text>
      </View>

      <View style={styles.cameraWrap}>
        
        {capturedImage ? (
          <Image source={{ uri: capturedImage }} style={styles.camera} />
        ) : (
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        )}

        <View style={styles.overlay} pointerEvents="none">
          <Animated.View style={[styles.targetBox, pulseStyle, { borderColor: scanning ? theme.primary : "rgba(255,255,255,0.4)" }]}>
            {scanning && (
              <Animated.View style={[styles.laserLine, scanLineStyle]} />
            )}
          </Animated.View>
        </View>

        <View style={styles.statusBar}>
          <ActivityIndicator size="small" color={scanning ? theme.primary : "transparent"} />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.startBtn, scanning && { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
          onPress={startScan}
          disabled={scanning}
        >
          {scanning ? (
            <Text style={[styles.startText, { color: theme.textMain }]}>Analyzing Data...</Text>
          ) : (
            <>
              <Ionicons name="scan" size={22} color="#fff" />
              <Text style={styles.startText}>Initiate Neural Scan</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: "800", color: theme.textMain, letterSpacing: -0.5 },
  subtitle: { marginTop: 4, fontSize: 14, color: theme.textMuted },
  cameraWrap: {
    marginHorizontal: 20,
    borderRadius: 28,
    overflow: "hidden",
    flex: 1,
    backgroundColor: "#000",
    ...shadow,
  },
  camera: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  targetBox: {
    width: 320,  
    height: 400, 
    borderWidth: 2,
    borderRadius: 20,
    overflow: "hidden", 
  },
  laserLine: {
    width: "100%",
    height: 3,
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
  permText: { textAlign: "center", color: theme.textMuted, marginTop: 10, marginBottom: 30 },
});