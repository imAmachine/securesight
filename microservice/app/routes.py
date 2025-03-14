import asyncio
import json
import time
import base64
import cv2
from app.src.webcam_processing import process_frame_and_render, send_websocket_data
import numpy as np
from fastapi import APIRouter, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from uvicorn.protocols.utils import ClientDisconnected
from app.src.video_processing import process_video, initialize_components


router = APIRouter()

active_connections = {}

@router.websocket("/ws/camera/{client_id}")
async def camera_websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket маршрут для обработки видеопотока с камеры."""
    await websocket.accept()
    active_connections[client_id] = websocket
    print(f"Client {client_id} connected")

    components = initialize_components()
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        await websocket.send_text(json.dumps({"error": "Failed to open camera"}))
        return

    frame_count = 0
    start_time = time.time()
    timestamp_prev = 0

    try:
        while True:
            ret, bgr_frame = cap.read()
            if not ret:
                break

            timestamp = time.time() - start_time
            frame_count += 1

            predictions, render_image = process_frame_and_render(bgr_frame, components)

            if timestamp - timestamp_prev >= 1:
                await send_websocket_data(websocket, render_image, predictions, timestamp, frame_count)
                timestamp_prev = timestamp

    except WebSocketDisconnect:
        print(f"Client {client_id} disconnected")
    except Exception as e:
        print(f"Error in WebSocket processing: {e}")
        await websocket.send_text(json.dumps({"error": str(e)}))
    finally:
        cap.release()
        active_connections.pop(client_id, None)

@router.get("/api/status")
async def get_status():
    """Возвращает статус API."""
    return {
        "status": "running",
        "active_connections": len(active_connections)
    }

@router.post("/process_video")
async def process_video_route(file: UploadFile):
    """Маршрут для обработки загруженного видео."""
    try:
        processed_video_path, log = process_video(file)

        def stream_video_file():
            with open(processed_video_path, "rb") as f:
                while chunk := f.read(4096):
                    yield chunk

        response = StreamingResponse(stream_video_file(), media_type="video/mp4")
        response.headers["Content-Disposition"] = "attachment; filename=processed_video.mp4"
        response.headers["Log"] = json.dumps(log)
        return response
    except ClientDisconnected:
        print("Client disconnected while streaming video")
        raise
