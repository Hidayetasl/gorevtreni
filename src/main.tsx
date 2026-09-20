import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// --- GEÇİCİ TEŞHİS BANDI (sorun bulunca kaldırılacak) ---
declare global {
  interface Window {
    __debugLog?: (message: string) => void;
  }
}

function showDebugBanner(message: string, isError: boolean) {
  let banner = document.getElementById('debug-log-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'debug-log-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:rgba(15,23,42,0.94);color:#a7f3d0;padding:8px;font-family:monospace;font-size:10px;white-space:pre-wrap;max-height:50vh;overflow:auto;';
    document.body.appendChild(banner);
  }
  const line = document.createElement('div');
  line.style.cssText = `border-top:1px solid rgba(255,255,255,0.2);padding-top:5px;margin-top:5px;${isError ? 'color:#fca5a5;font-weight:bold;' : ''}`;
  line.textContent = `${new Date().toLocaleTimeString('tr-TR')} — ${message}`;
  banner.prepend(line);
}

window.__debugLog = (message: string) => showDebugBanner(message, false);

window.addEventListener('error', (event) => {
  showDebugBanner(`HATA: ${event.message}\n${event.filename}:${event.lineno}:${event.colno}\n${event.error?.stack ?? ''}`, true);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason: any = event.reason;
  showDebugBanner(`PROMISE REDDİ: ${reason?.message ?? reason}\n${reason?.stack ?? ''}`, true);
});

window.__debugLog(`main.tsx yüklendi — bundle: ${document.querySelector('script[type="module"]')?.getAttribute('src') ?? '?'}`);
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
