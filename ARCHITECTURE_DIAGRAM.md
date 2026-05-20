# Disease Detection - Visual Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (MOBILE APP)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📸 SCAN SCREEN                                                 │
│  ├─ Camera: Captures face image                                │
│  ├─ Accelerometer: Records gait patterns                       │
│  ├─ Arm Band Sensors: Collects HR, SpO2, GSR, ECG, Temp      │
│  └─ Button: "Complete Scan"                                   │
│                                                                   │
│  Shows: 20-second processing animation                         │
│                                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    RAW SENSOR DATA:
                    • Face Image
                    • Accelerometer (X,Y,Z)
                    • HR, SpO2, GSR, ECG, Temp
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND PROCESSING                            │
│                                                                   │
│  POST /models/detect-disease                                   │
│  ├─ Input: File (face), gait_data, vitals_data               │
│  └─ Output: Disease detection results                         │
│                                                                   │
│  STEP 1: FEATURE EXTRACTION                                    │
│  ├─ Gait Features (13 features)                               │
│  │  ├─ stride_length_estimate: 1.1m                           │
│  │  ├─ arm_swing_symmetry: 0.65 ◄─ Parkinson's indicator    │
│  │  ├─ tremor_frequency: 5.1 Hz ◄─ Parkinson's indicator    │
│  │  ├─ gait_regularity: 0.35                                 │
│  │  ├─ balance_index: 0.45                                   │
│  │  └─ ... 8 more features                                   │
│  │                                                              │
│  ├─ Biometric Features (16 features)                          │
│  │  ├─ heart_rate_variability: 4.2 ◄─ Low = bad sign       │
│  │  ├─ autonomic_stress_index: 0.65                          │
│  │  ├─ tremor_amplitude: 8.5                                 │
│  │  └─ ... 13 more features                                  │
│  │                                                              │
│  └─ Face Features (10 features)                               │
│     ├─ expression_intensity: 0.65                             │
│     ├─ eye_contact_quality: 0.70                              │
│     └─ ... 8 more features                                    │
│                                                                   │
│  STEP 2: DISEASE DETECTION (Parallel)                         │
│  ├─ Parkinson's Detector                                      │
│  │  ├─ arm_swing < 0.7? YES → +15 points                     │
│  │  ├─ stride < 1.0m? YES → +12 points                       │
│  │  ├─ tremor 4-6Hz? YES → +20 points                        │
│  │  ├─ rigidity markers? YES → +20 points                    │
│  │  ├─ autonomic dysfunction? YES → +15 points               │
│  │  └─ TOTAL: 65/100 (Moderate Risk, 78% confidence)        │
│  │                                                              │
│  ├─ Essential Tremor Detector                                 │
│  │  ├─ tremor 8-12Hz? NO → 0 points                          │
│  │  ├─ normal gait? YES → +30 points                         │
│  │  └─ TOTAL: 35/100                                         │
│  │                                                              │
│  ├─ Multiple Sclerosis Detector                               │
│  │  ├─ high gait variability? MAYBE → +10 points             │
│  │  └─ TOTAL: 28/100                                         │
│  │                                                              │
│  └─ Cognitive Decline Detector                                │
│     ├─ reduced expression? YES → +16 points                  │
│     ├─ slow gait? YES → +12 points                           │
│     └─ TOTAL: 22/100                                         │
│                                                                   │
│  STEP 3: STORE RESULTS                                         │
│  └─ MongoDB: disease_detections collection                    │
│                                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    DETECTION RESULTS:
                    {
                      "parkinsons": {
                        "risk_score": 65,
                        "confidence": 0.78,
                        "factors": [...]
                      },
                      ...
                    }
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   RESULTS SCREEN (FRONTEND)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ⚠️ ALERT (if risk > 50%)                                       │
│  "Your scan indicates Parkinson's Disease risk.                │
│   Please consult with a healthcare provider."                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  🚶 PARKINSON'S DISEASE RISK                         │       │
│  │                                                       │       │
│  │  Score: 65    🟠 MODERATE RISK                      │       │
│  │                                                       │       │
│  │  ┌─────────────┐  Contributing Factors:             │       │
│  │  │    65%      │  • Reduced arm swing (0.65)       │       │
│  │  │   ░░░░░░░░  │  • Tremor detected (5.1 Hz)       │       │
│  │  └─────────────┘  • Stride variability              │       │
│  │                                                       │       │
│  │  Confidence: 78%  ▓▓▓▓▓▓▓▓░░                        │       │
│  │                                                       │       │
│  │  🔶 Recommendation:                                 │       │
│  │  Schedule neurological consultation                │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  🌀 ESSENTIAL TREMOR RISK                            │       │
│  │  Score: 35    🟡 MILD RISK                          │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  🧠 COGNITIVE DECLINE RISK                           │       │
│  │  Score: 22    🟢 LOW RISK                           │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  📋 FEATURES ANALYZED                               │       │
│  │  • Gait Metrics: 13 features analyzed              │       │
│  │  • Biometrics: 16 features analyzed                │       │
│  │  • Facial: 10 features analyzed                    │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Parkinson's Detection Algorithm (Detailed)

