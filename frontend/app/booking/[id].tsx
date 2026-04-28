import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, BookingDetail, formatErr } from "../../src/lib/api";
import { colors, radii } from "../../src/theme";

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [b, setB] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<BookingDetail>(`/bookings/${id}`);
      setB(data);
    } catch (e) {
      Alert.alert("Error", formatErr(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const checkout = () => {
    Alert.alert("Checkout", "Mark this booking as completed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, checkout",
        onPress: async () => {
          setWorking(true);
          try {
            await api.post(`/bookings/${id}/checkout`);
            await load();
          } catch (e) {
            Alert.alert("Error", formatErr(e));
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: "center", justifyContent: "center" }]} edges={["top"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }
  if (!b) return null;

  const due = new Date(b.check_out_due);
  const overdue = b.status === "active" && due.getTime() < Date.now();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="detail-back">
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.roomBlock}>
            <Text style={styles.roomNo}>{b.room_no}</Text>
            <View style={[styles.tag, { backgroundColor: b.room_type === "AC" ? colors.acBg : colors.nonacBg }]}>
              <Text style={[styles.tagText, { color: b.room_type === "AC" ? colors.acText : colors.nonacText }]}>
                {b.room_type === "AC" ? "AC" : "Non-AC"}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View
              style={[
                styles.statusChip,
                { backgroundColor: b.status === "active" ? colors.availableBg : colors.surfaceSecondary },
              ]}
            >
              <Text style={[styles.statusText, { color: b.status === "active" ? colors.availableText : colors.textMuted }]}>
                {b.status === "active" ? "ACTIVE" : "COMPLETED"}
              </Text>
            </View>
            <Text style={styles.guest}>{b.customer_name}</Text>
            <Text style={styles.guestSub}>₹{b.rate} • {b.duration_hours} hrs</Text>
          </View>
        </View>

        {/* Times */}
        <Card>
          <Row label="Check-in" value={new Date(b.check_in).toLocaleString("en-IN")} />
          <Row
            label="Due"
            value={due.toLocaleString("en-IN")}
            valueStyle={overdue ? { color: colors.occupiedText, fontWeight: "700" } : undefined}
          />
          {b.checked_out_at && (
            <Row label="Checked out" value={new Date(b.checked_out_at).toLocaleString("en-IN")} />
          )}
        </Card>

        {/* Customer */}
        <SectionTitle>CUSTOMER</SectionTitle>
        <Card>
          <Row label="Name" value={b.customer_name} />
          <Row label="Aadhar" value={b.aadhar_id} mono />
          <Row label="Phone" value={b.phone} />
        </Card>

        {b.aadhar_front_b64 || b.aadhar_back_b64 ? (
          <View style={styles.photoRow}>
            {b.aadhar_front_b64 ? <Image source={{ uri: b.aadhar_front_b64 }} style={styles.photo} /> : null}
            {b.aadhar_back_b64 ? <Image source={{ uri: b.aadhar_back_b64 }} style={styles.photo} /> : null}
          </View>
        ) : null}

        {/* Partner */}
        {b.partner_name ? (
          <>
            <SectionTitle>PARTNER</SectionTitle>
            <Card>
              <Row label="Name" value={b.partner_name} />
              {b.partner_aadhar ? <Row label="Aadhar" value={b.partner_aadhar} mono /> : null}
            </Card>
            {b.partner_aadhar_front_b64 || b.partner_aadhar_back_b64 ? (
              <View style={styles.photoRow}>
                {b.partner_aadhar_front_b64 ? <Image source={{ uri: b.partner_aadhar_front_b64 }} style={styles.photo} /> : null}
                {b.partner_aadhar_back_b64 ? <Image source={{ uri: b.partner_aadhar_back_b64 }} style={styles.photo} /> : null}
              </View>
            ) : null}
          </>
        ) : null}

        {/* Meta */}
        <SectionTitle>META</SectionTitle>
        <Card>
          <Row label="Created by" value={b.created_by} />
          <Row label="Created at" value={new Date(b.created_at).toLocaleString("en-IN")} />
          {b.notes ? <Row label="Notes" value={b.notes} /> : null}
        </Card>

        {b.status === "active" && (
          <TouchableOpacity
            style={[styles.checkoutBtn, working && { opacity: 0.7 }]}
            onPress={checkout}
            disabled={working}
            testID="checkout-button"
          >
            {working ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color={colors.primaryText} />
                <Text style={styles.checkoutText}>Check Out Guest</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}
function Row({ label, value, mono, valueStyle }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && { fontVariant: ["tabular-nums"] }, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.textMain },
  scroll: { padding: 20, paddingBottom: 40 },
  hero: {
    flexDirection: "row", gap: 14,
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  roomBlock: { alignItems: "center", gap: 6 },
  roomNo: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: colors.primary,
    color: colors.primaryText, fontSize: 24, fontWeight: "800",
    textAlign: "center", textAlignVertical: "center", lineHeight: 64,
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  statusChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginBottom: 6 },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  guest: { fontSize: 18, fontWeight: "800", color: colors.textMain },
  guestSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface, borderRadius: radii.md, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  section: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: colors.textMuted, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  rowValue: { fontSize: 13, color: colors.textMain, fontWeight: "600", flex: 1, textAlign: "right", marginLeft: 12 },
  photoRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  photo: { flex: 1, aspectRatio: 1.4, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary },
  checkoutBtn: {
    marginTop: 22, backgroundColor: colors.accent, borderRadius: radii.md,
    paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  checkoutText: { color: colors.primaryText, fontSize: 16, fontWeight: "700" },
});
