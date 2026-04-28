import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/lib/auth";
import { useLive } from "../../src/lib/live";
import { colors, radii } from "../../src/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { connected } = useLive();

  const onLogout = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color={colors.primaryText} />
        </View>
        <Text style={styles.name}>{user?.name || "Admin"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Live Sync</Text>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: connected ? "#22c55e" : "#9ca3af" }]} />
          <Text style={styles.rowText}>{connected ? "Connected to live updates" : "Reconnecting..."}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hotel</Text>
        <Text style={styles.helper}>Hotel Swastik • 7 rooms</Text>
        <Text style={styles.helper}>AC: 103, 104, 107  •  Non-AC: 101, 102, 105, 106</Text>
        <Text style={styles.helper}>AC base ₹700 • Non-AC base ₹400 • +₹100 increments</Text>
      </View>

      <TouchableOpacity style={styles.logout} onPress={onLogout} testID="logout-button">
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  header: { paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "800", color: colors.textMain, letterSpacing: -0.5 },
  profileCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: 22,
    alignItems: "center", borderWidth: 1, borderColor: colors.border, marginTop: 6,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 999, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: "800", color: colors.textMain },
  email: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  roleBadge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surfaceSecondary },
  roleText: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: colors.primary },
  section: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: colors.border, marginTop: 12 },
  sectionTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: colors.textMuted, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  rowText: { fontSize: 14, color: colors.textMain, fontWeight: "600" },
  helper: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  logout: {
    marginTop: 20,
    backgroundColor: colors.accent, borderRadius: radii.md,
    paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  logoutText: { color: colors.primaryText, fontSize: 15, fontWeight: "700" },
});
