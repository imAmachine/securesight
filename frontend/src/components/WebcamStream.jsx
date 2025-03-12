import React, { useRef, useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const WebcamStream = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [analytics, setAnalytics] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const requestRef = useRef();
  const lastProcessedRef = useRef(0);
  const processing = useRef(false);
  const frameQueue = useRef([]);

  // Фиксированные размеры для камеры 1280x720
  const CAMERA_WIDTH = 1280;
  const CAMERA_HEIGHT = 720;
  const FPS = 30;
  const FRAME_INTERVAL = 1000 / FPS;

  // Нормализация координат с учетом фиксированного разрешения
  const normalizeCoordinates = useCallback((coord, isX = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    
    const scale = isX ? canvas.width / CAMERA_WIDTH : canvas.height / CAMERA_HEIGHT;
    return coord * scale;
  }, []);

  // Основной цикл отрисовки
  const animate = useCallback(() => {
    const now = Date.now();
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!ctx || !video || !canvas) {
      requestRef.current = requestAnimationFrame(animate);
      return;
    }

    // Отрисовка видео с зеркальным отражением
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Отрисовка аналитики
    analytics.forEach(obj => {
      if (!obj.bbox || !obj.skeleton) return;

      // Bounding Box
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      const [x1, y1, x2, y2] = obj.bbox;
      ctx.strokeRect(
        normalizeCoordinates(CAMERA_WIDTH - x2, true),
        normalizeCoordinates(y1, false),
        normalizeCoordinates(x2 - x1, true),
        normalizeCoordinates(y2 - y1, false)
      );

      // Скелет
      ctx.fillStyle = '#FF0000';
      obj.skeleton.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(
          normalizeCoordinates(CAMERA_WIDTH - x, true),
          normalizeCoordinates(y, false),
          5, 0, 2 * Math.PI
        );
        ctx.fill();
      });
    });

    // Управление FPS
    if (now - lastProcessedRef.current >= FRAME_INTERVAL) {
      lastProcessedRef.current = now;
      processFrame();
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [analytics, normalizeCoordinates]);

  // Обработка и отправка кадра
  const processFrame = useCallback(async () => {
    if (processing.current || !videoRef.current) return;
    
    processing.current = true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CAMERA_WIDTH;
      canvas.height = CAMERA_HEIGHT;
      const ctx = canvas.getContext('2d');
      
      // Захват кадра без эффектов отображения
      ctx.drawImage(videoRef.current, 0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);
      
      // Создаем FormData и добавляем обязательные поля
      const formData = new URLSearchParams();
      formData.append('frame_data', canvas.toDataURL('image/jpeg', 0.8));
      formData.append('timestamp', Date.now());
  
      const response = await axios.post(
        'http://localhost:9000/process-frame',
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
  
      if (response.data?.objects) {
        setAnalytics(response.data.objects);
        
        // Отрисовка результатов
        const mainCtx = canvasRef.current.getContext('2d');
        mainCtx.clearRect(0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);
        
        // Зеркальное отображение исходного видео
        mainCtx.save();
        mainCtx.scale(-1, 1);
        mainCtx.translate(-CAMERA_WIDTH, 0);
        mainCtx.drawImage(videoRef.current, 0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);
        mainCtx.restore();
  
        // Отрисовка аналитики
        response.data.objects.forEach(obj => {
          if (obj.bbox) {
            const [x1, y1, x2, y2] = obj.bbox;
            mainCtx.strokeStyle = '#00FF00';
            mainCtx.lineWidth = 3;
            mainCtx.strokeRect(
              CAMERA_WIDTH - x2, 
              y1, 
              x2 - x1, 
              y2 - y1
            );
  
            if (obj.skeleton) {
              mainCtx.fillStyle = '#FF0000';
              obj.skeleton.forEach(([x, y]) => {
                mainCtx.beginPath();
                mainCtx.arc(CAMERA_WIDTH - x, y, 5, 0, Math.PI * 2);
                mainCtx.fill();
              });
            }
          }
        });
      }
    } catch (err) {
      console.error('Frame processing error:', err);
    }
    processing.current = false;
  }, []);

  // Инициализация камеры
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: CAMERA_WIDTH },
            height: { ideal: CAMERA_HEIGHT },
            frameRate: { ideal: FPS }
          }
        });

        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => {
            setStreaming(true);
            requestRef.current = requestAnimationFrame(animate);
          });
        };
      } catch (err) {
        console.error('Camera error:', err);
      }
    };

    initCamera();

    return () => {
      cancelAnimationFrame(requestRef.current);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [animate]);

  return (
    <div style={{ position: 'relative', maxWidth: '100%', margin: '0 auto' }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      <canvas
        ref={canvasRef}
        width={CAMERA_WIDTH}
        height={CAMERA_HEIGHT}
        style={{
          width: '100%',
          height: 'auto',
          transform: 'scaleX(-1)', // Зеркальное отражение только для отображения
          backgroundColor: '#000'
        }}
      />
      <div style={statusStyle}>
        Статус: {streaming ? 'LIVE' : 'Инициализация...'}
        <div>Обнаружено объектов: {analytics.length}</div>
      </div>
    </div>
  );
};

const statusStyle = {
  position: 'absolute',
  top: '16px',
  left: '16px',
  color: '#00FF00',
  fontFamily: 'monospace',
  backgroundColor: 'rgba(0,0,0,0.7)',
  padding: '8px',
  borderRadius: '4px'
};

export default WebcamStream;