import React, { useRef, useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const WebcamStream = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [analytics, setAnalytics] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const requestRef = useRef();
  const lastFrameTime = useRef(0);
  const processing = useRef(false);

  // Конфигурация камеры
  const CAMERA_CONFIG = {
    width: 1280,
    height: 720,
    fps: 30,
    frameInterval: 1000 / 30 // 33ms между кадрами
  };

  // Нормализация координат с зеркалированием и масштабированием
  const normalizeBBox = useCallback((bbox) => {
    const canvas = canvasRef.current;
    if (!canvas || !bbox) return null;

    const [x1, y1, x2, y2] = bbox;
    const scaleX = canvas.width / CAMERA_CONFIG.width;
    const scaleY = canvas.height / CAMERA_CONFIG.height;

    return {
      x: (CAMERA_CONFIG.width - x2) * scaleX,
      y: y1 * scaleY,
      width: (x2 - x1) * scaleX,
      height: (y2 - y1) * scaleY
    };
  }, []);

  // Отрисовка скелета
  const drawSkeleton = useCallback((ctx, points) => {
    if (!points?.length) return;
    
    // Фильтруем валидные точки и преобразуем координаты
    const validPoints = points
      .map(point => {
        // Проверяем структуру данных (может быть [id, x, y] или [x, y])
        const isV1Format = point.length === 3;
        const x = isV1Format ? point[1] : point[0];
        const y = isV1Format ? point[2] : point[1];
        
        // Конвертируем нормализованные координаты в абсолютные
        const absX = x * CAMERA_CONFIG.width;
        const absY = y * CAMERA_CONFIG.height;
        
        // Фильтрация невалидных точек
        return x > 0 && y > 0 && x < 1 && y < 1 
          ? { x: absX, y: absY } 
          : null;
      })
      .filter(Boolean);
  
    // Отрисовка линий между ключевыми точками
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    
    // соединение точек
    const connections = [
      [16, 14], [14, 12], [17, 15], [15, 13], [12, 13], [6, 8], [7, 9],
        [8, 10], [9, 11], [2, 3], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6],
        [5, 7], [18, 1], [18, 6], [18, 7], [18, 12], [18, 13]
    ];
  
    connections.forEach(([start, end]) => {
      if (validPoints[start] && validPoints[end]) {
        ctx.beginPath();
        ctx.moveTo(
          CAMERA_CONFIG.width - validPoints[start].x,
          validPoints[start].y
        );
        ctx.lineTo(
          CAMERA_CONFIG.width - validPoints[end].x,
          validPoints[end].y
        );
        ctx.stroke();
      }
    });
  
    // Отрисовка точек
    ctx.fillStyle = '#00FF00';
    validPoints.forEach(point => {
      ctx.beginPath();
      ctx.arc(
        CAMERA_CONFIG.width - point.x, // Зеркалирование по X
        point.y,
        5, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
    });
  }, []);

  // Основной цикл рендеринга
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!ctx || !video || !canvas) return;

    // Очистка канваса
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Зеркальное отображение видео
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Отрисовка аналитики
    analytics.forEach(obj => {
      const bbox = normalizeBBox(obj.bbox);
      if (!bbox) return;

      // Bounding box
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

      // Скелет
      if (obj.skeleton) {
        drawSkeleton(ctx, obj.skeleton);
      }

      // Подпись
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const label = `${obj.action} (ID: ${obj.track_id})`;
      ctx.fillRect(bbox.x, bbox.y - 20, ctx.measureText(label).width + 10, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, bbox.x + 5, bbox.y - 5);
    });

    requestRef.current = requestAnimationFrame(renderFrame);
  }, [analytics, normalizeBBox, drawSkeleton]);

  // Отправка кадра на сервер
  const processFrame = useCallback(async () => {
    if (processing.current || !videoRef.current) return;
    
    processing.current = true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CAMERA_CONFIG.width;
      canvas.height = CAMERA_CONFIG.height;
      const ctx = canvas.getContext('2d');
      
      // Захват кадра
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // Отправка данных
      const response = await axios.post(
        'http://localhost:9000/process-frame',
        new URLSearchParams({
          frame_data: canvas.toDataURL('image/jpeg', 0.8),
          timestamp: Date.now()
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (response.data?.objects) {
        setAnalytics(response.data.objects);
      }
    } catch (err) {
      console.error('Frame processing error:', err);
    }
    processing.current = false;
  }, []);

  // Управление частотой кадров
  const animationLoop = useCallback((timestamp) => {
    if (timestamp - lastFrameTime.current >= CAMERA_CONFIG.frameInterval) {
      lastFrameTime.current = timestamp;
      processFrame();
    }
    requestRef.current = requestAnimationFrame(animationLoop);
  }, [processFrame]);

  // Инициализация камеры
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: CAMERA_CONFIG.width },
            height: { ideal: CAMERA_CONFIG.height },
            frameRate: { ideal: CAMERA_CONFIG.fps }
          }
        });

        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
          
          videoRef.current.play().then(() => {
            setStreaming(true);
            requestRef.current = requestAnimationFrame(animationLoop);
            renderFrame();
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
  }, [animationLoop, renderFrame]);

  return (
    <div style={{ position: 'relative', maxWidth: '100%', margin: '0 auto' }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 'auto',
          backgroundColor: '#000',
          borderRadius: '8px',
          transform: 'scaleX(-1)' // Зеркалирование только для отображения
        }}
      />
      <div style={statusStyle}>
        <div>Статус: {streaming ? 'LIVE' : 'Инициализация...'}</div>
        <div>Обнаружено объектов: {analytics.length}</div>
        <div>FPS: {CAMERA_CONFIG.fps}</div>
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
  borderRadius: '4px',
  zIndex: 1
};

export default WebcamStream;