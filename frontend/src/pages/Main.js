import React, {useEffect, useState} from 'react';
import client from '../ApiClient';
import {Dashboard, Footer, Header, Sidebar, VideoUploadForm, WebcamStream} from "../components";
import {useStateContext} from '../contexts/ContextProvider';
import {Container} from 'react-bootstrap';
import '../styles/main.css';

const Main = () => {
    const {setCurrentMode, currentMode} = useStateContext();

    useEffect(() => {
        const currentThemeMode = currentMode;
        if (currentThemeMode) {
            setCurrentMode(currentThemeMode);
        }
    }, [setCurrentMode]);

    const [showForm, setShowForm] = useState(false);

    const [showWebcam, setShowWebcam] = useState(false); // Новое состояние

    const handleToggleForm = () => {
        setShowForm(!showForm);
        setShowWebcam(false); // Закрыть веб-камеру при открытии формы
    }

    const handleToggleWebcam = () => {
        setShowWebcam(!showWebcam);
        setShowForm(false); // Закрыть форму при открытии веб-камеры
    }

    return (
        <Container fluid className="d-flex vh-100 p-0">
            <Sidebar onWebcamToggle={handleToggleWebcam}/>
            <Container fluid
                       className={`main-container d-flex p-0 flex-column ${currentMode === 'Dark' ? 'main-dark' : ''}`}>
                <Header handleToggleForm={handleToggleForm} showForm={showForm}/>
                <Container
                    className={`main d-flex flex-column align-items-center justify-content-center ${currentMode === 'Dark' ? 'main-dark' : ''}`}>
                    <div className={`webcam-container ${showWebcam ? 'fade-in' : 'fade-out'}`}>
                        {showWebcam && <WebcamStream />}
                    </div>
                    <div className={`dashboard-container ${showWebcam || showForm ? 'fade-out' : 'fade-in'} ${showWebcam || showForm ? 'd-none' : ''}`}>
                        {!showForm && <Dashboard/>}
                    </div>
                    <div className={`upload-form-container ${showForm ? 'fade-in' : 'fade-out'}`}>
                        {showForm && <VideoUploadForm onClose={handleToggleForm} apiClient={client}/>}
                    </div>
                </Container>
                <Footer/>
            </Container>
        </Container>
    );
};

export default Main;