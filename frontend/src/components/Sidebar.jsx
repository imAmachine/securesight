import React from 'react';
import {useStateContext} from '../contexts/ContextProvider';
import {FormCheck, Nav, Navbar} from 'react-bootstrap';
import {useNavigate} from 'react-router-dom';
import { ReactComponent as LogoLightSvg } from '../assets/images/logo_dark.svg';
import { ReactComponent as LogoDarkSvg } from '../assets/images/logo_light.svg';
import {BiChevronsLeft, BiChevronsRight, BiExit, BiHome, BiVideo, BiWebcam} from 'react-icons/bi';
import {useAuth} from '../auth/AuthProvider';
import '../styles/sidebar.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const Sidebar = ({onWebcamToggle}) => {
    const {activeMenu, setActiveMenu, currentMode, setCurrentMode, setMode} = useStateContext();
    const navigate = useNavigate();
    const {logout} = useAuth();

    const handleToggle = () => {
        setActiveMenu(!activeMenu);
    };

    const handleModeSwitch = (event) => {
        setCurrentMode(currentMode === 'Light' ? 'Dark' : 'Light');
        setMode(currentMode === 'Light' ? 'Dark' : 'Light');
    };
    const handleLogout = () => {
        logout();
    };

    return (
        <Navbar className={`sidebar ${activeMenu ? 'active' : ''} ${currentMode === 'Dark' ? 'sidebar-dark' : ''}`}>
            <Navbar.Brand className='top d-flex align-items-center'>
              {currentMode === 'Light' ? <LogoDarkSvg className='logo-svg-sidebar' /> : <LogoLightSvg className='logo-svg-sidebar' />}
              <span className={`logo-text-sidebar ${!activeMenu && 'd-none'} ${currentMode === 'Dark' ? 'text-light' : 'text-dark'}`}>SecureSight</span>
            </Navbar.Brand>

            <Nav className="flex-column mt-4">
                {/* Add your sidebar content here, for example: */}
                <Nav.Item>
                    <Nav.Link onClick={() => navigate('/')}>
                        <BiHome className='nav-icon'/>
                        <span className={`nav-text ${!activeMenu && 'd-none'}`}>Домой</span>
                    </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                    <Nav.Link onClick={() => navigate('/videos')}>
                        <BiVideo className='nav-icon'/>
                        <span className={`nav-text ${!activeMenu && 'd-none'}`}>Видеоролики</span>
                    </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                    <Nav.Link onClick={() => navigate('/ws/camera')}>
                        <BiWebcam className='nav-icon'/>
                        <span className={`nav-text ${!activeMenu && 'd-none'}`}>Веб-камера</span>
                    </Nav.Link>
                </Nav.Item>
            </Nav>
            <Nav className="mt-auto d-flex flex-column">
                <Nav.Item className='center'>
                    <Nav.Link onClick={handleToggle}>
                        {activeMenu ? <BiChevronsLeft className='nav-icon'/> : <BiChevronsRight className='nav-icon'/>}
                    </Nav.Link>
                </Nav.Item>
                <Nav.Item className='mb-2 center'>
                    <Nav.Link onClick={handleLogout}>
                        <BiExit className='nav-icon'/>
                        <span className={`nav-text ${!activeMenu && 'd-none'}`}>Выйти</span>
                    </Nav.Link>
                </Nav.Item>
                <Nav.Item className='center'>
                    <FormCheck className={` ${!activeMenu && 'd-none'}`}
                               type="switch"
                               id="custom-switch"
                               label={currentMode === 'Light' ? 'Light' : 'Dark'}
                               checked={currentMode === 'Dark'}
                               onChange={handleModeSwitch}
                    />
                </Nav.Item>
            </Nav>
        </Navbar>
    );
};

export default Sidebar;
