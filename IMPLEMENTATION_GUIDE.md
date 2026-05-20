# Complete Disease Detection Implementation Guide

## 📋 Overview

This guide shows how to integrate the disease detection pipeline into your backend and frontend.

---

## 🔧 Backend Integration

### Step 1: Update Server Imports

```python
# backend/server.py

from fastapi import FastAPI, UploadFile, File, Body, Depends
from fastapi.responses import JSONResponse
from datetime import datetime
import json

# Import disease detection models
from models.feature_extractor import FeatureExtractor
from models.disease_detectors import DiseaseDetectionEnsemble
from models_face_processor_guide import FaceProcessor
```

### Step 2: Initialize Models in App Startup

```python
# backend/server.py

# Global model instances (initialize once at startup)
feature_extractor = FeatureExtractor()
disease_ensemble = DiseaseDetectionEnsemble()
face_processor = FaceProcessor()

@app.on_event("startup")
async def startup():
    """Initialize ML models on app startup."""
    global feature_extractor, disease_ensemble, face_processor
    print("✅ ML models loaded successfully")
```

### Step 3: Add Disease Detection Endpoint

```python
# backend/server.py

@api_router.post("/models/detect-disease")
async def detect_disease(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    gait_data: str = Body(...),
    vitals_data: str = Body(...),
):
    """
    Comprehensive disease detection endpoint.
    
    Request:
    {
        "gait_data": [
            {"x": 0.1, "y": 0.2, "z": 9.8, "timestamp": 1234567890},
            ...
        ],
        "vitals_data": [
            {"hr": 72, "spo2": 98, "gsr": 0.5, "ecg": 0.1, "temp": 36.8},
            ...
        ]
    }
    """
    try:
        # Parse JSON data
        gait_array = json.loads(gait_data) if isinstance(gait_data, str) else gait_data
        vitals_array = json.loads(vitals_data) if isinstance(vitals_data, str) else vitals_data
        
        # 1. Extract face features from uploaded image
        face_features = await face_processor.extract_features(file)
        
        # 2. Extract gait features from accelerometer data
        gait_features = feature_extractor.extract_gait_features(gait_array)
        
        # 3. Extract biometric features from arm band data
        biometric_features = feature_extractor.extract_biometric_features(vitals_array)
        
        # 4. Combine all features
        all_features = {
            **face_features,
            **gait_features,
            **biometric_features,
        }
        
        # 5. Run disease detection
        detections = disease_ensemble.detect_all(all_features)
        
        # 6. Store results in MongoDB
        scan_id = str(ObjectId())
        detection_record = {
            "scan_id": scan_id,
            "user_id": user["id"],
            "timestamp": datetime.now(),
            "detections": detections,
            "raw_features": all_features,
            "primary_disease": detections["primary_disease"],
            "highest_risk_score": detections["highest_risk_score"],
        }
        
        await db.disease_detections.insert_one(detection_record)
        
        return JSONResponse({
            "status": "success",
            "scan_id": scan_id,
            "detections": detections,
        })
        
    except Exception as e:
        logger.error(f"Disease detection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/models/detection-history")
async def get_detection_history(
    user: dict = Depends(get_current_user),
    limit: int = 10,
):
    """Get user's disease detection history."""
    try:
        detections = await db.disease_detections.find(
            {"user_id": user["id"]}
        ).sort("timestamp", -1).limit(limit).to_list(None)
        
        return JSONResponse({
            "status": "success",
            "detections": detections,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/models/detection/{scan_id}")
async def get_detection_detail(
    scan_id: str,
    user: dict = Depends(get_current_user),
):
    """Get detailed detection results for a specific scan."""
    try:
        detection = await db.disease_detections.find_one({
            "scan_id": scan_id,
            "user_id": user["id"],
        })
        
        if not detection:
            raise HTTPException(status_code=404, detail="Detection not found")
        
        return JSONResponse({
            "status": "success",
            "detection": detection,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 📱 Frontend Integration

### Step 1: Update Scan Component to Send Data

```typescript
// frontend/app/(tabs)/scan.tsx

import { api } from "../src/api";
import { useAuth } from "../src/AuthContext";

