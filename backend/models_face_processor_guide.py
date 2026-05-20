"""
Backend Guide - Face Scanning & ML Model Integration
File: backend/models/face_processor.py
"""

import os
import cv2
import numpy as np
from pathlib import Path
import pickle

# Assuming you have trained models saved in /models folder
MODELS_DIR = Path(__file__).parent.parent.parent / "models"

class FaceProcessor:
    def __init__(self):
        # Load pre-trained models
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        # Load custom ML models (once you train them)
        self.expression_model = self._load_model("expression_analyzer.pkl")
        self.landmark_detector = self._load_model("face_landmarks.pkl")
    
    def _load_model(self, model_name: str):
        """Load pickled ML model"""
        model_path = MODELS_DIR / model_name
        if model_path.exists():
            with open(model_path, 'rb') as f:
                return pickle.load(f)
        return None
    
    def process_face(self, image_path: str) -> dict:
        """
        Process face image and extract features
        
        Returns:
            {
                "face_score": 0-100,
                "confidence": 0-1,
                "features": {
                    "symmetry": 0-100,
                    "expression_intensity": 0-100,
                    "eye_movement": {...},
                    "micro_expressions": [...]
                }
            }
        """
        try:
            # Read image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError("Could not read image")
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
            
            if len(faces) == 0:
                return {
                    "face_score": 0,
                    "confidence": 0,
                    "error": "No face detected"
                }
            
            # Process first detected face
            face = faces[0]
            x, y, w, h = face
            face_roi = gray[y:y+h, x:x+w]
            
            # Extract features
            symmetry_score = self._calculate_symmetry(face_roi)
            micro_exp_score = self._detect_micro_expressions(face_roi)
            eye_score = self._analyze_eyes(image, face)
            
            # Combine scores
            face_score = int((symmetry_score + micro_exp_score + eye_score) / 3)
            confidence = 0.85  # Base confidence
            
            return {
                "face_score": face_score,
                "confidence": confidence,
                "features": {
                    "symmetry": symmetry_score,
                    "micro_expressions": micro_exp_score,
                    "eyes": eye_score,
                    "faces_detected": len(faces)
                }
            }
        
        except Exception as e:
            print(f"Face processing error: {e}")
            return {
                "face_score": 0,
                "confidence": 0,
                "error": str(e)
            }
    
    def _calculate_symmetry(self, face_roi: np.ndarray) -> int:
        """Calculate facial symmetry score (0-100)"""
        # Split face in half
        h, w = face_roi.shape
        left_half = face_roi[:, :w//2]
        right_half = face_roi[:, w//2:]
        
        # Compare halves
        right_half_flipped = np.fliplr(right_half[:, :left_half.shape[1]])
        difference = cv2.absdiff(left_half, right_half_flipped)
        mse = np.sum(difference ** 2) / difference.size
        
        # Convert MSE to symmetry score (lower MSE = higher symmetry)
        symmetry = max(0, 100 - (mse / 100))
        return int(symmetry)
    
    def _detect_micro_expressions(self, face_roi: np.ndarray) -> int:
        """Detect micro-expressions (0-100)"""
        # Use facial recognition model for expressions
        # For now, return a placeholder
        # TODO: Integrate with TensorFlow/PyTorch expression model
        
        # Example with histogram
        hist = cv2.calcHist([face_roi], [0], None, [256], [0, 256])
        expression_variance = np.var(hist)
        expression_score = min(100, int(expression_variance / 10))
        
        return expression_score
    
    def _analyze_eyes(self, image: np.ndarray, face: tuple) -> int:
        """Analyze eye gaze and quality (0-100)"""
        # Detect eyes within face region
        x, y, w, h = face
        roi = image[y:y+h, x:x+w]
        
        # Use cascade classifier for eyes
        eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_eye.xml'
        )
        eyes = eye_cascade.detectMultiScale(roi)
        
        # Score based on eye detection (both eyes present = high score)
        eye_score = min(100, len(eyes) * 50)
        return eye_score


# ===== FastAPI Integration =====
# server.py

from fastapi import UploadFile, File
import tempfile

face_processor = FaceProcessor()

@api_router.post("/models/process-face")
async def process_face(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """
    Process uploaded face image and return score
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name
        
        # Process face
        result = face_processor.process_face(tmp_path)
        
        # Clean up
        os.unlink(tmp_path)
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== Example Directory Structure =====
"""
models/
├─ face_detector.pkl
├─ expression_analyzer.pkl
├─ face_landmarks.pkl
├─ gait_analyzer.pkl
├─ requirements.txt (scikit-learn, opencv-python, etc.)
└─ train_models.py (script to create models)
"""

# ===== Install Requirements =====
"""
pip install opencv-python scikit-learn numpy
"""
