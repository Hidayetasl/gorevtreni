import React, { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { createFamilyCode, familyExists, isCloudConfigured } from '../utils/cloudSync';

const ACCESS_PINS = new Set(['1234', '0123']);

interface SimpleAccessGateProps {
  /** Bulut açıksa geçerli aile kodunu taşır; kapalıysa hiç çağrılmaz. */
  onUnlock: (familyCode?: string) => void;
}

/**
 * Aile için tek giriş kapısı. Bulut (Firebase) yapılandırılmışsa giriş kodu
 * doğrudan aile kodudur: doğru kod hem oyunu açar hem bu cihazı aynı aile
 * verisine bağlar — ayrıca Ebeveyn panelinde "eşleşme" adımına gerek kalmaz.
 * Bulut yapılandırılmamışsa (ör. yerel geliştirme ortamı) eski sabit PIN'e
 * geri düşülür ki uygulama hiçbir zaman tamamen kilitli kalmasın.
 */
export const SimpleAccessGate: React.FC<SimpleAccessGateProps> = ({ onUnlock }) => {
  // Bulut kapalıyken eski davranış: sabit 4 haneli PIN.
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Bulut açıkken: giriş kodu = aile kodu.
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [newFamilyCode, setNewFamilyCode] = useState('');

  const tryUnlockWithPin = (value: string) => {
    if (value.length < 4) return;
    if (ACCESS_PINS.has(value)) {
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

  const handleEnter = async () => {
    if (normalizedCode.length < 8 || status === 'checking') return;
    setStatus('checking');
    setErrorMessage('');
    try {
      const exists = await familyExists(normalizedCode);
      if (!exists) {
        setStatus('error');
        setErrorMessage('Bu aile koduyla kayıt bulunamadı. Kodu kontrol edin.');
        return;
      }
      localStorage.setItem('ruzgar_game_access_v1', 'open');
      onUnlock(normalizedCode);
    } catch {
      setStatus('error');
      setErrorMessage('Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.');
    }
  };

  const handleCreateFamily = () => {
    setErrorMessage('');
    setNewFamilyCode(createFamilyCode());
  };

  const handleContinueWithNewFamily = () => {
    localStorage.setItem('ruzgar_game_access_v1', 'open');
    onUnlock(newFamilyCode);
  };

  // Bulut yapılandırılmamışsa: eski sabit PIN davranışı, hiç değiştirilmedi.
  if (!isCloudConfigured) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#071622] via-[#12354a] to-[#2f7533] px-5 flex items-center justify-center text-slate-900">
        <section className="w-full max-w-md rounded-[2rem] border-4 border-sky-300 bg-white p-6 sm:p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-blue-700 text-4xl shadow-lg">🚂</div>
          <p className="font-game text-sm font-black text-sky-700">RÜZGAR'IN</p>
          <h1 className="mt-1 font-game text-3xl font-black text-slate-900">Görev Treni</h1>
          <p className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm font-semibold leading-relaxed text-slate-600">Oyuna girmek için aile giriş kodunu yazın.</p>
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

  // Yeni aile oluşturulduysa: kodu bir kez göster, sonra oyuna gir.
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
        <p className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm font-semibold leading-relaxed text-slate-600">Oyuna girmek için aile giriş kodunu yazın.</p>

        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setStatus('idle'); setErrorMessage(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleEnter(); }}
          placeholder="Aile giriş kodu"
          maxLength={16}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="mt-5 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono text-lg font-black tracking-[0.15em] text-slate-800 outline-none focus:border-sky-400"
        />

        {status === 'error' && <p role="alert" className="mt-3 text-sm font-bold text-rose-700">{errorMessage}</p>}

        <button
          type="button"
          onClick={handleEnter}
          disabled={normalizedCode.length < 8 || status === 'checking'}
          className="mt-4 w-full min-h-12 rounded-2xl bg-sky-600 text-white font-game text-sm font-bold shadow-md disabled:opacity-50"
        >
          {status === 'checking' ? 'Kontrol ediliyor…' : 'Oyuna Gir 🚂'}
        </button>

        <button
          type="button"
          onClick={handleCreateFamily}
          className="mt-3 text-xs font-bold text-sky-700 underline decoration-dotted"
        >
          İlk kurulum mu yapıyorsunuz? Yeni aile oluştur
        </button>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500"><LockKeyhole className="h-3.5 w-3.5" /> Girişten sonra ebeveyn işlemleri için ayrıca PIN belirlenir.</p>
      </section>
    </main>
  );
};
