import asyncio
import json
import time
import base64
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from uvicorn.protocols.utils import ClientDisconnected
from app.src.video_processing import process_video, initialize_components, process_frame, create_log_entry

router = APIRouter()

# Хранение активных соединений
active_connections = {}

@router.websocket("/ws/camera/{client_id}")
async def camera_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    active_connections[client_id] = websocket
    
    print(f"Client {client_id} connected")
    
    # Инициализация компонентов для обработки видео
    components = initialize_components()
    
    try:
        while True:
            # Получаем данные от клиента
            data = await websocket.receive()
            
            if "bytes" in data:
                # Обрабатываем изображение
                frame_bytes = data["bytes"]
                
                # Декодируем изображение
                nparr = np.frombuffer(frame_bytes, np.uint8)
                bgr_frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if bgr_frame is None:
                    await websocket.send_text(json.dumps({"error": "Failed to decode image"}))
                    continue
                
                # Конвертируем и обрабатываем кадр
                rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
                
                # Используем существующий пайплайн обработки
                predictions = process_frame(
                    rgb_frame,
                    components['pose_estimator'],
                    components['tracker'],
                    components['action_classifier']
                )
                
                # Рендерим результат
                render_image = components['drawer'].render_frame(
                    bgr_frame, 
                    predictions, 
                    **components['visualization_params']
                )
                
                # Создаем лог
                timestamp = time.time()
                log_entry = create_log_entry(predictions, timestamp, 0)
                
                # Преобразуем изображение в base64 для отправки
                _, buffer = cv2.imencode('.jpg', render_image)
                frame_data = buffer.tobytes()
                frame_base64 = base64.b64encode(frame_data).decode('utf-8')
                
                # Отправляем результат
                await websocket.send_text(json.dumps({
                    "frame": frame_base64,
                    "log": json.dumps(log_entry, default=str)
                }))
            
    except WebSocketDisconnect:
        print(f"Client {client_id} disconnected")
    except Exception as e:
        print(f"Error processing camera stream: {e}")
        try:
            await websocket.send_text(json.dumps({"error": str(e)}))
        except:
            pass
    finally:
        if client_id in active_connections:
            del active_connections[client_id]

# Остальные маршруты остаются без изменений
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
        raise