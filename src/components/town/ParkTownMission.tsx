import React, { useState } from 'react';
import { Home, Volume2 } from 'lucide-react';
import type { RoutineTask } from '../../types';
import { playFanfare, playPopSound, speakText } from '../../utils/audio';
import parkImage from '../../assets/images/park.webp';
import { TownMissionVisual } from '../TrainWorldView';
import { isSelectedAfternoonTownScenario } from '../../domain/town/afternoonScenario';
import {
  isParkTownReady,
  nextParkTownStep,
  readParkTownStep,
  saveParkTownStep,
  type ParkTownStep,
} from '../../domain/town/parkMission';

interface ParkTownMissionProps {
  tasks: RoutineTask[];
  soundEnabled: boolean;
  speechEnabled: boolean;
  children: React.ReactNode;
}

const BALL_CHOICES = [
  { id: 'red', emoji: '🔴', label: 'Kırmızı top' },
  { id: 'green', emoji: '🟢', label: 'Yeşil top' },
  { id: 'blue', emoji: '🔵', label: 'Mavi top' },
] as const;

export const ParkTownMission: React.FC<ParkTownMissionProps> = ({
  tasks,
  soundEnabled,
  speechEnabled,
  children,
}) => {
  const selected = isSelectedAfternoonTownScenario('park');
  const ready = isParkTownReady(tasks);
  const [step, setStep] = useState<ParkTownStep>(() => readParkTownStep());
  const [feedback, setFeedback] = useState('');
  const [showWorld, setShowWorld] = useState(() => readParkTownStep() === 'completed');

  if (!selected || !ready || showWorld) return <>{children}</>;

  const advance = () => {
    const next = nextParkTownStep(step);
    saveParkTownStep(next);
    setStep(next);
    setFeedback('');
    playPopSound(soundEnabled);
  };

  const chooseGreenBall = (choiceId: typeof BALL_CHOICES[number]['id']) => {
    if (choiceId !== 'green') {
      setFeedback('Bir daha dene.');
      speakText('Bir daha dene.', speechEnabled);
      return;
    }
    setFeedback('Doğru! Green, yeşil demek.');
    speakText('Doğru! Green, yeşil demek.', speechEnabled);
    window.setTimeout(advance, 650);
  };

  const completeMission = () => {
    saveParkTownStep('completed');
    setStep('completed');
    setShowWorld(true);
    playFanfare(soundEnabled);
    speakText('Sıpa parkta oynadı.', speechEnabled);
  };

  return (
    <section className="gt-town" aria-live="polite">
      {step === 'wants_move' && (
        <div className="gt-town-card">
          <span className="gt-town-sun" aria-hidden="true">🫏</span>
          <p className="gt-label">ÖĞLE GÖREVLERİ ONAYLANDI</p>
          <h1>Sıpa biraz hareket etmek istiyor</h1>
          <p>Parkta kısa bir oyun zamanı.</p>
          <button type="button" className="gt-big turkuaz" onClick={advance}>
            <img src={parkImage} alt="" /> Parka git
          </button>
        </div>
      )}

      {step === 'park' && (
        <div className="gt-town-card">
          <TownMissionVisual kind="park" phase="travel" />
          <p className="gt-label">PARK</p>
          <h1>Green hangisi?</h1>
          <button type="button" className="gt-town-listen" onClick={() => speakText('Green hangisi?', speechEnabled)}>
            <Volume2 aria-hidden="true" /> Dinle
          </button>
          <div className="gt-town-choices" aria-label="Green rengindeki topu seç">
            {BALL_CHOICES.map((choice) => (
              <button key={choice.id} type="button" onClick={() => chooseGreenBall(choice.id)}>
                <span aria-hidden="true">{choice.emoji}</span>
                <b>{choice.label}</b>
              </button>
            ))}
          </div>
          {feedback && <p className="gt-town-feedback" role="status">{feedback}</p>}
        </div>
      )}

      {step === 'played' && (
        <div className="gt-town-card">
          <TownMissionVisual kind="park" phase="arrived" />
          <p className="gt-label">PARK</p>
          <h1>Sıpa parkta oynadı</h1>
          <p>Bugünkü kısa park oyunu burada bitti.</p>
          <button type="button" className="gt-big turkuaz" onClick={completeMission}>
            <Home aria-hidden="true" /> Kasabaya dön
          </button>
        </div>
      )}
    </section>
  );
};
