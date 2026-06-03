import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { theme, shadow } from "../../src/theme";

type FacePartResult = {
  predicted_class: string;
  class_probs: Record<string, number>;
};

type ScanItem = {
  id: string;
  user_id: string;
  type: string;
  created_at: string;
  result: {
    eye: FacePartResult;
    eyebrow: FacePartResult;
    mouth: FacePartResult;
  };
};

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function getTopConfidence(part?: FacePartResult) {
  if (!part?.class_probs) return null;
  const values = Object.values(part.class_probs);
  if (!values.length) return null;
  return Math.max(...values);
}

function toPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function severityColor(label?: string) {
  const text = (label || "").toLowerCase();
  if (text.includes("severe")) return theme.high;
  if (text.includes("moderate")) return theme.moderate;
  return theme.low;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.listScans();
      setScans(Array.isArray(s) ? s : []);
    } catch (e) {
      console.log("History load failed:", e);
      setScans([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
    <SafeAreaView style={styles.safe}>
      <View style={styles.mainRow}>
        <Sidebar active="history" />

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>Scan History</Text>
            <Text style={styles.subtitle}>
              All saved scan records for the current user.
            </Text>
          </View>

          {scans.length === 0 ? (
            <View style={[styles.emptyCard, shadow]} testID="history-empty">
              <Ionicons name="time-outline" size={32} color={theme.primary} />
              <Text style={styles.emptyTitle}>No scans yet</Text>
              <Text style={styles.emptyText}>
                Run your first scan to start building history.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => router.push("/scan")}
                testID="history-start-scan"
              >
                <Text style={styles.emptyCtaText}>Start Scan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.historyCard, shadow]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>All Scans</Text>
                <Text style={styles.sectionMeta}>{scans.length} records</Text>
              </View>

              {scans.map((scan, index) => {
                const eye = scan.result?.eye;
                const eyebrow = scan.result?.eyebrow;
                const mouth = scan.result?.mouth;

                return (
                  <View
                    key={scan.id || `${scan.created_at}-${index}`}
                    style={styles.scanCard}
                  >
                    <View style={styles.scanTopRow}>
                      <View style={styles.scanTitleWrap}>
                        <View style={styles.scanIconWrap}>
                          <Ionicons
                            name="document-text-outline"
                            size={18}
                            color={theme.primary}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.scanTitle}>
                            {scan.type === "face" ? "Face Scan" : "Scan"}
                          </Text>
                          <Text style={styles.scanDate}>
                            {formatDateTime(scan.created_at)}
                          </Text>
                          <Text style={styles.scanMeta}>
                            Scan ID: {scan.id}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.metricsGrid}>
                      <ResultBox
                        label="Eye"
                        value={eye?.predicted_class || "N/A"}
                        confidence={toPercent(getTopConfidence(eye))}
                        color={severityColor(eye?.predicted_class)}
                        icon="eye-outline"
                      />
                      <ResultBox
                        label="Eyebrow"
                        value={eyebrow?.predicted_class || "N/A"}
                        confidence={toPercent(getTopConfidence(eyebrow))}
                        color={severityColor(eyebrow?.predicted_class)}
                        icon="analytics-outline"
                      />
                      <ResultBox
                        label="Mouth"
                        value={mouth?.predicted_class || "N/A"}
                        confidence={toPercent(getTopConfidence(mouth))}
                        color={severityColor(mouth?.predicted_class)}
                        icon="happy-outline"
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ResultBox({
  label,
  value,
  confidence,
  color,
  icon,
}: {
  label: string;
  value: string;
  confidence: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.metricBox}>
      <View style={styles.metricHeader}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricMeta}>Confidence: {confidence}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
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
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },

  header: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 6 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.textMain,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 4,
  },

  emptyCard: {
    backgroundColor: theme.surface,
    padding: 28,
    borderRadius: 24,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.textMain,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: "center",
  },
  emptyCta: {
    marginTop: 10,
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  emptyCtaText: { color: "#fff", fontWeight: "700" },

  historyCard: {
    backgroundColor: theme.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionMeta: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.textMain,
  },

  scanCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  scanTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  scanTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  scanIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#eef4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  scanTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.textMain,
  },
  scanDate: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 3,
  },
  scanMeta: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 3,
  },

  metricsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textMuted,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  metricMeta: {
    marginTop: 6,
    fontSize: 12,
    color: theme.textMuted,
  },
});