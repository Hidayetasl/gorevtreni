import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// ÖNEMLİ: Önceden servis çalışanı (service worker) kayıt olsa da yeni bir
// sürüm yayınlandığında sayfayı KENDİLİĞİNDEN yenilemiyordu — kullanıcının
// (ör. anneanne) elle "site verilerini temizle" yapması gerekiyordu. Bu,
// vite-plugin-pwa'nın resmi otomatik güncelleme kaydı: periyodik olarak yeni
// sürüm var mı kontrol eder, bulursa hiçbir manuel işlem gerektirmeden
// sayfayı otomatik yeniler (registerType: 'autoUpdate' ile birlikte çalışır).
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
