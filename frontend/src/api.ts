import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "neuroscan_token";

if (!BASE) {
  throw new Error("EXPO_PUBLIC_BACKEND_URL is not set");
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  method: string = "GET",
  body?: unknown,
  auth: boolean = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text || `Request failed (${res.status})` };
  }

  if (!res.ok) {
    const msg =
      typeof data?.detail === "string"
        ? data.detail
        : Array.isArray(data?.detail)
        ? data.detail.map((d: any) => d?.msg || JSON.stringify(d)).join(" ")
        : `Request failed (${res.status})`;

    throw new Error(msg);
  }

  return data as T;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  created_at?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface FacePartResult {
  predicted_class: string;
  class_probs: Record<string, number>;
}

export interface FaceAnalysisResponse {
  id: string;
  user_id: string;
  type: "face";
  created_at: string;
  result: {
    eye: FacePartResult;
    eyebrow: FacePartResult;
    mouth: FacePartResult;
  };
}

export type ScanHistoryItem = FaceAnalysisResponse;

export interface SensorDataItem {
  timestamp?: string;
  accel?: {
    x?: number;
    y?: number;
    z?: number;
  };
  gyro?: {
    x?: number;
    y?: number;
    z?: number;
  };
  [key: string]: any;
}

export interface GaitTimelineItem {
  score: number;
  class: string;
}

export interface GaitDataResponse {
  raw_data: SensorDataItem[];
  timeline: GaitTimelineItem[];
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<AuthResponse>(
      "/auth/register",
      "POST",
      { email, password, name },
      false
    ),

  login: (email: string, password: string) =>
    request<AuthResponse>(
      "/auth/login",
      "POST",
      { email, password },
      false
    ),

  me: () => request<AuthUser>("/auth/me"),

  analyzeFace: (base64Image: string) =>
    request<FaceAnalysisResponse>("/scans/face", "POST", {
      image: base64Image.startsWith("data:image")
        ? base64Image
        : `data:image/jpeg;base64,${base64Image}`,
    }),

  listScans: () => request<ScanHistoryItem[]>("/scans"),

  getSensorData: () => request<SensorDataItem[]>("/sensor-data"),

  getGaitData: () => request<GaitDataResponse>("/gait-data"),
};