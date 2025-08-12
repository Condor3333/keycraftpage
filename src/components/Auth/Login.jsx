import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const Login = () => {
  const { currentUser, loading } = useAuth();
  
  // Use IP address for development on mobile devices
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isLocalIP = window.location.hostname === '192.168.2.19';
  const mainSiteUrl = (isDevelopment && isLocalIP) ? 'http://192.168.2.19:3000' : 'http://keycraft.org:3000';

  console.log('Login Component - Auth State:', { currentUser, loading });

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h2>Loading...</h2>
          <p>Checking authentication status...</p>
          <p>If this takes too long, check the browser console for errors.</p>
        </div>
      </div>
    );
  }

  if (currentUser) {
    console.log('User is authenticated:', currentUser);
    return null;
  }

  console.log('No user found, showing login screen');

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Welcome to Key Craft!</h2>
        <p>To access the editor, please sign in or register on our main site.</p>
        <a 
          href={mainSiteUrl}
          className="standard-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Sign in or Register at keycraft.org
        </a>
        
        <div style={{marginTop: '20px'}}>
          <button 
            onClick={async () => {
              console.log('Testing session bridge manually...');
              try {
                const response = await fetch(`${mainSiteUrl}/api/auth/session-bridge`, {
                  credentials: 'include',
                  headers: {
                    'Accept': 'application/json',
                  }
                });
                console.log('Manual test response status:', response.status);
                const data = await response.json();
                console.log('Manual test response data:', data);
                alert(`Response: ${response.status} - ${JSON.stringify(data)}`);
              } catch (error) {
                console.error('Manual test error:', error);
                alert(`Error: ${error.message}`);
              }
            }}
            style={{
              padding: '10px 15px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Test Session Bridge
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login; 