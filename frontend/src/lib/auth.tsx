import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore, formatErr } from "./api";

export type User = { id: string; email: string; name: string; role: string };

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await tokenStore.get();
      if (!token) {
        setUser(null);
        return;
      }
      const { data } = await api.get<User>("/auth/me");
      setUser(data);
    } catch {
      await tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post("/auth/login", { email: email.toLowerCase().trim(), password });
      await tokenStore.set(data.access_token);
      setUser(data.user);
    } catch (e) {
      throw new Error(formatErr(e));
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