export default function ScanScreen() {
  const { user } = useAuth();
  const [liveData, setLiveData] = useState<any>(null);
  const [scanning, setScanning] = useState(false);

  const handleScanComplete = async (photoUri: string) => {
    setScanning(true);
    
    try {
      // 1. Fetch live sensor data (already in code)
      const sensorData = await api.get("/scans/live-sensor-data");
      
      // 2. Extract gait and vitals data
      const gaitData = sensorData.data.accelerometer_data || [];
      const vitalsData = sensorData.data.biometric_data || [];
      
      // 3. Upload scan with disease detection
      const formData = new FormData();
      formData.append("file", {
        uri: photoUri,
        type: "image/jpeg",
        name: "scan.jpg",
      } as any);
      formData.append("gait_data", JSON.stringify(gaitData));
      formData.append("vitals_data", JSON.stringify(vitalsData));
      
      const response = await api.post(
        "/models/detect-disease",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      
      if (response.status === 200) {
        const { scan_id, detections } = response.data;
        
        // Store scan ID for results page
        await AsyncStorage.setItem("lastScanId", scan_id);
        
        // Navigate to results with detection data
        router.push({
          pathname: "/result",
          params: {
            scanId: scan_id,
            hasDetection: "true",
          },
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to process scan");
      console.error(error);
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Existing camera/scan UI */}
      {/* ... */}
    </View>
  );
}
```

### Step 2: Update Result Component to Show Disease Risks

```typescript
// frontend/app/result.tsx

import { ScrollView, View, Text, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import DiseaseRiskCard from "../src/components/DiseaseRiskCard";
import { api } from "../src/api";
import { theme } from "../src/theme";
import { useEffect, useState } from "react";

export default function ResultScreen() {
  const { scanId } = useLocalSearchParams();
  const [detection, setDetection] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDetectionResults();
  }, [scanId]);

  const loadDetectionResults = async () => {
    try {
      const response = await api.get(`/models/detection/${scanId}`);
      setDetection(response.data.detection);
    } catch (error) {
      console.error("Failed to load detection results:", error);
      Alert.alert("Error", "Failed to load scan results");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <Text>Loading detection results...</Text>
      </View>
    );
  }

  if (!detection) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <Text>No results found</Text>
      </View>
    );
  }

  const detections = detection.detections;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Disease Detection Results</Text>
        <Text style={styles.subtitle}>
          {new Date(detection.timestamp).toLocaleDateString()}
        </Text>
      </View>

      {/* Primary Risk Alert */}
      {detections.highest_risk_score > 50 && (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>⚠️ IMPORTANT</Text>
          <Text style={styles.alertText}>
            Your scan indicates {detections.primary_disease} risk.
            Please consult with a healthcare provider.
          </Text>
        </View>
      )}

      {/* Disease Detection Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Risk Assessment</Text>

        <DiseaseRiskCard
          diseaseName="Parkinson's Disease"
          riskScore={detections.parkinsons.risk_score}
          confidence={detections.parkinsons.confidence}
          contributingFactors={detections.parkinsons.contributing_factors}
          icon="walk"
          color="#EC4899"
          testID="parkinsons-card"
        />

        <DiseaseRiskCard
          diseaseName="Essential Tremor"
          riskScore={detections.essential_tremor.risk_score}
          confidence={detections.essential_tremor.confidence}
          contributingFactors={detections.essential_tremor.contributing_factors}
          icon="hand-left"
          color="#F59E0B"
          testID="tremor-card"
        />

        <DiseaseRiskCard
          diseaseName="Multiple Sclerosis"
          riskScore={detections.multiple_sclerosis.risk_score}
          confidence={detections.multiple_sclerosis.confidence}
          contributingFactors={detections.multiple_sclerosis.contributing_factors}
          icon="fitness"
          color="#3B82F6"
          testID="ms-card"
        />

        <DiseaseRiskCard
          diseaseName="Cognitive Decline"
          riskScore={detections.cognitive_decline.risk_score}
          confidence={detections.cognitive_decline.confidence}
          contributingFactors={detections.cognitive_decline.contributing_factors}
          icon="brain"
          color="#8B5CF6"
          testID="cognitive-card"
        />
      </View>

      {/* Raw Sensor Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Raw Biometric Data</Text>
        <View style={styles.dataCard}>
          <Text style={styles.dataLabel}>Scan ID</Text>
          <Text style={styles.dataValue}>{detection.scan_id}</Text>
        </View>
        <View style={styles.dataCard}>
          <Text style={styles.dataLabel}>Timestamp</Text>
          <Text style={styles.dataValue}>
            {new Date(detection.timestamp).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Features Analyzed */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features Analyzed</Text>
        <View style={styles.featureGrid}>
          <View style={styles.featureBox}>
            <Text style={styles.featureLabel}>Gait Metrics</Text>
            <Text style={styles.featureCount}>
              {Object.keys(detection.raw_features)
                .filter((k) => k.includes("stride") || k.includes("walk"))
                .length} features
            </Text>
          </View>
          <View style={styles.featureBox}>
            <Text style={styles.featureLabel}>Biometrics</Text>
            <Text style={styles.featureCount}>
              {Object.keys(detection.raw_features)
                .filter((k) => k.includes("heart_rate") || k.includes("tremor"))
                .length} features
            </Text>
          </View>
          <View style={styles.featureBox}>
            <Text style={styles.featureLabel}>Facial</Text>
            <Text style={styles.featureCount}>
              {Object.keys(detection.raw_features)
                .filter((k) => k.includes("facial") || k.includes("expression"))
                .length} features
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.textMain,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.textMuted,
  },
  alertBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
    marginBottom: 20,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#DC2626",
    marginBottom: 4,
  },
  alertText: {
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.textMain,
    marginBottom: 12,
  },
  dataCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dataLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.textMuted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textMain,
  },
  featureGrid: {
    flexDirection: "row",
    gap: 12,
  },
  featureBox: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textMuted,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  featureCount: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.primary,
  },
});
```

---

## 🧪 Testing the Integration

### Test in Postman

```json
POST /models/detect-disease

