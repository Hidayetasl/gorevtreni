import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import './AuthGate.css';
import {
  acceptFamilyInvite,
  createFamily,
  describeAuthError,
  getAdultFamilyCode,
  getAdultName,
  getFamilyCode,
  getFamilyData,
  getFamilyInviteLink,
  getInviteFamilyCode,
  resetAdultPassword,
  setFamilyPinHash,
  signInAdult,
  signOutAdult,
  subscribeToAuth,
  usesEmulators,
  type FamilyData,
} from '../utils/cloudSync';
import { hashParentPin, isWeakParentPin, needsNewParentPin } from '../utils/storage';

interface AuthGateProps {
  /** Bu cihazdaki oyun verisi; yeni aile kurulurken buluta ilk kopya olarak gider. */
  getLocalFamilyData: () => FamilyData;
  onReady: (familyCode: string, familyData: FamilyData) => void;
}

type Phase = 'checking' | 'login' | 'resolving' | 'no-family' | 'pin' | 'created' | 'error';

/** Davet alanına tam bağlantı da yapıştırılabilir; içinden aile kodu çıkarılır. */
function parseInvite(value: string) {
  const trimmed = value.trim();
  try {
    const fromUrl = new URL(trimmed).searchParams.get('aile');
    if (fromUrl) return fromUrl.toUpperCase().replace(/[^A-Z0-9]/g, '');
  } catch { /* bağlantı değil, düz kod */ }
  return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Her cihaz bir kez izinli bir yetişkin hesabıyla açılır ve aileye bağlanır.
 * Sonrasında oyun doğrudan açılır; ebeveyn işlemleri aile PIN'i ister.
 */
export const AuthGate: React.FC<AuthGateProps> = ({ getLocalFamilyData, onReady }) => {
  const [phase, setPhase] = useState<Phase>('checking');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [pinMode, setPinMode] = useState<'create' | 'claim'>('create');
  const [pendingCode, setPendingCode] = useState('');
  const [manualInvite, setManualInvite] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteCode] = useState(() => getInviteFamilyCode());
  // Giriş formu kendi akışını yönetirken oturum olayının ikinci kez aile
  // araması başlatmasını engeller.
  const manualFlowRef = useRef(false);

  const finish = async (code: string, known?: FamilyData | null) => {
    const data = known || await getFamilyData(code);
    if (!data) throw new Error('Bu aile kaydı bulunamadı.');
    // Davet bağlantısı bir kez kullanıldı; adres çubuğunda kalıp tekrar işlenmesin.
    if (inviteCode) window.history.replaceState(null, '', window.location.pathname);
    onReady(code, data);
  };

  const joinFamily = async (code: string) => {
    await acceptFamilyInvite(code);
    const data = await getFamilyData(code);
    if (needsNewParentPin(data?.parentConfig?.pinHash)) {
      setPendingCode(code);
      setPinMode('claim');
      setPhase('pin');
      return;
    }
    await finish(code, data);
  };

  const resolveFamily = async () => {
    setError('');
    setPhase('resolving');
    try {
      // Öncelik: davet bağlantısı → hesabın ailesi → bu cihazda kayıtlı eski aile kodu.
      const candidate = inviteCode || await getAdultFamilyCode() || getFamilyCode();
      if (!candidate) {
        setPhase('no-family');
        return;
      }
      await joinFamily(candidate);
    } catch (reason) {
      setError(describeAuthError(reason));
      setPhase('error');
    }
  };

  useEffect(() => subscribeToAuth((user) => {
    setAuthUser(user);
    if (manualFlowRef.current) return;
    if (user && getAdultName(user)) { void resolveFamily(); return; }
    // Eski sürümde "çocuk olarak devam" anonim oturum açıyordu. Bu cihaz artık
    // bir kez yetişkin hesabıyla açılmalı.
    if (user) void signOutAdult();
    setPhase('login');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const run = async (step: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try { await step(); } catch (reason) { setError(describeAuthError(reason)); } finally { setBusy(false); }
  };

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) { setError('E-posta ve şifre gerekli.'); return; }
    void run(async () => {
      manualFlowRef.current = true;
      try {
        await signInAdult(email, password);
        setPassword('');
        await resolveFamily();
      } finally { manualFlowRef.current = false; }
    });
  };

  const handleReset = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Şifre yenileme bağlantısı için önce e-posta adresinizi yazın.'); return; }
    void run(async () => {
      await resetAdultPassword(email);
      setNotice('Şifre yenileme bağlantısı e-posta adresinize gönderildi.');
    });
  };

  const handlePin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin) || pin !== pinAgain) { setError('PIN iki alanda da aynı 4 rakam olmalı.'); return; }
    // Kolay PIN'ler ve eski sürümlerin herkesçe bilinen sabit PIN'leri reddedilir.
    if (isWeakParentPin(pin) || needsNewParentPin(hashParentPin(pin))) {
      setError('Bu PIN kolay tahmin edilir (1111, 1234 gibi). Başka 4 rakam seçin.');
      return;
    }
    void run(async () => {
      const pinHash = hashParentPin(pin);
      if (pinMode === 'claim') {
        await setFamilyPinHash(pendingCode, pinHash);
        await finish(pendingCode);
        return;
      }
      const local = getLocalFamilyData();
      const code = await createFamily({ ...local, parentConfig: { ...local.parentConfig, pinHash } });
      setCreatedCode(code);
      setPhase('created');
    });
  };

  const handleManualInvite = (event: React.FormEvent) => {
    event.preventDefault();
    const code = parseInvite(manualInvite);
    if (code.length < 8) { setError('Davet bağlantısını veya aile kodunu yapıştırın.'); return; }
    void run(() => joinFamily(code));
  };

  const handleSignOut = () => void run(async () => {
    await signOutAdult();
    setPhase('login');
  });

  const errorBox = error && <p className="ag-msg err" role="alert">{error}</p>;

  return (
    <main className="ag">
      <div className="ag-wrap">
        <header className="ag-brand">
          <span className="ag-logo" aria-hidden="true">🚂</span>
          <span><small>RÜZGAR’IN</small><b>Görev Treni</b></span>
          {usesEmulators && <span className="ag-tag">Yerel test</span>}
        </header>

        <section className="ag-card">
          {(phase === 'checking' || phase === 'resolving') && (
            <div className="ag-center" role="status">
              <span className="ag-spin" aria-hidden="true" />
              {phase === 'checking' ? 'Açılıyor…' : 'Aile bilgisi yükleniyor…'}
            </div>
          )}

          {phase === 'login' && (
            <form onSubmit={handleLogin} noValidate style={{ display: 'contents' }}>
              <h1>{inviteCode ? 'Aileye katılın' : 'Ebeveyn girişi'}</h1>
              <p className="ag-sub">Bu cihaz bir kez yetişkin hesabıyla açılır. Sonra Rüzgar oyunu doğrudan açar; ebeveyn işlemleri aile PIN’i ister.</p>
              <div className="ag-field">
                <label htmlFor="ag-email">E-posta adresi</label>
                <input id="ag-email" className="ag-input" type="email" inputMode="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@aile.com" />
              </div>
              <div className="ag-field">
                <label htmlFor="ag-password">Şifre</label>
                <div className="ag-pw">
                  <input id="ag-password" className="ag-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
                  <button type="button" className="ag-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>{showPassword ? 'Gizle' : 'Göster'}</button>
                </div>
              </div>
              {errorBox}
              {notice && <p className="ag-msg ok" role="status">{notice}</p>}
              <button type="submit" className="ag-btn" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
              <button type="button" className="ag-link" onClick={handleReset} disabled={busy}>Şifremi unuttum</button>
            </form>
          )}

          {phase === 'no-family' && (
            <>
              <h1>Aileye bağlanın</h1>
              <p className="ag-sub">{authUser?.email} hesabı henüz bir aileye bağlı değil.</p>
              <button type="button" className="ag-btn" onClick={() => { setError(''); setPinMode('create'); setPhase('pin'); }}>Yeni aile kur</button>
              <form onSubmit={handleManualInvite} className="ag-box" noValidate>
                <label htmlFor="ag-invite" style={{ fontWeight: 800 }}>Davet bağlantım var</label>
                <input id="ag-invite" className="ag-input" value={manualInvite} onChange={(event) => setManualInvite(event.target.value)} placeholder="Bağlantıyı veya aile kodunu yapıştırın" />
                <button type="submit" className="ag-btn line" disabled={busy}>Aileye katıl</button>
              </form>
              {errorBox}
              <button type="button" className="ag-link" onClick={handleSignOut}>Farklı hesapla gir</button>
            </>
          )}

          {phase === 'pin' && (
            <form onSubmit={handlePin} noValidate style={{ display: 'contents' }}>
              <h1>{pinMode === 'claim' ? 'Yeni aile PIN’i' : 'Aile PIN’i'}</h1>
              <p className="ag-sub">
                {pinMode === 'claim'
                  ? 'Aile için henüz ortak bir PIN yok ya da eski, herkesin bildiği bir PIN kullanılıyor. Rüzgar’ın bilmediği yeni bir PIN belirleyin.'
                  : 'Görev onayı, ödül ve ayarlar bu PIN ile açılır. Ailedeki tüm cihazlarda aynıdır.'}
              </p>
              <div className="ag-field">
                <label htmlFor="ag-pin">4 haneli PIN</label>
                <input id="ag-pin" className="ag-input pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" />
              </div>
              <div className="ag-field">
                <label htmlFor="ag-pin2">PIN tekrarı</label>
                <input id="ag-pin2" className="ag-input pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={pinAgain} onChange={(event) => setPinAgain(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" />
              </div>
              <p className="ag-note">PIN, hesap şifrenizin yerine geçmez. 1111 veya 1234 gibi kolay PIN’ler kabul edilmez.</p>
              {errorBox}
              <div className="ag-row">
                {pinMode === 'create' && <button type="button" className="ag-btn ghost" onClick={() => { setError(''); setPhase('no-family'); }}>Geri</button>}
                <button type="submit" className="ag-btn" disabled={busy}>{pinMode === 'claim' ? 'PIN’i kaydet' : 'Aileyi kur'}</button>
              </div>
            </form>
          )}

          {phase === 'created' && (
            <>
              <h1>Aile hazır!</h1>
              <p className="ag-sub">Diğer ebeveynlerin telefonuna bu bağlantıyı gönderin. Açtıklarında kendi hesaplarıyla katılırlar.</p>
              <div className="ag-box"><span className="ag-code">{createdCode}</span></div>
              <button type="button" className="ag-btn line" onClick={async () => {
                const link = getFamilyInviteLink(createdCode);
                try { await navigator.clipboard.writeText(link); setCopyMessage('Davet bağlantısı kopyalandı.'); } catch { setCopyMessage(link); }
              }}>Davet bağlantısını kopyala</button>
              {copyMessage && <p className="ag-note" role="status" style={{ wordBreak: 'break-all', textAlign: 'center' }}>{copyMessage}</p>}
              {errorBox}
              <button type="button" className="ag-btn" disabled={busy} onClick={() => void run(() => finish(createdCode))}>Oyuna başla</button>
            </>
          )}

          {phase === 'error' && (
            <>
              <h1>Aileye bağlanılamadı</h1>
              {errorBox}
              <button type="button" className="ag-btn" onClick={() => void resolveFamily()}>Tekrar dene</button>
              <button type="button" className="ag-link" onClick={handleSignOut}>Farklı hesapla gir</button>
            </>
          )}
        </section>
      </div>
    </main>
  );
};
