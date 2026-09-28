import React, { useState } from 'react';
import { Home, Volume2 } from 'lucide-react';
import type { RoutineTask } from '../../types';
import { playFanfare, playPopSound, speakText } from '../../utils/audio';
import schoolImage from '../../assets/images/urun-scenery-school.webp';
import { TownMissionVisual } from '../TrainWorldView';
import { isSelectedAfternoonTownScenario } from '../../domain/town/afternoonScenario';
import {
  isAfternoonTownReady,
  nextAfternoonTownStep,
  readAfternoonTownStep,
  saveAfternoonTownStep,
  type AfternoonTownStep,
} from '../../domain/town/afternoonMission';

interface AfternoonTownMissionProps {
  tasks: RoutineTask[];
  soundEnabled: boolean;
  speechEnabled: boolean;
  children: React.ReactNode;
}

const SCHOOL_CHOICES = [
  { id: 'bakery', emoji: '🍞', label: 'Fırın' },
  { id: 'school', emoji: '🏫', label: 'Okul' },
  { id: 'park', emoji: '🌳', label: 'Park' },
] as const;

export const AfternoonTownMission: React.FC<AfternoonTownMissionProps> = ({
  tasks,
  soundEnabled,
  speechEnabled,
  children,
}) => {
  const selected = isSelectedAfternoonTownScenario('school');
  const ready = isAfternoonTownReady(tasks);
  const [step, setStep] = useState<AfternoonTownStep>(() => readAfternoonTownStep());
  const [feedback, setFeedback] = useState('');
  const [showWorld, setShowWorld] = useState(() => readAfternoonTownStep() === 'completed');

  if (!selected || !ready || showWorld) return <>{children}</>;

  const advance = () => {
    const next = nextAfternoonTownStep(step);
    saveAfternoonTownStep(next);
    setStep(next);
    setFeedback('');
    playPopSound(soundEnabled);
  };

  const chooseSchool = (choiceId: typeof SCHOOL_CHOICES[number]['id']) => {
    if (choiceId !== 'school') {
      setFeedback('Bir daha dene.');
      speakText('Bir daha dene.', speechEnabled);
      return;
    }
    setFeedback('Doğru!');
    speakText('Doğru!', speechEnabled);
    window.setTimeout(advance, 650);
  };

  const completeMission = () => {
    saveAfternoonTownStep('completed');
    setStep('completed');
    setShowWorld(true);
    playFanfare(soundEnabled);
    speakText('Sincap okula ulaştı.', speechEnabled);
  };

  return (
    <section className="gt-town" aria-live="polite">
      {step === 'wants_school' && (
        <div className="gt-town-card">
          <span className="gt-town-sun" aria-hidden="true">🐿️</span>
          <p className="gt-label">ÖĞLE GÖREVLERİ ONAYLANDI</p>
          <h1>Sincap okula gitmek istiyor</h1>
          <p>Kısa bir okul yolculuğuna hazır.</p>
          <button type="button" className="gt-big turkuaz" onClick={advance}>
            <img src={schoolImage} alt="" /> Okula git
          </button>
        </div>
      )}

      {step === 'school' && (
        <div className="gt-town-card">
          <TownMissionVisual kind="school" phase="travel" />
          <p className="gt-label">OKUL</p>
          <h1>School ne demek?</h1>
          <button type="button" className="gt-town-listen" onClick={() => speakText('School ne demek?', speechEnabled)}>
            <Volume2 aria-hidden="true" /> Dinle
          </button>
          <div className="gt-town-choices" aria-label="School kelimesinin karşılığını seç">
            {SCHOOL_CHOICES.map((choice) => (
              <button key={choice.id} type="button" onClick={() => chooseSchool(choice.id)}>
                <span aria-hidden="true">{choice.emoji}</span>
                <b>{choice.label}</b>
              </button>
            ))}
          </div>
          {feedback && <p className="gt-town-feedback" role="status">{feedback}</p>}
        </div>
      )}

      {step === 'arrived' && (
        <div className="gt-town-card">
          <TownMissionVisual kind="school" phase="arrived" />
          <p className="gt-label">OKUL</p>
          <h1>Sincap okula ulaştı</h1>
          <p>Bugünkü kısa okul yolculuğu burada bitti.</p>
          <button type="button" className="gt-big turkuaz" onClick={completeMission}>
            <Home aria-hidden="true" /> Kasabaya dön
          </button>
        </div>
      )}
    </section>
  );
};
