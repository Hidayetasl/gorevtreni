import type { RoutineTask } from '../../types';

export const MORNING_TOWN_TASK_IDS = ['task-1', 'task-2'] as const;

export type MorningTownStep = 'village_started' | 'bakery' | 'donkey' | 'completed';

interface StoredMorningTownMission {
  dateKey: string;
  step: MorningTownStep;
}

const STORAGE_KEY = 'ruzgar_town_morning_mission_v1';
const STEPS: MorningTownStep[] = ['village_started', 'bakery', 'donkey', 'completed'];

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isMorningTownReady(tasks: RoutineTask[]) {
  return MORNING_TOWN_TASK_IDS.every((taskId) =>
    tasks.some((task) => task.id === taskId && task.status === 'completed' && !task.deletedAt),
  );
}

export function nextMorningTownStep(step: MorningTownStep): MorningTownStep {
  if (step === 'village_started') return 'bakery';
  if (step === 'bakery') return 'donkey';
  return 'completed';
}

export function readMorningTownStep(dateKey = localDateKey()): MorningTownStep {
  if (typeof window === 'undefined') return 'village_started';

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as StoredMorningTownMission | null;
    if (stored?.dateKey === dateKey && STEPS.includes(stored.step)) return stored.step;
  } catch {
    // Bozuk yerel kayıt, kısa görevin yeniden başlamasına engel olmaz.
  }

  return 'village_started';
}

export function saveMorningTownStep(step: MorningTownStep, dateKey = localDateKey()) {
  if (typeof window === 'undefined') return;
  const value: StoredMorningTownMission = { dateKey, step };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}
