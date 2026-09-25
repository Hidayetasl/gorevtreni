import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, Hand, LayoutGrid, Mic, TrainFront, Volume2 } from 'lucide-react';
import type { AdultName, RoutineTask, TimeOfDay } from '../../types';
import { withGenitive } from '../../utils/turkish';
import { playFanfare, playPopSound, speakText } from '../../utils/audio';

type Station = TimeOfDay | 'all';

interface TasksHomeProps {
  tasks: RoutineTask[];
  onMarkTaskDone: (taskId: string) => void;
  onOpenJournal: () => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  /** Rüzgar şu an kimin yanında (aktif cihazı seçen yetişkin). */
  caregiver?: AdultName | null;
}

const STATIONS: Array<{ key: TimeOfDay; name: string; emoji: string }> = [
  { key: 'morning', name: 'Sabah', emoji: '🌅' },
  { key: 'afternoon', name: 'Öğle', emoji: '☀️' },
  { key: 'evening', name: 'Akşam', emoji: '🌙' },
];
const JOURNAL_TASK_ID = 'task-8';

function stationForNow(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** Şeffaf arka planlı görev çizimleri daireye kesilmeden sığdırılır; fotoğraflar kaplar. */
const isArt = (url?: string) => Boolean(url && /gorev-[a-z-]+.*\.webp/.test(url));

function TaskPicture({ task, className }: { task: RoutineTask; className: string }) {
  return (
    <span className={`${className} ${isArt(task.imageUrl) ? 'art' : ''}`} aria-hidden="true">
      {task.imageUrl ? <img src={task.imageUrl} alt="" /> : task.icon}
    </span>
  );
}

/**
 * Çocuğun ana ekranı: günün üç durağı, o an yapılacak tek görev ve büyük
 * "Bitti!" butonu. Sayaç, filtre ve puan ayrıntıları ebeveyn modundadır.
 */
export const TasksHome: React.FC<TasksHomeProps> = ({
  tasks,
  onMarkTaskDone,
  onOpenJournal,
  soundEnabled,
  speechEnabled,
  caregiver,
}) => {
  const [station, setStation] = useState<Station>(() => {
    const now = stationForNow();
    const order = STATIONS.map((item) => item.key);
    // Şu anki durak bittiyse, sıradaki açık durağa geç.
    const open = order.slice(order.indexOf(now)).find((key) => tasks.some((task) => task.timeOfDay === key && task.status === 'todo'));
    return open || now;
  });
  const [focusId, setFocusId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<RoutineTask | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const scrollTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2400);
  };

  const byStation = useMemo(() => {
    const map = new Map<TimeOfDay, RoutineTask[]>();
    for (const item of STATIONS) map.set(item.key, tasks.filter((task) => task.timeOfDay === item.key));
    return map;
  }, [tasks]);

  const stationDone = (key: TimeOfDay) => (byStation.get(key) || []).every((task) => task.status !== 'todo');
  const stationTasks = station === 'all' ? [] : byStation.get(station) || [];
  const todo = stationTasks.filter((task) => task.status === 'todo');
  const current = todo.find((task) => task.id === focusId) || todo[0] || null;
  const upcoming = todo.filter((task) => task.id !== current?.id).slice(0, 2);
  const pendingHere = stationTasks.filter((task) => task.status === 'pending_approval').length;
  const doneCount = tasks.filter((task) => task.status !== 'todo').length;
  const stationInfo = STATIONS.find((item) => item.key === station);
  const nextOpenStation = STATIONS.find((item) => !stationDone(item.key));

  const chooseStation = (next: Station) => {
    playPopSound(soundEnabled);
    setStation(next);
    setFocusId(null);
  };

  const handleDone = (task: RoutineTask) => {
    if (task.id === JOURNAL_TASK_ID) {
      onOpenJournal();
      return;
    }
    playFanfare(soundEnabled);
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 }, colors: ['#16A34A', '#0E9AA7', '#F59E0B', '#2563EB'] });
    setCelebrating(task);
    speakText('Aferin Rüzgar! Şimdi onay bekliyoruz.', speechEnabled);
    onMarkTaskDone(task.id);
    setFocusId(null);
    window.setTimeout(() => setCelebrating(null), 1700);
  };

  const handleListen = (task: RoutineTask) => {
    speakText(task.title, speechEnabled);
    if (!speechEnabled) showToast('🔊 Ses kapalı. Bir büyüğünden sesi açmasını iste.');
  };

  const handleHelp = () => {
    speakText('Yardım istedin. Bir büyüğün birazdan yanında olacak.', speechEnabled);
    showToast('💜 Yardım istedin. Bir büyüğün birazdan yanında olacak.');
  };

  return (
    <div ref={scrollTopRef}>
      <div className="gt-track" role="tablist" aria-label="Duraklar">
        {STATIONS.map((item) => {
          const done = stationDone(item.key);
          return (
            <button key={item.key} type="button" role="tab" aria-selected={station === item.key} className={`gt-st ${done ? 'done' : ''} ${station === item.key ? 'sel' : ''}`} onClick={() => chooseStation(item.key)}>
              <span className="dot">{done ? '✓' : item.emoji}</span>
              {item.name}
            </button>
          );
        })}
        <button type="button" role="tab" aria-selected={station === 'all'} className={`gt-st ${station === 'all' ? 'sel' : ''}`} onClick={() => chooseStation('all')}>
          <span className="dot"><LayoutGrid aria-hidden="true" /></span>
          Tümü
        </button>
      </div>

      {station === 'all' ? (
        <div className="gt-all">
          {tasks.map((task) => {
            const time = STATIONS.find((item) => item.key === task.timeOfDay)?.name.toLocaleUpperCase('tr-TR');
            return (
              <div key={task.id} className={`gt-tc ${task.status === 'completed' ? 'done' : task.status === 'pending_approval' ? 'pending' : ''}`}>
                <TaskPicture task={task} className="pic" />
                <span className="tm">{time}</span>
                <b>{task.title}</b>
                {task.status === 'completed' && <span className="gt-stt done">✓ Bitti</span>}
                {task.status === 'pending_approval' && <span className="gt-stt pending">⏳ Onayda</span>}
                {task.status === 'todo' && (
                  <button type="button" className="gt-stt todo" onClick={() => { setStation(task.timeOfDay); setFocusId(task.id); }}>Başla</button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="gt-grid2">
          <div>
            {current ? (
              <section className="gt-now" aria-label="Şimdiki görev">
                <TaskPicture task={current} className="gt-illu" />
                <div className="gt-now-body">
                  <span className="gt-label">ŞİMDİ · {stationInfo?.name.toLocaleUpperCase('tr-TR')}</span>
                  <h2>{current.title}</h2>
                  {current.id === JOURNAL_TASK_ID ? (
                    <button type="button" className="gt-big mor" onClick={() => handleDone(current)}><Mic aria-hidden="true" />Günümü anlat</button>
                  ) : (
                    <button type="button" className="gt-big" onClick={() => handleDone(current)}><Check aria-hidden="true" strokeWidth={3} />Bitti!</button>
                  )}
                  <div className="gt-pair">
                    <button type="button" className="gt-mid mavi" onClick={() => handleListen(current)}><Volume2 aria-hidden="true" />Dinle</button>
                    <button type="button" className="gt-mid mor" onClick={handleHelp}><Hand aria-hidden="true" />Yardım</button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="gt-now" aria-label="Durak tamamlandı">
                <span className="gt-party" aria-hidden="true">🎉</span>
                <div className="gt-now-body">
                  <span className="gt-label">{stationInfo?.name.toLocaleUpperCase('tr-TR')} DURAĞI</span>
                  <h2>{stationInfo?.name} durağı tamam!</h2>
                  {nextOpenStation && nextOpenStation.key !== station ? (
                    <button type="button" className="gt-big turkuaz" onClick={() => chooseStation(nextOpenStation.key)}><TrainFront aria-hidden="true" />{nextOpenStation.name} durağına git</button>
                  ) : (
                    <p className="gt-empty">Bugünkü bütün duraklar bitti. Harika bir gündü!</p>
                  )}
                </div>
              </section>
            )}
          </div>

          <div className="gt-side">
            {pendingHere > 0 && (
              <div className="gt-waiting" role="status">
                <span className="hg" aria-hidden="true">⏳</span>
                <span>{pendingHere} görev {caregiver ? `${withGenitive(caregiver)} onayını` : 'onay'} bekliyor</span>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="gt-next">
                <span className="gt-label">SIRADAKİ</span>
                {upcoming.map((task) => (
                  <button key={task.id} type="button" className="gt-nx" onClick={() => { setFocusId(task.id); scrollTopRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>
                    {task.imageUrl ? <img className={isArt(task.imageUrl) ? 'art' : ''} src={task.imageUrl} alt="" /> : <span className="emo" aria-hidden="true">{task.icon}</span>}
                    <span className="t">{task.title}</span>
                    <span className="arr" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            )}
            <div className="gt-today">
              <span className="gt-label">BUGÜNKÜ YOLCULUK</span>
              <div className="rail" aria-label={`Bugün ${doneCount} görev bitti`}>
                {STATIONS.map((item, index) => (
                  <React.Fragment key={item.key}>
                    {index > 0 && <b />}
                    {(byStation.get(item.key) || []).map((task) => <i key={task.id} className={task.status} />)}
                  </React.Fragment>
                ))}
              </div>
              <p>{doneCount === tasks.length && tasks.length > 0 ? 'Bütün vagonlar doldu!' : 'Her bitirdiğin görev bir vagonu doldurur.'}</p>
            </div>
          </div>
        </div>
      )}

      {celebrating && (
        <div className="gt-cele" role="status">
          <span className="runner" aria-hidden="true">🚂</span>
          <span className="ok"><Check aria-hidden="true" strokeWidth={3} /></span>
          <h2>Harika!</h2>
          <p>{caregiver ? `${caregiver} onaylayınca` : 'Onaylanınca'} +{celebrating.rewardCoins} puan senin.</p>
        </div>
      )}
      {toast && <div className="gt-toast" role="status">{toast}</div>}
    </div>
  );
};
