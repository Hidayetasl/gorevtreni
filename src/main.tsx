import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppErrorBoundary } from './components/StartupScreen';
import './index.css';
import { registerSW } from 'virtual:pwa-register';


// registerType: 'autoUpdate' zaten yeni sürüm aktifleştiğinde otomatik reload
// yapıyor (vite-plugin-pwa'nın kendi register.js'i, activated olayında
// window.location.reload() çağırıyor) — ayrıca bir controllerchange dinleyicisi
// eklemek bunu tekrarlayıp reload'u kullanıcının parmağı ekrandayken
// tetikleyebiliyordu. onNeedReload ile bu reload'u devralıp, kullanıcı birkaç
// saniyedir etkileşimde değilse (dokunuş/tuş yok) uyguluyoruz.
let lastInteractionAt = Date.now();
const markInteraction = () => { lastInteractionAt = Date.now(); };
(['pointerdown', 'touchstart', 'keydown'] as const).forEach((eventName) => {
  window.addEventListener(eventName, markInteraction, { passive: true });
});

const IDLE_MS_BEFORE_RELOAD = 4000;

function reloadWhenIdle() {
  if (Date.now() - lastInteractionAt >= IDLE_MS_BEFORE_RELOAD) {
    window.location.reload();
  } else {
    window.setTimeout(reloadWhenIdle, 1000);
  }
}

registerSW({
  immediate: true,
  onNeedReload: reloadWhenIdle,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
