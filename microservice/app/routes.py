import asyncio
import json
from fastapi import APIRouter, UploadFile
from fastapi.responses import StreamingResponse
from uvicorn.protocols.utils import ClientDisconnected
from app.src.webcam_processing import process_cam
from app.src.video_processing import process_video
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

router = APIRouter()

# Хранение активных соединений
active_connections = {}

@router.websocket("/ws/camera/{client_id}")
async def camera_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    active_connections[client_id] = websocket
    
    print(f"Client {client_id} connected")
    
    try:
        # Запускаем обработку видеопотока с камеры
        await asyncio.to_thread(process_cam, websocket)
    except WebSocketDisconnect:
        print(f"Client {client_id} disconnected")
    except Exception as e:
        print(f"Error processing camera stream: {e}")
    finally:
        if client_id in active_connections:
            del active_connections[client_id]

# Эндпоинт для проверки статуса
@router.get("/api/status")
async def get_status():
    return {
        "status": "running",
        "active_connections": len(active_connections)
    }

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
