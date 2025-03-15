import base64
import json
import cv2
from app.src.video_processing import create_log_entry, process_frame


def process_frame_and_render(bgr_frame, components):
    """Обрабатывает кадр и рендерит визуализацию в зависимости от выбранной модели."""
    try:
        if bgr_frame is None or not isinstance(bgr_frame, np.ndarray):
            print("Ошибка: некорректный входной кадр!")
            return [], bgr_frame
        
        print(f"Получен кадр, размер: {bgr_frame.shape}")
        rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
        model_name = components.get('model_name', 'skeleton')

        if model_name == 'emotion':
            try:
                from deepface import DeepFace
                analysis = DeepFace.analyze(rgb_frame, actions=['emotion'], enforce_detection=False)
                if not analysis:
                    print("DeepFace не нашёл лиц на кадре.")
                    return [], bgr_frame
                
                render_image = bgr_frame.copy()
                predictions = [{'id': 1, 'action': f"emotion: {face_data['dominant_emotion']}"} for face_data in analysis] if isinstance(analysis, list) else [{'id': 1, 'action': f"emotion: {analysis['dominant_emotion']}"}]
            except Exception as e:
                print(f"Ошибка в анализе эмоций: {e}")
                render_image = bgr_frame.copy()
                predictions = []

        else:
            if not all(key in components for key in ['pose_estimator', 'tracker', 'action_classifier']):
                print("Ошибка: отсутствуют компоненты для стандартной обработки!")
                return [], bgr_frame
            
            try:
                predictions = process_frame(rgb_frame, components['pose_estimator'], components['tracker'], components['action_classifier'])
                render_image = components['drawer'].render_frame(bgr_frame, predictions, **components['visualization_params'])
            except Exception as e:
                print(f"Ошибка в стандартной обработке кадра: {e}")
                render_image = bgr_frame.copy()
                predictions = []

        return predictions, render_image

    except Exception as e:
        print(f"Непредвиденная ошибка в обработке кадра: {e}")
        return [], bgr_frame



async def send_websocket_data(websocket, render_image, predictions, timestamp, frame_count):
    """Формирует и отправляет данные через WebSocket."""
    try:
        log_entry = create_log_entry(predictions, timestamp, frame_count)
        _, buffer = cv2.imencode('.jpg', render_image)
        if not _ or buffer is None:
            print("Ошибка: не удалось закодировать кадр в JPEG.")
            return

        frame_data = base64.b64encode(buffer).decode('utf-8')
        response = {
            "frame": frame_data,
            "log": json.dumps(log_entry, default=str)
        }

        print(f"Отправка данных клиенту: размер кадра {len(buffer)} байт, log_entry: {log_entry}")
        await websocket.send_text(json.dumps(response))

    except Exception as e:
        print(f"Ошибка отправки данных через WebSocket: {e}")

