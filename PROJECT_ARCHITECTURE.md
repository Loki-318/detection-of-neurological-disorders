# NeuroScan AI - Complete Architecture & Implementation Guide

## 📋 Project Overview

**NeuroScan AI** is a neurological health screening app that:
1. ✅ Authenticates users
2. ✅ Captures face images via camera
3. ✅ Reads live sensor data (heart rate, SpO2, GSR, ECG)
4. ✅ Displays individual health components (no overall score)
5. ✅ Stores data in MongoDB
6. ✅ Processes data with ML models (face scanning, gait analysis)

---

## 🗂️ File Structure

```
detection-of-neurological-disorders/
│
├─ frontend/ (React Native - Expo)
│  ├─ app/
│  │  ├─ _layout.tsx (Root navigation - login check)
│  │  ├─ login.tsx (Login/Register)
│  │  ├─ result.tsx (OLD - with health score)
│  │  └─ (tabs)/
│  │     ├─ _layout.tsx (Tab navigation - 3 tabs only)
│  │     ├─ index.tsx (Dashboard - live data)
│  │     ├─ scan.tsx (Camera & scanning)
│  │     ├─ history.tsx (Trends & statistics)
│  │     ├─ chat.tsx (UNUSED - remove)
│  │     └─ appointments.tsx (UNUSED - remove)
│  │
│  └─ src/
│     ├─ api.ts (API calls to backend)
│     ├─ AuthContext.tsx (Auth state management)
│     ├─ theme.ts (Colors & styling)
│     ├─ notifications.ts (Reminders)
│     ├─ CircularProgress.tsx (OLD - not used now)
│     ├─ TrendChart.tsx (Chart visualization)
│     │
│     └─ components/ (NEW - reusable)
│        ├─ MetricCard.tsx (Individual vitals display)
│        ├─ ScoreDisplay.tsx (ML model scores)
│        └─ ResultRefactored.tsx (Refactored results page)
│
├─ backend/ (Python FastAPI)
│  ├─ server.py (Main API server)
│  ├─ requirements.txt
│  ├─ .env (Environment variables)
│  │
│  └─ tests/ (Unit tests)
│
├─ models/ (ML Models - TO CREATE)
│  ├─ face_detector.pkl
│  ├─ expression_analyzer.pkl
│  ├─ face_landmarks.pkl
│  ├─ gait_analyzer.pkl
│  └─ requirements.txt
│
├─ data/ (Datasets)
│  ├─ pads_preprocessed/ (Training data)
│  └─ training_data/ (Raw training data)
│
├─ notebooks/ (Jupyter - for ML development)
│  ├─ 01_eda.ipynb
│  ├─ 02_baseline_model.ipynb
│  ├─ 03_pads_integration.ipynb
│  └─ 05_shap_analysis.ipynb
│
└─ README.md
```

---

## 🔄 Complete Application Flow

### 1. **App Startup**
```
App Loads
  ↓
AuthProvider checks token (AsyncStorage)
  ├─ Token exists? → Verify with backend → Show Dashboard
  └─ Token missing? → Show Login Screen
```

### 2. **Authentication**
```
User enters email/password
  ↓
Frontend: POST /auth/login
  ↓
Backend: Verify credentials, create JWT token
  ↓
Frontend: Store token locally
  ↓
Dashboard displays (with user data)
```

### 3. **Dashboard (Home Tab)**
```
Display:
  ├─ User greeting
  ├─ Latest scan score (if exists)
  ├─ Live sensor data from MongoDB
  │  ├─ Heart Rate: 72 bpm (from database)
  │  ├─ SpO2: 98% (from database)
  │  ├─ GSR: 1500 (from database)
  │  └─ ECG: 350 (from database)
  ├─ Anomaly detection alerts
  ├─ Trends chart
  ├─ Reminder toggle
  └─ Action buttons: New Scan, View History
```

### 4. **Scanning (Scan Tab)**
```
User taps "Start Scan"
  ↓
Request camera permission
  ↓
Show camera with target overlay
  ↓
User taps "Initiate Neural Scan"
  ↓
Step 1: Capture face photo (2 sec)
  ↓
Step 2: Show laser animation (18 sec)
  ├─ "Aligning Facial Geometry..." (2s)
  ├─ "Extracting Micro-expressions..." (3s)
  ├─ "Running Deep Learning Model..." (5s)
  ├─ "Syncing Hardware Vitals..." (3s)
  └─ "Finalizing..." (2s)
  ↓
Step 3: Send face image to backend
  ↓
Backend: Process with ML model → face_score
  ↓
Step 4: Fetch live sensor data
  ↓
Step 5: Create scan record
  POST /api/scans with:
  {
    "heartRate": 72,
    "spo2": 98,
    "gsr": 1500,
    "ecg": 350,
    "face_score": 78,
    "face_detected": true
  }
  ↓
Backend: Store in MongoDB
  ↓
Step 6: Redirect to Results page
```

### 5. **Results Display**
```
Show three sections:

SECTION 1: Hardware Vitals (Live data from database)
├─ Heart Rate: 72 bpm (with progress bar)
├─ SpO2: 98% (with progress bar)
├─ GSR: 1500 (with progress bar)
└─ ECG: 350 (with progress bar)

SECTION 2: AI Model Scores
├─ Autonomic Vitals Score: 85 (with confidence)
├─ Gait & Motor Control: 80 (with confidence)
└─ Facial Micro-expressions: 78 (with confidence)

SECTION 3: Face Scan Details
├─ Faces Detected: 1
├─ Symmetry Score: 92%
├─ Lighting Quality: Optimal
└─ Resolution: 1920x1080

SECTION 4: Raw Data
├─ Scan ID
├─ User ID
├─ Timestamp
└─ Device Info
```

