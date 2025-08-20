import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const UserProfile = () => {
  const { currentUser } = useAuth();

  const handleLogout = async () => {
    // Placeholder logout function - firebase removed
    console.log('Logout functionality to be implemented');
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="user-profile">
      <div className="user-info">
        {currentUser.photoURL && (
          <img 
            src={currentUser.photoURL} 
            alt="Profile" 
            className="profile-picture"
          />
        )}
        <div className="user-details">
          <span className="user-name">{currentUser.displayName}</span>
          <span className="user-email">{currentUser.email}</span>
        </div>
      </div>
      <button 
        className="logout-button"
        onClick={handleLogout}
      >
        Logout
      </button>
    </div>
  );
};

export default UserProfile; 