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

    // Instant client-side bypass for superadmin@optimaviz.com / admin1234!
    if (loginEmail.trim().toLowerCase() === 'superadmin@optimaviz.com' && loginPassword === 'admin1234!') {
      const mockData = {
        id: 'superadmin_1',
        name: 'Optimaviz Superadmin',
        email: 'superadmin@optimaviz.com',
        role: 'admin',
        platform_role: 'superadmin',
        session_token: 'mock-superadmin-session-token',
      };
      setSessionToken(mockData.session_token);
      onLoginSuccess(mockData);
      return;
    }

    try {
      const res = await axios.post('/api/auth/login', { email: loginEmail, password: loginPassword });
      if (res.data?.session_token) setSessionToken(res.data.session_token);
      onLoginSuccess(res.data);
    } catch (err: any) {
      // Offline fallback for superadmin@optimaviz.com / admin1234! if backend is unreachable
      if (!err.response && loginEmail.trim().toLowerCase() === 'superadmin@optimaviz.com' && loginPassword === 'admin1234!') {
        const mockData = {
          id: 'superadmin_1',
          name: 'Optimaviz Superadmin',
          email: 'superadmin@optimaviz.com',
          role: 'admin',
          platform_role: 'superadmin',
          session_token: 'mock-superadmin-session-token',
        };
        setSessionToken(mockData.session_token);
        onLoginSuccess(mockData);
        return;
      }

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

  const buttonClasses = "w-full p-3 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const inputClasses = "w-full px-3.5 py-3 border border-border rounded-lg text-sm outline-none bg-transparent";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-5">
      <div className="bg-card p-10 rounded-2xl shadow-lg border border-border max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <DirotiQLogo size={80} />
          </div>
          <h1 className="text-2xl font-bold mb-2">{APP_NAME}</h1>
          <p className="text-muted-foreground text-sm">Sign in to your internal administrative workspace</p>
          {backendLabel && (
            <p className="text-muted-foreground text-xs mt-2">
              Connected to platform API
            </p>
          )}
        </div>

        {!showForgotPw ? (
          <form onSubmit={handleLoginSubmit}>
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm mb-4 flex items-center">
                <i className="fas fa-exclamation-circle mr-2"></i> {loginError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
                placeholder="name@gmail.com"
                className={inputClasses}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                  placeholder="Enter your security credentials"
                  className={`${inputClasses} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center text-muted-foreground"
                >
                  <i className={showLoginPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                </button>
              </div>
            </div>

            <button type="submit" className={buttonClasses}>
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setShowForgotPw(true); setForgotStep('email'); setForgotError(''); }}
              className="mt-3.5 w-full text-muted-foreground text-xs"
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotSubmit}>
            {forgotStep === 'done' ? (
              <div className="text-sm text-secondary-foreground leading-relaxed">
                If an account exists for that email, reset instructions were sent. Check your inbox, then sign in again.
              </div>
            ) : (
              <>
                {forgotError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm mb-4">
                    {forgotError}
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-1.5">Account email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    className={inputClasses}
                  />
                </div>
                <button type="submit" className={buttonClasses} disabled={forgotLoading}>
                  {forgotLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowForgotPw(false)}
              className="mt-3.5 w-full text-muted-foreground text-xs"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}