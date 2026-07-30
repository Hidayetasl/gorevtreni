import React from 'react';
import { BonusCard } from '../types';
import { playCoinSound, playFanfare, speakText } from '../utils/audio';
import confetti from 'canvas-confetti';
import { Sparkles, Gift } from 'lucide-react';

interface BonusModalProps {
  bonus: BonusCard | null;
  onClaim: (bonusId: string, coins: number) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
}

export const BonusModal: React.FC<BonusModalProps> = ({
  bonus,
  onClaim,
  soundEnabled,
  speechEnabled,
}) => {
  if (!bonus) return null;

  const handleClaim = () => {
    playCoinSound(soundEnabled);
    playFanfare(soundEnabled);

    confetti({
      particleCount: 80,
      spread: 90,
      origin: { y: 0.5 },
    });

    speakText(`Tebrikler Rüzgar! Ekstra ${bonus.coins} Tren Parası kazandın!`, speechEnabled);
    onClaim(bonus.id, bonus.coins);
  };

  return (
    <div className="fixed inset-0 z-50 bg-purple-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-gradient-to-b from-purple-500 via-pink-500 to-rose-500 text-white rounded-3xl max-w-sm w-full p-6 text-center border-4 border-yellow-300 shadow-2xl relative overflow-hidden space-y-4">
        <div className="absolute top-2 right-2 text-3xl animate-spin">✨</div>

        <div className="w-20 h-20 bg-yellow-400 rounded-full mx-auto flex items-center justify-center text-5xl shadow-xl border-4 border-white animate-pulse">
          {bonus.icon || '🎁'}
        </div>

        <div className="space-y-1">
          <span className="bg-yellow-300 text-purple-950 text-xs font-bold px-3 py-1 rounded-full uppercase font-game">
            Ebeveynden Sürpriz Hediye!
          </span>
          <h2 className="font-game text-xl sm:text-2xl font-extrabold text-white drop-shadow-md">
            {bonus.title}
          </h2>
        </div>

        <p className="text-xs sm:text-sm font-bold text-purple-100 bg-black/20 p-3 rounded-2xl border border-white/20">
          "{bonus.message}"
        </p>

        <div className="bg-yellow-400 text-yellow-950 rounded-2xl p-2.5 font-game text-lg font-bold flex items-center justify-center gap-2 border-b-4 border-yellow-600 shadow-md">
          <span>Ödül:</span>
          <span className="text-2xl">+{bonus.coins} 🪙</span>
        </div>

        <button
          onClick={handleClaim}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-game text-lg font-extrabold rounded-2xl border-b-4 border-teal-700 shadow-xl hover:brightness-110 active:scale-95 uppercase tracking-wider transition-all"
        >
          HEDİYEMİ AL! 🎁
        </button>
      </div>
    </div>
  );
};
