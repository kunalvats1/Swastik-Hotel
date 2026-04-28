import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, Booking, formatErr } from "../../src/lib/api";
import { colors, radii } from "../../src/theme";

type Field = "any" | "name" | "aadhar" | "phone";

export default function SearchScreen() {
  const router = useRouter();
  const [field, setField] = useState<Field>("any");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Booking[]>([]);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setTouched(true);
    setError(null);
    try {
      const { data } = await api.get<Booking[]>("/bookings/search", { params: { q: q.trim(), field } });
      setResults(data);
    } catch (e) {
      setError(formatErr(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Search</Text>
          <Text style={styles.subtitle}>Find guest by name, Aadhar or phone</Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            testID="search-input"
            value={q}
            onChangeText={setQ}
            placeholder={`Search by ${field}...`}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            onSubmitEditing={search}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {q ? (
            <TouchableOpacity onPress={() => { setQ(""); setResults([]); setTouched(false); }} testID="search-clear">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {(["any", "name", "aadhar", "phone"] as Field[]).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setField(f)}
              style={[styles.filterChip, field === f && styles.filterChipActive]}
              testID={`filter-${f}`}
            >
              <Text style={[styles.filterText, field === f && styles.filterTextActive]}>
                {f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.searchBtn} onPress={search} disabled={!q.trim()} testID="search-submit">
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 100 }}
            ListEmptyComponent={
              touched ? (
                <View style={styles.empty}>
                  <Ionicons name="file-tray-outline" size={42} color={colors.textMuted} />
                  <Text style={styles.emptyText}>{error || "No matches found"}</Text>
                </View>
              ) : (
                <View style={styles.empty}>
                  <Ionicons name="search-outline" size={42} color={colors.textMuted} />
                  <Text style={styles.emptyText}>Type and tap Search</Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultCard}
                onPress={() => router.push(`/booking/${item.id}`)}
                testID={`search-result-${item.id}`}
              >
                <View style={styles.roomBadge}>
                  <Text style={styles.roomBadgeText}>{item.room_no}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guestName}>{item.customer_name}</Text>
                  <Text style={styles.meta}>{item.phone}</Text>
                  <Text style={styles.meta}>Aadhar: ****{item.aadhar_id.slice(-4)}</Text>
                  <Text style={[styles.statusPill, { backgroundColor: item.status === "active" ? colors.availableBg : colors.surfaceSecondary, color: item.status === "active" ? colors.availableText : colors.textMuted }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", color: colors.textMain, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  searchBar: {
    marginHorizontal: 20, marginTop: 8,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textMain, paddingVertical: 4 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginTop: 12, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: colors.textMuted },
  filterTextActive: { color: colors.primaryText },
  searchBtn: { backgroundColor: colors.accent, marginHorizontal: 20, marginTop: 12, paddingVertical: 14, borderRadius: radii.md, alignItems: "center" },
  searchBtnText: { color: colors.primaryText, fontWeight: "700", fontSize: 15 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  resultCard: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    backgroundColor: colors.surface, borderRadius: radii.lg, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  roomBadge: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  roomBadgeText: { fontSize: 18, fontWeight: "800", color: colors.primary },
  guestName: { fontSize: 15, fontWeight: "700", color: colors.textMain },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusPill: { alignSelf: "flex-start", marginTop: 6, fontSize: 10, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
});
