import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

// ***** START DEBUG *****
console.log('[AuthContext] NODE_ENV:', process.env.NODE_ENV);
console.log('[AuthContext] Raw env var REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);

// Use localhost for development, keycraft.org for production
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'http://keycraft.org:3000');

console.log('[AuthContext] Resolved API_BASE_URL for fetch:', API_BASE_URL);
// ***** END DEBUG *****

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    console.log('[AuthContext] fetchSession called.');
    setLoading(true);
    try {
      // 1) Try session bridge first (CORS tuned for app domain)
      try {
        const bridgeUrl = `${API_BASE_URL}/api/auth/session-bridge`;
        const bridgeRes = await fetch(bridgeUrl, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
        });
        console.log('[AuthContext] Bridge response status:', bridgeRes.status);
        if (bridgeRes.ok) {
          const sessionData = await bridgeRes.json();
          if (sessionData && sessionData.user) {
            setCurrentUser(sessionData.user);
            console.log('[AuthContext] SUCCESS: Session via bridge:', sessionData.user);
            return;
          }
        }
      } catch (e) {
        console.log('[AuthContext] Bridge request failed, will try standard session:', e);
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
      console.log('[AuthContext] Fetch response status:', response.status);

      if (response.ok) {
        const session = await response.json();
        if (session && Object.keys(session).length > 0 && session.user) {
          setCurrentUser(session.user);
          console.log('[AuthContext] SUCCESS: Session fetched and user set.', session.user);
          console.log('AuthContext: currentUser.hasPaid after setCurrentUser:', session.user?.hasPaid);
          return;
        }
      }

      // If both attempts failed
      setCurrentUser(null);
      console.warn('[AuthContext] No active session found after both bridge and standard session checks.');

    } catch (error) {
      console.error('AuthContext: Error fetching session', error);
      setCurrentUser(null);
    } finally {
      console.log('[AuthContext] Setting loading to false');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
    const timeout = setTimeout(() => {
      console.log('[AuthContext] Timeout reached, setting loading to false');
      setLoading(false);
    }, 10000);
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
      {children}
    </AuthContext.Provider>
  );
}; 