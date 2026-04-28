import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../src/lib/auth";
import { colors, radii } from "../src/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@swastik.com");
  const [password, setPassword] = useState("admin123");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Missing", "Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      Alert.alert("Login failed", e?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: "https://images.pexels.com/photos/5378701/pexels-photo-5378701.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
      style={styles.bg}
      blurRadius={Platform.OS === "web" ? 0 : 6}
    >
      <View style={styles.overlay} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.brandWrap}>
              <View style={styles.logoBadge}>
                <Ionicons name="bed" size={26} color={colors.primaryText} />
              </View>
              <Text style={styles.brandKicker}>HOTEL SWASTIK</Text>
              <Text style={styles.brandTitle}>Welcome back</Text>
              <Text style={styles.brandSubtitle}>Sign in to manage your bookings</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <TextInput
                  testID="login-email-input"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="admin@swastik.com"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <TextInput
                  testID="login-password-input"
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!show}
                  placeholder="Enter password"
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity onPress={() => setShow(!show)} testID="login-toggle-show">
                  <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.cta, loading && { opacity: 0.7 }]}
                onPress={onSubmit}
                disabled={loading}
                testID="login-submit-button"
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.primaryText} />
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.helper}>
                Default: admin@swastik.com / admin123
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.primary },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,56,46,0.55)" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  brandWrap: { alignItems: "flex-start", marginBottom: 28 },
  logoBadge: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  brandKicker: {
    color: "rgba(255,255,255,0.8)", fontSize: 11, letterSpacing: 3, fontWeight: "700",
    marginBottom: 8,
  },
  brandTitle: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  brandSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 15, marginTop: 4 },
  card: {
    backgroundColor: colors.surface, borderRadius: radii.xl, padding: 22,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 24,
    elevation: 8,
  },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: colors.textMuted, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surfaceSecondary, borderRadius: radii.md,
    paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 14 : 6,
    borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 15, color: colors.textMain, paddingVertical: 8 },
  cta: {
    marginTop: 22, backgroundColor: colors.primary, borderRadius: radii.md,
    paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  ctaText: { color: colors.primaryText, fontSize: 16, fontWeight: "700" },
  helper: { textAlign: "center", marginTop: 12, fontSize: 12, color: colors.textMuted },
});
