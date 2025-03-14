import base64
import json
from app.src.video_processing import create_log_entry, process_frame
import cv2


def process_frame_and_render(bgr_frame, components):
    """Обрабатывает кадр и рендерит визуализацию."""
    rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
    predictions = process_frame(
        rgb_frame,
        components['pose_estimator'],
        components['tracker'],
        components['action_classifier']
    )
    render_image = components['drawer'].render_frame(
        bgr_frame, 
        predictions, 
        **components['visualization_params']
    )
    return predictions, render_image

async def send_websocket_data(websocket, render_image, predictions, timestamp, frame_count):
    """Формирует и отправляет данные через WebSocket."""
    log_entry = create_log_entry(predictions, timestamp, frame_count)
    _, buffer = cv2.imencode('.jpg', render_image)
    frame_data = buffer.tobytes()
    
    await websocket.send_text(json.dumps({
        "frame": base64.b64encode(frame_data).decode('utf-8'),
        "log": json.dumps(log_entry, default=str)
    }))