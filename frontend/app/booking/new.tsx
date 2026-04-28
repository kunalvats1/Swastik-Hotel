import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api, formatErr, Room } from "../../src/lib/api";
import { colors, radii } from "../../src/theme";

type Duration = 12 | 24;

export default function NewBooking() {
  const router = useRouter();
  const params = useLocalSearchParams<{ room_no?: string }>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomNo, setRoomNo] = useState<string | undefined>(params.room_no);
  const [duration, setDuration] = useState<Duration>(12);
  const [name, setName] = useState("");
  const [aadhar, setAadhar] = useState("");
  const [phone, setPhone] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerAadhar, setPartnerAadhar] = useState("");
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [pFront, setPFront] = useState<string | null>(null);
  const [pBack, setPBack] = useState<string | null>(null);
  const [extra, setExtra] = useState(0); // multiples of 100
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showRooms, setShowRooms] = useState(false);
  const [includePartner, setIncludePartner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api.get<Room[]>("/rooms").then(({ data }) => setRooms(data)).catch(() => {});
  }, []);

  const room = useMemo(() => rooms.find((r) => r.room_no === roomNo), [rooms, roomNo]);
  const base = room?.base_price ?? 0;
  const defaultRate = duration === 12 ? room?.default_12hr ?? 0 : room?.default_24hr ?? 0;
  const rate = base + extra;

  // When room or duration changes, set extra so rate matches default
  useEffect(() => {
    if (room) {
      const defaultExtra = (duration === 12 ? room.default_12hr : room.default_24hr) - room.base_price;
      setExtra(Math.max(0, defaultExtra));
    }
  }, [roomNo, duration, room]);

  const pickImage = async (setter: (v: string | null) => void) => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Please allow access to photos");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      const a = res.assets[0];
      setter(`data:${a.mimeType || "image/jpeg"};base64,${a.base64}`);
    }
  };

  const captureImage = async (setter: (v: string | null) => void) => {
    setError(null);
    if (Platform.OS === "web") {
      // Camera not reliable on web - fall back to gallery/file picker
      return pickImage(setter);
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Please allow camera access");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      const a = res.assets[0];
      setter(`data:${a.mimeType || "image/jpeg"};base64,${a.base64}`);
    }
  };

  const promptPhoto = (setter: (v: string | null) => void) => {
    if (Platform.OS === "web") {
      // On web just open file picker directly
      pickImage(setter);
      return;
    }
    Alert.alert("Add Aadhar Photo", "Choose source", [
      { text: "Camera", onPress: () => captureImage(setter) },
      { text: "Gallery", onPress: () => pickImage(setter) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!roomNo) { setError("Please select a room"); return; }
    if (!name.trim()) { setError("Customer name is required"); return; }
    const aClean = aadhar.replace(/\s/g, "");
    if (!/^\d{12}$/.test(aClean)) { setError("Aadhar must be 12 digits"); return; }
    if (!/^\d{10}$/.test(phone.replace(/\s/g, ""))) {
      setError("Phone must be 10 digits"); return;
    }
    if (!front || !back) { setError("Aadhar front and back photos are required"); return; }
    if (includePartner) {
      if (!partnerName.trim()) { setError("Partner name required"); return; }
      const pClean = partnerAadhar.replace(/\s/g, "");
      if (!/^\d{12}$/.test(pClean)) { setError("Partner Aadhar must be 12 digits"); return; }
      if (!pFront || !pBack) { setError("Partner Aadhar photos required"); return; }
    }

    setSubmitting(true);
    try {
      await api.post("/bookings", {
        room_no: roomNo,
        customer_name: name.trim(),
        aadhar_id: aClean,
        phone: phone.replace(/\s/g, ""),
        partner_name: includePartner ? partnerName.trim() : null,
        partner_aadhar: includePartner ? partnerAadhar.replace(/\s/g, "") : null,
        aadhar_front_b64: front,
        aadhar_back_b64: back,
        partner_aadhar_front_b64: includePartner ? pFront : null,
        partner_aadhar_back_b64: includePartner ? pBack : null,
        duration_hours: duration,
        rate,
        notes: notes.trim() || null,
      });
      setSuccess("Booking confirmed successfully!");
      setTimeout(() => router.back(), 900);
    } catch (e) {
      setError(formatErr(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="booking-close">
          <Ionicons name="close" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Booking</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Room selector */}
          <Section title="ROOM">
            <TouchableOpacity
              onPress={() => setShowRooms(true)}
              style={styles.roomSelector}
              testID="room-selector"
            >
              {room ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomSelectedNo}>Room {room.room_no}</Text>
                  <Text style={styles.roomSelectedMeta}>
                    {room.room_type === "AC" ? "AC" : "Non-AC"} • Base ₹{room.base_price}
                  </Text>
                </View>
              ) : (
                <Text style={styles.roomPlaceholder}>Select a room</Text>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </Section>

          {/* Duration */}
          <Section title="DURATION">
            <View style={styles.row}>
              <DurChip label="12 hours" active={duration === 12} onPress={() => setDuration(12)} testID="dur-12" />
              <DurChip label="24 hours" active={duration === 24} onPress={() => setDuration(24)} testID="dur-24" />
            </View>
          </Section>

          {/* Rate */}
          {room && (
            <Section title="RATE">
              <View style={styles.rateBox}>
                <View>
                  <Text style={styles.rateLabel}>Final Rate</Text>
                  <Text style={styles.rateValue}>₹{rate}</Text>
                  <Text style={styles.rateMeta}>Base ₹{base} + ₹{extra} extra • Default ₹{defaultRate}</Text>
                </View>
                <View style={styles.rateActions}>
                  <TouchableOpacity
                    onPress={() => setExtra((v) => Math.max(0, v - 100))}
                    style={styles.rateBtn}
                    testID="rate-minus"
                  >
                    <Ionicons name="remove" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setExtra((v) => v + 100)}
                    style={[styles.rateBtn, styles.rateBtnPlus]}
                    testID="rate-plus"
                  >
                    <Text style={styles.rateBtnPlusText}>+₹100</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Section>
          )}

          {/* Customer */}
          <Section title="CUSTOMER">
            <Field label="Full Name" value={name} onChangeText={setName} placeholder="John Doe" testID="cust-name" />
            <Field
              label="Aadhar ID (12 digits)"
              value={aadhar}
              onChangeText={(t: string) => setAadhar(t.replace(/\D/g, "").slice(0, 12))}
              placeholder="123412341234"
              keyboardType="number-pad"
              maxLength={12}
              testID="cust-aadhar"
            />
            <Field
              label="Phone (10 digits)"
              value={phone}
              onChangeText={(t: string) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
              placeholder="9876543210"
              keyboardType="phone-pad"
              maxLength={10}
              testID="cust-phone"
            />
          </Section>

          {/* Aadhar Photos */}
          <Section title="AADHAR PHOTOS (FRONT & BACK)">
            <View style={styles.photoRow}>
              <PhotoSlot label="Front" value={front} onPress={() => promptPhoto(setFront)} testID="photo-front" />
              <PhotoSlot label="Back" value={back} onPress={() => promptPhoto(setBack)} testID="photo-back" />
            </View>
          </Section>

          {/* Partner toggle */}
          <Section title="PARTNER (OPTIONAL)">
            <TouchableOpacity
              onPress={() => setIncludePartner(!includePartner)}
              style={[styles.toggleRow, includePartner && styles.toggleRowActive]}
              testID="toggle-partner"
            >
              <Ionicons
                name={includePartner ? "checkbox" : "square-outline"}
                size={22}
                color={includePartner ? colors.primary : colors.textMuted}
              />
              <Text style={styles.toggleLabel}>Add partner details (couple booking)</Text>
            </TouchableOpacity>

            {includePartner && (
              <View style={{ marginTop: 12 }}>
                <Field label="Partner Name" value={partnerName} onChangeText={setPartnerName} testID="partner-name" />
                <Field
                  label="Partner Aadhar (12 digits)"
                  value={partnerAadhar}
                  onChangeText={(t: string) => setPartnerAadhar(t.replace(/\D/g, "").slice(0, 12))}
                  keyboardType="number-pad"
                  maxLength={12}
                  testID="partner-aadhar"
                />
                <View style={[styles.photoRow, { marginTop: 4 }]}>
                  <PhotoSlot label="P. Front" value={pFront} onPress={() => promptPhoto(setPFront)} testID="photo-pfront" />
                  <PhotoSlot label="P. Back" value={pBack} onPress={() => promptPhoto(setPBack)} testID="photo-pback" />
                </View>
              </View>
            )}
          </Section>

          {/* Notes */}
          <Section title="NOTES (OPTIONAL)">
            <View style={styles.inputWrap}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Any remarks..."
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
                multiline
                testID="cust-notes"
              />
            </View>
          </Section>

          {error ? (
            <View style={styles.errorBanner} testID="booking-error">
              <Ionicons name="alert-circle" size={18} color={colors.occupiedText} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={styles.successBanner} testID="booking-success">
              <Ionicons name="checkmark-circle" size={18} color={colors.availableText} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submit, submitting && { opacity: 0.7 }]}
            onPress={onSubmit}
            disabled={submitting}
            testID="booking-submit"
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={colors.primaryText} />
                <Text style={styles.submitText}>Confirm Booking — ₹{rate}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Room picker modal */}
      <Modal visible={showRooms} animationType="slide" transparent onRequestClose={() => setShowRooms(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Room</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {rooms.map((r) => {
                const disabled = r.is_occupied;
                return (
                  <TouchableOpacity
                    key={r.room_no}
                    disabled={disabled}
                    style={[styles.modalRoom, disabled && { opacity: 0.5 }]}
                    onPress={() => {
                      setRoomNo(r.room_no);
                      setShowRooms(false);
                    }}
                    testID={`pick-room-${r.room_no}`}
                  >
                    <Text style={styles.modalRoomNo}>{r.room_no}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRoomType}>{r.room_type === "AC" ? "AC" : "Non-AC"} • From ₹{r.default_12hr}/12hr</Text>
                      <Text style={[styles.modalRoomStatus, { color: disabled ? colors.occupiedText : colors.availableText }]}>
                        {disabled ? "Occupied" : "Available"}
                      </Text>
                    </View>
                    {!disabled && <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowRooms(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

function Field({ label, ...rest }: any) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          {...rest}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>
    </View>
  );
}

function DurChip({ label, active, onPress, testID }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.durChip, active && styles.durChipActive]} testID={testID}>
      <Text style={[styles.durChipText, active && styles.durChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PhotoSlot({ label, value, onPress, testID }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.photoSlot} testID={testID}>
      {value ? (
        <Image source={{ uri: value }} style={styles.photoImg} />
      ) : (
        <View style={styles.photoEmpty}>
          <Ionicons name="camera" size={28} color={colors.primary} />
          <Text style={styles.photoLabel}>{label}</Text>
          <Text style={styles.photoHint}>Tap to add</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.textMain },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: colors.textMuted, marginBottom: 8 },
  roomSelector: {
    flexDirection: "row", alignItems: "center", padding: 16,
    backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
  },
  roomSelectedNo: { fontSize: 18, fontWeight: "800", color: colors.primary },
  roomSelectedMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  roomPlaceholder: { flex: 1, fontSize: 15, color: colors.textMuted },
  row: { flexDirection: "row", gap: 8 },
  durChip: {
    flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: radii.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  durChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durChipText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  durChipTextActive: { color: colors.primaryText },
  rateBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.surface, borderRadius: radii.md, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  rateLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "700", letterSpacing: 1 },
  rateValue: { fontSize: 28, fontWeight: "800", color: colors.primary, marginTop: 2 },
  rateMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  rateActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  rateBtn: {
    width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  rateBtnPlus: { width: "auto", paddingHorizontal: 16, backgroundColor: colors.accent, borderColor: colors.accent },
  rateBtnPlusText: { color: colors.primaryText, fontWeight: "800", fontSize: 13 },
  fieldLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 15, color: colors.textMain, paddingVertical: 12 },
  photoRow: { flexDirection: "row", gap: 12 },
  photoSlot: {
    flex: 1, aspectRatio: 1.4, borderRadius: radii.md, overflow: "hidden",
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderStyle: "dashed",
  },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, padding: 8 },
  photoLabel: { fontSize: 13, fontWeight: "700", color: colors.primary, marginTop: 4 },
  photoHint: { fontSize: 11, color: colors.textMuted },
  photoImg: { width: "100%", height: "100%" },
  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, backgroundColor: colors.surface, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
  },
  toggleRowActive: { borderColor: colors.primary },
  toggleLabel: { fontSize: 14, color: colors.textMain, fontWeight: "600" },
  submit: {
    marginTop: 8, backgroundColor: colors.primary, borderRadius: radii.md,
    paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitText: { color: colors.primaryText, fontSize: 16, fontWeight: "700" },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.occupiedBg, padding: 12, borderRadius: radii.md, marginBottom: 12,
  },
  errorText: { flex: 1, color: colors.occupiedText, fontSize: 13, fontWeight: "600" },
  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.availableBg, padding: 12, borderRadius: radii.md, marginBottom: 12,
  },
  successText: { flex: 1, color: colors.availableText, fontSize: 13, fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.textMain, marginBottom: 12 },
  modalRoom: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalRoomNo: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surfaceSecondary,
    textAlign: "center", textAlignVertical: "center", lineHeight: 48,
    fontSize: 18, fontWeight: "800", color: colors.primary,
  },
  modalRoomType: { fontSize: 14, fontWeight: "600", color: colors.textMain },
  modalRoomStatus: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  modalClose: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  modalCloseText: { color: colors.textMuted, fontWeight: "700" },
});
