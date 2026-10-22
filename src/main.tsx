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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
