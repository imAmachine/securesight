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

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname + ':9000';
    wsRef.current = new WebSocket(`${protocol}//${host}/ws/camera/${selectedModel}`);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected directly to FastAPI');
      setIsConnected(true);
      setIsLoading(false);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setIsStreamingActive(false);
      setTimeout(() => connectWebSocket(), 3000);
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
        videoRef.current.play();
        setIsStreamingActive(true);

        const captureCanvas = captureCanvasRef.current;
        const captureCtx = captureCanvas.getContext('2d');
        const video = videoRef.current;

        video.addEventListener('loadedmetadata', () => {
          captureCanvas.width = video.videoWidth;
          captureCanvas.height = video.videoHeight;
        });

        const sendFrame = () => {
          if (
            isStreamingActive &&
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN &&
            !isProcessing
          ) {
            captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
            captureCanvas.toBlob(
              (blob) => {
                if (blob) {
                  wsRef.current.send(blob);
                  console.log("Кадр отправлен на сервер.");
                  setIsProcessing(true);
                } else {
                  console.error('Не удалось создать blob для отправки.');
                }
              },
              'image/jpeg',
              0.8
            );
          }
        };

        const frameInterval = setInterval(() => {
          if (isStreamingActive) {
            sendFrame();
          } else {
            clearInterval(frameInterval);
          }
        }, 1000 / fps);

        return () => clearInterval(frameInterval);
      }
    } catch (error) {
      console.error('Ошибка доступа к веб-камере:', error);
    }
  };

  const stopStreamingVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    setIsStreamingActive(false);
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
