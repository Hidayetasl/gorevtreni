import React from 'react';
import { BonusCard } from '../types';
import { playCoinSound, playFanfare, speakText } from '../utils/audio';
import confetti from 'canvas-confetti';
import { Gift } from 'lucide-react';

interface BonusModalProps {
  bonus: BonusCard | null;
  onClaim: (bonusId: string, coins: number) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
}

/** Ebeveynin gönderdiği sürpriz hediye kartı: çocuk açınca puan onun olur. */
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
    confetti({ particleCount: 90, spread: 90, origin: { y: 0.55 }, colors: ['#16A34A', '#0E9AA7', '#F59E0B', '#2563EB', '#7C3AED'] });
    speakText(`Tebrikler Rüzgar! ${bonus.coins} puan kazandın!`, speechEnabled);
    onClaim(bonus.id, bonus.coins);
  };

  return (
    <div className="gt-sheet-wrap gt-center" role="dialog" aria-modal="true" aria-labelledby="bonus-title">
      <div className="gt-sheet-bg" aria-hidden="true" />
      <div className="gt-sheet gt-gift">
        <span className="gt-sheet-tag">💜 Sana bir sürpriz var!</span>
        <span className="gt-gift-box" aria-hidden="true">{bonus.icon || '🎁'}</span>
        <h2 id="bonus-title">{bonus.title}</h2>
        {bonus.message && <p className="gt-gift-note">“{bonus.message}”</p>}
        <p className="gt-sheet-price"><span className="gt-coin-dot" aria-hidden="true" /><b>+{bonus.coins}</b> puan</p>
        <button type="button" className="gt-big" onClick={handleClaim}><Gift aria-hidden="true" />Hediyemi aç!</button>
      </div>
    </div>
  );
};
