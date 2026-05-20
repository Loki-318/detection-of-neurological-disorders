from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import Optional
import tempfile  # for temp image files

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
import certifi

# --- TRADITIONAL ML IMPORTS (QSVM ONLY) ---
import joblib
import pandas as pd
import numpy as np
from scipy.signal import butter, filtfilt

# --- FACE MODELS (ResNet / HF Space) ---
import base64
from io import BytesIO
from PIL import Image
import torch
import torch.nn as nn
import torchvision.transforms as transforms
import torchvision.models as models
from gradio_client import Client, handle_file  # HF Space client

# ---------------------------------------------------------------------------
# Config / DB
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]

client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
db = client[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"

app = FastAPI(title="NeuroScan AI")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("neuroscan")

# --- GLOBAL ML MODELS ---
scaler = None
pca = None
qsvm_model = None

# Face models (kept for compatibility, but inference now uses HF Space)
eye_model = None
mouth_model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

IMG_SIZE = 224
eval_transform = transforms.Compose(
    [
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.Grayscale(num_output_channels=3),
        transforms.ToTensor(),
    ]
)

EYE_CLASSES = ["Mild eye", "Moderate eye", "Moderate severe eye", "Severe eye"]
MOUTH_CLASSES = ["Mild mouth", "Moderate mouth", "Moderate severe mouth", "Severe mouth"]

# Hugging Face Space id (Gradio app)
HF_SPACE_ID = "Nihar3006/neuroscan-facial-ai"
hf_client = None

# ---------------------------------------------------------------------------
# Feature Extraction (Physics & Math)
# ---------------------------------------------------------------------------
def apply_bandpass_filter(data_array, fs=13.3, lowcut=3.0, highcut=6.0):
    if len(data_array) < 15:
        return data_array
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    b, a = butter(4, [low, high], btype="band")
    return filtfilt(b, a, data_array)


def extract_6axis_features(raw_mongo_window: list) -> pd.DataFrame:
    df = pd.json_normalize(raw_mongo_window)

    # Mapped exactly to your 'newdata' collection schema
    for col in ["Accel_X", "Accel_Y", "Accel_Z", "Gyro_X", "Gyro_Y", "Gyro_Z"]:
        if col not in df.columns:
            df[col] = 0.0

    acc_x_g = df["Accel_X"] / 16384.0
    acc_y_g = df["Accel_Y"] / 16384.0
    acc_z_g = df["Accel_Z"] / 16384.0

    gyr_x_dps = df["Gyro_X"] / 131.0
    gyr_y_dps = df["Gyro_Y"] / 131.0
    gyr_z_dps = df["Gyro_Z"] / 131.0

    filtered_acc_x = apply_bandpass_filter(acc_x_g)
    filtered_acc_y = apply_bandpass_filter(acc_y_g)
    filtered_acc_z = apply_bandpass_filter(acc_z_g)
    filtered_gyr_x = apply_bandpass_filter(gyr_x_dps)
    filtered_gyr_y = apply_bandpass_filter(gyr_y_dps)
    filtered_gyr_z = apply_bandpass_filter(gyr_z_dps)

    return pd.DataFrame(
        [
            {
                "xAcc": np.var(filtered_acc_x),
                "yAcc": np.var(filtered_acc_y),
                "zAcc": np.var(filtered_acc_z),
                "xGyro": np.sum(filtered_gyr_x ** 2) / len(df),
                "yGyro": np.sum(filtered_gyr_y ** 2) / len(df),
                "zGyro": np.sum(filtered_gyr_z ** 2) / len(df),
            }
        ]
    )

# ---------------------------------------------------------------------------
# Face model helpers (now using HF Space as backend)
# ---------------------------------------------------------------------------
def build_resnet50(num_classes: int) -> nn.Module:
    # Kept for compatibility; not used when calling HF Space
    model = models.resnet50(weights=None)
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(p=0.3),
        nn.Linear(in_features, num_classes),
    )
    return model


def load_face_models() -> bool:
    """
    Initialize a client to the Hugging Face Space instead of downloading .pth files.
    """
    global hf_client

    try:
        logger.info(f"Initializing Hugging Face Space client for {HF_SPACE_ID}")
        hf_client = Client(HF_SPACE_ID)
        logger.info(f"Connected to Hugging Face Space: {HF_SPACE_ID}")
        # Optional: inspect API once at startup
        try:
            api_info = hf_client.view_api()
            logger.info(f"HF Space API schema: {api_info}")
        except Exception:
            logger.warning("Could not fetch HF Space API schema via view_api()")
        return True
    except Exception:
        logger.exception("Failed to initialize Hugging Face Space client")
        hf_client = None
        return False


