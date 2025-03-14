import React from 'react';
import { Card, Badge, Spinner, Button } from 'react-bootstrap';
import { FaVideo, FaVideoSlash } from 'react-icons/fa';
import '../styles/main.css';

const WebcameraComponent = ({ 
  currentMode, 
  isConnected, 
  isLoading, 
  isStreamingActive, 
  startStreamingVideo, 
  stopStreamingVideo,
  canvasRef, 
  videoRef, 
  captureCanvasRef 
}) => {
  return (
    <Card className={`video-stream-card ${currentMode === 'Light' ? 'video-stream-card-light' : 'video-stream-card-dark'}`}>
      <Card.Header className={`d-flex justify-content-between align-items-center ${currentMode === 'Light' ? 'text-dark' : 'text-light'}`}>
        <h3>Видеоаналитика в реальном времени</h3>
        <Badge bg={isConnected ? "success" : "danger"}>
          {isConnected ? "Подключено" : "Отключено"}
        </Badge>
      </Card.Header>
      <Card.Body>
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

          {/* Отображаемый канвас с обработанным видео */}
          <canvas 
            ref={canvasRef} 
            width="640" 
            height="480" 
            className="video-canvas"
          />

          {/* Скрытое видео для захвата кадров */}
          <video 
            ref={videoRef} 
            style={{ display: 'none' }} 
            width="640" 
            height="480" 
            autoPlay 
            playsInline 
            muted
          />

          {/* Скрытый канвас для захвата кадров */}
          <canvas 
            ref={captureCanvasRef} 
            style={{ display: 'none' }} 
            width="640" 
            height="480"
          />
        </div>

        <div className="d-flex justify-content-center mt-3">
          <Button 
            variant={isStreamingActive ? "danger" : "success"}
            onClick={isStreamingActive ? stopStreamingVideo : startStreamingVideo}
            disabled={!isConnected}
            size="lg"
          >
            {isStreamingActive ? (
              <>
                <FaVideoSlash className="me-2" />
                Остановить камеру
              </>
            ) : (
              <>
                <FaVideo className="me-2" />
                Включить камеру
              </>
            )}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default WebcameraComponent;
