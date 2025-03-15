import React, { useEffect } from 'react';
import { Card, Badge, Spinner, Button, Form } from 'react-bootstrap';
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
  captureCanvasRef,
  selectedModel,
  setSelectedModel,
}) => {
  const toggleModel = () => {
    if (!isStreamingActive) {
      setSelectedModel((prev) => {
        const newModel = prev === 'skeleton' ? 'emotion' : 'skeleton';
        console.log('Выбранная модель изменена на:', newModel);
        return newModel;
      });
    }
  };

  // Проверка и отладка референсов (canvasRef, videoRef, captureCanvasRef)
  useEffect(() => {
    if (canvasRef?.current) {
      console.log('Canvas подключён:', canvasRef.current);
    } else {
      console.error('Canvas не инициализирован!');
    }

    if (videoRef?.current) {
      console.log('Video подключено:', videoRef.current);
    } else {
      console.error('Video не инициализировано!');
    }

    if (captureCanvasRef?.current) {
      console.log(
        'CaptureCanvas подключён с размерами:',
        captureCanvasRef.current.width,
        captureCanvasRef.current.height
      );
    } else {
      console.error('CaptureCanvas не инициализирован!');
    }
  }, [canvasRef, videoRef, captureCanvasRef]);

  return (
    <Card
      className={`video-stream-card ${
        currentMode === 'Light' ? 'video-stream-card-light' : 'video-stream-card-dark'
      }`}
    >
      <Card.Header
        className={`d-flex justify-content-between align-items-center ${
          currentMode === 'Light' ? 'text-dark' : 'text-light'
        }`}
      >
        <h3>Видеоаналитика в реальном времени</h3>
        <div className="model-switcher d-flex align-items-center gap-3">
          <div
            onClick={toggleModel}
            style={{ cursor: isStreamingActive ? 'not-allowed' : 'pointer' }}
            className="d-flex align-items-center gap-2"
          >
            <span>Трекинг скелета</span>
            <Form.Check
              type="switch"
              checked={selectedModel === 'emotion'}
              disabled={isStreamingActive}
              readOnly
              className={`mx-2 ${currentMode === 'Dark' ? 'custom-switch-dark' : ''}`}
            />
            <span>Распознавание эмоций</span>
          </div>
        </div>

        <Badge bg={isConnected ? 'success' : 'danger'}>
          {isConnected ? 'Подключено' : 'Отключено'}
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
            variant={isStreamingActive ? 'danger' : 'success'}
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
