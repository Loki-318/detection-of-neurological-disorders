import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "neuroscan_token";

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
  body?: any,
  auth: boolean = true
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  
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

export interface ScanResponse {
  id: string;
  total_score: number;
  vitals_score: number;
  gait_score: number; 
  face_score: number;
  risk_label: string; 
  face_detected: boolean;
  ai_summary: string; 
  ai_recommendations: string[];
  created_at: string;
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: any }>("/auth/register", "POST", { email, password, name }, false),
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/auth/login", "POST", { email, password }, false),
  me: () => request<any>("/auth/me"),

  // Scans
  createScan: (data: {
    heartRate: number;
    spo2: number;
    gsr: number;
    ecg: number;
    face_detected: boolean;
  }) => request<ScanResponse>("/scans", "POST", data),

  analyzeFace: (base64Image: string) => 
    request<{ summary: string }>("/scans/face", "POST", { image: base64Image }),

  latestScan: () => request<ScanResponse>("/scans/latest"),
  listScans: () => request<ScanResponse[]>("/scans"),
  
  // Data Streams
  // Existing Biometrics
  getSensorData: () => request<any[]>("/sensor-data"),
  
  // 🚨 NEW: Gait data from 'newdata' collection
 // 🚨 NEW: Updated to expect the true model output
  getGaitData: () => request<{ 
    raw_data: any[], 
    timeline: Array<{ score: number, class: string, timestamp: string }> 
  }>("/gait-data"),
};