def decode_base64_image(b64: str) -> Image.Image:
    if not b64:
        raise ValueError("Empty image payload")

    if b64.startswith("data:image"):
        b64 = b64.split(",", 1)[1]

    b64 = b64.strip().replace("\n", "").replace("\r", "").replace(" ", "")

    missing_padding = len(b64) % 4
    if missing_padding:
        b64 += "=" * (4 - missing_padding)

    data = base64.b64decode(b64)
    return Image.open(BytesIO(data)).convert("RGB")


@torch.no_grad()
def run_face_models(image: Image.Image):
    """
    Send the image to the Hugging Face Space and return its raw prediction
    (dict or string, depending on the Space).
    """
    if hf_client is None:
        raise RuntimeError("Hugging Face Space client is not initialized")

    # Save image to a temporary PNG file (handle_file needs a path or URL)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        image.save(tmp, format="PNG")
        tmp_path = tmp.name

    logger.info(f"Sending image to HF Space for prediction: {tmp_path}")
    try:
        # api_name must match the Space "Use via API" snippet
        result = hf_client.predict(
            image=handle_file(tmp_path),
            api_name="/predict_severity",  # from your HF example
        )
        logger.info(f"HF Space prediction raw result: {result}")
    except Exception:
        logger.exception("Hugging Face Space inference failed")
        raise RuntimeError("Hugging Face Space inference failed")
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            logger.warning(f"Failed to delete temp image file: {tmp_path}")

    # IMPORTANT: return the raw result (often a dict), not str(...)
    return result


def build_face_summary(result) -> str:
    """
    Turn the HF Space result into a concise, human-readable summary.
    Expects a dict like:
    {
      "Eye paralysis": {"predicted_class": "...", "class_probs": {...}},
      "Mouth paralysis": {"predicted_class": "...", "class_probs": {...}}
    }
    """
    try:
        if isinstance(result, dict):
            eye_info = result.get("Eye paralysis", {}) or {}
            mouth_info = result.get("Mouth paralysis", {}) or {}

            eye_class = eye_info.get("predicted_class", "Unknown eye")
            mouth_class = mouth_info.get("predicted_class", "Unknown mouth")

            def top_prob_str(probs: dict):
                if not isinstance(probs, dict) or not probs:
                    return ""
                label, val = max(probs.items(), key=lambda kv: kv[1])
                return f" (highest confidence: {label} {val:.1%})"

            eye_probs = eye_info.get("class_probs") or {}
            mouth_probs = mouth_info.get("class_probs") or {}

            eye_extra = top_prob_str(eye_probs)
            mouth_extra = top_prob_str(mouth_probs)

            return f"Eye: {eye_class}{eye_extra} | Mouth: {mouth_class}{mouth_extra}"
        else:
            # Fallback if Space changes its schema
            return str(result)
    except Exception:
        logger.exception("Failed to format face summary from HF result")
        return str(result)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    token = None
    if creds and creds.credentials:
        token = creds.credentials
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one(
            {"id": payload["sub"]}, {"_id": 0, "password_hash": 0}
        )
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AuthOut(BaseModel):
    token: str
    user: dict


class ScanIn(BaseModel):
    heartRate: float = 0.0
    spo2: float = 0.0
    gsr: float = 0.0
    ecg: float = 0.0
    accel: Optional[dict] = None
    face_detected: bool = True


class FaceScanIn(BaseModel):
    image: str

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@api_router.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    return {"token": token, "user": {"id": user_id, "email": email, "name": body.name}}


