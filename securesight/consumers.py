from channels.generic.websocket import AsyncWebsocketConsumer
import json
import asyncio
import aiohttp
import base64

class CameraConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.model_name = self.scope['url_route']['kwargs']['model_name']
        
        # Принять соединение от веб-клиента
        await self.accept()
        
        # Подключиться к FastAPI сервису
        try:
            self.backend_url = f"ws://microservice:9000/ws/camera/{self.model_name}"
            self.session = aiohttp.ClientSession()
            self.backend_ws = await self.session.ws_connect(self.backend_url)
            
            # Запустить процесс перенаправления сообщений
            self.forwarding_task = asyncio.create_task(self.forward_messages())
        except Exception as e:
            await self.send(text_data=json.dumps({
                "error": f"Failed to connect to processing server: {str(e)}"
            }))
            await self.close()

    async def disconnect(self, close_code):
        # Очистить ресурсы при отключении
        if hasattr(self, 'backend_ws') and not self.backend_ws.closed:
            await self.backend_ws.close()
        if hasattr(self, 'session'):
            await self.session.close()
        if hasattr(self, 'forwarding_task'):
            self.forwarding_task.cancel()

    async def receive(self, text_data=None, bytes_data=None):
        if not hasattr(self, 'backend_ws') or self.backend_ws.closed:
            await self.send(text_data=json.dumps({
                "error": "Not connected to processing server"
            }))
            return

        try:
            # Перенаправить данные на сервер обработки
            if bytes_data:
                await self.backend_ws.send_bytes(bytes_data)
            elif text_data:
                await self.backend_ws.send_str(text_data)
        except Exception as e:
            await self.send(text_data=json.dumps({
                "error": f"Failed to send data to processing server: {str(e)}"
            }))

    async def forward_messages(self):
        try:
            async for msg in self.backend_ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    await self.send(text_data=msg.data)
                elif msg.type == aiohttp.WSMsgType.BINARY:
                    # Обработка бинарных данных (фреймы видео)
                    frame_base64 = base64.b64encode(msg.data).decode('utf-8')
                    await self.send(text_data=json.dumps({
                        "frame": frame_base64
                    }))
                elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                    break
        except Exception as e:
            await self.send(text_data=json.dumps({
                "error": f"Connection error: {str(e)}"
            }))
        finally:
            await self.close()