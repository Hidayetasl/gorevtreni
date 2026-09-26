import React, { useEffect, useState } from 'react';

/** Açılışta ve açılış hatalarında görünen sade ekran. Beyaz/boş ekran kalmasın diye. */

const box: React.CSSProperties = {
  minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
  padding: 'calc(24px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))',
  background: 'linear-gradient(180deg, #e3eee9 0%, #d3e6de 100%)', color: '#16323a', textAlign: 'center',
  fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, sans-serif',
};
const button: React.CSSProperties = {
  minHeight: 52, padding: '0 22px', border: 0, borderRadius: 18, background: '#0e9aa7', color: '#fff',
  font: '800 18px/1 inherit', fontFamily: 'inherit', boxShadow: '0 4px 0 #0b6e78', cursor: 'pointer',
};

// Açılıştaki beklenmedik hatalar burada toplanır; açılış ekranı bunları gösterir.
const startupErrors: string[] = [];
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => { startupErrors.push(String(event.message || event.error || 'Bilinmeyen hata')); });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string } | undefined;
    startupErrors.push(String(reason?.message || reason || 'Bilinmeyen hata'));
  });
}

function ProblemBox({ detail }: { detail: string }) {
  return (
    <main style={box} role="alert">
      <span style={{ fontSize: 56 }} aria-hidden="true">🚂</span>
      <h1 style={{ margin: 0, fontSize: 22 }}>Uygulama açılamadı</h1>
      <p style={{ margin: 0, fontSize: 16, maxWidth: 340, color: '#4b676c' }}>İnternet bağlantısını kontrol edip yeniden deneyin. Olmazsa bu ekranın fotoğrafını aileye gönderin.</p>
      <button type="button" style={button} onClick={() => window.location.reload()}>Yeniden dene</button>
      <p style={{ margin: 0, fontSize: 12, color: '#6b8589', maxWidth: 340, wordBreak: 'break-word' }}>{detail}</p>
    </main>
  );
}

/** Giriş kontrolü sürerken: "Açılıyor…"; 10 saniyeyi geçerse sebebiyle birlikte "Yeniden dene". */
export function StartupScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 10000);
    return () => window.clearTimeout(timer);
  }, []);
  if (slow) {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches ? 'ana ekran' : 'tarayıcı';
    return <ProblemBox detail={`Açılış 10 sn'yi geçti (${standalone}, ${navigator.onLine ? 'çevrimiçi' : 'çevrimdışı'})${startupErrors.length ? ` · ${startupErrors.slice(-2).join(' · ')}` : ''}`} />;
  }
  return (
    <main style={box} aria-busy="true">
      <span style={{ fontSize: 56 }} aria-hidden="true">🚂</span>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Açılıyor…</p>
    </main>
  );
}

/** Uygulamanın herhangi bir yerinde hata olursa beyaz ekran yerine açıklama ve "Yeniden dene". */
type BoundaryProps = { children: React.ReactNode };
type BoundaryState = { error: string | null };
export class AppErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  // Alanlar açıkça bildirilir: CI'da React tip paketi olmadan da derlensin.
  declare props: BoundaryProps;
  declare state: BoundaryState;
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: String((error as { message?: string })?.message || error) };
  }
  render() {
    return this.state.error ? <ProblemBox detail={this.state.error} /> : this.props.children;
  }
}
