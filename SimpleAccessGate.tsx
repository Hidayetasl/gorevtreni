import React, { useState } from 'react';
import { Baby, Eye, LockKeyhole, Pencil, Plus } from 'lucide-react';
import {
  acceptFamilyInvite,
  createFamilyCode,
  ensureAnonymousAuth,
  familyExists,
  getFamilyCode,
  getFamilyData,
  isCloudConfigured,
  type FamilyData,
} from '../utils/cloudSync';
import { getStoredDeviceRole, hashParentPin, saveDeviceRole, type DeviceRole } from '../utils/storage';

const LOCAL_ACCESS_PIN_KEY = 'ruzgar_game_access_pin_hash_v1';

interface SimpleAccessGateProps {
  /** Bulut açıksa geçerli aile kodunu taşır; kapalıysa hiç çağrılmaz. */
  onUnlock: (familyCode?: string, role?: DeviceRole, familyData?: FamilyData) => void;
}

type GateStatus = 'idle' | 'checking' | 'error';

function getAccessErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (raw.includes('permission-denied') || raw.includes('insufficient permissions')) {
    return 'Bu aileye henüz katılım tamamlanamadı. Kodu ve internet bağlantısını kontrol edin.';
  }
  if (raw.includes('Davet bağlantısı') || raw.includes('aile kaydı')) return raw;
  if (raw.includes('network-request-failed')) return 'Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.';
  return 'Aile bağlantısı kurulamadı. Kodu ve internet bağlantısını kontrol edin.';
}

export const SimpleAccessGate: React.FC<SimpleAccessGateProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [code, setCode] = useState(() => getFamilyCode());
  const [deviceRole, setDeviceRole] = useState<DeviceRole | null>(() => getStoredDeviceRole());
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

  const chooseRole = (role: DeviceRole) => {
    saveDeviceRole(role);
    setDeviceRole(role);
    setErrorMessage('');
    setStatus('idle');
  };

  const completeUnlock = (familyCode?: string, familyData?: FamilyData) => {
    if (familyCode) localStorage.setItem('ruzgar_family_code_v1', familyCode);
    localStorage.setItem('ruzgar_game_access_v1', 'open');
    onUnlock(familyCode, deviceRole || undefined, familyData);
  };

  const handleEnterWithCode = async () => {
    if (normalizedCode.length < 8 || status === 'checking') return;
    if (!deviceRole) {
      setStatus('error');
      setErrorMessage('Önce bu cihazın Ana cihaz mı, Sadece izle mi olduğunu seçin.');
      return;
    }

    setStatus('checking');
    setErrorMessage('');
    try {
      await ensureAnonymousAuth();
      const exists = await familyExists(normalizedCode);
      if (!exists) throw new Error('Bu aile koduyla kayıt bulunamadı. Kodu kontrol edin.');
      await acceptFamilyInvite(normalizedCode);
      const familyData = await getFamilyData(normalizedCode);
      if (!familyData) throw new Error('Aile verisi bulunamadı. Lütfen tekrar deneyin.');
      completeUnlock(normalizedCode, familyData);
    } catch (error) {
      setStatus('error');
      setErrorMessage(getAccessErrorMessage(error));
    }
  };

  const handleCreateFamily = () => {
    if (deviceRole !== 'writer') {
      setStatus('error');
      setErrorMessage('Yeni aileyi oluşturmak için bu cihazı Ana cihaz olarak seçin.');
      return;
    }
    setErrorMessage('');
    setNewFamilyCode(createFamilyCode());
  };

  const handleContinueWithNewFamily = () => {
    if (!newFamilyCode || deviceRole !== 'writer') return;
    completeUnlock(newFamilyCode);
  };

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
          <p className="mt-3 text-sm font-semibold text-slate-600">Bu kodu not edin — diğer cihazlarda yalnızca izleme amacıyla kullanılabilir.</p>
          <div className="my-5 rounded-xl bg-emerald-50 border border-emerald-300 px-3 py-3 text-center font-mono font-black tracking-[0.15em] text-emerald-800 break-all">{newFamilyCode}</div>
          <button type="button" onClick={handleContinueWithNewFamily} className="w-full min-h-12 rounded-2xl bg-emerald-600 text-white font-game text-sm font-bold shadow-md">Ana cihaz olarak oyuna gir 🚂</button>
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
          Aile kodunu girin ve bu cihazın nasıl kullanılacağını seçin. Ana cihaz oyunu yönetir; izleyici cihazlar yalnızca güncel durumu gösterir.
        </p>

        <div className="mt-5 rounded-2xl border border-sky-100 bg-slate-50 p-3 text-left" role="radiogroup" aria-label="Cihaz kullanım modu">
          <p className="mb-2 text-center text-xs font-black uppercase tracking-wide text-slate-500">Bu cihaz nasıl kullanılacak?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" role="radio" aria-checked={deviceRole === 'writer'} onClick={() => chooseRole('writer')} className={`min-h-24 rounded-2xl border-2 px-2 py-3 text-center transition-all active:scale-95 ${deviceRole === 'writer' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-slate-200 bg-white text-slate-600'}`}>
              <Pencil className="mx-auto mb-1 h-6 w-6" />
              <span className="block text-sm font-black">Ana cihaz</span>
              <span className="mt-1 block text-[10px] font-semibold">Görev, onay ve mağaza</span>
            </button>
            <button type="button" role="radio" aria-checked={deviceRole === 'viewer'} onClick={() => chooseRole('viewer')} className={`min-h-24 rounded-2xl border-2 px-2 py-3 text-center transition-all active:scale-95 ${deviceRole === 'viewer' ? 'border-sky-500 bg-sky-50 text-sky-800 shadow-sm' : 'border-slate-200 bg-white text-slate-600'}`}>
              <Eye className="mx-auto mb-1 h-6 w-6" />
              <span className="block text-sm font-black">Sadece izle</span>
              <span className="mt-1 block text-[10px] font-semibold">Salt-okunur durum</span>
            </button>
          </div>
        </div>

        <div className="mt-4 text-left">
          <label className="block text-xs font-black text-slate-600" htmlFor="family-code">Aile giriş kodu</label>
          <input id="family-code" type="text" value={code} onChange={(event) => { setCode(event.target.value); setStatus('idle'); setErrorMessage(''); }} onKeyDown={(event) => { if (event.key === 'Enter') void handleEnterWithCode(); }} placeholder="Aile giriş kodu" maxLength={16} autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono text-lg font-black tracking-[0.15em] text-slate-800 outline-none focus:border-sky-400" />
        </div>

        {status === 'error' && <p role="alert" className="mt-3 text-sm font-bold text-rose-700">{errorMessage}</p>}

        <button type="button" onClick={() => void handleEnterWithCode()} disabled={normalizedCode.length < 8 || status === 'checking'} className="mt-4 w-full min-h-12 rounded-2xl bg-emerald-600 text-white font-game text-sm font-bold shadow-md disabled:opacity-50"><Baby className="mr-1 inline h-4 w-4" />{status === 'checking' ? 'Bağlanıyor…' : 'Aile koduyla devam et'}</button>
        <button type="button" onClick={handleCreateFamily} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-sky-700 underline decoration-dotted"><Plus className="h-3.5 w-3.5" />İlk kurulum mu? Yeni aile oluştur</button>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500"><LockKeyhole className="h-3.5 w-3.5" /> Ebeveyn onayları için PIN paneli ana cihazda korunur.</p>
      </section>
    </main>
  );
};
