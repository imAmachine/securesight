import base64
import json
import os
from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
import cv2
import numpy as np
from uvicorn.protocols.utils import ClientDisconnected
from app.src.video_processing import process_video
from app.src.lib.utils.config import Config
from app.src.lib.utils.drawer import Drawer
from app.src.lib.pose_estimation import get_pose_estimator
from app.src.lib.tracker import get_tracker
from app.src.lib.action_classifier import get_classifier
from app.src.lib.utils.utils import convert_to_openpose_skeletons

router = APIRouter()

# Инициализация моделей при старте сервиса
cfg = Config("app/src/configs/infer_trtpose_deepsort_dnn.yaml")
pose_estimator = get_pose_estimator(**cfg.POSE)
tracker = get_tracker(**cfg.TRACKER)
action_classifier = get_classifier(**cfg.CLASSIFIER)
drawer = Drawer()

@router.post("/process-frame")
async def process_realtime_frame(
    frame_data: str = Form(..., description="Base64 encoded JPEG image"),
    timestamp: float = Form(0.0)
):
    """Real-time frame processing endpoint"""
    try:
        # Декодирование base64
        if not frame_data.startswith("data:image/jpeg;base64,"):
            raise ValueError("Invalid image format")
            
        encoded = frame_data.split(",", 1)[1]
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        bgr_frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if bgr_frame is None or bgr_frame.size == 0:
            raise ValueError("Failed to decode image")

        # Обработка кадра через полный пайплайн
        rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
        
        # Шаг 1: Детекция позы
        predictions = pose_estimator.predict(rgb_frame, get_bbox=True)
        
        # Шаг 2: Трекинг объектов
        if predictions:
            predictions = convert_to_openpose_skeletons(predictions)
            predictions, _ = tracker.predict(rgb_frame, predictions)
            
            # Шаг 3: Классификация действий
            predictions = action_classifier.classify(predictions)
        
        # Форматирование результатов
        results = []
        for pred in predictions:
            item = {
                "bbox": [
                    float(pred.bbox[0]),  # x1
                    float(pred.bbox[1]),  # y1
                    float(pred.bbox[2]),  # x2
                    float(pred.bbox[3])   # y2
                ],
                "action": getattr(pred, 'action', 'unknown'),
                "track_id": getattr(pred, 'tracking_id', -1)
            }
            
            if hasattr(pred, 'keypoints'):
                item["skeleton"] = pred.keypoints.tolist()
                
            results.append(item)

        return JSONResponse({
            "timestamp": timestamp,
            "objects": results
        })

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Processing error: {str(e)}"
        )

@router.post("/process_video")
async def process_video_route(file: UploadFile):
    try:
        processed_video_path, log = process_video(file)

        def stream_video_file():
            with open(processed_video_path, "rb") as f:
                while True:
                    data = f.read(4096)
                    if not data:
                        break
                    yield data

        response = StreamingResponse(stream_video_file(), media_type="video/mp4")
        response.headers["Content-Disposition"] = f"attachment; filename=processed_video.mp4"
        response.headers["Log"] = json.dumps(log)
        return response
    except ClientDisconnected:
        print("Client disconnected before response was fully sent")
        # Perform any necessary cleanup here
        raise
