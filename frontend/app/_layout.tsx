import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/lib/auth";
import { LiveProvider } from "../src/lib/live";
import { LiveToast } from "../src/lib/LiveToast";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <LiveProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="booking/new" options={{ presentation: "modal" }} />
              <Stack.Screen name="booking/[id]" />
            </Stack>
            <LiveToast />
          </LiveProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
