import React, { type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error | null;
}

/**
 * Catches render-time errors so a single thrown error does not blank the app.
 * Provides a friendly recovery screen with options to reload or clear cache & restart.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  private readonly childNodes: ReactNode;

  constructor(props: Props) {
    super(props);
    this.childNodes = props.children;
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('CRM render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Unknown render error';
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-base, #0b0f1a)',
            color: 'var(--text-primary, #e5e7eb)',
            padding: '24px',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }} aria-hidden="true">
              ⚠️
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h1>
            <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '14px', margin: '0 0 16px', lineHeight: 1.5 }}>
              The application encountered a rendering or session error during login or navigation.
            </p>
            {errorMessage && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '20px', textAlign: 'left', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {errorMessage}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent, #0f766e)',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch {}
                  window.location.reload();
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: 'var(--text-primary, #e5e7eb)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                Clear Cache &amp; Restart
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.childNodes;
  }
}
