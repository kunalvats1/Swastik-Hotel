import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLive } from "./live";
import { colors, radii } from "../theme";

export function LiveToast() {
  const { lastEvent } = useLive();
  const [msg, setMsg] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const lastSeenRef = useRef<any>(null);

  useEffect(() => {
    if (!lastEvent || lastEvent === lastSeenRef.current) return;
    lastSeenRef.current = lastEvent;
    if (lastEvent.type === "booking_created" && lastEvent.booking) {
      setMsg(`New booking: Room ${lastEvent.booking.room_no} • ${lastEvent.booking.customer_name}`);
    } else if (lastEvent.type === "booking_checked_out" && lastEvent.booking) {
      setMsg(`Checked out: Room ${lastEvent.booking.room_no}`);
    } else {
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 220, useNativeDriver: true }),
      ]).start(() => setMsg(null));
    }, 4000);
    return () => clearTimeout(t);
  }, [lastEvent, opacity, translateY]);

  if (!msg) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
      testID="live-toast"
    >
      <View style={styles.toast}>
        <View style={styles.iconWrap}>
          <Ionicons name="notifications" size={18} color={colors.primaryText} />
        </View>
        <Text style={styles.text} numberOfLines={2}>
          {msg}
        </Text>
        <TouchableOpacity onPress={() => setMsg(null)} testID="live-toast-dismiss">
          <Ionicons name="close" size={18} color={colors.primaryText} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: "600",
  },
});
