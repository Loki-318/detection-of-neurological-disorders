import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle, Line, G } from "react-native-svg";
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

type TrendPoint = {
  date: string;
  score: number;
  severe: boolean;
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

function formatShortDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
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

function classToScore(label?: string) {
  const text = (label || "").toLowerCase();
  if (text.includes("moderate severe")) return 3;
  if (text.includes("severe")) return 4;
  if (text.includes("moderate")) return 2;
  return 1;
}

function average(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function buildDetectionSummary(scan: ScanItem) {
  const eye = scan.result?.eye;
  const eyebrow = scan.result?.eyebrow;
  const mouth = scan.result?.mouth;

  const eyeScore = classToScore(eye?.predicted_class);
  const eyebrowScore = classToScore(eyebrow?.predicted_class);
  const mouthScore = classToScore(mouth?.predicted_class);

  const severityAvg = average([eyeScore, eyebrowScore, mouthScore]);
  const confidenceAvg = average([
    getTopConfidence(eye) ?? 0,
    getTopConfidence(eyebrow) ?? 0,
    getTopConfidence(mouth) ?? 0,
  ]);

  let riskLevel = "Low";
  let pattern = "No strong neurological facial pattern";
  let statusColor = theme.low;
  let action = "Continue monitoring with future scans.";
  let badge = "Stable";

  if (severityAvg > 3.25) {
    riskLevel = "High";
    pattern = "Strong Parkinsonian-style facial masking pattern";
    statusColor = theme.high;
    action = "Recommend neurological review and gait correlation.";
    badge = "High risk";
  } else if (severityAvg > 2.5) {
    riskLevel = "High";
    pattern = "Moderate-severe facial motor reduction pattern";
    statusColor = theme.high;
    action = "Recommend repeat scan and clinical follow-up.";
    badge = "High risk";
  } else if (severityAvg > 1.5) {
    riskLevel = "Medium";
    pattern = "Moderate facial movement reduction pattern";
    statusColor = theme.moderate;
    action = "Watch trend over time and compare with gait findings.";
    badge = "Watch";
  }

  return {
    riskLevel,
    pattern,
    statusColor,
    action,
    badge,
    severityAvg,
    confidenceAvg,
    severe: severityAvg >= 3.25,
  };
}

function buildFaceTrend(scans: ScanItem[]): TrendPoint[] {
  const sorted = scans
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .map((scan) => {
      const eye = classToScore(scan.result?.eye?.predicted_class);
      const eyebrow = classToScore(scan.result?.eyebrow?.predicted_class);
      const mouth = classToScore(scan.result?.mouth?.predicted_class);

      const score = average([eye, eyebrow, mouth]);
      return {
        date: scan.created_at,
        score,
        severe: score >= 3.25,
      };
    });

  return sorted.length > 14 ? sorted.slice(-14) : sorted;
}

function getTrendLabel(points: TrendPoint[]) {
  if (points.length < 2) return "Not enough data";

  const recent = points.slice(-3);
  if (recent.length < 2) return "Not enough data";

  const first = recent[0].score;
  const last = recent[recent.length - 1].score;
  const delta = last - first;

  if (delta > 0.15) return "Increasing";
  if (delta < -0.15) return "Decreasing";
  return "Stable";
}

function getTrendColor(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("increasing")) return theme.high;
  if (lower.includes("decreasing")) return theme.low;
  return theme.moderate;
}

function getLatestScanSummary(scans: ScanItem[]) {
  if (!scans.length) return null;

  const sorted = scans
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const latest = sorted[sorted.length - 1];
  return buildDetectionSummary(latest);
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const chartBoxWidth = Dimensions.get("window").width - 32;
  const chartHeight = 180;
  const svgWidth = chartBoxWidth - 48;
  const paddingLeft = 20;
  const paddingRight = 20;
  const paddingY = 16;

  const visiblePoints = points.length > 14 ? points.slice(-14) : points;

  const min = 1;
  const max = 4;
  const range = max - min;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingY * 2;
  const xStep =
    visiblePoints.length > 1
      ? plotWidth / (visiblePoints.length - 1)
      : plotWidth;

  const coords = visiblePoints.map((p, i) => {
    const x = paddingLeft + i * xStep;
    const normalized = (p.score - min) / range;
    const y = paddingY + (1 - normalized) * plotHeight;
    return { x, y, severe: p.severe, score: p.score, date: p.date };
  });

  const path = coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const gridLines = [1, 2, 3, 4];

  const labelIndexes = new Set<number>();
  if (coords.length > 0) labelIndexes.add(0);
  if (coords.length > 1) labelIndexes.add(coords.length - 1);
  if (coords.length > 2) labelIndexes.add(Math.floor(coords.length / 2));
  if (coords.length > 4) {
    for (let i = 0; i < coords.length; i += 3) labelIndexes.add(i);
  }

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Face severity trend</Text>
          <Text style={styles.chartSubtitleSmall}>
            Higher line means stronger facial movement reduction
          </Text>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.low }]} />
            <Text style={styles.legendText}>Normal</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.high }]} />
            <Text style={styles.legendText}>Severe</Text>
          </View>
        </View>
      </View>

      <View style={[styles.chartArea, { height: chartHeight }]}>
        <View style={styles.yAxis}>
          {gridLines.map((tick) => (
            <Text key={tick} style={styles.yAxisLabel}>
              {tick}
            </Text>
          ))}
        </View>

        <View style={styles.svgWrap}>
          <Svg width={svgWidth} height={chartHeight}>
            <G>
              {gridLines.map((tick) => {
                const normalized = (tick - min) / range;
                const y = paddingY + (1 - normalized) * plotHeight;
                return (
                  <Line
                    key={tick}
                    x1={paddingLeft}
                    y1={y}
                    x2={paddingLeft + plotWidth}
                    y2={y}
                    stroke="#e5eaf1"
                    strokeWidth={1}
                  />
                );
              })}

              {coords.length >= 2 && (
                <Path
                  d={path}
                  stroke={theme.primary}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {coords.map((p, index) => (
                <Circle
                  key={index}
                  cx={p.x}
                  cy={p.y}
                  r={p.severe ? 5.5 : 4}
                  fill={p.severe ? theme.high : theme.low}
                  stroke="#fff"
                  strokeWidth={2}
                />
              ))}
            </G>
          </Svg>
        </View>
      </View>

      <View style={styles.xAxisRow}>
        {coords.map((p, index) => (
          <View key={index} style={[styles.axisLabelWrap, { width: xStep }]}>
            <Text
              style={[
                styles.axisLabel,
                { textAlign: index === coords.length - 1 ? "right" : "center" },
              ]}
              numberOfLines={1}
            >
              {labelIndexes.has(index) ? formatShortDate(p.date) : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
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

  const sortedScans = useMemo(
    () =>
      scans
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    [scans]
  );

  const trendPoints = useMemo(() => buildFaceTrend(sortedScans), [sortedScans]);
  const trendLabel = useMemo(() => getTrendLabel(trendPoints), [trendPoints]);
  const trendColor = getTrendColor(trendLabel);

  const latestDetection = useMemo(
    () => getLatestScanSummary(sortedScans),
    [sortedScans]
  );

  return (
    <SafeAreaView style={styles.safe}>
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Scan History</Text>
          <Text style={styles.subtitle}>
            Saved scan records with face trend visualization.
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
          <>
            <View style={[styles.compositeCard, shadow]}>
              <View style={styles.compositeTop}>
                <View style={styles.compositeHeaderRow}>
                  <Ionicons name="pulse-outline" size={18} color={trendColor} />
                  <Text style={styles.compositeLabel}>Screening Summary</Text>
                </View>

                <View
                  style={[
                    styles.riskBadge,
                    { backgroundColor: `${trendColor}18` },
                  ]}
                >
                  <Text style={[styles.riskBadgeText, { color: trendColor }]}>
                    {trendLabel}
                  </Text>
                </View>
              </View>

              <Text style={[styles.compositeStatus, { color: trendColor }]}>
                {latestDetection?.pattern || "No strong trend detected"}
              </Text>

              <Text style={styles.compositeText}>
                {latestDetection
                  ? `Risk level: ${latestDetection.riskLevel} • Severity index: ${latestDetection.severityAvg.toFixed(
                      2
                    )} • Mean confidence: ${toPercent(
                      latestDetection.confidenceAvg
                    )}`
                  : "No summary available yet."}
              </Text>

              <Text style={styles.compositeNote}>
                Screening support only — not a diagnosis.
              </Text>
            </View>

            {trendPoints.length >= 2 ? <TrendChart points={trendPoints} /> : null}

            <View style={[styles.historyCard, shadow]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>All Scans</Text>
                <Text style={styles.sectionMeta}>{scans.length} records</Text>
              </View>

              {sortedScans.map((scan, index) => {
                const eye = scan.result?.eye;
                const eyebrow = scan.result?.eyebrow;
                const mouth = scan.result?.mouth;
                const detection = buildDetectionSummary(scan);

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
                          <Text style={styles.scanMeta}>Scan ID: {scan.id}</Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.riskBadge,
                          { backgroundColor: `${detection.statusColor}18` },
                        ]}
                      >
                        <Text
                          style={[
                            styles.riskBadgeText,
                            { color: detection.statusColor },
                          ]}
                        >
                          {detection.badge}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.detectionBox,
                        { borderColor: detection.statusColor },
                      ]}
                    >
                      <View style={styles.detectionHeader}>
                        <Ionicons
                          name="pulse-outline"
                          size={16}
                          color={detection.statusColor}
                        />
                        <Text style={styles.detectionTitle}>
                          Detection summary
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.detectionPattern,
                          { color: detection.statusColor },
                        ]}
                      >
                        {detection.pattern}
                      </Text>

                      <Text style={styles.detectionText}>
                        Risk level: {detection.riskLevel} • Severity index:{" "}
                        {detection.severityAvg.toFixed(2)} • Mean confidence:{" "}
                        {toPercent(detection.confidenceAvg)}
                      </Text>

                      <Text style={styles.detectionNote}>
                        Screening support only — not a diagnosis.
                      </Text>
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
          </>
        )}
      </ScrollView>
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

  compositeCard: {
    backgroundColor: theme.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  compositeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  compositeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  compositeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textMuted,
  },
  compositeStatus: {
    fontSize: 18,
    fontWeight: "800",
  },
  compositeText: {
    fontSize: 12,
    color: theme.textMain,
    lineHeight: 18,
  },
  compositeNote: {
    fontSize: 11,
    color: theme.textMuted,
  },

  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },

  chartWrap: {
    backgroundColor: theme.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
    overflow: "hidden",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.textMain,
  },
  chartSubtitleSmall: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 4,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: "600",
  },

  chartArea: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    overflow: "hidden",
    paddingVertical: 10,
    width: "100%",
  },
  yAxis: {
    width: 24,
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingLeft: 6,
  },
  yAxisLabel: {
    fontSize: 10,
    color: theme.textMuted,
  },
  svgWrap: {
    flex: 1,
    overflow: "hidden",
  },
  xAxisRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 6,
  },
  axisLabelWrap: {
    position: "relative",
  },
  axisLabel: {
    width: "100%",
    fontSize: 10,
    color: theme.textMuted,
  },

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

  detectionBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
  },
  detectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  detectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textMuted,
  },
  detectionPattern: {
    fontSize: 15,
    fontWeight: "800",
  },
  detectionText: {
    marginTop: 6,
    fontSize: 12,
    color: theme.textMain,
    lineHeight: 18,
  },
  detectionNote: {
    marginTop: 6,
    fontSize: 11,
    color: theme.textMuted,
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