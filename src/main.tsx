import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
// Configure same-origin API credentials before any page loads.
import './services/api';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element with id "root" not found. Ensure your HTML contains <div id="root"></div>');
}

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
