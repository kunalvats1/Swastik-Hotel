import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, Booking } from "../../src/lib/api";
import { useLive } from "../../src/lib/live";
import { colors, radii } from "../../src/theme";

type Tab = "active" | "completed";

export default function BookingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { lastEvent } = useLive();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Booking[]>(`/bookings?status=${tab}`);
      setItems(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (lastEvent) load();
  }, [lastEvent, load]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.subtitle}>{items.length} {tab === "active" ? "active" : "completed"}</Text>
      </View>

      <View style={styles.tabs}>
        <TabBtn label="Active" active={tab === "active"} onPress={() => setTab("active")} testID="tab-active" />
        <TabBtn label="History" active={tab === "completed"} onPress={() => setTab("completed")} testID="tab-history" />
      </View>

      {loading ? (
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bed-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No {tab} bookings</Text>
            </View>
          }
          renderItem={({ item }) => (
            <BookingItem item={item} onPress={() => router.push(`/booking/${item.id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress, testID }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]} testID={testID}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BookingItem({ item, onPress }: { item: Booking; onPress: () => void }) {
  const due = new Date(item.check_out_due);
  const overdue = item.status === "active" && due.getTime() < Date.now();
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} testID={`booking-item-${item.id}`}>
      <View style={styles.cardLeft}>
        <View style={styles.roomBadge}>
          <Text style={styles.roomBadgeText}>{item.room_no}</Text>
        </View>
        <View style={[styles.miniTag, { backgroundColor: item.room_type === "AC" ? colors.acBg : colors.nonacBg }]}>
          <Text style={[styles.miniTagText, { color: item.room_type === "AC" ? colors.acText : colors.nonacText }]}>
            {item.room_type === "AC" ? "AC" : "Non-AC"}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.guestName} numberOfLines={1}>{item.customer_name}</Text>
        <Text style={styles.meta}>📞 {item.phone} • #{item.aadhar_id.slice(-4)}</Text>
        <Text style={styles.meta}>
          ₹{item.rate} • {item.duration_hours}hr • {new Date(item.check_in).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </Text>
        {item.status === "active" && (
          <Text style={[styles.dueText, overdue && { color: colors.occupiedText }]}>
            Due: {due.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {overdue ? " • Overdue" : ""}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: "800", color: colors.textMain, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  tabs: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  tabBtnTextActive: { color: colors.primaryText },
  card: {
    flexDirection: "row", gap: 12, alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  cardLeft: { alignItems: "center", gap: 6 },
  roomBadge: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  roomBadgeText: { fontSize: 18, fontWeight: "800", color: colors.primary },
  miniTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  miniTagText: { fontSize: 9, fontWeight: "700" },
  guestName: { fontSize: 15, fontWeight: "700", color: colors.textMain },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  dueText: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: 4 },
  empty: { alignItems: "center", paddingVertical: 80, gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});
