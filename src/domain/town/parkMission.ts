import type { RoutineTask } from '../../types';

export const PARK_TOWN_TASK_IDS = ['task-3', 'task-4', 'task-5'] as const;

export type ParkTownStep = 'wants_move' | 'park' | 'played' | 'completed';

interface StoredParkTownMission {
  dateKey: string;
  step: ParkTownStep;
}

const STORAGE_KEY = 'ruzgar_town_park_mission_v1';
const STEPS: ParkTownStep[] = ['wants_move', 'park', 'played', 'completed'];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isParkTownReady(tasks: RoutineTask[]) {
  return PARK_TOWN_TASK_IDS.every((taskId) =>
    tasks.some((task) => task.id === taskId && task.status === 'completed' && !task.deletedAt),
  );
}

export function nextParkTownStep(step: ParkTownStep): ParkTownStep {
  if (step === 'wants_move') return 'park';
  if (step === 'park') return 'played';
  return 'completed';
}

export function readParkTownStep(dateKey = localDateKey()): ParkTownStep {
  if (typeof window === 'undefined') return 'wants_move';

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as StoredParkTownMission | null;
    if (stored?.dateKey === dateKey && STEPS.includes(stored.step)) return stored.step;
  } catch {
    // Bozuk yerel kayıt, kısa görevin yeniden başlamasına engel olmaz.
  }

  return 'wants_move';
}

export function saveParkTownStep(step: ParkTownStep, dateKey = localDateKey()) {
  if (typeof window === 'undefined') return;
  const value: StoredParkTownMission = { dateKey, step };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}
