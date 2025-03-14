import asyncio
import cv2
import base64
import json
import websockets
import time
import numpy as np
from aiohttp import ClientSession, WSMsgType


class WebcamStreamClient:
    def __init__(self, websocket_url="ws://localhost:8000/ws/camera/"):
        """
        Клиент для передачи потока с веб-камеры на сервер обработки.
        
        Args:
            websocket_url: URL для WebSocket соединения с сервером обработки
        """
        self.websocket_url = websocket_url
        self.running = False
        self.camera = None
        self.websocket = None
        
    async def connect(self):
        """Установка WebSocket соединения с сервером."""
        try:
            self.websocket = await websockets.connect(self.websocket_url)
            print(f"Connected to {self.websocket_url}")
            return True
        except Exception as e:
            print(f"Connection error: {e}")
            return False
            
    async def initialize_camera(self, camera_id=0):
        """Инициализация камеры."""
        self.camera = cv2.VideoCapture(camera_id)
        if not self.camera.isOpened():
            print("Error: Could not open camera")
            return False
        return True
            
    async def start_streaming(self):
        """Запуск потоковой передачи с камеры на сервер."""
        if not self.camera or not self.websocket:
            print("Error: Camera or WebSocket connection not initialized")
            return
            
        self.running = True
        try:
            while self.running:
                # Захват кадра с камеры
                ret, frame = self.camera.read()
                if not ret:
                    print("Error: Cannot read from camera")
                    break
                    
                # Кодирование и отправка кадра
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                frame_data = buffer.tobytes()
                
                # Отправка кадра на сервер
                await self.websocket.send(frame_data)
                
                # Получение результатов обработки
                response = await self.websocket.recv()
                self.handle_server_response(response)
                
                # Небольшая задержка для контроля FPS
                await asyncio.sleep(0.03)  # ~30 FPS
                
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket connection closed")
        except Exception as e:
            print(f"Streaming error: {e}")
        finally:
            await self.stop_streaming()
    
    def handle_server_response(self, response):
        """Обработка ответа от сервера."""
        try:
            # Предполагаем, что ответ приходит в формате JSON
            data = json.loads(response)
            
            # Обработка распознанных действий из логов
            if "log" in data:
                log_data = json.loads(data["log"])
                print(f"Actions detected: {log_data.get('Actions', [])}")
                
            # Обработка обработанного кадра
            if "frame" in data:
                processed_frame_base64 = data["frame"]
                processed_frame_bytes = base64.b64decode(processed_frame_base64)
                
                # Конвертируем байты в массив numpy
                nparr = np.frombuffer(processed_frame_bytes, np.uint8)
                processed_frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                # Показываем обработанный кадр
                cv2.imshow("Processed Frame", processed_frame)
                
                # Обработка нажатия клавиш (q для выхода)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    self.running = False
                    
        except Exception as e:
            print(f"Error handling server response: {e}")
    
    async def stop_streaming(self):
        """Остановка стриминга и освобождение ресурсов."""
        self.running = False
        
        if self.camera:
            self.camera.release()
            self.camera = None
            
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            
        cv2.destroyAllWindows()