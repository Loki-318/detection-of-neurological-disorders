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

export const api = {
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: any }>("/auth/register", "POST", { email, password, name }, false),
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/auth/login", "POST", { email, password }, false),
  me: () => request<any>("/auth/me"),

  createScan: (data: {
    heartRate: number;
    spo2: number;
    gsr: number;
    ecg: number;
    accel?: any;
    face_detected: boolean;
}) =>
  request<any>("/scans", "POST", data),

  latestScan: () => request<any>("/scans/latest"),
  listScans: () => request<any[]>("/scans"),
  sendChat: (message: string) =>
    request<{ user_message: any; ai_message: any }>("/chat/send", "POST", { message }),
  chatHistory: () => request<any[]>("/chat/history"),
  slots: () => request<any[]>("/appointments/slots"),
  book: (slot_id: string, doctor: string, date: string, time: string) =>
    request<any>("/appointments", "POST", { slot_id, doctor, date, time }),
  myAppointments: () => request<any[]>("/appointments"),
  
  // The missing bridge to your MongoDB data!
  getSensorData: () => request<any[]>("/sensor-data"),
};