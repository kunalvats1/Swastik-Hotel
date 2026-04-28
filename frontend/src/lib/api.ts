import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";
export const API_URL = `${BACKEND_URL}/api`;

const TOKEN_KEY = "swastik_token";

export const tokenStore = {
  async get(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  },
  async set(token: string) {
    return AsyncStorage.setItem(TOKEN_KEY, token);
  },
  async clear() {
    return AsyncStorage.removeItem(TOKEN_KEY);
  },
};

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.get();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatErr(e: any): string {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d.map((x) => (x?.msg ? x.msg : JSON.stringify(x))).join(" ");
  return e?.message || "Something went wrong";
}

export type Room = {
  room_no: string;
  room_type: "AC" | "NON_AC";
  base_price: number;
  default_12hr: number;
  default_24hr: number;
  is_occupied: boolean;
  current_booking?: Booking | null;
};

export type Booking = {
  id: string;
  room_no: string;
  room_type: "AC" | "NON_AC";
  customer_name: string;
  aadhar_id: string;
  phone: string;
  partner_name?: string | null;
  partner_aadhar?: string | null;
  duration_hours: number;
  rate: number;
  check_in: string;
  check_out_due: string;
  checked_out_at?: string | null;
  status: "active" | "completed";
  notes?: string | null;
  created_by: string;
  created_at: string;
};

export type BookingDetail = Booking & {
  aadhar_front_b64: string;
  aadhar_back_b64: string;
  partner_aadhar_front_b64?: string | null;
  partner_aadhar_back_b64?: string | null;
};
