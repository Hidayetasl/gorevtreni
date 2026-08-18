import React, { useState } from 'react';
import { DeviceRole } from '../types';

interface DeviceRoleGateProps {
  onSelect: (role: DeviceRole, owner?: string) => void;
}

const VIEWER_OWNERS = ['Baba', 'Anne', 'Anneanne', 'Dede', 'Diğer'];

/**
 * Aile kodu girişinden sonra, bu FİZİKSEL cihazın ne için kullanılacağını
 * sorar: Rüzgar bu telefonda mı oynayacak (görevleri o işaretler), yoksa bu
 * cihaz sadece takip eden/onaylayan bir aile üyesinin mi (izleyici)? Cevap bu
 * cihazda kalıcı kaydedilir; buluta gitmez, sadece etkinlik geçmişinde ve
 * senkronizasyon bilgisinde "hangi cihazdan geldi" etiketlemesi için kullanılır.
 */
export const DeviceRoleGate: React.FC<DeviceRoleGateProps> = ({ onSelect }) => {
  const [pickingOwner, setPickingOwner] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#071622] via-[#12354a] to-[#2f7533] px-5 flex items-center justify-center text-slate-900">
      <section className="w-full max-w-md rounded-[2rem] border-4 border-sky-300 bg-white p-6 sm:p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-blue-700 text-4xl shadow-lg">📱</div>
        <h1 className="font-game text-2xl font-black text-slate-900">Bu Cihaz Ne İçin?</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
          Rüzgar görevlerini bu telefonda mı işaretleyecek, yoksa siz sadece takip mi edeceksiniz?
        </p>

        {!pickingOwner ? (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onSelect('player')}
              className="w-full min-h-14 rounded-2xl bg-sky-600 text-white font-game text-sm font-bold shadow-md flex items-center justify-center gap-2"
            >
              🚂 Rüzgar Bu Telefonda Oynuyor
            </button>
            <button
              type="button"
              onClick={() => setPickingOwner(true)}
              className="w-full min-h-14 rounded-2xl bg-slate-100 text-slate-800 font-game text-sm font-bold shadow-sm flex items-center justify-center gap-2"
            >
              👀 Sadece İzliyorum / Onaylıyorum
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold text-slate-500">Kimsiniz?</p>
            <div className="grid grid-cols-2 gap-2.5">
              {VIEWER_OWNERS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onSelect('viewer', name)}
                  className="min-h-12 rounded-2xl bg-slate-100 font-game text-sm font-bold text-slate-800 active:bg-sky-100"
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPickingOwner(false)}
              className="mt-4 text-xs font-bold text-sky-700 underline decoration-dotted"
            >
              ← Geri
            </button>
          </div>
        )}

        <p className="mt-5 text-[11px] font-semibold text-slate-400">Bu seçim sadece bu cihazda geçerli, istediğiniz zaman Ebeveyn panelinden değiştirebilirsiniz.</p>
      </section>
    </main>
  );
};
