import React, { useState } from 'react';
import { Check, Home, Volume2 } from 'lucide-react';
import type { RoutineTask } from '../../types';
import { playFanfare, playPopSound, speakText, speakTurkishThenEnglish } from '../../utils/audio';
import {
  contentPhrase,
  contentText,
  contentWord,
  readWordLang,
  type ContentWordId,
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

const BREAD_CHOICE_IDS = ['apple', 'bread', 'milk'] as const satisfies readonly ContentWordId[];
const BREAD_CHOICES = BREAD_CHOICE_IDS.map((id) => ({ id, ...contentWord(id) }));
const BREAD = contentWord('bread');
const BREAD_QUESTION = contentPhrase('breadQuestion');
const BREAD_TRY_AGAIN = contentPhrase('breadTryAgain');
const BREAD_CORRECT = contentPhrase('breadCorrect');
const GIVE_BREAD = contentPhrase('giveBread');
const THANK_YOU = contentPhrase('thankYou');

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

  const chooseBread = (choiceId: ContentWordId) => {
    if (choiceId !== 'bread') {
      setFeedback(BREAD_TRY_AGAIN.tr);
      speakText(BREAD_TRY_AGAIN.tr, speechEnabled);
      return;
    }
    setFeedback(BREAD_CORRECT.tr);
    speakText(BREAD_CORRECT.tr, speechEnabled);
    window.setTimeout(advance, 650);
  };

  const completeMission = () => {
    saveMorningTownStep('completed');
    setStep('completed');
    playFanfare(soundEnabled);
    const language = readWordLang();
    if (language === 'en') {
      speakText(THANK_YOU.en, speechEnabled, 0.7, 'en-US', 1.0);
    } else {
      speakTurkishThenEnglish(THANK_YOU.tr, THANK_YOU.en, speechEnabled);
    }
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
          <TownMissionVisual kind="morning" phase="start" />
          <p className="gt-label">FIRIN</p>
          <h1>{BREAD_QUESTION.tr}</h1>
          <button type="button" className="gt-town-listen" onClick={() => speakText(BREAD_QUESTION.tr, speechEnabled)}>
            <Volume2 aria-hidden="true" /> Dinle
          </button>
          <div className="gt-town-choices" aria-label={`${BREAD.en} kelimesinin karşılığını seç`}>
            {BREAD_CHOICES.map((choice) => (
              <button key={choice.id} type="button" onClick={() => chooseBread(choice.id)}>
                <span aria-hidden="true">{choice.emoji}</span>
                <b>{choice.tr}</b>
              </button>
            ))}
          </div>
          {feedback && <p className="gt-town-feedback" role="status">{feedback}</p>}
        </div>
      )}

      {step === 'donkey' && (
        <div className="gt-town-card">
          <TownMissionVisual kind="morning" phase="travel" />
          <p className="gt-label">SIPA</p>
          <h1>Ekmeği Sıpa'ya götür</h1>
          <p>Sıpa fırından gelen ekmeği bekliyor.</p>
          <button type="button" className="gt-big" onClick={completeMission}>{GIVE_BREAD.emoji} {GIVE_BREAD.tr}</button>
        </div>
      )}

      {step === 'completed' && (
        <div className="gt-town-card">
          <TownMissionVisual kind="morning" phase="arrived" />
          <span className="gt-town-check gt-town-check--small" aria-hidden="true"><Check /></span>
          <p className="gt-label">SİNCAP KÖYÜ</p>
          <h1>Görev tamamlandı</h1>
          <p className="gt-town-feedback">{contentText(THANK_YOU, readWordLang())}</p>
          <p>Sıpa ekmeğine kavuştu. Bu kısa köy görevi burada bitti.</p>
          <button type="button" className="gt-big turkuaz" onClick={() => setShowWorld(true)}>
            <Home aria-hidden="true" /> Dünyaya dön
          </button>
        </div>
      )}
    </section>
  );
};
