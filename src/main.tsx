import { applyPrefs, loadPrefs } from './ui/prefs';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App2 from './game/App2';
import ErrorBoundary from './ui/ErrorBoundary';
// Fonts are served with the game: no third-party request, and they work offline.
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import './index.css';
import { registerOfflineSupport } from './ui/pwa';
import { installTooltips } from './ui/tooltip';

applyPrefs(loadPrefs());
installTooltips();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App2 />
    </ErrorBoundary>
  </StrictMode>,
);

registerOfflineSupport();
