import assert from 'node:assert/strict';
import {
  isSelectedAfternoonTownScenario,
  selectAfternoonTownScenario,
} from '../src/domain/town/afternoonScenario';
import {
  readAfternoonTownStep,
  saveAfternoonTownStep,
} from '../src/domain/town/afternoonMission';
import { readParkTownStep, saveParkTownStep } from '../src/domain/town/parkMission';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: new MemoryStorage() },
  configurable: true,
});

const schoolDateKey = '2026-09-28';
const parkDateKey = '2026-09-29';

assert.equal(selectAfternoonTownScenario(schoolDateKey), 'school');
assert.equal(selectAfternoonTownScenario(schoolDateKey), 'school');
saveAfternoonTownStep('completed', schoolDateKey);
assert.equal(readAfternoonTownStep(schoolDateKey), 'completed');
assert.equal(isSelectedAfternoonTownScenario('park', schoolDateKey), false);
console.log(`AFTERNOON_SCHOOL_DAY=PASS ${schoolDateKey}`);

assert.equal(selectAfternoonTownScenario(parkDateKey), 'park');
assert.equal(selectAfternoonTownScenario(parkDateKey), 'park');
saveParkTownStep('completed', parkDateKey);
assert.equal(readParkTownStep(parkDateKey), 'completed');
assert.equal(isSelectedAfternoonTownScenario('school', parkDateKey), false);
console.log(`AFTERNOON_PARK_DAY=PASS ${parkDateKey}`);

assert.equal(readParkTownStep(schoolDateKey), 'wants_move');
assert.equal(readAfternoonTownStep(parkDateKey), 'wants_school');
assert.equal(selectAfternoonTownScenario(schoolDateKey), 'school');
assert.equal(selectAfternoonTownScenario(parkDateKey), 'park');
console.log('AFTERNOON_NO_CHAIN=PASS');
