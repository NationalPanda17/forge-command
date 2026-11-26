import { applyPrefs, loadPrefs } from './ui/prefs';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App2 from './game/App2';
import ErrorBoundary from './ui/ErrorBoundary';
// Fonts are served with the game: no third-party request, and they work offline.
// Barlow Condensed for headings and controls, Inter for reading, JetBrains Mono for map readouts.
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
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
