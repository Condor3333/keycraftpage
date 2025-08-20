import React, { useState, useEffect, useRef } from 'react';
import './SettingsDropdown.css';
import '@fortawesome/fontawesome-free/css/all.min.css'; // For gear, user, theme, logout icons

const SettingsDropdown = ({
  currentUser,
  onLogout,
  theme,
  onToggleTheme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleDropdown = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="settings-dropdown-container" ref={dropdownRef}>
      <button onClick={toggleDropdown} className="settings-gear-button" aria-label="Settings" title="Settings">
        <i className="fas fa-cog"></i>
      </button>
      {isOpen && (
        <div className="settings-dropdown-menu">
          {currentUser && (
            <div className="dropdown-item username-item">
              <i className="fas fa-user-circle"></i>
              <span>Logged in as: <strong>{currentUser.displayName || currentUser.email}</strong></span>
            </div>
          )}
          <button onClick={onToggleTheme} className="dropdown-item">
            <i className={theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon'}></i>
            Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
          {currentUser && (
            <>
              <hr className="dropdown-divider" />
              <button onClick={onLogout} className="dropdown-item logout-button">
                <i className="fas fa-sign-out-alt"></i>
                Logout
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsDropdown; 