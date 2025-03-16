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

@router.websocket("/ws/camera/{model_name}")
async def camera_websocket_endpoint(websocket: WebSocket, model_name: str):
    """WebSocket маршрут для обработки видеопотока с фронтенда."""
    await websocket.accept()
    active_connections[model_name] = websocket
    print(f"Клиент подключился к модели: {model_name}")

    components = initialize_components()
    components["model_name"] = model_name

    frame_count = 0
    start_time = time.time()
    timestamp_prev = 0

    try:
        while True:
            # 1. Принимаем кадр от клиента
            try:
                frame_data = await websocket.receive_text()
                print(f"Получен кадр (первые 50 символов): {frame_data[:50]}...")

                frame_bytes = base64.b64decode(frame_data)
                np_arr = np.frombuffer(frame_bytes, np.uint8)
                bgr_frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                if bgr_frame is None:
                    print("Ошибка: некорректный кадр!")
                    continue

                print("Кадр успешно декодирован.")
            except Exception as e:
                print(f"Ошибка при декодировании данных кадра: {e}")
                await websocket.send_text(json.dumps({"error": "Invalid frame data"}))
                continue

            # 2. Обработка кадра
            try:
                predictions, render_image = process_frame_and_render(bgr_frame, components)
                print("Кадр обработан.")
            except Exception as e:
                print(f"Ошибка обработки кадра: {e}")
                await websocket.send_text(json.dumps({"error": "Error processing frame"}))
                continue

            # 3. Отправляем обработанные данные клиенту каждую секунду
            timestamp = time.time() - start_time
            frame_count += 1

            if timestamp - timestamp_prev >= 1:
                try:
                    print(f"Отправка обработанных данных клиенту. Всего кадров: {frame_count}")
                    await send_websocket_data(websocket, render_image, predictions, timestamp, frame_count)
                    print("Данные отправлены клиенту.")
                    timestamp_prev = timestamp
                except Exception as e:
                    print(f"Ошибка отправки данных клиенту: {e}")
                    break

    except WebSocketDisconnect:
        print(f"Клиент с моделью {model_name} отключился.")
    except Exception as e:
        print(f"Общая ошибка в обработке WebSocket: {e}")
        await websocket.send_text(json.dumps({"error": str(e)}))
    finally:
        # Убираем соединение из активных
        active_connections.pop(model_name, None)
        print(f"Соединение для модели {model_name} закрыто.")


@router.get("/ping")
async def health_check():
    return {"status": "alive"}

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
