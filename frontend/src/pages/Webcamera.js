import React, { useEffect, useRef, useState } from 'react';
import { Container } from 'react-bootstrap';
import { useStateContext } from '../contexts/ContextProvider';
import { Header, Sidebar } from "../components";
import WebcameraComponent from '../components/WebcameraComponent';
import '../styles/main.css';

const Webcamera = () => {
  const { setCurrentColor, setCurrentMode, currentMode } = useStateContext();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const [fps, setFps] = useState(15);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState('skeleton');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const currentThemeColor = localStorage.getItem('colorMode');
    const currentThemeMode = localStorage.getItem('themeMode');
    if (currentThemeColor && currentThemeMode) {
      setCurrentColor(currentThemeColor);
      setCurrentMode(currentThemeMode);
    }

    connectWebSocket();

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      stopStreamingVideo();
    };
  }, []);

  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.close();
      connectWebSocket();
    }
  }, [selectedModel]);

  useEffect(() => {
    if (isStreamingActive) {
      console.log('Streaming ACTIVE, WS state:', wsRef.current?.readyState);
    } else {
      console.log('Streaming INACTIVE');
    }
  }, [isStreamingActive]);

  const streamingActiveRef = useRef(false);

  useEffect(() => {
    streamingActiveRef.current = isStreamingActive;
  }, [isStreamingActive]);

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname + ':9000'; // Используем текущий хост
    const wsUrl = `${protocol}//${host}/ws/camera/${selectedModel}`;
    
    console.log(`Подключение к WebSocket: ${wsUrl}`);
    
    wsRef.current = new WebSocket(wsUrl);
  
    wsRef.current.onopen = () => {
      console.log('WebSocket подключен');
      setIsConnected(true);
      setIsLoading(false);
      if (isStreamingActive) {
        console.log('Перезапуск отправки кадров после переподключения');
      }
    };

    wsRef.current.onclose = (event) => {
        console.warn('WebSocket disconnected, причина:', event.reason);
        setIsConnected(false);
        setIsStreamingActive(false);
        setTimeout(() => connectWebSocket(), 3000);  // Переподключение через 3 сек
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.frame) {
          console.log("Получен кадр base64 для отрисовки:", data.frame.slice(0, 50)); // Проверка данных
          displayFrame(data.frame);
        } else if (data.error) {
          console.error('Ошибка сервера:', data.error);
        }
        setIsProcessing(false);
      } catch (e) {
        console.error('Ошибка обработки сообщения WebSocket:', e);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
  };

  const displayFrame = (frameBase64) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      console.log("Кадр успешно отрисован.");
    };

    img.onerror = () => {
      console.error("Ошибка загрузки изображения для отрисовки.");
    };

    img.src = `data:image/jpeg;base64,${frameBase64}`;
  };

  const startStreamingVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      });
  
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            const captureCanvas = captureCanvasRef.current;
            captureCanvas.width = videoRef.current.videoWidth;
            captureCanvas.height = videoRef.current.videoHeight;
            console.log(`Размеры видео: ${captureCanvas.width}x${captureCanvas.height}`);
            resolve();
          };
        });
  
        await videoRef.current.play();
        
        setIsStreamingActive(true);
        streamingActiveRef.current = true; // Используем внешний ref
  
        const captureCtx = captureCanvasRef.current.getContext('2d');
        const video = videoRef.current;
  
        const sendFrame = () => {
          if (
            streamingActiveRef.current && 
            wsRef.current?.readyState === WebSocket.OPEN
          ) {
            try {
              captureCtx.drawImage(video, 0, 0);
              const frameBase64 = captureCanvasRef.current
                .toDataURL("image/jpeg", 0.8)
                .split(",")[1];
              
              console.log("Отправка кадра:", frameBase64.slice(0, 20) + "...");
              wsRef.current.send(frameBase64);
            } catch (e) {
              console.error('Ошибка отправки:', e);
            }
            requestAnimationFrame(sendFrame);
          }
        };
  
        requestAnimationFrame(sendFrame);
  
        return () => {
          streamingActiveRef.current = false;
        };
      }
    } catch (error) {
      console.error('Ошибка доступа к камере:', error);
      setIsStreamingActive(false);
    }
  };

  const stopStreamingVideo = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    streamingActiveRef.current = false;
    setIsStreamingActive(false);
    console.log('Поток остановлен');
  };

  return (
    <Container fluid className={`d-flex vh-100 p-0 ${currentMode === 'Dark' ? 'main-dark' : ''}`}>
      <Sidebar />
      <Container fluid className="main-container d-flex p-0 flex-column">
        <Header />
        <Container className="main d-flex flex-column align-items-center justify-content-center">
          <WebcameraComponent
            currentMode={currentMode}
            isConnected={isConnected}
            isLoading={isLoading}
            isStreamingActive={isStreamingActive}
            startStreamingVideo={startStreamingVideo}
            stopStreamingVideo={stopStreamingVideo}
            canvasRef={canvasRef}
            videoRef={videoRef}
            captureCanvasRef={captureCanvasRef}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
          />
        </Container>
      </Container>
    </Container>
  );
};

export default Webcamera;
