import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// --- GEÇİCİ TEŞHİS BANDI (sorun bulunca kaldırılacak) ---
function showErrorBanner(message: string) {
  let banner = document.getElementById('debug-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'debug-error-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#dc2626;color:#fff;padding:10px;font-family:monospace;font-size:11px;white-space:pre-wrap;max-height:60vh;overflow:auto;';
    document.body.appendChild(banner);
  }
  const line = document.createElement('div');
  line.style.cssText = 'border-top:1px solid rgba(255,255,255,0.35);padding-top:6px;margin-top:6px;';
  line.textContent = message;
  banner.prepend(line);
}

window.addEventListener('error', (event) => {
  showErrorBanner(`HATA: ${event.message}\n${event.filename}:${event.lineno}:${event.colno}\n${event.error?.stack ?? ''}`);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason: any = event.reason;
  showErrorBanner(`PROMISE REDDİ: ${reason?.message ?? reason}\n${reason?.stack ?? ''}`);
});
// --- /GEÇİCİ TEŞHİS BANDI ---

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
    <App />
  </StrictMode>,
);
