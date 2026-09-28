import React, { useState } from 'react';
import { Check, Home, Volume2 } from 'lucide-react';
import type { RoutineTask } from '../../types';
import { playFanfare, playPopSound, speakText } from '../../utils/audio';
import bakeryImage from '../../assets/images/urun-scenery-bakery.webp';
import donkeyImage from '../../assets/images/sipa-maskot.webp';
import {
  isMorningTownReady,
  nextMorningTownStep,
  readMorningTownStep,
  saveMorningTownStep,
  type MorningTownStep,
} from '../../domain/town/morningMission';

interface MorningTownMissionProps {
  tasks: RoutineTask[];
  soundEnabled: boolean;
  speechEnabled: boolean;
  children: React.ReactNode;
}

const BREAD_CHOICES = [
  { id: 'apple', emoji: '🍎', label: 'Elma' },
  { id: 'bread', emoji: '🍞', label: 'Ekmek' },
  { id: 'milk', emoji: '🥛', label: 'Süt' },
] as const;

export const MorningTownMission: React.FC<MorningTownMissionProps> = ({
  tasks,
  soundEnabled,
  speechEnabled,
  children,
}) => {
  const ready = isMorningTownReady(tasks);
  const [step, setStep] = useState<MorningTownStep>(() => readMorningTownStep());
  const [feedback, setFeedback] = useState('');
  const [showWorld, setShowWorld] = useState(() => readMorningTownStep() === 'completed');

  if (!ready || showWorld) return <>{children}</>;

  const advance = () => {
    const next = nextMorningTownStep(step);
    saveMorningTownStep(next);
    setStep(next);
    setFeedback('');
    playPopSound(soundEnabled);
  };

  const chooseBread = (choiceId: typeof BREAD_CHOICES[number]['id']) => {
    if (choiceId !== 'bread') {
      setFeedback('Bir daha deneyelim. Bread, ekmek demek.');
      speakText('Bir daha deneyelim. Bread, ekmek demek.', speechEnabled);
      return;
    }
    setFeedback('Evet! Bread, ekmek demek.');
    speakText('Evet! Bread, ekmek demek.', speechEnabled);
    window.setTimeout(advance, 650);
  };

  const completeMission = () => {
    saveMorningTownStep('completed');
    setStep('completed');
    playFanfare(soundEnabled);
    speakText('Görev tamamlandı. Sıpa ekmeğine kavuştu.', speechEnabled);
  };

  return (
    <section className="gt-town" aria-live="polite">
      {step === 'village_started' && (
        <div className="gt-town-card">
          <span className="gt-town-sun" aria-hidden="true">☀️</span>
          <p className="gt-label">SABAH GÖREVLERİ ONAYLANDI</p>
          <h1>Sincap Köyü güne başladı</h1>
          <p>Dişler fırçalandı, yatak toplandı. Şimdi Fırın'a uğrama zamanı.</p>
          <button type="button" className="gt-big turkuaz" onClick={advance}>
            <img src={bakeryImage} alt="" /> Fırın'a git
          </button>
        </div>
      )}

      {step === 'bakery' && (
        <div className="gt-town-card">
          <img className="gt-town-place" src={bakeryImage} alt="Sincap Köyü Fırını" />
          <p className="gt-label">FIRIN</p>
          <h1>Bread hangisi?</h1>
          <button type="button" className="gt-town-listen" onClick={() => speakText('Bread hangisi?', speechEnabled)}>
            <Volume2 aria-hidden="true" /> Dinle
          </button>
          <div className="gt-town-choices" aria-label="Bread kelimesinin karşılığını seç">
            {BREAD_CHOICES.map((choice) => (
              <button key={choice.id} type="button" onClick={() => chooseBread(choice.id)}>
                <span aria-hidden="true">{choice.emoji}</span>
                <b>{choice.label}</b>
              </button>
            ))}
          </div>
          {feedback && <p className="gt-town-feedback" role="status">{feedback}</p>}
        </div>
      )}

      {step === 'donkey' && (
        <div className="gt-town-card">
          <img className="gt-town-donkey" src={donkeyImage} alt="Sıpa" />
          <p className="gt-label">SIPA</p>
          <h1>Ekmeği Sıpa'ya götür</h1>
          <p>Sıpa fırından gelen ekmeği bekliyor.</p>
          <button type="button" className="gt-big" onClick={completeMission}>🍞 Ekmeği ver</button>
        </div>
      )}

      {step === 'completed' && (
        <div className="gt-town-card">
          <span className="gt-town-check" aria-hidden="true"><Check /></span>
          <p className="gt-label">SİNCAP KÖYÜ</p>
          <h1>Görev tamamlandı</h1>
          <p>Sıpa ekmeğine kavuştu. Bu kısa köy görevi burada bitti.</p>
          <button type="button" className="gt-big turkuaz" onClick={() => setShowWorld(true)}>
            <Home aria-hidden="true" /> Dünyaya dön
          </button>
        </div>
      )}
    </section>
  );
};
