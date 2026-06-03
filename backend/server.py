from contextlib import asynccontextmanager
from dotenv import load_dotenv
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging
import base64
import time
import asyncio
from io import BytesIO


import bcrypt
import jwt as pyjwt
import certifi
import pandas as pd
import numpy as np
import joblib
from scipy.signal import butter, filtfilt


import torch
import torch.nn as nn
import torchvision.transforms as transforms
import torchvision.models as models
from PIL import Image, UnidentifiedImageError
from google.cloud import storage


from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field



ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)
logger = logging.getLogger("neuroscan")


mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"


GCS_BUCKET = os.environ.get("GCS_BUCKET", "")
EYE_MODEL_BLOB = os.environ.get("EYE_MODEL_BLOB", "models/eye/best_eye_model.pth")
EYEBROW_MODEL_BLOB = os.environ.get("EYEBROW_MODEL_BLOB", "models/eyebrow/best_eyebrow_model.pth")
MOUTH_MODEL_BLOB = os.environ.get("MOUTH_MODEL_BLOB", "models/mouth/best_mouth_model.pth")


PORT = int(os.environ.get("PORT", "8080"))


logger.info("Initializing MongoDB client")
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
db = client[db_name]


api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE = 224
MODEL_CACHE_DIR = ROOT_DIR / "model_cache"
MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)


if DEVICE.type == "cpu":
    torch.set_num_threads(int(os.environ.get("TORCH_NUM_THREADS", "2")))
    torch.set_num_interop_threads(int(os.environ.get("TORCH_INTEROP_THREADS", "1")))


logger.info(f"Runtime device selected: {DEVICE}")
logger.info(f"Model cache dir: {MODEL_CACHE_DIR}")
logger.info(f"TORCH_NUM_THREADS={torch.get_num_threads()}")
logger.info(f"TORCH_INTEROP_THREADS={torch.get_num_interop_threads()}")


scaler = None
pca = None
qsvm_model = None
models_loaded = False


eye_model = None
eyebrow_model = None
mouth_model = None
face_models_loaded = False


face_model_lock = asyncio.Lock()
face_inference_semaphore = asyncio.Semaphore(1)
gait_semaphore = asyncio.Semaphore(1)


EYE_CLASSES = ["Mild eye", "Moderate eye", "Moderate severe eye", "Severe eye"]
EYEBROW_CLASSES = ["Mild eyebrow", "Moderate eyebrow", "Moderate severe eyebrow", "Severe eyebrow"]
MOUTH_CLASSES = ["Mild mouth", "Moderate mouth", "Moderate severe mouth", "Severe mouth"]


eval_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.Grayscale(num_output_channels=3),
    transforms.ToTensor(),
])



def apply_bandpass_filter(data_array, fs=13.3, lowcut=3.0, highcut=6.0):
    if len(data_array) < 15:
        return data_array
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    b, a = butter(4, [low, high], btype="band")
    return filtfilt(b, a, data_array)



