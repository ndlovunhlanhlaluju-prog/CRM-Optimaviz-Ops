import React, { type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**

 * Catches render-time errors anywhere in the tree so a single thrown error
 * does not blank the whole app. Renders the error message on screen, which
 * makes production blank-screen bugs immediately diagnosable.
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
    console.error('Optima render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {

      const message = this.state.error?.message || String(this.state.error);
      const stack = this.state.error?.stack || '';
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f1a', color: '#e5e7eb', padding: '24px', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
          <div style={{ maxWidth: '680px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '22px' }}>⚠️</span>
              <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Something went wrong</h1>
            </div>
            <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '16px' }}>
              The CRM hit an error while rendering. Details below — reload after a fix is deployed.
            </p>
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: '6px' }}>Error</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', color: '#fecaca' }}>{message}</pre>
            </div>
            {stack && (
              <details style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '14px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#9ca3af' }}>Stack trace</summary>
                <pre style={{ margin: '12px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '11px', color: '#9ca3af', maxHeight: '300px', overflow: 'auto' }}>{stack}</pre>
              </details>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ marginTop: '16px', padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#6366f1', color: 'white', fontWeight: 600, cursor: 'pointer' }}
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
