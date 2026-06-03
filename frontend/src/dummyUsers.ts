import { subDays } from "date-fns";

function genSeries(days = 30, base = 60, variance = 12) {
  const now = new Date();
  return Array.from({ length: days }).map((_, i) => {
    const date = subDays(now, days - 1 - i).toISOString();
    return { date, value: Math.max(0, Math.min(100, base + Math.round((Math.random() - 0.5) * variance))) };
  });
}

export const users = [
  {
    id: "u1",
    name: "Asha Patel",
    age: 68,
    summary: "Lives alone, mild tremors",
    gait: genSeries(30, 48, 18),
    bp: genSeries(30, 130, 14),
    face_score: genSeries(30, 50, 24),
    health_score: genSeries(30, 54, 20),
  },
  {
    id: "u2",
    name: "Miguel Santos",
    age: 74,
    summary: "Recent slowed movements",
    gait: genSeries(30, 40, 20),
    bp: genSeries(30, 140, 10),
    face_score: genSeries(30, 38, 22),
    health_score: genSeries(30, 45, 22),
  },
  {
    id: "u3",
    name: "Rita Kumar",
    age: 71,
    summary: "Complains of memory lapses",
    gait: genSeries(30, 62, 12),
    bp: genSeries(30, 125, 12),
    face_score: genSeries(30, 62, 18),
    health_score: genSeries(30, 68, 16),
  },
];

export function getUser(id: string) {
  return users.find((u) => u.id === id);
}
