import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
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
  withSequence,
} from "react-native-reanimated";
import { api } from "../../src/api";
import { theme, shadow } from "../../src/theme";

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [status, setStatus] = useState<"idle" | "aligning" | "detected" | "analyzing">("idle");
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef<any[]>([]);

  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const op1 = useSharedValue(0.5);
  const op2 = useSharedValue(0.5);

  useEffect(() => {
    if (scanning) {
      pulse1.value = withRepeat(
        withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      op1.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 0 }),
          withTiming(0, { duration: 1500 })
        ),
        -1,
        false
      );
      pulse2.value = withRepeat(
        withTiming(1.8, { duration: 1800, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      op2.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 0 }),
          withTiming(0, { duration: 1800 })
        ),
        -1,
        false
      );
    } else {
      pulse1.value = 1;
      pulse2.value = 1;
      op1.value = 0;
      op2.value = 0;
    }
  }, [scanning]);

  const pulseStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: pulse1.value }],
    opacity: op1.value,
  }));
  const pulseStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: pulse2.value }],
    opacity: op2.value,
  }));

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const startScan = () => {
    setScanning(true);
    setFaceDetected(false);
    setStatus("aligning");
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    // Simulated detection: align -> detected -> analyzing -> submit
    timers.current.push(
      setTimeout(() => {
        setStatus("detected");
        setFaceDetected(true);
      }, 2200)
    );
    timers.current.push(
      setTimeout(() => {
        setStatus("analyzing");
      }, 3800)
    );
    timers.current.push(
      setTimeout(async () => {
        try {
          setSubmitting(true);
          const scan = await api.createScan(true);
          setScanning(false);
          setStatus("idle");
          router.push({
            pathname: "/result",
            params: { id: scan.id },
          });
        } catch (e) {
          setScanning(false);
          setStatus("idle");
        } finally {
          setSubmitting(false);
        }
      }, 5500)
    );
  };

  const cancel = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    setScanning(false);
    setStatus("idle");
    setFaceDetected(false);
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
          <View style={styles.permIcon}>
            <Ionicons name="camera-outline" size={40} color={theme.primary} />
          </View>
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permText}>
            NeuroScan uses your front camera to analyze facial cues. Your video never
            leaves this device.
          </Text>
          <TouchableOpacity
            style={styles.permCta}
            onPress={requestPermission}
            testID="grant-camera-permission"
          >
            <Text style={styles.permCtaText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusText =
    status === "aligning"
      ? "Align Your Face"
      : status === "detected"
      ? "Face Detected"
      : status === "analyzing"
      ? "Analyzing Features…"
      : "Ready to Scan";

  const statusColor =
    status === "detected" || status === "analyzing" ? theme.low : theme.high;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Facial Scan</Text>
        <Text style={styles.subtitle}>Keep your face centered in the ring</Text>
      </View>

      <View style={styles.cameraWrap} testID="camera-view">
        {Platform.OS !== "web" ? (
          <CameraView style={styles.camera} facing="front" />
        ) : (
          <View style={[styles.camera, styles.webFallback]}>
            <Ionicons name="videocam-outline" size={48} color={theme.textMuted} />
            <Text style={styles.webFallbackText}>
              Camera preview runs on device.{"\n"}Tap Start to simulate.
            </Text>
          </View>
        )}
        <View style={styles.overlay} pointerEvents="none">
          {scanning && (
            <>
              <Animated.View style={[styles.pulse, pulseStyle2]} />
              <Animated.View style={[styles.pulse, pulseStyle1]} />
            </>
          )}
          <View
            style={[
              styles.ring,
              { borderColor: scanning ? statusColor : "#FFFFFF66" },
            ]}
          />
        </View>

        <View style={styles.statusBar} testID="face-status-indicator">
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        {!scanning ? (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={startScan}
            testID="scan-start-button"
          >
            <Ionicons name="scan" size={22} color="#fff" />
            <Text style={styles.startText}>Start Scan</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={cancel}
            disabled={submitting}
            testID="scan-cancel-button"
          >
            {submitting ? (
              <ActivityIndicator color={theme.textMain} />
            ) : (
              <>
                <Ionicons name="close" size={20} color={theme.textMain} />
                <Text style={styles.cancelText}>Cancel</Text>
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
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
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
  camera: { flex: 1 },
  webFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  webFallbackText: {
    marginTop: 12,
    color: theme.textMuted,
    textAlign: "center",
    fontSize: 13,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  ring: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 3,
  },
  statusBar: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  controls: { padding: 20 },
  startBtn: {
    backgroundColor: theme.primary,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...shadow,
  },
  startText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn: {
    backgroundColor: theme.surface,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelText: { color: theme.textMain, fontSize: 15, fontWeight: "700" },
  permWrap: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 14 },
  permIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  permTitle: { fontSize: 22, fontWeight: "800", color: theme.textMain },
  permText: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  permCta: {
    marginTop: 10,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  permCtaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
