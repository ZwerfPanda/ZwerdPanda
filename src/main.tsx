import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/dm-sans/index.css';
import '@fontsource-variable/caveat/index.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import { App } from './app/App';
import { registerServiceWorker } from './lib/pwa';

// After an update, an app that was already open can ask for old code files
// that no longer exist. Load the fresh version once instead of failing.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'olu:reloaded-for-update';
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
