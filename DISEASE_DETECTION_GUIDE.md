# Neurological Disease Detection - Implementation Guide

## 🧠 Diseases to Detect

### 1. **Parkinson's Disease**
Using: **Gait Analysis + Arm Band Biometrics**

**Key Indicators:**
- **Gait:**
  - Reduced arm swing (asymmetry)
  - Shuffling steps (step length < 60cm)
  - Reduced walking speed
  - Increased stride variability
  - Postural instability

- **Arm Band Sensors (from biometrics):**
  - Tremor frequency: 4-6 Hz (rest tremor)
  - Reduced acceleration variability
  - Increased stiffness (rigidity)
  - Temperature changes (stress response)
  - Heart rate irregularities (autonomic dysfunction)

**Detection Algorithm:**
```python
def detect_parkinsons(gait_data, biometrics):
    score = 0
    
    # Gait analysis (40% weight)
    arm_swing_symmetry = calculate_arm_swing(gait_data)
    if arm_swing_symmetry < 0.7:  # <70% symmetry
        score += 15
    
    stride_length = calculate_stride_length(gait_data)
    if stride_length < 60:  # cm
        score += 15
    
    # Biometrics analysis (60% weight)
    tremor = detect_tremor(biometrics)
    if tremor and 4 <= tremor_freq <= 6:
        score += 25
    
    rigidity_score = calculate_rigidity(biometrics)
    if rigidity_score > 0.8:
        score += 25
    
    return score  # 0-100
```

---

### 2. **Essential Tremor**
Using: **Arm Band Accelerometer + ECG**

**Key Indicators:**
- Tremor frequency: 4-12 Hz (usually 8-12 Hz)
- Bilateral symmetry
- Task-dependent (worse with action)
- Heart rate correlation
- Low amplitude tremor

**Detection:**
```python
def detect_essential_tremor(arm_data, heart_rate_data):
    tremor_freq = detect_frequency(arm_data)
    amplitude = calculate_amplitude(arm_data)
    
    if 8 <= tremor_freq <= 12 and amplitude > 0.5:
        # Check bilateral symmetry if you have both arms
        return {
            "condition": "Essential Tremor",
            "confidence": calculate_confidence(tremor_freq, amplitude),
            "frequency": tremor_freq
        }
```

---

### 3. **Multiple Sclerosis (MS)**
Using: **Gait Analysis + Heart Rate Variability**

**Key Indicators:**
- Increased gait variability
- Slow walking speed
- Reduced balance
- Increased fatigue (detected via tremor patterns)
- Abnormal heart rate patterns (autonomic dysfunction)

---

### 4. **Alzheimer's / Cognitive Decline**
Using: **Face Scan + Gait Analysis**

**Key Indicators:**
- **Face:** Reduced facial expressiveness, poor eye contact
- **Gait:** Slower, more variable walking pattern
- **Biometrics:** Stress indicators (heart rate spikes, GSR elevation)

---

## 📊 Complete Backend ML Pipeline

### Step 1: Feature Extraction from Raw Sensors

```python
# backend/models/feature_extractor.py

class FeatureExtractor:
    def extract_gait_features(self, accel_data):
        """Extract gait-related features from accelerometer"""
        return {
            "stride_length": self._calculate_stride_length(accel_data),
            "stride_frequency": self._calculate_cadence(accel_data),
            "arm_swing_symmetry": self._calculate_symmetry(accel_data),
            "variability": self._calculate_variability(accel_data),
            "walking_speed": self._estimate_speed(accel_data),
            "balance_index": self._calculate_stability(accel_data),
        }
    
    def extract_biometric_features(self, vitals_data):
        """Extract features from heart rate, SpO2, GSR, ECG"""
        return {
            "tremor_frequency": self._detect_tremor_freq(vitals_data),
            "tremor_amplitude": self._detect_tremor_amp(vitals_data),
            "heart_rate_variability": self._calculate_hrv(vitals_data),
            "heart_rate_trends": self._analyze_hr_trends(vitals_data),
            "gsr_responsiveness": self._calculate_gsr_response(vitals_data),
            "rigidity_index": self._estimate_rigidity(vitals_data),
        }
    
    def extract_face_features(self, face_image):
        """Extract facial features"""
        return {
            "symmetry_score": self._calculate_symmetry(face_image),
            "expression_intensity": self._detect_expression(face_image),
            "eye_contact_quality": self._analyze_eyes(face_image),
            "micro_expressions": self._detect_micro_expressions(face_image),
        }
```

### Step 2: Train ML Models