@api_router.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user["name"]},
    }


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------------------------------------------------------------------------
# Full gait dataset processing
# ---------------------------------------------------------------------------
@api_router.get("/gait-data")
async def get_gait_data(user: dict = Depends(get_current_user)):
    try:
        hardware_db = client["WearableProject"]

        # PULL THE ENTIRE DATASET (Up to 2000 rows to ensure we get everything)
        cursor = hardware_db.newdata.find({}, {"_id": 0}).sort("Timestamp", 1)
        all_data = await cursor.to_list(length=2000)

        # If empty, return safe default
        if len(all_data) < 40:
            return {
                "raw_data": all_data,
                "timeline": [{"score": 85, "class": "Mild/No Tremor"}],
            }

        timeline = []
        window_size = 40

        # SLICE INTO CHUNKS & EVALUATE THE ENTIRE TIMELINE
        for i in range(0, len(all_data) - window_size + 1, window_size):
            window = all_data[i : i + window_size]
            gait_score = 85
            qsvm_class = "Mild/No Tremor"

            if scaler and pca and qsvm_model:
                try:
                    features_df = extract_6axis_features(window)
                    live_scaled = scaler.transform(features_df)
                    live_pca = pca.transform(live_scaled)
                    prediction = str(qsvm_model.predict(live_pca)[0])

                    if prediction == "3":
                        gait_score = 30
                        qsvm_class = "Severe Tremor"
                    elif prediction == "2":
                        gait_score = 55
                        qsvm_class = "Moderate Tremor"
                    elif prediction == "1":
                        gait_score = 85
                        qsvm_class = "Mild/No Tremor"
                except Exception:
                    logger.exception("Error in QSVM prediction for gait window")
                    pass

            # Save the AI result for this specific chunk
            timeline.append(
                {
                    "score": gait_score,
                    "class": qsvm_class,
                }
            )

        return {
            "raw_data": all_data,  # Full dataset for the flowing graph
            "timeline": timeline,  # Array of AI scores corresponding to the chunks
        }
    except Exception:
        logger.exception("Bulk QSVM error")
        return {"raw_data": [], "timeline": []}


@api_router.get("/sensor-data")
async def get_raw_sensor_data(user: dict = Depends(get_current_user)):
    try:
        hardware_db = client["WearableProject"]
        cursor = (
            hardware_db.LiveHumanData.find({}, {"_id": 0})
            .sort("timestamp", 1)
            .limit(50)
        )
        data = await cursor.to_list(length=50)
        return data
    except Exception:
        logger.exception("LiveHumanData error")
        return []

# ---------------------------------------------------------------------------
# Face scan endpoint (now using HF Space)
# ---------------------------------------------------------------------------
@api_router.post("/scans/face")
async def analyze_face(body: FaceScanIn, user: dict = Depends(get_current_user)):
    if not body.image:
        raise HTTPException(status_code=400, detail="No image provided")

    logger.info(f"Received face scan request for user_id={user.get('id')}")
    try:
        pil_image = decode_base64_image(body.image)
        raw_result = run_face_models(pil_image)
        summary = build_face_summary(raw_result)
        logger.info(f"Face scan summary for user_id={user.get('id')}: {summary}")
    except Exception as e:
        logger.exception("Face model error")
        raise HTTPException(status_code=500, detail=str(e))

    face_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "image_base64": body.image,
        "raw_result": raw_result,
        "summary": summary,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.face_scans.insert_one(face_doc)
    return {"summary": summary}

# ---------------------------------------------------------------------------
# Root + startup
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"service": "NeuroScan AI", "status": "ok"}


@app.on_event("startup")
async def on_startup():
    logger.info("Starting NeuroScan AI backend")
    await db.users.create_index("email", unique=True)
    await db.scans.create_index([("user_id", 1), ("created_at", -1)])

    global scaler, pca, qsvm_model
    model_dir = ROOT_DIR / "models"
    try:
        scaler = joblib.load(model_dir / "live_qsvm_scaler.pkl")
        pca = joblib.load(model_dir / "live_qsvm_pca.pkl")
        qsvm_model = joblib.load(model_dir / "live_qsvm_model.pkl")
        logger.info("Quantum SVM pipeline loaded successfully")
    except Exception:
        logger.exception(f"Failed to load Quantum models from {model_dir}")

    try:
        ok = load_face_models()
        if ok:
            logger.info(
                "Face ResNet models loaded successfully (Hugging Face Space)"
            )
        else:
            logger.error("Face ResNet models NOT loaded")
    except Exception:
        logger.exception("Failed to load face models from Hugging Face Space")

    logger.info("NeuroScan AI backend ready")


@app.on_event("shutdown")
async def on_shutdown():
    logger.info("Shutting down NeuroScan AI backend")
    client.close()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)