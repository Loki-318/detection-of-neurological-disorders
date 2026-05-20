import joblib
import pandas as pd
import numpy as np
from scipy.signal import butter, filtfilt
import os

# --- 1. FILTERING MATH ---
def apply_bandpass_filter(data_array, fs=13.3, lowcut=3.0, highcut=6.0):
    if len(data_array) < 15:
        return data_array
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    b, a = butter(4, [low, high], btype='band')
    return filtfilt(b, a, data_array)

def extract_6axis_features(raw_mongo_window: list) -> pd.DataFrame:
    df = pd.json_normalize(raw_mongo_window)
    for col in ['accel.x', 'accel.y', 'accel.z', 'gyro.x', 'gyro.y', 'gyro.z']:
        if col not in df.columns:
            df[col] = 0.0

    acc_x_g = df['accel.x'] / 16384.0
    acc_y_g = df['accel.y'] / 16384.0
    acc_z_g = df['accel.z'] / 16384.0
    
    gyr_x_dps = df['gyro.x'] / 131.0
    gyr_y_dps = df['gyro.y'] / 131.0
    gyr_z_dps = df['gyro.z'] / 131.0

    filtered_acc_x = apply_bandpass_filter(acc_x_g)
    filtered_acc_y = apply_bandpass_filter(acc_y_g)
    filtered_acc_z = apply_bandpass_filter(acc_z_g)
    filtered_gyr_x = apply_bandpass_filter(gyr_x_dps)
    filtered_gyr_y = apply_bandpass_filter(gyr_y_dps)
    filtered_gyr_z = apply_bandpass_filter(gyr_z_dps)

    return pd.DataFrame([{
        'xAcc': np.var(filtered_acc_x), 'yAcc': np.var(filtered_acc_y), 'zAcc': np.var(filtered_acc_z),
        'xGyro': np.sum(filtered_gyr_x ** 2) / len(df), 'yGyro': np.sum(filtered_gyr_y ** 2) / len(df), 'zGyro': np.sum(filtered_gyr_z ** 2) / len(df)
    }])

# --- 2. LOAD MODELS ---
model_dir = os.path.join(os.path.dirname(__file__), "models")
scaler = joblib.load(os.path.join(model_dir, "live_qsvm_scaler.pkl"))
pca = joblib.load(os.path.join(model_dir, "live_qsvm_pca.pkl"))
qsvm = joblib.load(os.path.join(model_dir, "live_qsvm_model.pkl"))

# --- 3. PROCEDURAL PATIENT GENERATOR ---
def generate_patient(freq, acc_amp, gyro_amp, noise):
    """Generates 3 seconds of fake MPU-6050 data based on frequency and amplitude."""
    data = []
    time_steps = np.linspace(0, 3, 40)
    for t in time_steps:
        # If freq is 0, it's just static noise. Otherwise, it's a sine wave.
        wave = np.sin(2 * np.pi * freq * t) if freq > 0 else 0
        data.append({
            "accel": {
                "x": int(wave * acc_amp + np.random.normal(0, noise)),
                "y": int(wave * acc_amp + np.random.normal(0, noise)),
                "z": int(16384 + wave * acc_amp + np.random.normal(0, noise)) # Gravity on Z
            },
            "gyro": {
                "x": int(wave * gyro_amp + np.random.normal(0, noise)),
                "y": int(wave * gyro_amp + np.random.normal(0, noise)),
                "z": int(wave * gyro_amp + np.random.normal(0, noise))
            }
        })
    return data

# --- 4. THE 10 TEST CASES ---
# Format: (Name, Frequency Hz, Accel Amplitude, Gyro Amplitude, Noise)
test_cases = [
    ("Patient 1: Absolute Stillness (Sensor Noise Only)", 0, 0, 0, 50),
    ("Patient 2: Very Slow Movement (e.g. stretching - 1Hz)", 1.0, 3000, 3000, 100), # Should be filtered out!
    ("Patient 3: Typing on Keyboard (High noise, no wave)", 0, 0, 0, 600),
    ("Patient 4: Mild Physiological Tremor", 5.0, 100, 100, 50),
    ("Patient 5: Mild Parkinson's (Slight Twisting)", 4.5, 300, 1200, 100),
    ("Patient 6: Moderate Tremor (Visible Shaking)", 5.0, 1500, 3000, 150),
    ("Patient 7: Moderate Tremor (High Gyro/Pill-Rolling)", 4.8, 800, 6000, 200),
    ("Patient 8: Severe Tremor (Standard 5Hz)", 5.0, 4000, 12000, 300),
    ("Patient 9: Violent Action Tremor", 5.5, 7000, 20000, 500),
    ("Patient 10: Extreme Chaos (Drop/Glitch Simulation)", 6.0, 15000, 30000, 1000)
]

# --- 5. RUN THE TEST SUITE ---
print("\n" + "="*50)
print(" 🚀 NEUROSCAN QSVM VALIDATION SUITE ")
print("    Lead Engineer: P Nihar Reddy ")
print("="*50)

for name, freq, acc_amp, gyro_amp, noise in test_cases:
    raw_data = generate_patient(freq, acc_amp, gyro_amp, noise)
    features = extract_6axis_features(raw_data)
    
    # Predict
    scaled = scaler.transform(features)
    compressed = pca.transform(scaled)
    prediction = str(qsvm.predict(compressed)[0])
    
    # Map label
    if prediction == "3":
        result = "Severe Tremor 🚨"
    elif prediction == "2":
        result = "Moderate Tremor ⚠️"
    else:
        result = "Safe / Normal ✅"
        
    print(f"\n🩺 {name}")
    print(f"   Features -> AccVar: {features['xAcc'][0]:.4f} | GyrEng: {features['xGyro'][0]:.2f}")
    print(f"   🧠 QSVM: {result}")

print("\n" + "="*50 + "\n")