```python
# backend/models/train_models.py

from sklearn.ensemble import RandomForestClassifier
import numpy as np

class ParkinsonsDetector:
    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=15,
            random_state=42
        )
    
    def train(self, X_train, y_train):
        """
        X_train: (n_samples, n_features) - extracted features
        y_train: (n_samples,) - binary labels [0: healthy, 1: parkinsons]
        """
        self.model.fit(X_train, y_train)
    
    def predict(self, features):
        """
        features: dict with gait and biometric features
        
        Returns: {
            "disease": "Parkinson's",
            "risk_score": 0-100,
            "confidence": 0-1,
            "contributing_factors": [...]
        }
        """
        X = self._prepare_features(features)
        probability = self.model.predict_proba(X)[0]
        
        return {
            "disease": "Parkinson's Disease",
            "risk_score": int(probability[1] * 100),
            "confidence": float(probability[1]),
            "contributing_factors": self._explain_prediction(X),
            "recommendation": self._get_recommendation(probability[1])
        }
```

---

## 🔄 Updated Backend Endpoint

```python
# server.py - Add disease detection endpoint

@api_router.post("/models/detect-disease")
async def detect_disease(
    file: UploadFile = File(...),
    gait_data: dict = Body(...),
    vitals_data: dict = Body(...),
    user: dict = Depends(get_current_user)
):
    """
    Comprehensive disease detection using:
    - Face image
    - Gait (accelerometer) data
    - Biometric (heart rate, SpO2, GSR, ECG) data
    """
    
    # 1. Extract features
    face_features = face_processor.extract_features(file)
    gait_features = feature_extractor.extract_gait_features(gait_data)
    biometric_features = feature_extractor.extract_biometric_features(vitals_data)
    
    # 2. Combine features
    all_features = {
        **face_features,
        **gait_features,
        **biometric_features
    }
    
    # 3. Run detection models
    results = {
        "parkinsons": parkinsons_detector.predict(all_features),
        "essential_tremor": tremor_detector.predict(all_features),
        "ms_risk": ms_detector.predict(all_features),
        "alzheimers_risk": cognitive_detector.predict(all_features),
    }
    
    # 4. Store in database
    detection_record = {
        "user_id": user["id"],
        "scan_id": scan_id,
        "timestamp": datetime.now(),
        "detections": results,
        "primary_risk": get_highest_risk(results),
    }
    
    await db.disease_detections.insert_one(detection_record)
    
    return results
```

---

## 📱 Frontend Integration

### Updated Results Page

```typescript
// frontend/app/result.tsx

import DetectionResults from "../src/components/DetectionResults";

export default function Result() {
  const [scan, setScan] = useState<any>(null);
  const [detections, setDetections] = useState<any>(null);
  
  useEffect(() => {
    // Fetch scan + detection results
    const detection = await api.getDetectionResults(scanId);
    setDetections(detection);
  }, []);
  
  return (
    <ScrollView>
      {/* Existing: Raw Vitals */}
      <Section title="Raw Biometric Data">
        {/* HR, SpO2, GSR, ECG */}
      </Section>
      
      {/* NEW: Disease Detection Results */}
      <Section title="Disease Risk Assessment">
        <DetectionResults
          parkinsons={detections.parkinsons}
          tremor={detections.essential_tremor}
          ms={detections.ms_risk}
          alzheimers={detections.alzheimers_risk}
        />
      </Section>
      
      {/* Existing: Gait Data */}
      <Section title="Gait Analysis">
        {/* Arm swing, stride length, etc */}
      </Section>
    </ScrollView>
  );
}
```

### Detection Results Component

```typescript
// frontend/src/components/DetectionResults.tsx

export default function DetectionResults({ parkinsons, tremor, ms, alzheimers }) {
  return (
    <View style={styles.container}>
      {/* Parkinson's */}
      <DiseaseCard
        title="Parkinson's Disease Risk"
        score={parkinsons.risk_score}
        confidence={parkinsons.confidence}
        factors={parkinsons.contributing_factors}
        icon="walk"
        color="#EC4899"
      />
      
      {/* Essential Tremor */}
      <DiseaseCard
        title="Essential Tremor Risk"
        score={tremor.risk_score}
        confidence={tremor.confidence}
        factors={tremor.contributing_factors}
        icon="hand-left"
        color="#F59E0B"
      />
      
      {/* MS Risk */}
      <DiseaseCard
        title="Multiple Sclerosis Risk"
        score={ms.risk_score}
        confidence={ms.confidence}
        factors={ms.contributing_factors}
        icon="fitness"
        color="#3B82F6"
      />
      
      {/* Cognitive Decline */}
      <DiseaseCard
        title="Cognitive Decline Risk"
        score={alzheimers.risk_score}
        confidence={alzheimers.confidence}
        factors={alzheimers.contributing_factors}
        icon="brain"
        color="#8B5CF6"
      />
    </View>
  );
}

function DiseaseCard({ title, score, confidence, factors, icon, color }) {
  const riskLevel = score > 70 ? "High" : score > 40 ? "Moderate" : "Low";
  
  return (
    <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={styles.header}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.title}>{title}</Text>
      </View>
      
      <View style={styles.scoreSection}>
        <View style={styles.scoreDisplay}>
          <Text style={[styles.score, { color }]}>{score}</Text>
          <Text style={styles.riskLevel}>{riskLevel} Risk</Text>
        </View>
        
        <CircularProgress value={score} color={color} />
      </View>
      
      <Text style={styles.confidenceLabel}>
        Confidence: {Math.round(confidence * 100)}%
      </Text>
      
      {/* Contributing Factors */}
      <View style={styles.factorsSection}>
        {factors.map((factor, i) => (
          <Text key={i} style={styles.factor}>
            • {factor}
          </Text>
        ))}
      </View>
    </View>
  );
}
```

