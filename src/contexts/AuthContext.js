import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

// ***** START DEBUG *****
// Use environment variable for API base URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://keycraft.org:3000';

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Try session bridge first (CORS tuned for app domain)
      try {
        const bridgeUrl = `${API_BASE_URL}/api/auth/session-bridge`;
        const bridgeRes = await fetch(bridgeUrl, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
        });
        if (bridgeRes.ok) {
          const sessionData = await bridgeRes.json();
          if (sessionData && sessionData.user) {
            setCurrentUser(sessionData.user);
            return;
          }
        }
      } catch (e) {
        // Bridge request failed, will try standard session
      }

      // 2) Fallback to standard NextAuth session route
      const fetchUrl = `${API_BASE_URL}/api/auth/session`;
      const response = await fetch(fetchUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      if (response.ok) {
        const session = await response.json();
        if (session && Object.keys(session).length > 0 && session.user) {
          setCurrentUser(session.user);
          return;
        }
      }

      // If both attempts failed
      setCurrentUser(null);
    } catch (error) {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [fetchSession]);

  const forceSessionRefresh = useCallback(() => {
    return fetchSession();
  }, [fetchSession]);

  const value = {
    currentUser,
    loading,
    forceSessionRefresh,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 
