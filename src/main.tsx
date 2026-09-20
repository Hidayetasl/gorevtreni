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

const updateSW = registerSW({ immediate: true });

// workbox-window'un isUpdate/isExternal sezgisi bazı senaryolarda güncellemeyi
// kaçırabiliyor (bkz. vite-plugin-pwa#789); native controllerchange olayı daha
// güvenilir bir yedek — yeni SW kontrolü devraldığı an sayfayı yeniler.
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  window.location.reload();
});

// Sekme kapatılıp açılmasa bile periyodik olarak yeni sürüm var mı diye kontrol et.
setInterval(() => {
  updateSW();
}, 60 * 1000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
