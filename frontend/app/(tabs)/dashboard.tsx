import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, formatErr, Room } from "../../src/lib/api";
import { useLive } from "../../src/lib/live";
import { colors, radii } from "../../src/theme";

export default function Dashboard() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { lastEvent, connected } = useLive();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Room[]>("/rooms");
      setRooms(data);
    } catch (e) {
      Alert.alert("Error", formatErr(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Refresh on live events
  useEffect(() => {
    if (lastEvent && (lastEvent.type === "booking_created" || lastEvent.type === "booking_checked_out")) {
      load();
    }
  }, [lastEvent, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const occupied = rooms.filter((r) => r.is_occupied).length;
  const available = rooms.length - occupied;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>HOTEL SWASTIK</Text>
          <Text style={styles.title}>Rooms Overview</Text>
        </View>
        <View style={styles.liveBadge} testID="live-status">
          <View style={[styles.dot, { backgroundColor: connected ? "#22c55e" : "#9ca3af" }]} />
          <Text style={styles.liveText}>{connected ? "Live" : "Offline"}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.statRow}>
          <View style={[styles.statCard, { backgroundColor: colors.availableBg }]}>
            <Text style={[styles.statNum, { color: colors.availableText }]}>{available}</Text>
            <Text style={[styles.statLabel, { color: colors.availableText }]}>Available</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.occupiedBg }]}>
            <Text style={[styles.statNum, { color: colors.occupiedText }]}>{occupied}</Text>
            <Text style={[styles.statLabel, { color: colors.occupiedText }]}>Occupied</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{rooms.length}</Text>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Total</Text>
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.grid}>
            {rooms.map((r) => (
              <RoomCard
                key={r.room_no}
                room={r}
                onPress={() => {
                  if (r.is_occupied && r.current_booking) {
                    router.push(`/booking/${r.current_booking.id}`);
                  } else {
                    router.push({ pathname: "/booking/new", params: { room_no: r.room_no } });
                  }
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/booking/new")}
        testID="fab-new-booking"
      >
        <Ionicons name="add" size={26} color={colors.primaryText} />
        <Text style={styles.fabText}>New Booking</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function RoomCard({ room, onPress }: { room: Room; onPress: () => void }) {
  const isAC = room.room_type === "AC";
  const occupied = room.is_occupied;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.roomCard, occupied && { backgroundColor: "#FDF7F5" }]}
      testID={`room-card-${room.room_no}`}
    >
      <View style={styles.roomTopRow}>
        <Text style={styles.roomNo}>{room.room_no}</Text>
        <View style={[styles.tag, { backgroundColor: isAC ? colors.acBg : colors.nonacBg }]}>
          <Ionicons
            name={isAC ? "snow" : "sunny"}
            size={11}
            color={isAC ? colors.acText : colors.nonacText}
          />
          <Text style={[styles.tagText, { color: isAC ? colors.acText : colors.nonacText }]}>
            {isAC ? "AC" : "Non-AC"}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.statusChip,
          { backgroundColor: occupied ? colors.occupiedBg : colors.availableBg },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: occupied ? colors.occupiedText : colors.availableText }]} />
        <Text style={[styles.statusText, { color: occupied ? colors.occupiedText : colors.availableText }]}>
          {occupied ? "Occupied" : "Available"}
        </Text>
      </View>

      {occupied && room.current_booking ? (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.guestName} numberOfLines={1}>{room.current_booking.customer_name}</Text>
          <Text style={styles.guestMeta}>₹{room.current_booking.rate} • {room.current_booking.duration_hours}hr</Text>
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.priceLabel}>From</Text>
          <Text style={styles.priceValue}>₹{room.default_12hr}<Text style={styles.priceUnit}> / 12hr</Text></Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  kicker: { fontSize: 11, letterSpacing: 2.5, color: colors.textMuted, fontWeight: "700" },
  title: { fontSize: 26, fontWeight: "800", color: colors.textMain, marginTop: 4, letterSpacing: -0.5 },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  liveText: { fontSize: 11, fontWeight: "700", color: colors.textMain },
  scroll: { padding: 20, paddingBottom: 120 },
  statRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: radii.lg, paddingVertical: 14, paddingHorizontal: 12 },
  statNum: { fontSize: 26, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  roomCard: {
    width: "48%", flexGrow: 1,
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: 16,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  roomTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  roomNo: { fontSize: 28, fontWeight: "800", color: colors.primary, letterSpacing: -1 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "700" },
  guestName: { fontSize: 14, fontWeight: "700", color: colors.textMain },
  guestMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  priceLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "700", letterSpacing: 1 },
  priceValue: { fontSize: 16, fontWeight: "800", color: colors.textMain, marginTop: 2 },
  priceUnit: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  fab: {
    position: "absolute", right: 16, bottom: 80,
    backgroundColor: colors.accent, borderRadius: 999,
    paddingHorizontal: 18, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 6,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  fabText: { color: colors.primaryText, fontSize: 15, fontWeight: "700" },
});
