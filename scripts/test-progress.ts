import { strict as assert } from 'node:assert';
import { buildDailyProgress, calculateCurrentStreak, weeklyCompletion } from '../src/utils/progress';

const now = new Date('2026-08-26T12:00:00');
const tasks = [
  { id: 'a', title: 'A', description: '', icon: '⭐', rewardCoins: 1, timeOfDay: 'morning', status: 'completed', completedAt: '2026-08-26T08:00:00', approvedAt: '2026-08-26T08:30:00' },
  { id: 'b', title: 'B', description: '', icon: '⭐', rewardCoins: 1, timeOfDay: 'morning', status: 'todo' },
] as any[];
const days = buildDailyProgress(tasks, [{ id: 'log-1', type: 'task_approved', label: 'A', timestamp: '2026-08-26T08:30:00', taskId: 'a', dateKey: '2026-08-26' }], now);
assert.equal(days.find((day) => day.dateKey === '2026-08-26')?.approvedTaskIds.length, 1);
assert.equal(calculateCurrentStreak(days, now), 0);
assert.equal(weeklyCompletion(days, now).find((day) => day.dateKey === '2026-08-26')?.rate, 50);

const fullTasks = tasks.map((task) => ({ ...task, status: 'completed', completedAt: '2026-08-26T08:00:00', approvedAt: '2026-08-26T08:30:00' })) as any[];
const fullDays = buildDailyProgress(fullTasks, [], now);
assert.equal(calculateCurrentStreak(fullDays, now), 1);
console.log('progress tests passed');