def extract_6axis_features(raw_mongo_window: list) -> pd.DataFrame:
    rows = []


    for item in raw_mongo_window:
        accel = item.get("accel", {}) or {}
        gyro = item.get("gyro", {}) or {}


        rows.append({
            "Accel_X": float(accel.get("x", 0.0)),
            "Accel_Y": float(accel.get("y", 0.0)),
            "Accel_Z": float(accel.get("z", 0.0)),
            "Gyro_X": float(gyro.get("x", 0.0)),
            "Gyro_Y": float(gyro.get("y", 0.0)),
            "Gyro_Z": float(gyro.get("z", 0.0)),
        })


    df = pd.DataFrame(rows)


    if df.empty:
        df = pd.DataFrame([{
            "Accel_X": 0.0,
            "Accel_Y": 0.0,
            "Accel_Z": 0.0,
            "Gyro_X": 0.0,
            "Gyro_Y": 0.0,
            "Gyro_Z": 0.0,
        }])


    acc_x_g = df["Accel_X"] / 16384.0
    acc_y_g = df["Accel_Y"] / 16384.0
    acc_z_g = df["Accel_Z"] / 16384.0
    gyr_x_dps = df["Gyro_X"] / 131.0
    gyr_y_dps = df["Gyro_Y"] / 131.0
    gyr_z_dps = df["Gyro_Z"] / 131.0


    filtered_acc_x = apply_bandpass_filter(acc_x_g.to_numpy())
    filtered_acc_y = apply_bandpass_filter(acc_y_g.to_numpy())
    filtered_acc_z = apply_bandpass_filter(acc_z_g.to_numpy())
    filtered_gyr_x = apply_bandpass_filter(gyr_x_dps.to_numpy())
    filtered_gyr_y = apply_bandpass_filter(gyr_y_dps.to_numpy())
    filtered_gyr_z = apply_bandpass_filter(gyr_z_dps.to_numpy())


    return pd.DataFrame([{
        "xAcc": float(np.var(filtered_acc_x)),
        "yAcc": float(np.var(filtered_acc_y)),
        "zAcc": float(np.var(filtered_acc_z)),
        "xGyro": float(np.sum(filtered_gyr_x ** 2) / len(df)),
        "yGyro": float(np.sum(filtered_gyr_y ** 2) / len(df)),
        "zGyro": float(np.sum(filtered_gyr_z ** 2) / len(df)),
    }])



def load_qsvm_models():
    global scaler, pca, qsvm_model, models_loaded
    if models_loaded:
        logger.info("QSVM models already loaded, skipping")
        return


    model_dir = ROOT_DIR / "models"
    logger.info(f"Loading QSVM models from {model_dir}")


    scaler_path = model_dir / "live_qsvm_scaler.pkl"
    pca_path = model_dir / "live_qsvm_pca.pkl"
    qsvm_path = model_dir / "live_qsvm_model.pkl"


    logger.info(f"Loading scaler from {scaler_path}")
    scaler = joblib.load(scaler_path)


    logger.info(f"Loading PCA from {pca_path}")
    pca = joblib.load(pca_path)


    logger.info(f"Loading QSVM model from {qsvm_path}")
    qsvm_model = joblib.load(qsvm_path)


    models_loaded = True
    logger.info("QSVM models loaded successfully")



def build_resnet18(num_classes: int) -> nn.Module:
    model = models.resnet18(weights=None)
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Linear(in_features, 256),
        nn.ReLU(),
        nn.Dropout(0.4),
        nn.Linear(256, num_classes),
    )
    return model



def download_blob_if_missing(bucket_name: str, blob_name: str, local_path: Path):
    if local_path.exists():
        logger.info(f"Using cached model file: {local_path}")
        return


    logger.info(f"Downloading from gs://{bucket_name}/{blob_name} to {local_path}")
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)


    local_path.parent.mkdir(parents=True, exist_ok=True)
    blob.download_to_filename(str(local_path))
    logger.info(f"Downloaded blob successfully: {local_path.name}")



def load_face_models_sync():
    global eye_model, eyebrow_model, mouth_model, face_models_loaded


    if face_models_loaded:
        logger.info("Face models already loaded, skipping")
        return


    if not GCS_BUCKET:
        logger.error("GCS_BUCKET not set")
        raise RuntimeError("GCS_BUCKET not set")


    logger.info("Starting face model load sequence")


    eye_path = MODEL_CACHE_DIR / "best_eye_model.pth"
    eyebrow_path = MODEL_CACHE_DIR / "best_eyebrow_model.pth"
    mouth_path = MODEL_CACHE_DIR / "best_mouth_model.pth"


    download_blob_if_missing(GCS_BUCKET, EYE_MODEL_BLOB, eye_path)
    download_blob_if_missing(GCS_BUCKET, EYEBROW_MODEL_BLOB, eyebrow_path)
    download_blob_if_missing(GCS_BUCKET, MOUTH_MODEL_BLOB, mouth_path)


    logger.info("Building eye model")
    eye_model_local = build_resnet18(len(EYE_CLASSES))
    logger.info("Loading eye weights")
    eye_model_local.load_state_dict(torch.load(eye_path, map_location=DEVICE))
    eye_model_local.to(DEVICE).eval()


    logger.info("Building eyebrow model")
    eyebrow_model_local = build_resnet18(len(EYEBROW_CLASSES))
    logger.info("Loading eyebrow weights")
    eyebrow_model_local.load_state_dict(torch.load(eyebrow_path, map_location=DEVICE))
    eyebrow_model_local.to(DEVICE).eval()


    logger.info("Building mouth model")
    mouth_model_local = build_resnet18(len(MOUTH_CLASSES))
    logger.info("Loading mouth weights")
    mouth_model_local.load_state_dict(torch.load(mouth_path, map_location=DEVICE))
    mouth_model_local.to(DEVICE).eval()


    eye_model = eye_model_local
    eyebrow_model = eyebrow_model_local
    mouth_model = mouth_model_local
    face_models_loaded = True
    logger.info("Face models loaded successfully")



