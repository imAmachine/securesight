import base64
import json
import time
from app.src.video_processing import create_log_entry, initialize_components, process_frame, cv2

def process_cam(ws_stream):
    """Обработка потока с веб-камеры с распознаванием поз и действий."""
    cap = setup_camera()
    components = initialize_components()
    
    try:
        process_camera_stream(cap, components, ws_stream)
    except Exception as e:
        print(f"Error in camera processing: {e}")
    finally:
        cap.release()


def setup_camera():
    """Настройка и открытие веб-камеры."""
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise ValueError("Failed to open camera")
    return cap


def process_camera_stream(cap, components, ws_stream):
    """Основной цикл обработки потока с камеры."""
    frame_count = 0
    timestamp_prev = 0
    start_time = time.time()
    
    while True:
        # Получение и проверка кадра
        ret, bgr_frame = cap.read()
        if not ret:
            break
            
        # Обработка текущего кадра
        timestamp = time.time() - start_time
        frame_count += 1
        
        # Анализ кадра
        predictions, render_image = analyze_frame(bgr_frame, components)
        
        # Отправка результатов по необходимости
        if timestamp - timestamp_prev >= 1:
            send_results(ws_stream, render_image, predictions, timestamp, frame_count)
            timestamp_prev = timestamp


def analyze_frame(bgr_frame, components):
    """Анализ кадра: распознавание поз, трекинг и классификация действий."""
    # Конвертация и обработка изображения
    rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
    predictions = process_frame(
        rgb_frame,
        components['pose_estimator'],
        components['tracker'],
        components['action_classifier']
    )
    
    # Отрисовка результатов
    render_image = components['drawer'].render_frame(
        bgr_frame, 
        predictions, 
        **components['visualization_params']
    )
    
    return predictions, render_image


def send_results(ws_stream, render_image, predictions, timestamp, frame_count):
    """Отправка результатов анализа через WebSocket."""
    # Создание логов
    log_entry = create_log_entry(predictions, timestamp, frame_count)
    
    # Кодирование изображения
    _, buffer = cv2.imencode('.jpg', render_image)
    frame_data = buffer.tobytes()
    
    # Формирование и отправка сообщения
    message = {
        "frame": base64.b64encode(frame_data).decode('utf-8'),
        "log": json.dumps(log_entry, default=str)
    }
    
    ws_stream.send_text(json.dumps(message))