import React, { useState } from 'react';
import { ShopItem, ShopCategory, UserProfile } from '../types';
import { playCoinSound, playFanfare, speakText } from '../utils/audio';
import confetti from 'canvas-confetti';
import { ShoppingBag, Check, Sparkles, Gift } from 'lucide-react';

interface ShopViewProps {
  shopItems: ShopItem[];
  user: UserProfile;
  onBuyItem: (itemId: string, price: number) => void;
  onSetActiveTrain: (icon: string) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  onOpenGiftModal: (item: ShopItem) => void;
}

export const ShopView: React.FC<ShopViewProps> = ({
  shopItems,
  user,
  onBuyItem,
  onSetActiveTrain,
  soundEnabled,
  speechEnabled,
  onOpenGiftModal,
}) => {
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('tracks');

  const filteredItems = shopItems.filter((item) => item.category === activeCategory);

  const handleBuy = (item: ShopItem) => {
    if (user.coins < item.price) {
      speakText('Yeterli tren paran yok Rüzgar, görev yaparak kazanabilirsin!', speechEnabled);
      return;
    }

    playCoinSound(soundEnabled);
    playFanfare(soundEnabled);

    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 },
    });

    onBuyItem(item.id, item.price);
    onOpenGiftModal(item);
  };

  return (
    <div className="space-y-4 pb-28">
      {/* View Header matching Screenshot 2 */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <div className="text-[11px] font-black text-sky-400 uppercase tracking-widest">
            PARÇA AL
          </div>
          <h2 className="font-game text-2xl sm:text-3xl font-black text-white">
            Mağaza
          </h2>
        </div>

        {/* Bakiye Badge */}
        <div className="bg-[#091720] border-2 border-amber-500/80 px-4 py-1.5 rounded-full shadow-inner flex items-center gap-2">
          <span className="text-amber-400 font-bold text-xs sm:text-sm font-game">
            Bakiye: {user.coins}
          </span>
          <span className="text-base sm:text-lg">🪙</span>
        </div>
      </div>

      {/* Shop Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setActiveCategory('tracks')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            activeCategory === 'tracks'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <span>🛤️ Raylar</span>
        </button>

        <button
          onClick={() => setActiveCategory('trains')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            activeCategory === 'trains'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <span>🚂 Trenler</span>
        </button>

        <button
          onClick={() => setActiveCategory('wagons')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            activeCategory === 'wagons'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <span>🚃 Vagonlar</span>
        </button>

        <button
          onClick={() => setActiveCategory('scenery')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            activeCategory === 'scenery'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <span>🏙️ Kent & Dekorasyon</span>
        </button>

        <button
          onClick={() => setActiveCategory('rewards')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            activeCategory === 'rewards'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <span>🎁 Gerçek Ödüller</span>
        </button>
      </div>

      {/* Shop Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredItems.map((item) => {
          const canAfford = user.coins >= item.price;
          const isTrainActive = item.type === 'train' && user.activeTrainIcon === item.icon;

          return (
            <div
              key={item.id}
              className={`rounded-3xl p-4 bg-[#15303e] border-2 border-slate-600 transition-all flex flex-col justify-between shadow-lg hover:border-sky-400 text-white ${
                item.unlocked
                  ? 'border-emerald-500/50 bg-[#12313b]'
                  : canAfford
                  ? 'border-amber-500/40'
                  : 'opacity-85'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#254b5e] to-[#0a1820] border-2 border-sky-400/70 flex items-center justify-center text-4xl sm:text-5xl shadow-lg relative game-icon">
                  {item.icon}
                  {item.category === 'rewards' && (
                    <div className="absolute -top-1.5 -left-1.5 bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md border border-white shadow">
                      ÖDÜL
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="bg-gradient-to-r from-amber-950/90 via-[#18291f] to-amber-950/90 border-2 border-amber-400 px-3 py-1 rounded-2xl shadow-lg flex items-center gap-1">
                    <span className="text-base sm:text-xl font-black font-game text-amber-300 drop-shadow-md">{item.price}</span>
                    <span className="text-base">🪙</span>
                  </div>
                  {item.unlocked && <span className="text-[10px] text-emerald-300 font-bold">✓ Envanterde</span>}
                </div>
              </div>

              <div className="my-3">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-game text-white text-base sm:text-lg font-black">
                    {item.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-100 font-medium mt-1 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-800">
                {item.unlocked ? (
                  item.type === 'train' ? (
                    <button
                      onClick={() => onSetActiveTrain(item.icon)}
                      className={`w-full py-2.5 rounded-2xl font-game text-xs font-bold border transition-all ${
                        isTrainActive
                          ? 'bg-emerald-600 text-white border-emerald-400 cursor-default shadow'
                          : 'bg-[#2263df] hover:bg-[#1d57c7] text-white border-blue-400 shadow-md'
                      }`}
                    >
                      {isTrainActive ? 'Kullanımda 🚂' : 'Bu Treni Seç 🚂'}
                    </button>
                  ) : (
                    <div className="bg-emerald-900/40 text-emerald-300 rounded-2xl py-2 px-3 text-xs font-bold flex items-center justify-center gap-1 border border-emerald-600/50">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Envanterinde Mevcut ✅</span>
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => handleBuy(item)}
                    disabled={!canAfford}
                    className={`w-full py-3 rounded-2xl font-game text-sm font-black uppercase tracking-wider transition-all border active:translate-y-0.5 shadow-lg flex items-center justify-center gap-2 ${
                      canAfford
                        ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-amber-950 border-amber-200 hover:brightness-110'
                        : 'bg-slate-800/90 text-slate-400 border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    {canAfford ? (
                      <>
                        <span>Satın Al 🛒</span>
                        <span className="bg-amber-950/20 px-2 py-0.5 rounded-lg border border-amber-800/30 text-amber-950 text-base font-black">
                          {item.price} 🪙
                        </span>
                      </>
                    ) : (
                      <>
                        <span>Eksik Bakiye 🔒</span>
                        <span className="text-amber-400/90 font-black text-xs">
                          ({item.price} 🪙)
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
