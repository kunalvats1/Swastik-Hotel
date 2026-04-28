import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLive } from "./live";
import { colors, radii } from "../theme";

export function LiveToast() {
  const { lastEvent } = useLive();
  const [msg, setMsg] = useState<string | null>(null);
  const [type, setType] = useState<"created" | "checkout">("created");
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current;
  const lastSeenRef = useRef<any>(null);

  useEffect(() => {
    if (!lastEvent || lastEvent === lastSeenRef.current) return;
    lastSeenRef.current = lastEvent;

    let next: { msg: string; type: "created" | "checkout" } | null = null;
    if (lastEvent.type === "booking_created" && lastEvent.booking) {
      next = {
        msg: `New booking • Room ${lastEvent.booking.room_no} • ${lastEvent.booking.customer_name} • ₹${lastEvent.booking.rate}`,
        type: "created",
      };
    } else if (lastEvent.type === "booking_checked_out" && lastEvent.booking) {
      next = {
        msg: `Checked out • Room ${lastEvent.booking.room_no} now available`,
        type: "checkout",
      };
    }
    if (!next) return;

    setMsg(next.msg);
    setType(next.type);
    opacity.setValue(0);
    translateY.setValue(-30);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: Platform.OS !== "web", friction: 7 }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(translateY, { toValue: -30, duration: 260, useNativeDriver: Platform.OS !== "web" }),
      ]).start(() => setMsg(null));
    }, 6000);
    return () => clearTimeout(t);
  }, [lastEvent, opacity, translateY]);

  if (!msg) return null;

  const bg = type === "created" ? colors.primary : colors.accent;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
      testID="live-toast"
    >
      <View style={[styles.toast, { backgroundColor: bg }]}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={type === "created" ? "notifications" : "exit"}
            size={18}
            color={colors.primaryText}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>
            {type === "created" ? "LIVE • NEW BOOKING" : "LIVE • CHECKOUT"}
          </Text>
          <Text style={styles.text} numberOfLines={2}>
            {msg}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setMsg(null)} testID="live-toast-dismiss">
          <Ionicons name="close" size={20} color={colors.primaryText} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginBottom: 3,
  },
  text: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
});
