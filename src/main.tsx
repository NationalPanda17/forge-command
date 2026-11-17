import { applyPrefs, loadPrefs } from './ui/prefs';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App2 from './game/App2';
import ErrorBoundary from './ui/ErrorBoundary';
import './index.css';
import { registerOfflineSupport } from './ui/pwa';

applyPrefs(loadPrefs());
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App2 />
    </ErrorBoundary>
  </StrictMode>,
);

registerOfflineSupport();
