import React from 'react';
import { ShopItem } from '../types';
import { playFanfare, speakText } from '../utils/audio';
import confetti from 'canvas-confetti';
import { Sparkles, Check } from 'lucide-react';

interface RewardClaimModalProps {
  item: ShopItem | null;
  onClose: () => void;
  speechEnabled: boolean;
}

export const RewardClaimModal: React.FC<RewardClaimModalProps> = ({
  item,
  onClose,
  speechEnabled,
}) => {
  if (!item) return null;

  const handleClose = () => {
    speakText('Harika seçim! Şimdi Tren Dünyana gidip yerleştirebilirsin.', speechEnabled);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-600 text-white rounded-3xl max-w-sm w-full p-6 text-center border-4 border-yellow-300 shadow-2xl space-y-4 relative">
        <div className="w-24 h-24 bg-yellow-300 rounded-3xl mx-auto flex items-center justify-center text-6xl shadow-2xl border-4 border-white">
          {item.icon}
        </div>

        <div className="space-y-1">
          <span className="bg-emerald-400 text-emerald-950 text-xs font-bold px-3 py-1 rounded-full uppercase font-game">
            YENİ OYUNCAK AÇILDI! 🎁
          </span>
          <h2 className="font-game text-xl sm:text-2xl font-extrabold text-white drop-shadow">
            {item.name}
          </h2>
        </div>

        <p className="text-xs text-sky-100 font-bold bg-white/10 p-3 rounded-2xl border border-white/20">
          {item.description}
        </p>

        <button
          onClick={handleClose}
          className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-yellow-950 font-game text-base font-extrabold rounded-2xl border-b-4 border-yellow-600 shadow-xl uppercase tracking-wider transition-all active:scale-95"
        >
          HARİKA! ENVANTERE EKLE ✨
        </button>
      </div>
    </div>
  );
};
