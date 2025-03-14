import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card, Badge, Spinner } from 'react-bootstrap';
import { FaVideo, FaVideoSlash, FaUser } from 'react-icons/fa';
import '../styles/main.css';
import { useStateContext } from '../contexts/ContextProvider';
import { Footer, Sidebar } from "../components";

const Webcamera = () => {
  const { currentMode } = useStateContext();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const clientId = useRef(`client-${Date.now()}`);

  useEffect(() => {
    // Инициализация WebSocket соединения
    connectWebSocket();

    // Очистка при размонтировании компонента
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    const ws = new WebSocket(`ws://localhost:8000/ws/camera/${clientId.current}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setIsLoading(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      
      // Попытка переподключения через 3 секунды
      setTimeout(() => {
        if (!isConnected) {
          connectWebSocket();
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsLoading(false);
    };

    ws.onmessage = (event) => {
      handleServerMessage(event.data);
    };
  };

  const handleServerMessage = (data) => {
    try {
      const message = JSON.parse(data);
      
      // Обработка и отображение видеокадра
      if (message.frame) {
        displayFrame(message.frame);
      }
      
      // Обработка логов с распознанными действиями
      if (message.log) {
        const logData = JSON.parse(message.log);
        setDetectedActions(logData.Actions || []);
        setNumPeople(logData.Num_People || 0);
      }
    } catch (error) {
      console.error('Error parsing server message:', error);
    }
  };

  const displayFrame = (frameBase64) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Очистка холста перед отрисовкой нового кадра
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Отрисовка изображения на холсте
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    
    img.src = `data:image/jpeg;base64,${frameBase64}`;
  };

  return (
    <Container fluid className="d-flex vh-100 p-0">
      <Sidebar />
      <Container fluid className={`main-container d-flex p-0 flex-column ${currentMode === 'Dark' ? 'main-dark' : ''}`}>
        <Container className="main d-flex flex-column align-items-center justify-content-center">
          <Card className={`video-stream-card ${currentMode === 'Light' ? 'video-stream-card-light' : 'video-stream-card-dark'}`}>
            <Card.Header className={`d-flex justify-content-between align-items-center ${currentMode === 'Light' ? 'text-dark' : 'text-light'}`}>
              <h3>Распознавание активности</h3>
              <Badge bg={isConnected ? "success" : "danger"}>
                {isConnected ? "Подключено" : "Отключено"}
              </Badge>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col lg={8} md={12} className="mb-3 mb-lg-0">
                  <div className="video-container position-relative">
                    {isLoading ? (
                      <div className="loading-overlay d-flex justify-content-center align-items-center">
                        <Spinner animation="border" variant="primary" />
                      </div>
                    ) : !isConnected ? (
                      <div className="connection-error d-flex flex-column justify-content-center align-items-center">
                        <FaVideoSlash size={48} className="mb-3 text-danger" />
                        <h5>Нет соединения с сервером</h5>
                        <p>Пытаемся восстановить подключение...</p>
                      </div>
                    ) : null}
                    <canvas 
                      ref={canvasRef} 
                      width="640" 
                      height="480" 
                      className="video-canvas w-100 h-auto"
                    />
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Container>
        <Footer />
      </Container>
    </Container>
  );
};

export default Webcamera;