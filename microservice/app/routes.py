import base64
import json
import os
from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
import cv2
import numpy as np
from uvicorn.protocols.utils import ClientDisconnected
from app.src.video_processing import process_video, process_single_frame
from app.src.lib.utils.config import Config
from app.src.lib.pose_estimation import get_pose_estimator
from app.src.lib.tracker import get_tracker
from app.src.lib.action_classifier import get_classifier

router = APIRouter()

# Инициализация моделей при старте сервиса
cfg = Config("app/src/configs/infer_trtpose_deepsort_dnn.yaml")
pose_estimator = get_pose_estimator(**cfg.POSE)
tracker = get_tracker(**cfg.TRACKER)
action_classifier = get_classifier(**cfg.CLASSIFIER)

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

        # Обработка кадра через общий пайплайн
        predictions = process_single_frame(
            bgr_frame,
            pose_estimator,
            tracker,
            action_classifier
        )

        # Форматирование результатов
        results = []
        for p in predictions:
            if not hasattr(p, 'bbox'):
                continue
                
            item = {
                "bbox": [
                    float(p.bbox[0]),  # x1
                    float(p.bbox[1]),  # y1
                    float(p.bbox[2]),  # x2
                    float(p.bbox[3])   # y2
                ],
                "action": p.action if hasattr(p, 'action') else 'unknown',
                "track_id": p.tracking_id if hasattr(p, 'tracking_id') else -1
            }
            
            # Добавляем ключевые точки если есть
            if hasattr(p, 'keypoints'):
                item["skeleton"] = p.keypoints.tolist()
                
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
