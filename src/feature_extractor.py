"""
feature_extractor.py
--------------------
Reusable pipeline for extracting ALAMEDA-compatible features
from live MPU6050 data (or any raw 3-axis accelerometer input).

Used by both training notebooks and the production app.

Usage:
    from src.feature_extractor import FeatureExtractor
    fe = FeatureExtractor(sample_rate=100, window_size=2048, overlap=0.5)
    features = fe.extract(accel_xyz_array)  # shape (N, 3)
"""

import numpy as np
from scipy.signal import butter, filtfilt
from scipy.fft import fft, fftfreq
from scipy.stats import skew, kurtosis


class FeatureExtractor:
    def __init__(self, sample_rate: int = 100,
                 window_size: int = 2048,
                 overlap: float = 0.5,
                 lowcut: float = 2.5,
                 highcut: float = 12.5):
        self.fs          = sample_rate
        self.window_size = window_size
        self.step        = int(window_size * (1 - overlap))
        self.lowcut      = lowcut
        self.highcut     = highcut

    # ── Preprocessing ──────────────────────────────────────────────────────
    def bandpass_filter(self, signal: np.ndarray) -> np.ndarray:
        nyq = self.fs / 2.0
        b, a = butter(4, [self.lowcut / nyq, self.highcut / nyq], btype='band')
        return filtfilt(b, a, signal)

    def compute_magnitude(self, accel_xyz: np.ndarray) -> np.ndarray:
        """accel_xyz: shape (N, 3) → returns magnitude shape (N,)"""
        return np.sqrt(np.sum(accel_xyz ** 2, axis=1))

    def pca_first_component(self, accel_xyz: np.ndarray) -> np.ndarray:
        """Returns first PCA component to remove orientation dependency."""
        centered = accel_xyz - accel_xyz.mean(axis=0)
        cov = np.cov(centered.T)
        eigvals, eigvecs = np.linalg.eigh(cov)
        pc1_vec = eigvecs[:, np.argmax(eigvals)]
        return centered @ pc1_vec

    # ── Feature extraction from one signal ─────────────────────────────────
    def _features_from_signal(self, sig: np.ndarray, prefix: str) -> dict:
        N = len(sig)
        fft_vals = np.abs(fft(sig))[:N // 2]
        freqs    = fftfreq(N, 1 / self.fs)[:N // 2]
        dom_idx  = np.argmax(fft_vals)

        f = {
            # Time domain
            f"{prefix}_mean":            np.mean(sig),
            f"{prefix}_std_dev":         np.std(sig),
            f"{prefix}_var":             np.var(sig),
            f"{prefix}_avg_diff_mean":   np.mean(np.abs(np.diff(sig))),
            f"{prefix}_above_mean_rt":   np.mean(sig > np.mean(sig)),
            f"{prefix}_median":          np.median(sig),
            f"{prefix}_med_dev":         np.median(np.abs(sig - np.median(sig))),
            f"{prefix}_iqr":             np.percentile(sig, 75) - np.percentile(sig, 25),
            f"{prefix}_skewness":        skew(sig),
            f"{prefix}_kurtosis":        kurtosis(sig),
            f"{prefix}_min":             np.min(sig),
            f"{prefix}_max":             np.max(sig),
            f"{prefix}_maxmin_diff":     np.max(sig) - np.min(sig),
            f"{prefix}_peaks_rt":        np.mean(np.diff(np.sign(np.diff(sig))) < 0),
            f"{prefix}_rest_rt":         np.mean(np.abs(sig) < 0.01),
            f"{prefix}_ssc_rt":          np.mean(np.diff(np.sign(np.diff(sig))) != 0),
            f"{prefix}_rms":             np.sqrt(np.mean(sig ** 2)),
            f"{prefix}_energy":          np.sum(sig ** 2),
            f"{prefix}_sampen":          0.0,   # populate via antropy if available
            f"{prefix}_dfa":             1.0,   # populate via antropy if available
            # FFT domain
            f"{prefix}_fft_mean":        np.mean(fft_vals),
            f"{prefix}_fft_std_dev":     np.std(fft_vals),
            f"{prefix}_fft_var":         np.var(fft_vals),
            f"{prefix}_fft_avg_diff_mean": np.mean(np.abs(np.diff(fft_vals))),
            f"{prefix}_fft_above_mean_rt": np.mean(fft_vals > np.mean(fft_vals)),
            f"{prefix}_fft_median":      np.median(fft_vals),
            f"{prefix}_fft_med_dev":     np.median(np.abs(fft_vals - np.median(fft_vals))),
            f"{prefix}_fft_iqr":         np.percentile(fft_vals, 75) - np.percentile(fft_vals, 25),
            f"{prefix}_fft_skewness":    skew(fft_vals),
            f"{prefix}_fft_kurtosis":    kurtosis(fft_vals),
            f"{prefix}_fft_min":         np.min(fft_vals),
            f"{prefix}_fft_max":         np.max(fft_vals),
            f"{prefix}_fft_maxmin_diff": np.max(fft_vals) - np.min(fft_vals),
            f"{prefix}_fft_peaks_rt":    np.mean(np.diff(np.sign(np.diff(fft_vals))) < 0),
            f"{prefix}_fft_rest_rt":     np.mean(fft_vals < 0.01),
            f"{prefix}_fft_ssc_rt":      np.mean(np.diff(np.sign(np.diff(fft_vals))) != 0),
            f"{prefix}_fft_rms":         np.sqrt(np.mean(fft_vals ** 2)),
            f"{prefix}_fft_tot_power":   np.sum(fft_vals ** 2),
            f"{prefix}_fft_dom_freq":    freqs[dom_idx],
            f"{prefix}_fft_dom_freq_rt": freqs[dom_idx] / (self.fs / 2),
            f"{prefix}_fft_pw_ar_dom_freq": fft_vals[dom_idx],
            f"{prefix}_fft_energy":      np.sum(fft_vals ** 2),
        }

        psd_norm = fft_vals ** 2 / (np.sum(fft_vals ** 2) + 1e-12)
        f[f"{prefix}_fft_entropy"]  = -np.sum(psd_norm * np.log(psd_norm + 1e-12))
        f[f"{prefix}_fft_flatness"] = (np.exp(np.mean(np.log(fft_vals + 1e-12))) /
                                       (np.mean(fft_vals) + 1e-12))

        if prefix == "PC1":
            f["PC1_mean_abs"]       = np.mean(np.abs(sig))
            f["PC1_neg_rt"]         = np.mean(sig < 0)
            f["PC1_pos_rt"]         = np.mean(sig > 0)
            f["PC1_zero_cross_rt"]  = np.mean(np.diff(np.sign(sig)) != 0)

        return f

    # ── Main entry point ────────────────────────────────────────────────────
    def extract(self, accel_xyz: np.ndarray) -> list[dict]:
        """
        accel_xyz : np.ndarray, shape (N, 3)
            Raw accelerometer data from MPU6050 in g units.
            First 50 samples (0.5s) are auto-dropped to remove
            device startup/vibration artifact.

        Returns list of feature dicts (one per window).
        """
        # Drop first 0.5s
        accel_xyz = accel_xyz[50:]

        mag = self.compute_magnitude(accel_xyz)
        mag_filt = self.bandpass_filter(mag)

        pc1_raw = self.pca_first_component(accel_xyz)
        pc1_filt = self.bandpass_filter(pc1_raw)

        n_windows = (len(mag_filt) - self.window_size) // self.step + 1
        all_features = []

        for i in range(n_windows):
            start = i * self.step
            end   = start + self.window_size
            w_mag = mag_filt[start:end]
            w_pc1 = pc1_filt[start:end]

            if len(w_mag) < self.window_size:
                continue

            feats = {}
            feats.update(self._features_from_signal(w_mag, "Magnitude"))
            feats.update(self._features_from_signal(w_pc1, "PC1"))
            all_features.append(feats)

        return all_features

    def extract_single_window(self, accel_xyz: np.ndarray) -> dict:
        """
        For live/real-time use: pass exactly window_size samples.
        Returns a single feature dict ready for model.predict().
        """
        mag = self.compute_magnitude(accel_xyz)
        mag_filt = self.bandpass_filter(mag)
        pc1_raw  = self.pca_first_component(accel_xyz)
        pc1_filt = self.bandpass_filter(pc1_raw)

        feats = {}
        feats.update(self._features_from_signal(mag_filt, "Magnitude"))
        feats.update(self._features_from_signal(pc1_filt, "PC1"))
        return feats