async def ensure_face_models_loaded():
    global face_models_loaded
    if face_models_loaded:
        return


    async with face_model_lock:
        if face_models_loaded:
            return
        logger.info("ensure_face_models_loaded: loading face models now")
        await run_in_threadpool(load_face_models_sync)
        logger.info("ensure_face_models_loaded: face models ready")



def decode_base64_image(b64: str):
    logger.info("decode_base64_image called")


    if not b64:
        logger.error("Empty image payload received")
        raise HTTPException(status_code=400, detail="Empty image payload")


    if b64.startswith("data:image"):
        logger.info("Detected data URL prefix, stripping metadata")
        b64 = b64.split(",", 1)[1]


    b64 = b64.strip().replace("\n", "").replace("\r", "").replace(" ", "")
    missing_padding = len(b64) % 4
    if missing_padding:
        b64 += "=" * (4 - missing_padding)


    try:
        data = base64.b64decode(b64)
    except Exception:
        logger.exception("Base64 decode failed")
        raise HTTPException(status_code=400, detail="Invalid base64 image data")


    logger.info(f"Base64 decoded successfully bytes={len(data)}")


    try:
        image = Image.open(BytesIO(data)).convert("RGB")
        logger.info(f"Image decoded successfully size={image.size} mode={image.mode}")
        return image
    except (UnidentifiedImageError, OSError):
        logger.exception("Image open failed")
        raise HTTPException(status_code=400, detail="Invalid or truncated image file")



def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()



def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())



def create_access_token(user_id: str, email: str) -> str:
    logger.info(f"Creating access token for user_id={user_id} email={email}")
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


        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")


        return user


    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")



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


class FacePartOut(BaseModel):
    predicted_class: str
    class_probs: Dict[str, float]


class FaceResultOut(BaseModel):
    eye: FacePartOut
    eyebrow: FacePartOut
    mouth: FacePartOut


class ScanHistoryOut(BaseModel):
    id: str
    user_id: str
    type: str
    created_at: str
    result: FaceResultOut



@api_router.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn):
    logger.info(f"Register attempt email={body.email.lower()}")
    email = body.email.lower()


    existing = await db.users.find_one({"email": email})
    if existing:
        logger.warning(f"Register failed, email already registered email={email}")
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
    logger.info(f"Register success user_id={user_id} email={email}")


    return {"token": token, "user": {"id": user_id, "email": email, "name": body.name}}



@api_router.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    logger.info(f"Login attempt email={body.email.lower()}")
    email = body.email.lower()


    user = await db.users.find_one({"email": email})
    if not user:
        logger.warning(f"Login failed, user not found email={email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")


    if not verify_password(body.password, user["password_hash"]):
        logger.warning(f"Login failed, invalid password email={email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")


    token = create_access_token(user["id"], email)
    logger.info(f"Login success user_id={user['id']} email={email}")


    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}



@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user



