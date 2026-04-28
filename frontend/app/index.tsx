import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../src/lib/auth";
import { colors } from "../src/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center} testID="boot-loading">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)/dashboard" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
