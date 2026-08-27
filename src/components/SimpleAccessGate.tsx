import React, { useState } from 'react';
import { Baby, LockKeyhole, LogIn, UserRound } from 'lucide-react';
import {
  acceptFamilyInvite,
  createFamilyCode,
  ensureAnonymousAuth,
  familyExists,
  getFamilyCode,
  isCloudConfigured,
  signInAdult,
  signOutAdult,
} from '../utils/cloudSync';
import { hashParentPin } from '../utils/storage';

const LOCAL_ACCESS_PIN_KEY = 'ruzgar_game_access_pin_hash_v1';

interface SimpleAccessGateProps {
  /** Bulut açıksa geçerli aile kodunu taşır; kapalıysa hiç çağrılmaz. */
  onUnlock: (familyCode?: string) => void;
}

type GateMode = 'adult' | 'child';
type GateStatus = 'idle' | 'checking' | 'error';

function getAuthErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (raw.includes('izinli yetişkin')) return raw;
  if (raw.includes('auth/invalid-credential') || raw.includes('auth/invalid-login-credentials')) {
    return 'E-posta veya şifre hatalı.';
  }
  if (raw.includes('auth/too-many-requests')) {
    return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.';
  }
  if (raw.includes('auth/network-request-failed')) {
    return 'Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.';
  }
  if (raw.includes('Bu aile koduyla kayıt bulunamadı')) return raw;
  return 'Giriş yapılamadı. Bilgileri ve aile kodunu kontrol edin.';
}

/**
 * Aile için giriş kapısı. Yetişkinler sabit Firebase Email/Password
 * hesaplarıyla, çocuk ise kişisel hesap kullanmadan anonim Firebase oturumuyla
 * devam eder. Mevcut yerel PIN fallback'i bulut yapılandırılmadığında korunur.
 */
