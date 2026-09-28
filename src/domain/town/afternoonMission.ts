import type { RoutineTask } from '../../types';

export const AFTERNOON_TOWN_TASK_IDS = ['task-3', 'task-4', 'task-5'] as const;

export type AfternoonTownStep = 'wants_school' | 'school' | 'arrived' | 'completed';

interface StoredAfternoonTownMission {
  dateKey: string;
  step: AfternoonTownStep;
}

const STORAGE_KEY = 'ruzgar_town_afternoon_mission_v1';
const STEPS: AfternoonTownStep[] = ['wants_school', 'school', 'arrived', 'completed'];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isAfternoonTownReady(tasks: RoutineTask[]) {
  return AFTERNOON_TOWN_TASK_IDS.every((taskId) =>
    tasks.some((task) => task.id === taskId && task.status === 'completed' && !task.deletedAt),
  );
}

export function nextAfternoonTownStep(step: AfternoonTownStep): AfternoonTownStep {
  if (step === 'wants_school') return 'school';
  if (step === 'school') return 'arrived';
  return 'completed';
}

export function readAfternoonTownStep(dateKey = localDateKey()): AfternoonTownStep {
  if (typeof window === 'undefined') return 'wants_school';

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as StoredAfternoonTownMission | null;
    if (stored?.dateKey === dateKey && STEPS.includes(stored.step)) return stored.step;
  } catch {
    // Bozuk yerel kayıt, kısa görevin yeniden başlamasına engel olmaz.
  }

  return 'wants_school';
}

export function saveAfternoonTownStep(step: AfternoonTownStep, dateKey = localDateKey()) {
  if (typeof window === 'undefined') return;
  const value: StoredAfternoonTownMission = { dateKey, step };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}
