import React, { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { RoutineTask } from '../../types';
import { playFanfare, playPopSound, speakText, speakTurkishThenEnglish } from '../../utils/audio';
import {
  contentPhrase,
  contentText,
  readWordLang,
} from '../../utils/sceneWords';
import bakeryImage from '../../assets/images/urun-scenery-bakery.webp';
import { TownMissionVisual } from '../TrainWorldView';
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

const BREAD_QUESTION = contentPhrase('breadQuestion');
const THANK_YOU = contentPhrase('thankYou');

export const MorningTownMission: React.FC<MorningTownMissionProps> = ({
  tasks,
  soundEnabled,
  speechEnabled,
  children,
}) => {
  const ready = isMorningTownReady(tasks);
  const [step, setStep] = useState<MorningTownStep>(() => readMorningTownStep());
  const [visualPhase, setVisualPhase] = useState<'start' | 'travel' | 'arrived' | 'return'>(() => (
    readMorningTownStep() === 'donkey' ? 'travel' : 'start'
  ));
  const [showWorld, setShowWorld] = useState(() => readMorningTownStep() === 'completed');
  const thankedRef = useRef(false);

  const advance = () => {
    const next = nextMorningTownStep(step);
    saveMorningTownStep(next);
    setStep(next);
    playPopSound(soundEnabled);
  };

  const chooseBread = () => {
    if (step !== 'bakery') return;
    saveMorningTownStep('donkey');
    setStep('donkey');
    setVisualPhase('travel');
    playPopSound(soundEnabled);
  };

  useEffect(() => {
    if (!ready || step !== 'donkey') return;

    if (visualPhase === 'travel') {
      const timer = window.setTimeout(() => setVisualPhase('arrived'), 900);
      return () => window.clearTimeout(timer);
    }

    if (visualPhase === 'arrived') {
      if (!thankedRef.current) {
        thankedRef.current = true;
        const language = readWordLang();
        if (language === 'en') {
          speakText(THANK_YOU.en, speechEnabled, 0.7, 'en-US', 1.0);
        } else {
          speakTurkishThenEnglish(THANK_YOU.tr, THANK_YOU.en, speechEnabled);
        }
      }
      const timer = window.setTimeout(() => setVisualPhase('return'), 1200);
      return () => window.clearTimeout(timer);
    }

    if (visualPhase === 'return') {
      const timer = window.setTimeout(() => {
        saveMorningTownStep('completed');
        setStep('completed');
        playFanfare(soundEnabled);
        setShowWorld(true);
      }, 900);
      return () => window.clearTimeout(timer);
    }
  }, [ready, soundEnabled, speechEnabled, step, visualPhase]);

  if (!ready || showWorld) return <>{children}</>;

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
          <TownMissionVisual kind="morning" phase="start" onBreadClick={chooseBread} />
          <p className="gt-label">FIRIN</p>
          <h1>{BREAD_QUESTION.tr}</h1>
          <button type="button" className="gt-town-listen" onClick={() => speakText(BREAD_QUESTION.tr, speechEnabled)}>
            <Volume2 aria-hidden="true" /> Dinle
          </button>
          <p>Fırının üstündeki ekmeğe dokun.</p>
        </div>
      )}

      {step === 'donkey' && (
        <div className="gt-town-card">
          <TownMissionVisual kind="morning" phase={visualPhase} />
          <p className="gt-label">SIPA</p>
          <h1>{visualPhase === 'return'
            ? 'Sıpa yerine dönüyor'
            : visualPhase === 'arrived'
              ? 'Sıpa teşekkür ediyor'
              : 'Sıpa ekmeği almaya geliyor'}</h1>
          {visualPhase === 'arrived' && (
            <p className="gt-town-feedback" role="status">{contentText(THANK_YOU, readWordLang())}</p>
          )}
        </div>
      )}
    </section>
  );
};
