// API.ts - Add face scanning endpoint

export async function processFaceScan(imageUri: string) {
  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    type: "image/jpeg",
    name: "face_scan.jpg",
  } as any);

  const token = await getToken();
  const response = await fetch(`${API_BASE}/models/process-face`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) throw new Error("Face processing failed");
  return response.json();
}

// ===== Usage in scan.tsx =====
/*
import { processFaceScan } from "../../src/api";

const startScan = async () => {
  // 1. Capture image
  const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
  
  // 2. Process face with ML model
  const faceResult = await processFaceScan(photo.uri);
  // Returns: { face_score: 78, confidence: 0.92, features: {...} }
  
  // 3. Fetch live sensor data
  const liveData = await api.getSensorData();
  
  // 4. Send complete scan with face score
  const scanPayload = {
    heartRate: liveData.vitals.heart_rate,
    spo2: liveData.vitals.spo2,
    gsr: liveData.gsr,
    ecg: liveData.ecg,
    face_score: faceResult.face_score,
    face_detected: true,
  };
  
  const result = await api.createScan(scanPayload);
  router.push("/result");
};
*/
