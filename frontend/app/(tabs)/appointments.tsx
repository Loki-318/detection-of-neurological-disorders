import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { theme, shadow } from "../../src/theme";

type Slot = {
  id: string;
  date: string;
  time: string;
  doctor: string;
  specialty: string;
};

export default function AppointmentsScreen() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [booked, setBooked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([api.slots(), api.myAppointments()]);
      setSlots(s);
      setBooked(b);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const book = async (slot: Slot) => {
    setBookingId(slot.id);
    try {
      await api.book(slot.id, slot.doctor, slot.date, slot.time);
      await load();
      Alert.alert("Appointment confirmed", `${slot.doctor} · ${slot.date} · ${slot.time}`);
    } catch (e: any) {
      Alert.alert("Booking failed", e?.message || "Try again");
    } finally {
      setBookingId(null);
    }
  };

  const grouped = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.date] ||= []).push(s);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Book an Appointment</Text>
        <Text style={styles.subtitle}>
          Meet a neurologist to review your screening results.
        </Text>

        {booked.length > 0 && (
          <View style={[styles.upcomingCard, shadow]} testID="upcoming-list">
            <Text style={styles.cardLabel}>Upcoming</Text>
            {booked.slice(0, 3).map((a) => (
              <View key={a.id} style={styles.upcomingRow}>
                <View style={styles.upIcon}>
                  <Ionicons name="calendar" size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upName}>{a.doctor}</Text>
                  <Text style={styles.upMeta}>
                    {a.date} · {a.time}
                  </Text>
                </View>
                <View style={styles.confPill}>
                  <Text style={styles.confText}>Confirmed</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          Object.entries(grouped).map(([date, list]) => (
            <View key={date} style={styles.daySection}>
              <Text style={styles.dayLabel}>{date}</Text>
              <View style={styles.slotsWrap}>
                {list.map((s) => {
                  const isBooking = bookingId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.slot, shadow]}
                      onPress={() => book(s)}
                      disabled={!!bookingId}
                      testID="appointment-slot-pill"
                    >
                      <View style={styles.slotTop}>
                        <Text style={styles.slotTime}>{s.time}</Text>
                        {isBooking ? (
                          <ActivityIndicator size="small" color={theme.primary} />
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={theme.textMuted}
                          />
                        )}
                      </View>
                      <Text style={styles.slotDoc}>{s.doctor}</Text>
                      <Text style={styles.slotSpec}>{s.specialty}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 18 },
  title: { fontSize: 28, fontWeight: "800", color: theme.textMain, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: theme.textMuted, marginTop: -8 },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  upcomingCard: {
    backgroundColor: theme.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  upIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  upName: { fontSize: 15, fontWeight: "700", color: theme.textMain },
  upMeta: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  confPill: {
    backgroundColor: theme.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  confText: { color: theme.primary, fontSize: 11, fontWeight: "700" },
  daySection: { gap: 10 },
  dayLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  slotsWrap: { gap: 10 },
  slot: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  slotTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotTime: { fontSize: 17, fontWeight: "800", color: theme.textMain },
  slotDoc: { fontSize: 14, fontWeight: "600", color: theme.textMain, marginTop: 6 },
  slotSpec: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  center: { padding: 40, alignItems: "center" },
});
