import React, { useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

interface ParentLoginGateProps {
  onSignIn: () => Promise<void>;
}

/** Oyun, doğrulanmış bir ebeveyn Google hesabı olmadan açılmaz. */
export const ParentLoginGate: React.FC<ParentLoginGateProps> = ({ onSignIn }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError('');
    try {
      await onSignIn();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Google girişi açılamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#071622] via-[#12354a] to-[#2f7533] px-5 flex items-center justify-center text-slate-900">
      <section className="w-full max-w-md rounded-[2rem] border-4 border-sky-300 bg-white p-6 sm:p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-blue-700 text-4xl shadow-lg">🚂</div>
        <p className="font-game text-sm font-black text-sky-700">RÜZGAR'IN</p>
        <h1 className="mt-1 font-game text-3xl font-black text-slate-900">Görev Treni</h1>
        <div className="my-6 rounded-2xl bg-sky-50 p-4 text-left">
          <div className="flex items-center gap-2 font-game text-sm font-black text-sky-900"><ShieldCheck className="h-5 w-5" /> Ebeveyn girişi gerekli</div>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">Görevler, puanlar, tren dünyası ve sesli notlar ailede ortak kalsın diye önce Google hesabınızla giriş yapın.</p>
        </div>
        <button
          type="button"
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 font-game text-base font-black text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white font-sans text-lg font-black text-[#4285F4]">G</span>
          {isSigningIn ? 'Google açılıyor…' : 'Google ile giriş yap'}
        </button>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold leading-relaxed text-rose-700">{error}</p>}
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500"><LockKeyhole className="h-3.5 w-3.5" /> Girişten sonra ebeveyn PIN’iyle işlemlere devam edilir.</p>
      </section>
    </main>
  );
};