@api_router.get("/gait-data")
async def get_gait_data(user: dict = Depends(get_current_user)):
    started = time.time()
    async with gait_semaphore:
        try:
            hardware_db = client["WearableProject"]
            collection = hardware_db.LiveHumanData


            latest_data = await collection.find(
                {},
                {"_id": 0}
            ).sort("timestamp", -1).limit(120).to_list(length=120)


            latest_data.reverse()


            if len(latest_data) < 40:
                logger.info(f"/gait-data fallback user_id={user['id']} records={len(latest_data)}")
                return {
                    "raw_data": latest_data,
                    "timeline": [{"score": 85, "class": "Mild/No Tremor"}],
                }


            if not models_loaded:
                try:
                    await run_in_threadpool(load_qsvm_models)
                except Exception:
                    logger.exception("QSVM load failed; using fallback timeline")


            timeline = []
            window_size = 40


            for i in range(0, len(latest_data) - window_size + 1, window_size):
                window = latest_data[i:i + window_size]
                gait_score = 85
                qsvm_class = "Mild/No Tremor"


                if models_loaded:
                    try:
                        features_df = await run_in_threadpool(extract_6axis_features, window)
                        live_scaled = scaler.transform(features_df)
                        live_pca = pca.transform(live_scaled)
                        prediction = str(qsvm_model.predict(live_pca)[0])


                        if prediction == "3":
                            gait_score = 30
                            qsvm_class = "Severe Tremor"
                        elif prediction == "2":
                            gait_score = 55
                            qsvm_class = "Moderate Tremor"
                        else:
                            gait_score = 85
                            qsvm_class = "Mild/No Tremor"
                    except Exception:
                        logger.exception(f"Error in QSVM prediction for gait window start_index={i}")


                timeline.append({
                    "score": gait_score,
                    "class": qsvm_class,
                })


            logger.info(
                f"/gait-data completed user_id={user['id']} "
                f"records={len(latest_data)} timeline_count={len(timeline)} "
                f"duration_ms={round((time.time()-started)*1000, 2)}"
            )


            return {
                "raw_data": latest_data,
                "timeline": timeline,
            }


        except Exception:
            logger.exception("Bulk QSVM error")
            return {"raw_data": [], "timeline": []}



@api_router.get("/sensor-data")
async def get_raw_sensor_data(user: dict = Depends(get_current_user)):
    try:
        hardware_db = client["WearableProject"]
        collection = hardware_db.LiveHumanData


        data = await collection.find(
            {},
            {"_id": 0}
        ).sort("timestamp", -1).limit(50).to_list(length=50)


        data.reverse()


        logger.info(f"/sensor-data completed user_id={user['id']} records={len(data)}")
        return data


    except Exception:
        logger.exception("sensor-data error")
        return []



@torch.no_grad()
def run_face_inference(image: Image.Image):
    logger.info(f"run_face_inference called image_size={image.size}")


    x = eval_transform(image).unsqueeze(0).to(DEVICE)


    logger.info("Running eye model")
    eye_logits = eye_model(x)


    logger.info("Running eyebrow model")
    eyebrow_logits = eyebrow_model(x)


    logger.info("Running mouth model")
    mouth_logits = mouth_model(x)


    eye_probs = torch.softmax(eye_logits, dim=1)[0].cpu().tolist()
    eyebrow_probs = torch.softmax(eyebrow_logits, dim=1)[0].cpu().tolist()
    mouth_probs = torch.softmax(mouth_logits, dim=1)[0].cpu().tolist()


    eye_idx = int(torch.argmax(eye_logits, dim=1).item())
    eyebrow_idx = int(torch.argmax(eyebrow_logits, dim=1).item())
    mouth_idx = int(torch.argmax(mouth_logits, dim=1).item())


    result = {
        "eye": {
            "predicted_class": EYE_CLASSES[eye_idx],
            "class_probs": {cls: round(float(p), 4) for cls, p in zip(EYE_CLASSES, eye_probs)},
        },
        "eyebrow": {
            "predicted_class": EYEBROW_CLASSES[eyebrow_idx],
            "class_probs": {cls: round(float(p), 4) for cls, p in zip(EYEBROW_CLASSES, eyebrow_probs)},
        },
        "mouth": {
            "predicted_class": MOUTH_CLASSES[mouth_idx],
            "class_probs": {cls: round(float(p), 4) for cls, p in zip(MOUTH_CLASSES, mouth_probs)},
        },
    }


    logger.info(
        f"Face inference result eye={result['eye']['predicted_class']} "
        f"eyebrow={result['eyebrow']['predicted_class']} "
        f"mouth={result['mouth']['predicted_class']}"
    )
    return result



