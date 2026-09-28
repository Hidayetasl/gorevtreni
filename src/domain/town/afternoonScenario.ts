export type AfternoonTownScenario = 'school' | 'park';

export function localAfternoonDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Aynı dateKey her cihaz yenilemesinde aynı tek öğle senaryosunu seçer. */
export function selectAfternoonTownScenario(
  dateKey = localAfternoonDateKey(),
): AfternoonTownScenario {
  let hash = 5381;
  for (const character of dateKey) {
    hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  }
  return (hash >>> 0) % 2 === 0 ? 'school' : 'park';
}

export function isSelectedAfternoonTownScenario(
  scenario: AfternoonTownScenario,
  dateKey = localAfternoonDateKey(),
) {
  return selectAfternoonTownScenario(dateKey) === scenario;
}
