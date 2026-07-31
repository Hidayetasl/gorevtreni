import React, { useState } from 'react';
import { LockKeyhole } from 'lucide-react';

const ACCESS_PINS = new Set(['1234', '0123']);

interface SimpleAccessGateProps {
  onUnlock: () => void;
}

/** Aile için tek, sade giriş kapısı. İnternet ve hesap gerektirmez. */
export const SimpleAccessGate: React.FC<SimpleAccessGateProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const tryUnlock = (value: string) => {
    if (value.length < 4) return;
    if (ACCESS_PINS.has(value)) {
      localStorage.setItem('ruzgar_game_access_v1', 'open');
      onUnlock();
      return;
    }
    setPin('');
    setError('Kod yanlış. Tekrar deneyin.');
  };
  const addDigit = (digit: string) => {
    const next = `${pin}${digit}`.slice(0, 4);
    setPin(next);
    setError('');
    tryUnlock(next);
  };

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
        {error && <p role="alert" className="mb-3 text-sm font-bold text-rose-700">{error}</p>}
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-2.5">
          {['1','2','3','4','5','6','7','8','9'].map((digit) => <button key={digit} type="button" onClick={() => addDigit(digit)} className="min-h-12 rounded-2xl bg-slate-100 font-game text-xl font-black text-slate-800 active:bg-sky-100">{digit}</button>)}
          <button type="button" onClick={() => { setPin(''); setError(''); }} className="min-h-12 rounded-2xl bg-rose-50 font-game text-sm font-bold text-rose-700">Sil</button>
          <button type="button" onClick={() => addDigit('0')} className="min-h-12 rounded-2xl bg-slate-100 font-game text-xl font-black text-slate-800 active:bg-sky-100">0</button>
          <span className="min-h-12 grid place-items-center text-xs font-bold text-slate-400">4 hane</span>
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500"><LockKeyhole className="h-3.5 w-3.5" /> Girişten sonra ebeveyn işlemleri için aynı PIN kullanılır.</p>
      </section>
    </main>
  );
};
