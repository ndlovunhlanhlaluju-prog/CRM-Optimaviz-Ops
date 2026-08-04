import React, { type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-time errors so a single thrown error does not blank the app.
 * Users only see a friendly recovery screen — details go to the console.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  private readonly childNodes: ReactNode;

  constructor(props: Props) {
    super(props);
    this.childNodes = props.children;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('CRM render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
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
          <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }} aria-hidden="true">
              ⚠️
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h1>
            <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '14px', margin: '0 0 20px', lineHeight: 1.5 }}>
              The page could not load correctly. Please reload and try again. If this keeps happening, contact your admin.
            </p>
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
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.childNodes;
  }
}