export const SimpleAccessGate: React.FC<SimpleAccessGateProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [code, setCode] = useState(() => getFamilyCode());
  const [adultEmail, setAdultEmail] = useState('');
  const [adultPassword, setAdultPassword] = useState('');
  const [mode, setMode] = useState<GateMode>('adult');
  const [status, setStatus] = useState<GateStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [newFamilyCode, setNewFamilyCode] = useState('');

  const tryUnlockWithPin = (value: string) => {
    if (value.length < 4) return;
    const savedPinHash = localStorage.getItem(LOCAL_ACCESS_PIN_KEY);
    if (!savedPinHash) {
      localStorage.setItem(LOCAL_ACCESS_PIN_KEY, hashParentPin(value));
      localStorage.setItem('ruzgar_game_access_v1', 'open');
      onUnlock();
      return;
    }
    if (hashParentPin(value) === savedPinHash) {
      localStorage.setItem('ruzgar_game_access_v1', 'open');
      onUnlock();
      return;
    }
    setPin('');
    setPinError('Kod yanlış. Tekrar deneyin.');
  };

  const addDigit = (digit: string) => {
    const next = `${pin}${digit}`.slice(0, 4);
    setPin(next);
    setPinError('');
    tryUnlockWithPin(next);
  };

  const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const storedOrTypedFamilyCode = normalizedCode || getFamilyCode();

  const completeUnlock = (familyCode?: string) => {
    if (familyCode) localStorage.setItem('ruzgar_family_code_v1', familyCode);
    localStorage.setItem('ruzgar_game_access_v1', 'open');
    onUnlock(familyCode);
  };

  const handleAdultSignIn = async () => {
    if (status === 'checking') return;
    if (adultEmail.trim().length === 0 || adultPassword.length === 0) {
      setStatus('error');
      setErrorMessage('E-posta ve şifre zorunludur.');
      return;
    }
    if (storedOrTypedFamilyCode.length < 8) {
      setStatus('error');
      setErrorMessage('Yetişkin girişi için aile kodunu da yazın.');
      return;
    }

    setStatus('checking');
    setErrorMessage('');
    try {
      await signInAdult(adultEmail, adultPassword);
      const exists = await familyExists(storedOrTypedFamilyCode);
      if (!exists) throw new Error('Bu aile koduyla kayıt bulunamadı. Kodu kontrol edin.');
      await acceptFamilyInvite(storedOrTypedFamilyCode);
      completeUnlock(storedOrTypedFamilyCode);
    } catch (error) {
      setStatus('error');
      setErrorMessage(getAuthErrorMessage(error));
    }
  };

  const handleChildContinue = async () => {
    if (status === 'checking') return;
    setStatus('checking');
    setErrorMessage('');
    try {
      let familyCode = storedOrTypedFamilyCode;
      if (isCloudConfigured) {
        // Aynı cihazda daha önce yetişkin oturumu açık kaldıysa çocuk modu
        // kişisel hesap kullanmamalı; önce çıkış yapıp anonim oturum açılır.
        await signOutAdult();
        await ensureAnonymousAuth();
        if (familyCode.length >= 8) {
          const exists = await familyExists(familyCode);
          if (!exists) throw new Error('Bu aile koduyla kayıt bulunamadı. Kodu kontrol edin.');
          await acceptFamilyInvite(familyCode);
        }
      }
      completeUnlock(familyCode || undefined);
    } catch (error) {
      setStatus('error');
      setErrorMessage(getAuthErrorMessage(error));
    }
  };

  const handleEnterWithCode = async () => {
    if (normalizedCode.length < 8 || status === 'checking') return;
    setStatus('checking');
    setErrorMessage('');
    try {
      const exists = await familyExists(normalizedCode);
      if (!exists) throw new Error('Bu aile koduyla kayıt bulunamadı. Kodu kontrol edin.');
      await acceptFamilyInvite(normalizedCode);
      completeUnlock(normalizedCode);
    } catch (error) {
      setStatus('error');
      setErrorMessage(getAuthErrorMessage(error));
    }
  };

  const handleCreateFamily = () => {
    setErrorMessage('');
    setNewFamilyCode(createFamilyCode());
  };

  const handleContinueWithNewFamily = () => completeUnlock(newFamilyCode);

  if (!isCloudConfigured) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#071622] via-[#12354a] to-[#2f7533] px-5 flex items-center justify-center text-slate-900">
        <section className="w-full max-w-md rounded-[2rem] border-4 border-sky-300 bg-white p-6 sm:p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-blue-700 text-4xl shadow-lg">🚂</div>
          <p className="font-game text-sm font-black text-sky-700">RÜZGAR'IN</p>
          <h1 className="mt-1 font-game text-3xl font-black text-slate-900">Görev Treni</h1>
          <p className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm font-semibold leading-relaxed text-slate-600">
            {localStorage.getItem(LOCAL_ACCESS_PIN_KEY) ? 'Oyuna girmek için 4 haneli erişim PIN’inizi yazın.' : 'İlk kullanım için 4 haneli bir erişim PIN’i belirleyin.'}
          </p>
          <div className="my-5 flex justify-center gap-3" aria-label="Giriş kodu">
            {[0, 1, 2, 3].map((index) => <span key={index} className={`h-14 w-12 rounded-2xl border-2 grid place-items-center text-2xl ${pin.length > index ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50'}`}>{pin.length > index ? '●' : ''}</span>)}
          </div>
          {pinError && <p role="alert" className="mb-3 text-sm font-bold text-rose-700">{pinError}</p>}
          <div className="mx-auto grid max-w-xs grid-cols-3 gap-2.5">
            {['1','2','3','4','5','6','7','8','9'].map((digit) => <button key={digit} type="button" onClick={() => addDigit(digit)} className="min-h-12 rounded-2xl bg-slate-100 font-game text-xl font-black text-slate-800 active:bg-sky-100">{digit}</button>)}
            <button type="button" onClick={() => { setPin(''); setPinError(''); }} className="min-h-12 rounded-2xl bg-rose-50 font-game text-sm font-bold text-rose-700">Sil</button>
            <button type="button" onClick={() => addDigit('0')} className="min-h-12 rounded-2xl bg-slate-100 font-game text-xl font-black text-slate-800 active:bg-sky-100">0</button>
            <span className="min-h-12 grid place-items-center text-xs font-bold text-slate-400">4 hane</span>
          </div>
        </section>
      </main>
    );
  }

  if (newFamilyCode) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#071622] via-[#12354a] to-[#2f7533] px-5 flex items-center justify-center text-slate-900">
        <section className="w-full max-w-md rounded-[2rem] border-4 border-emerald-300 bg-white p-6 sm:p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 text-4xl shadow-lg">✨</div>
          <h1 className="font-game text-xl font-black text-slate-900">Yeni Aile Kodu Oluşturuldu</h1>
          <p className="mt-3 text-sm font-semibold text-slate-600">Bu kodu not edin — diğer telefonlarda oyuna girerken bu kod yazılacak.</p>
          <div className="my-5 rounded-xl bg-emerald-50 border border-emerald-300 px-3 py-3 text-center font-mono font-black tracking-[0.15em] text-emerald-800 break-all">{newFamilyCode}</div>
          <button type="button" onClick={handleContinueWithNewFamily} className="w-full min-h-12 rounded-2xl bg-emerald-600 text-white font-game text-sm font-bold shadow-md">Oyuna Gir 🚂</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#071622] via-[#12354a] to-[#2f7533] px-5 flex items-center justify-center text-slate-900">
      <section className="w-full max-w-md rounded-[2rem] border-4 border-sky-300 bg-white p-6 sm:p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-blue-700 text-4xl shadow-lg">🚂</div>
        <p className="font-game text-sm font-black text-sky-700">RÜZGAR'IN</p>
        <h1 className="mt-1 font-game text-3xl font-black text-slate-900">Görev Treni</h1>
        <p className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm font-semibold leading-relaxed text-slate-600">
          Yetişkinler kendi hesaplarıyla giriş yapabilir; Rüzgar’ın cihazı kişisel hesap olmadan devam edebilir.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5" role="tablist" aria-label="Giriş türü">
          <button type="button" role="tab" aria-selected={mode === 'adult'} onClick={() => { setMode('adult'); setStatus('idle'); setErrorMessage(''); }} className={`min-h-11 rounded-xl px-2 text-xs font-black transition-all active:scale-95 ${mode === 'adult' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`}><UserRound className="mr-1 inline h-4 w-4" />Yetişkin girişi</button>
          <button type="button" role="tab" aria-selected={mode === 'child'} onClick={() => { setMode('child'); setStatus('idle'); setErrorMessage(''); }} className={`min-h-11 rounded-xl px-2 text-xs font-black transition-all active:scale-95 ${mode === 'child' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}><Baby className="mr-1 inline h-4 w-4" />Çocuk olarak devam</button>
        </div>

        {mode === 'adult' && (
          <div className="mt-4 space-y-3 text-left">
            <label className="block text-xs font-black text-slate-600" htmlFor="adult-email">Yetişkin e-posta adresi</label>
            <input id="adult-email" type="email" value={adultEmail} onChange={(event) => { setAdultEmail(event.target.value); setStatus('idle'); setErrorMessage(''); }} autoComplete="username" placeholder="ornek@aile.com" className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400" />
            <label className="block text-xs font-black text-slate-600" htmlFor="adult-password">Şifre</label>
            <input id="adult-password" type="password" value={adultPassword} onChange={(event) => { setAdultPassword(event.target.value); setStatus('idle'); setErrorMessage(''); }} onKeyDown={(event) => { if (event.key === 'Enter') void handleAdultSignIn(); }} autoComplete="current-password" placeholder="••••••••" className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400" />
          </div>
        )}

        <div className="mt-4 text-left">
          <label className="block text-xs font-black text-slate-600" htmlFor="family-code">Aile giriş kodu</label>
          <input id="family-code" type="text" value={code} onChange={(event) => { setCode(event.target.value); setStatus('idle'); setErrorMessage(''); }} onKeyDown={(event) => { if (event.key === 'Enter') void (mode === 'adult' ? handleAdultSignIn() : handleEnterWithCode()); }} placeholder="Aile giriş kodu" maxLength={16} autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono text-lg font-black tracking-[0.15em] text-slate-800 outline-none focus:border-sky-400" />
        </div>

        {status === 'error' && <p role="alert" className="mt-3 text-sm font-bold text-rose-700">{errorMessage}</p>}

        {mode === 'adult' ? (
          <button type="button" onClick={() => void handleAdultSignIn()} disabled={status === 'checking'} className="mt-4 w-full min-h-12 rounded-2xl bg-sky-600 text-white font-game text-sm font-bold shadow-md disabled:opacity-50"><LogIn className="mr-1 inline h-4 w-4" />{status === 'checking' ? 'Giriş yapılıyor…' : 'Yetişkin olarak giriş yap'}</button>
        ) : (
          <>
            <button type="button" onClick={() => void handleChildContinue()} disabled={status === 'checking'} className="mt-4 w-full min-h-12 rounded-2xl bg-emerald-600 text-white font-game text-sm font-bold shadow-md disabled:opacity-50"><Baby className="mr-1 inline h-4 w-4" />{status === 'checking' ? 'Hazırlanıyor…' : 'Çocuk olarak devam et'}</button>
            <button type="button" onClick={() => void handleEnterWithCode()} disabled={normalizedCode.length < 8 || status === 'checking'} className="mt-2 w-full min-h-11 rounded-2xl bg-sky-50 text-sky-700 font-game text-xs font-bold border border-sky-200 disabled:opacity-50">Aile koduyla devam et</button>
          </>
        )}

        <button type="button" onClick={handleCreateFamily} className="mt-4 text-xs font-bold text-sky-700 underline decoration-dotted">İlk kurulum mu yapıyorsunuz? Yeni aile oluştur</button>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500"><LockKeyhole className="h-3.5 w-3.5" /> Ebeveyn onayları için mevcut PIN paneli korunur.</p>
      </section>
    </main>
  );
};