@api_router.post("/scans/face")
async def analyze_face(body: FaceScanIn, user: dict = Depends(get_current_user)):
    started = time.time()
    request_tag = str(uuid.uuid4())[:8]


    try:
        logger.info(f"[face:{request_tag}] Face scan requested user_id={user['id']}")


        await ensure_face_models_loaded()


        async with face_inference_semaphore:
            logger.info(f"[face:{request_tag}] Decoding image user_id={user['id']}")
            image = await run_in_threadpool(decode_base64_image, body.image)


            logger.info(f"[face:{request_tag}] Running face inference user_id={user['id']}")
            result = await run_in_threadpool(run_face_inference, image)


        scan_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "face",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "result": result,
        }


        logger.info(f"[face:{request_tag}] Saving face scan to MongoDB")
        insert_result = await db.scans.insert_one(scan_doc)


        logger.info(
            f"[face:{request_tag}] Face scan completed scan_id={scan_doc['id']} "
            f"mongo_id={insert_result.inserted_id} "
            f"user_id={user['id']} duration_ms={round((time.time()-started)*1000, 2)}"
        )


        scan_doc.pop("_id", None)
        return scan_doc


    except HTTPException:
        logger.warning(f"[face:{request_tag}] Face scan aborted with HTTPException")
        raise
    except Exception:
        logger.exception(f"[face:{request_tag}] Face inference failed")
        raise HTTPException(status_code=500, detail="Face inference failed")


@api_router.get("/scans", response_model=List[ScanHistoryOut])
async def list_scans(user: dict = Depends(get_current_user)):
    try:
        scans = await db.scans.find(
            {"user_id": user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(length=200)

        return scans
    except Exception:
        logger.exception("list_scans error")
        raise HTTPException(status_code=500, detail="Failed to fetch scan history")



@api_router.get("/")
async def api_root():
    return {"service": "NeuroScan AI", "status": "ok"}



@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting NeuroScan AI backend")


    try:
        await db.users.create_index("email", unique=True)
        logger.info("Created users.email index")
    except Exception:
        logger.exception("users index creation failed")


    try:
        await db.scans.create_index([("user_id", 1), ("created_at", -1)])
        logger.info("Created scans user_id/created_at index")
    except Exception:
        logger.exception("scans index creation failed")


    try:
        hardware_db = client["WearableProject"]
        await hardware_db.LiveHumanData.create_index([("timestamp", -1)])
        logger.info("Created newdata timestamp index")
    except Exception:
        logger.exception("newdata index creation failed")


    try:
        logger.info("Preloading QSVM models")
        await run_in_threadpool(load_qsvm_models)
    except Exception:
        logger.exception("QSVM preload failed")


    try:
        logger.info("Preloading face models")
        await ensure_face_models_loaded()
    except Exception:
        logger.exception("Face model preload failed")


    logger.info("NeuroScan AI backend ready")
    yield
    logger.info("Shutting down NeuroScan AI backend")
    client.close()
    logger.info("MongoDB client closed")



app = FastAPI(title="NeuroScan AI", lifespan=lifespan)



@app.get("/")
async def root():
    return {"service": "NeuroScan AI", "status": "ok"}



@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    client_host = request.client.host if request.client else "unknown"


    logger.info(
        f"[{request_id}] Request started method={request.method} "
        f"path={request.url.path} client={client_host}"
    )


    try:
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.info(
            f"[{request_id}] Request completed method={request.method} "
            f"path={request.url.path} status={response.status_code} "
            f"duration_ms={duration_ms}"
        )
        return response
    except Exception:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.exception(
            f"[{request_id}] Request failed method={request.method} "
            f"path={request.url.path} duration_ms={duration_ms}"
        )
        raise



app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)