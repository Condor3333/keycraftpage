import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

// ***** START DEBUG *****
console.log('[AuthContext] NODE_ENV:', process.env.NODE_ENV);
console.log('[AuthContext] Raw env var REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);

let resolvedApiBaseUrl;
// Use IP address for development on mobile devices
const isDevelopment = process.env.NODE_ENV === 'development';
const isLocalIP = window.location.hostname === '192.168.2.19';

if (isDevelopment && isLocalIP) {
  resolvedApiBaseUrl = 'http://192.168.2.19:3000';
} else {
  resolvedApiBaseUrl = 'http://keycraft.org:3000';
}

console.log('[AuthContext] Resolved API_BASE_URL for fetch:', resolvedApiBaseUrl);
// ***** END DEBUG *****

const API_BASE_URL = resolvedApiBaseUrl; // Use the resolved one

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    console.log('[AuthContext] fetchSession called.');
    setLoading(true);
    try {
      const fetchUrl = `${API_BASE_URL}/api/auth/session`;
      console.log('[AuthContext] Attempting to fetch from URL:', fetchUrl);
      
      // Log all cookies being sent
      console.log('[AuthContext] Current cookies:', document.cookie);
      
      const response = await fetch(fetchUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      console.log('[AuthContext] Fetch response status:', response.status);

      if (response.ok) {
        const session = await response.json();
        if (session && Object.keys(session).length > 0 && session.user) {
          setCurrentUser(session.user);
          console.log('[AuthContext] SUCCESS: Session fetched and user set.', session.user);
          console.log('AuthContext: currentUser.hasPaid after setCurrentUser:', session.user?.hasPaid);
        } else {
          setCurrentUser(null);
          console.log('[AuthContext] No active session found or session object is empty.');
          
          // Try the session bridge when no session is found
          console.log('[AuthContext] Trying session bridge as fallback...');
          try {
            const bridgeResponse = await fetch(`${API_BASE_URL}/api/auth/session-bridge`, {
              credentials: 'include',
              headers: {
                'Accept': 'application/json',
              }
            });
            
            console.log('[AuthContext] Bridge response status:', bridgeResponse.status);
            
            if (bridgeResponse.ok) {
              const sessionData = await bridgeResponse.json();
              console.log('[AuthContext] Bridge response data:', sessionData);
              if (sessionData && sessionData.user) {
                setCurrentUser(sessionData.user);
                console.log('[AuthContext] SUCCESS: Session fetched via bridge:', sessionData.user);
                return;
              }
            }
          } catch (bridgeError) {
            console.log('[AuthContext] Session bridge failed:', bridgeError);
          }
        }
      } else {
        // Try the session bridge as fallback
        console.log('[AuthContext] Regular session failed, trying session bridge...');
        try {
          const bridgeResponse = await fetch('http://keycraft.org:3000/api/auth/session-bridge', {
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
            }
          });
          
          if (bridgeResponse.ok) {
            const sessionData = await bridgeResponse.json();
            if (sessionData && sessionData.user) {
              setCurrentUser(sessionData.user);
              console.log('[AuthContext] SUCCESS: Session fetched via bridge:', sessionData.user);
              return;
            }
          }
        } catch (bridgeError) {
          console.log('[AuthContext] Session bridge also failed:', bridgeError);
        }
        
        setCurrentUser(null);
        console.error('AuthContext: Failed to fetch session. Status:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('AuthContext: Main error caught:', error);
      
      // Try the session bridge as fallback on any error
      try {
        console.log('[AuthContext] Trying session bridge due to error...');
        const bridgeResponse = await fetch('http://keycraft.org:3000/api/auth/session-bridge', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        });
        
        console.log('[AuthContext] Bridge response status:', bridgeResponse.status);
        
        if (bridgeResponse.ok) {
          const sessionData = await bridgeResponse.json();
          console.log('[AuthContext] Bridge response data:', sessionData);
          if (sessionData && sessionData.user) {
            setCurrentUser(sessionData.user);
            console.log('[AuthContext] SUCCESS: Session fetched via bridge after error:', sessionData.user);
            setLoading(false);
            return;
          }
        }
      } catch (bridgeError) {
        console.error('[AuthContext] Session bridge also failed:', bridgeError);
      }
      
      setCurrentUser(null);
      if (error instanceof TypeError && error.message.includes('Failed to parse URL')) {
        console.error(`AuthContext: Error fetching session ${error.name}: ${error.message} from ${API_BASE_URL}/api/auth/session`);
      } else {
        console.error('AuthContext: Error fetching session', error);
      }
    } finally {
      console.log('[AuthContext] Setting loading to false');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
    
    // Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('[AuthContext] Timeout reached, setting loading to false');
      setLoading(false);
    }, 10000); // 10 seconds
    
    return () => clearTimeout(timeout);
  }, [fetchSession]);

  const forceSessionRefresh = useCallback(() => {
    console.log('[AuthContext] forceSessionRefresh called.');
    return fetchSession();
  }, [fetchSession]);

  const value = {
    currentUser,
    loading,
    forceSessionRefresh,
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Children can be rendered while loading is true, 
          individual components can check loading state from useAuth() if they need to wait for user data */}
      {children}
    </AuthContext.Provider>
  );
}; 