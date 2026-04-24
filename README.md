# Gait Model — Parkinson's Detection

Wrist accelerometer-based motor symptom classifier using ALAMEDA + PADS datasets.

## Project Structure

```
gait_model/
├── data/
│   ├── ALAMEDA_PD_tremor_dataset.csv       ← Place here
│   ├── pads_preprocessed/                  ← PADS preprocessed movement files
│   │   ├── movement/                       ← Per-subject IMU files
│   │   └── file_list.csv                   ← Master index
│   └── pads_patients/                      ← patient_XXX.json files
├── notebooks/
│   ├── 01_eda.ipynb                        ← Run first: explore ALAMEDA
│   ├── 02_baseline_model.ipynb             ← LOSO + Random Forest on ALAMEDA
│   └── 03_pads_integration.ipynb           ← Phase 2: add PADS healthy controls
├── models/
│   └── rf_baseline.pkl                     ← Saved after 02 runs
└── src/
    └── feature_extractor.py                ← Reusable pipeline for live MPU6050
```

## Execution Order

1. Place `ALAMEDA_PD_tremor_dataset.csv` in `data/`
2. Run `01_eda.ipynb` — understand data distributions
3. Run `02_baseline_model.ipynb` — train + evaluate Random Forest with LOSO CV
4. (After PADS downloads) Run `03_pads_integration.ipynb` — add healthy controls

## Setup

```bash
pip install jupyterlab scikit-learn pandas numpy matplotlib seaborn scipy imbalanced-learn nbformat
jupyter lab
```

## Key Decisions

- **Target**: `Rest_tremor` (binary) — most clinically significant PD marker
- **Validation**: Leave-One-Subject-Out (LOSO) — prevents subject-level data leakage
- **Class imbalance**: SMOTE applied per training fold only
- **Metric**: Balanced Accuracy + ROC-AUC (not raw accuracy — class imbalance)
- **Feature space**: 92 features matching ALAMEDA schema (time-domain + FFT)

## Hardware

Sensor: MPU6050 (Accel X/Y/Z at 100 Hz, wrist/forearm placement)
Window: 2048 samples = 20.48s, 50% overlap
Filter: Bandpass 2.5–12.5 Hz (tremor band)
