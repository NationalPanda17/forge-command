import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import ErrorBoundary from './ui/ErrorBoundary';
import './index.css';
import { registerOfflineSupport } from './ui/pwa';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

registerOfflineSupport();
