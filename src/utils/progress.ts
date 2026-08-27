import type { ActivityLogEntry, RoutineTask } from '../types';

export interface DailyProgress {
  dateKey: string;
  scheduledTaskIds: string[];
  submittedTaskIds: string[];
  approvedTaskIds: string[];
  rejectedTaskIds: string[];
}

function localDateKey(value: Date | string = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDateKey(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

export function buildDailyProgress(tasks: RoutineTask[], activityLog: ActivityLogEntry[], now: Date = new Date()): DailyProgress[] {
  const byDate = new Map<string, DailyProgress>();
  const ensure = (dateKey: string, scheduledTaskIds: string[] = []) => {
    if (!dateKey) return undefined;
    const current = byDate.get(dateKey) || {
      dateKey,
      scheduledTaskIds: [...new Set(scheduledTaskIds)],
      submittedTaskIds: [],
      approvedTaskIds: [],
      rejectedTaskIds: [],
    };
    if (scheduledTaskIds.length) current.scheduledTaskIds = [...new Set([...current.scheduledTaskIds, ...scheduledTaskIds])];
    byDate.set(dateKey, current);
    return current;
  };

  const todayKey = localDateKey(now);
  const currentScheduled = tasks.filter((task) => !task.isExtra).map((task) => task.id);
  ensure(todayKey, currentScheduled);

  for (const entry of activityLog) {
    const dateKey = entry.dateKey || localDateKey(entry.timestamp);
    const day = ensure(dateKey, entry.scheduledTaskCount ? currentScheduled : []);
    if (!day || !entry.taskId) continue;
    if (entry.type === 'task_complete') day.submittedTaskIds = [...new Set([...day.submittedTaskIds, entry.taskId])];
    if (entry.type === 'task_approved') day.approvedTaskIds = [...new Set([...day.approvedTaskIds, entry.taskId])];
    if (entry.type === 'task_rejected') day.rejectedTaskIds = [...new Set([...day.rejectedTaskIds, entry.taskId])];
  }

  for (const task of tasks.filter((item) => !item.isExtra)) {
    const dateKey = task.approvedAt || task.completedAt ? localDateKey(task.approvedAt || task.completedAt) : '';
    const day = ensure(dateKey);
    if (!day) continue;
    if (task.completedAt) day.submittedTaskIds = [...new Set([...day.submittedTaskIds, task.id])];
    if (task.status === 'completed' && task.approvedAt) day.approvedTaskIds = [...new Set([...day.approvedTaskIds, task.id])];
  }

  return [...byDate.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function completionRate(day: DailyProgress | undefined): number | null {
  if (!day || day.scheduledTaskIds.length === 0) return null;
  const scheduled = new Set(day.scheduledTaskIds);
  const approvedScheduled = day.approvedTaskIds.filter((id) => scheduled.has(id)).length;
  return Math.round((approvedScheduled / scheduled.size) * 100);
}

export function calculateCurrentStreak(days: DailyProgress[], today: Date = new Date()): number {
  const byDate = new Map(days.map((day) => [day.dateKey, day]));
  let streak = 0;
  let cursor = localDateKey(today);
  while (true) {
    const day = byDate.get(cursor);
    if (!day || completionRate(day) !== 100) break;
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
    if (!cursor) break;
  }
  return streak;
}

export function weeklyCompletion(days: DailyProgress[], today: Date = new Date()): Array<{ label: string; dateKey: string; rate: number | null }> {
  const byDate = new Map(days.map((day) => [day.dateKey, day]));
  const labels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const todayKey = localDateKey(today);
  const todayDate = new Date(`${todayKey}T12:00:00`);
  const mondayOffset = (todayDate.getDay() + 6) % 7;
  const monday = new Date(todayDate);
  monday.setDate(monday.getDate() - mondayOffset);
  return labels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateKey = localDateKey(date);
    return { label, dateKey, rate: completionRate(byDate.get(dateKey)) };
  });
}
