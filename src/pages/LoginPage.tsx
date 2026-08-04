import React, { useState } from 'react';
import axios from 'axios';
import { DirotiQLogo, APP_NAME } from '../config/crmConfig';
import { setSessionToken, API_BASE_URL } from '../services/api';
import { toUserFacingError } from '../utils/userFacingError';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
  apiBaseHint?: string;
}

export function LoginPage({ onLoginSuccess, apiBaseHint }: LoginPageProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Forgot password sub-state
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotStep, setForgotStep] = useState('email'); // 'email' | 'done'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post('/api/auth/login', { email: loginEmail, password: loginPassword });
      if (res.data?.session_token) setSessionToken(res.data.session_token);
      onLoginSuccess(res.data);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 429) {
        setLoginError(toUserFacingError(err, 'Too many login attempts. Wait a minute and try again.'));
      } else if (!err.response) {
        setLoginError('Cannot reach the server. Check your connection and try again.');
      } else if (status === 404 || status >= 500) {
        setLoginError('Login is temporarily unavailable. Please try again in a moment.');
      } else {
        setLoginError(toUserFacingError(err, 'Invalid email or password.'));
      }
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await axios.post('/api/auth/forgot-password', { email: forgotEmail });
      setForgotStep('done');
    } catch (err: any) {
      setForgotError(toUserFacingError(err, 'Could not start password reset.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const backendLabel = apiBaseHint || API_BASE_URL;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '20px' }}>
      <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '20px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', maxWidth: '440px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '80px', height: '80px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <DirotiQLogo size={80} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>{APP_NAME}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Sign in to your internal administrative workspace</p>
          {backendLabel ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '8px' }}>
              Connected to platform API
            </p>
          ) : null}
        </div>

        {!showForgotPw ? (
          <form onSubmit={handleLoginSubmit}>
            {loginError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                <i className="fas fa-exclamation-circle" style={{ marginRight: '6px' }}></i> {loginError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
                placeholder="name@gmail.com"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '24px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Password</label>
              <input
                type={showLoginPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
                placeholder="Enter your security credentials"
                style={{ width: '100%', padding: '12px 42px 12px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(calc(-50% + 10px))', width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1 }}
              >
                <i className={showLoginPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
              </button>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: 700 }}>
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setShowForgotPw(true); setForgotStep('email'); setForgotError(''); }}
              style={{ marginTop: '14px', width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotSubmit}>
            {forgotStep === 'done' ? (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                If an account exists for that email, reset instructions were sent. Check your inbox, then sign in again.
              </div>
            ) : (
              <>
                {forgotError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                    {forgotError}
                  </div>
                )}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Account email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={forgotLoading} style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: 700 }}>
                  {forgotLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowForgotPw(false)}
              style={{ marginTop: '14px', width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
