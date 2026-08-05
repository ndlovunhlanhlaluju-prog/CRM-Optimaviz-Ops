import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { LoginPage } from './pages/LoginPage';
import { CRMApp } from './CRMApp';
import { clearSessionToken, getSessionToken, API_BASE_URL } from './services/api';

export function AppCore() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiBaseHint, setApiBaseHint] = useState('');

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    clearSessionToken();
    setUser(null);
  };

  const fetchProfile = useCallback(async () => {
    const token = getSessionToken();

    // Client-side bypass for superadmin mock session
    if (token === 'mock-superadmin-session-token') {
      const mockData = {
        id: 'superadmin_1',
        name: 'Optimaviz Superadmin',
        email: 'superadmin@optimaviz.com',
        role: 'admin',
        platform_role: 'superadmin',
        session_token: 'mock-superadmin-session-token',
      };
      setUser(mockData);
      return mockData;
    }

    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const res = await axios.post('/api/auth/profile');
      if (res.data) {
        setUser(res.data);
        return res.data;
      } else {
        clearSessionToken();
        setUser(null);
        return null;
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
      clearSessionToken();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchProfile();
      setLoading(false);
    };
    init();
  }, [fetchProfile]);

  useEffect(() => {
    if (typeof API_BASE_URL === 'string' && API_BASE_URL.length > 0 && !API_BASE_URL.startsWith('/')) {
      setApiBaseHint(API_BASE_URL);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <div>Loading application...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} apiBaseHint={apiBaseHint} />;
  }

  return <CRMApp user={user} onLogout={handleLogout} />;
}