```
PARKINSON'S DETECTOR SCORING:

INPUT: Gait + Biometric + Face Features
       │
       ├─ ARM SWING ANALYSIS (Max: 15 points)
       │  └─ IF symmetry < 0.7:
       │     └─ reason: Asymmetric arm movement is key sign
       │        score: +15
       │        example: 0.65 → "Reduced arm swing asymmetry"
       │
       ├─ STRIDE LENGTH ANALYSIS (Max: 12 points)
       │  └─ IF length < 1.0m:
       │     └─ reason: Shuffling is characteristic
       │        score: +12
       │        example: 0.85m → "Shortened stride length"
       │
       ├─ GAIT REGULARITY ANALYSIS (Max: 13 points)
       │  └─ IF regularity < 0.4:
       │     └─ reason: Variable pattern indicates motor control issues
       │        score: +13
       │        example: 0.35 → "Irregular gait pattern"
       │
       ├─ TREMOR ANALYSIS (Max: 20 points)
       │  └─ IF frequency 4-6Hz AND amplitude > 5:
       │     └─ reason: Rest tremor is diagnostic
       │        score: +20
       │        example: 5.1Hz, 8.5mg → "Rest tremor detected"
       │
       ├─ RIGIDITY DETECTION (Max: 12 points)
       │  └─ IF acceleration_std < 0.2:
       │     └─ reason: Reduced variability = muscle stiffness
       │        score: +12
       │        example: 0.15 → "Reduced acceleration variability"
       │
       ├─ ASYMMETRY INDEX (Max: 8 points)
       │  └─ IF asymmetry > 0.6:
       │     └─ reason: Unequal weight distribution
       │        score: +8
       │        example: 0.68 → "Movement asymmetry detected"
       │
       ├─ HEART RATE VARIABILITY (Max: 8 points)
       │  └─ IF HRV < 5:
       │     └─ reason: Autonomic nervous system affected
       │        score: +8
       │        example: 3.2 → "Autonomic dysfunction"
       │
       └─ AUTONOMIC STRESS (Max: 7 points)
          └─ IF stress_index > 0.6:
             └─ reason: Heightened stress response
                score: +7
                example: 0.68 → "Elevated autonomic stress"

FINAL SCORING:
  Low Risk (0-30): Normal gait, no tremor, good balance
  Mild Risk (30-50): Some indicators present
  Moderate Risk (50-70): Multiple indicators (65 in example)
  High Risk (70+): Strong indicators, urgent evaluation needed

CONFIDENCE CALCULATION:
  Base: 0.5
  +0.15 for each indicator present
  Example: 5 indicators → 0.5 + (5 × 0.15) = 0.78 (78%)
```

---

## Feature Extraction Pipeline

```
RAW SENSOR INPUT (per second)
│
├─ ACCELEROMETER STREAM
│  │ Sampled at 100 Hz
│  ├─ X-axis (lateral movement)
│  ├─ Y-axis (forward-back movement)
│  └─ Z-axis (vertical movement)
│
├─ ARM BAND STREAM
│  │ Sampled at ~1 Hz
│  ├─ Heart Rate (bpm): 60-100 normal
│  ├─ SpO2 (%): 95-100% normal
│  ├─ GSR (μS): 0.1-10 normal
│  ├─ ECG (mV): varies
│  └─ Temperature (°C): 36.5-37.5 normal
│
└─ FACE CAMERA
   │ Sampled at scan time
   ├─ Facial landmarks (68 points)
   ├─ Expression detection
   ├─ Eye tracking
   └─ Micro-expression detection

PROCESSING FOR GAIT (13 FEATURES):
```
X,Y,Z → Magnitude → Peak Detection → Intervals
                            ↓
                    Stride Length = f(magnitude)
                    Cadence = peaks_per_second
                    Regularity = autocorrelation
                    Speed = stride × cadence
                    Balance = var(X,Y,Z)
                    Symmetry = var(X)/var(Y)
                    Asymmetry = std(X)/(std(X)+std(Y))
                    Frequency = FFT(magnitude)
                    Variability = std(interval_diffs)
```

PROCESSING FOR BIOMETRICS (16 FEATURES):
```
HR Stream → Calculate HRV = std(diff(HR))
ECG Stream → FFT → Detect Tremor Frequency
GSR Stream → std(GSR) → Responsiveness
Temp Stream → Trends → Fever/Stress
Combine HR+GSR → Autonomic Stress Index
```

PROCESSING FOR FACE (10 FEATURES):
```
Image → Landmarks → Symmetry Score
Image → Facial Features → Expression Intensity
Image → Eye Regions → Eye Openness, Blink Rate
Image → Micro-expressions → Count & Intensity
```

OUTPUT: 39 FEATURES COMBINED
```
{
  "stride_length_estimate": 1.1,
  "arm_swing_symmetry": 0.65,
  "tremor_frequency": 5.1,
  ...
}
```

DISEASE DETECTORS USE THESE FEATURES:
```
Parkinson's → arm_swing, tremor_freq, stride, rigidity
Essential Tremor → tremor_freq, tremor_amp, normal_gait
MS → stride_variability, walking_speed, autonomic_stress
Cognitive → expression_intensity, eye_contact, gait_speed
```