### 6. **History/Trends Tab**
```
Display:
├─ Statistics cards (Total scans, average, best, worst)
├─ Trend charts
│  ├─ Overall Health trend
│  ├─ Gait trend
│  ├─ Facial trend
│  └─ Behavioral trend
└─ Recent scans list (10 most recent)
```

---

## 🛠️ Key Components Explained

### Frontend Components

#### **MetricCard.tsx** - Display individual vitals
```typescript
<MetricCard
  icon="pulse"
  label="Heart Rate"
  value={72}
  unit=" bpm"
  color="#EF4444"
  minValue={40}
  maxValue={150}
  description="Normal: 60-100 bpm"
/>
```
Shows: Icon, Label, Value, Unit, Progress Bar, Range

#### **ScoreDisplay.tsx** - Display ML model scores
```typescript
<ScoreDisplay
  title="Gait & Motor Control"
  score={80}
  confidence={0.78}
  icon="walk"
  color="#3B82F6"
  description="Movement patterns"
/>
```
Shows: Icon, Title, Score (0-100), Label, Circular Progress, Confidence Bar

#### **ResultRefactored.tsx** - Complete results page
Combines MetricCard and ScoreDisplay components
No overall "health score" anymore
Individual assessments only

---

## 🧠 ML Model Integration

### Step 1: Train Models (Optional)
```python
# notebooks/train_models.ipynb
import cv2
import scikit-learn
from sklearn.ensemble import RandomForestClassifier

# Train face detection model
# Train gait analysis model
# Train expression analysis model

# Save to /models folder
```

### Step 2: Backend Processing
```python
# backend/models_face_processor_guide.py

class FaceProcessor:
    def process_face(self, image_path):
        # Read image
        # Detect faces
        # Extract features
        # Calculate scores
        # Return: {"face_score": 78, "confidence": 0.85, ...}
```

### Step 3: Frontend Integration
```typescript
// frontend/src/api.ts

export async function processFaceScan(imageUri: string) {
  const formData = new FormData();
  formData.append("file", {...});
  
  const response = await fetch(`${API_BASE}/models/process-face`, {
    method: "POST",
    body: formData
  });
  
  return response.json();
}
```

### Step 4: Use in Scan
```typescript
// frontend/app/(tabs)/scan.tsx

const photo = await cameraRef.current.takePictureAsync();
const faceResult = await processFaceScan(photo.uri);

const scanPayload = {
  ...liveData,
  face_score: faceResult.face_score,
  face_detected: true
};

await api.createScan(scanPayload);
```

---

## 📊 Database Schema (MongoDB)

### Users Collection
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "password_hash": "bcrypt_hash",
  "created_at": "2026-05-18T..."
}
```

### Scans Collection
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "user_id": "uuid",
  "heartRate": 72,
  "spo2": 98,
  "gsr": 1500,
  "ecg": 350,
  "face_score": 78,
  "gait_score": 80,
  "vitals_score": 85,
  "face_detected": true,
  "created_at": "2026-05-18T...",
  "vitals_snapshot": {...}
}
```

### Sensor Data Collection (Live)
```json
{
  "_id": ObjectId,
  "user_id": "uuid",
  "vitals": {
    "heart_rate": 72,
    "spo2": 98
  },
  "gsr": 1500,
  "ecg": 350,
  "accel": {"x": 0.1, "y": 0.2, "z": 9.8},
  "timestamp": "2026-05-18T..."
}
```

---

## ✅ What's NEW vs OLD

### REMOVED
- ❌ CircularProgress (overall health score)
- ❌ riskMeta() function (risk level calculation)
- ❌ Chat with AI (Dr. Nova)
- ❌ Appointment booking
- ❌ AI summary card
- ❌ Overall risk percentage

### ADDED
- ✅ MetricCard component (individual vitals)
- ✅ ScoreDisplay component (ML scores with confidence)
- ✅ Face scanning integration
- ✅ Model analysis section (placeholder)
- ✅ Raw data display section
- ✅ Individual component assessments
- ✅ /models folder structure
- ✅ Backend face processing endpoint

---

## 🚀 Next Steps

1. **Create Models Folder**
   ```bash
   mkdir models
   touch models/requirements.txt
   ```

2. **Train ML Models** (use notebooks/)
   - Face detection & micro-expressions
   - Gait analysis from accelerometer
   - Vitals analysis from ECG/GSR

3. **Implement Face Processing**
   - Backend: models_face_processor_guide.py
   - Frontend: api_face_scanning_guide.tsx

4. **Update Result Page**
   - Replace result.tsx with ResultRefactored.tsx
   - Or merge components into existing result.tsx

5. **Remove Unused Files** (optional)
   - Delete chat.tsx
   - Delete appointments.tsx

---

## 📞 API Endpoints Summary

```
Authentication:
  POST /auth/login
  POST /auth/register
  GET  /auth/me

Scans:
  POST /scans (create new scan)
  GET  /scans (list all)
  GET  /scans/latest

Sensor Data:
  GET  /sensor-data (live MongoDB readings)

Models (NEW):
  POST /models/process-face (face processing)
  POST /models/process-gait (gait analysis)
```

---

## 💡 Key Concepts

**Individual Components**: Instead of showing 1 number (health score), show:
- Heart Rate (bpm)
- SpO2 (%)
- GSR (μS)
- ECG (mV)
- Face Score (0-100 with confidence)
- Gait Score (0-100 with confidence)
- Vitals Score (0-100 with confidence)

**No Health Ranking**: No "Low Risk", "Moderate Risk", "High Risk"
Just raw data and ML assessments

**Face Scanning**: 
- Capture face image
- Send to backend ML model
- Get face_score (0-100)
- Include in scan result