---

## 📂 Folder Structure Update

```
models/
├─ gait_analysis/
│  ├─ parkinsons_detector.pkl
│  ├─ ms_detector.pkl
│  └─ trainer.py
│
├─ face_analysis/
│  ├─ expression_analyzer.pkl
│  ├─ symmetry_calculator.pkl
│  └─ trainer.py
│
├─ biometric_analysis/
│  ├─ tremor_detector.pkl
│  ├─ hrv_analyzer.pkl
│  ├─ rigidity_calculator.pkl
│  └─ trainer.py
│
├─ feature_extractor.py (Main feature extraction)
├─ ensemble_model.py (Combine all models)
└─ requirements.txt
```

---

## 🚀 Implementation Roadmap

### Phase 1: Data Collection
- [x] Collect arm band biometric data (HR, SpO2, GSR, ECG)
- [x] Collect accelerometer data (gait)
- [x] Collect face images
- [ ] Create labeled dataset (healthy vs diseased)

### Phase 2: Feature Extraction
- [ ] Extract gait features from accelerometer
- [ ] Extract tremor patterns from arm band
- [ ] Extract facial features from images
- [ ] Normalize and standardize features

### Phase 3: Model Training
- [ ] Train Parkinson's detector
- [ ] Train Essential Tremor detector
- [ ] Train MS risk model
- [ ] Train Cognitive Decline model
- [ ] Optimize ensemble predictions

### Phase 4: Backend Integration
- [ ] Implement `/models/detect-disease` endpoint
- [ ] Store detection results in MongoDB
- [ ] Create detection history endpoint

### Phase 5: Frontend Display
- [ ] Create DetectionResults component
- [ ] Update result.tsx to show disease risks
- [ ] Add disease recommendations
- [ ] Show contributing factors

---

## 📊 Sample Detection Response

```json
{
  "parkinsons": {
    "disease": "Parkinson's Disease",
    "risk_score": 68,
    "confidence": 0.75,
    "contributing_factors": [
      "Reduced arm swing asymmetry (0.62)",
      "Tremor frequency detected at 5.2 Hz",
      "Increased gait variability",
      "Heart rate irregularities"
    ],
    "recommendation": "Consult a neurologist. These indicators suggest moderate risk."
  },
  "essential_tremor": {
    "disease": "Essential Tremor",
    "risk_score": 45,
    "confidence": 0.58
  },
  "ms_risk": {
    "disease": "Multiple Sclerosis",
    "risk_score": 32,
    "confidence": 0.42
  },
  "alzheimers_risk": {
    "disease": "Cognitive Decline",
    "risk_score": 28,
    "confidence": 0.35
  }
}
```

---

## 💡 Key Metrics to Track

### Gait Features
- Stride length
- Stride frequency (cadence)
- Arm swing symmetry
- Gait speed
- Balance index
- Step width variability

### Biometric Features
- Tremor frequency (Hz)
- Tremor amplitude (mg)
- Heart rate variability (HRV)
- Heart rate patterns
- GSR responsiveness
- ECG irregularities

### Face Features
- Facial symmetry
- Expression intensity
- Eye contact quality
- Micro-expression detection
- Facial drooping

---

## ✅ Next Steps

1. **Prepare Training Data**
   - Healthy controls (N=50+)
   - Parkinson's patients (N=50+)
   - Essential Tremor (N=30+)
   - MS patients (N=30+)

2. **Implement Feature Extraction**
   - Use provided code in `feature_extractor.py`
   - Test feature quality

3. **Train Models**
   - Use scikit-learn or TensorFlow
   - Cross-validate results
   - Calculate accuracy, sensitivity, specificity

4. **Deploy to Backend**
   - Add detection endpoints
   - Integrate with scanning workflow

5. **Update Frontend**
   - Display risk scores
   - Show recommendations
   - Track disease history
