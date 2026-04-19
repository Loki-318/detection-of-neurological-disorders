import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { theme } from "./theme";

type Point = { label: string; value: number };

export default function TrendChart({
  points,
  height = 160,
  color = theme.primary,
}: {
  points: Point[];
  height?: number;
  color?: string;
}) {
  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No scans yet — run your first scan to see trends.</Text>
      </View>
    );
  }

  const padding = { top: 16, right: 16, bottom: 28, left: 28 };
  const width = 320;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = 100;
  const min = 0;

  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = padding.left + step * i;
    const y = padding.top + innerH * (1 - (p.value - min) / (max - min));
    return { x, y, ...p };
  });

  const d = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  // Area fill path
  const areaD = `${d} L ${coords[coords.length - 1].x} ${padding.top + innerH} L ${
    coords[0].x
  } ${padding.top + innerH} Z`;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 25, 50, 75, 100].map((g) => {
          const y = padding.top + innerH * (1 - g / 100);
          return (
            <Line
              key={g}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke={theme.border}
              strokeWidth={1}
            />
          );
        })}
        <Path d={areaD} fill={color} opacity={0.12} />
        <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={4} fill={color} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.bg,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