{
  "gait_data": [
    {"x": 0.1, "y": 0.2, "z": 9.8},
    {"x": 0.15, "y": 0.25, "z": 9.7},
    ...
  ],
  "vitals_data": [
    {"hr": 72, "spo2": 98, "gsr": 0.5, "ecg": 0.1, "temp": 36.8},
    ...
  ]
}
```

### Response Example

```json
{
  "status": "success",
  "scan_id": "507f1f77bcf86cd799439011",
  "detections": {
    "parkinsons": {
      "disease": "Parkinson's Disease",
      "risk_score": 65,
      "confidence": 0.78,
      "contributing_factors": [
        "Reduced arm swing symmetry (0.65)",
        "Tremor frequency detected at 5.1 Hz",
        "Increased stride variability"
      ]
    },
    "essential_tremor": {
      "disease": "Essential Tremor",
      "risk_score": 35,
      "confidence": 0.52
    },
    "multiple_sclerosis": {
      "disease": "Multiple Sclerosis",
      "risk_score": 28,
      "confidence": 0.42
    },
    "cognitive_decline": {
      "disease": "Cognitive Decline",
      "risk_score": 22,
      "confidence": 0.35
    },
    "primary_disease": "parkinsons",
    "highest_risk_score": 65
  }
}
```

---

## 📊 Database Schema

```javascript
// MongoDB collection: disease_detections

{
  "_id": ObjectId,
  "scan_id": "507f1f77bcf86cd799439011",
  "user_id": "user123",
  "timestamp": ISODate("2024-01-15T10:30:00Z"),
  "detections": {
    "parkinsons": {
      "disease": "Parkinson's Disease",
      "risk_score": 65,
      "confidence": 0.78,
      "contributing_factors": [...]
    },
    // ... other diseases
  },
  "raw_features": {
    "stride_length_estimate": 1.1,
    "walking_speed_estimate": 1.15,
    // ... all extracted features
  },
  "primary_disease": "parkinsons",
  "highest_risk_score": 65
}
```

---

## 📦 Requirements to Add

```
# backend/models/requirements.txt

scikit-learn==1.3.0
numpy==1.24.0
scipy==1.11.0
opencv-python==4.8.0
```

---

## ✅ Deployment Checklist

- [ ] Install dependencies: `pip install -r models/requirements.txt`
- [ ] Test feature extraction with sample data
- [ ] Test disease detectors with sample features
- [ ] Add `/models/detect-disease` endpoint to backend
- [ ] Update database schema with `disease_detections` collection
- [ ] Create indices on `user_id` and `timestamp` in MongoDB
- [ ] Update frontend scan.tsx to send gait and vitals data
- [ ] Create DiseaseRiskCard component
- [ ] Update result.tsx to display detection results
- [ ] Test end-to-end flow: Scan → Detection → Results Display
- [ ] Create detection history view in dashboard
- [ ] Add alerts for high-risk detections

---

## 🚀 Next Steps

1. **Train Real Models** - Collect labeled data from patients and train actual classifiers
2. **Add More Diseases** - Expand to include ALS, Huntington's, Dystonia
3. **Improve Features** - Add more sophisticated signal processing
4. **Clinical Validation** - Test accuracy against clinical diagnoses
5. **User Feedback** - Track model accuracy and refine over time
