import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

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
