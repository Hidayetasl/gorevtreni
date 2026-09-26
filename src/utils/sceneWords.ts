/**
 * Dünya sahnesindeki yapı ve nesnelerin kısa Türkçe adı ve İngilizcesi.
 * Rüzgar bir yapıya dokununca önce Türkçesi, sonra İngilizcesi söylenir.
 */
export type SceneWord = { tr: string; en: string; emoji: string };

const WORDS: Record<string, SceneWord> = {
  'scenery-house': { tr: 'Ev', en: 'House', emoji: '🏠' },
  'scenery-house-2': { tr: 'Ev', en: 'House', emoji: '🏠' },
  'scenery-house-3': { tr: 'Ev', en: 'House', emoji: '🏠' },
  'scenery-house-4': { tr: 'Ev', en: 'House', emoji: '🏠' },
  'scenery-house-5': { tr: 'Ev', en: 'House', emoji: '🏠' },
  'scenery-house-6': { tr: 'Ev', en: 'House', emoji: '🏠' },
  'scenery-school': { tr: 'Okul', en: 'School', emoji: '🏫' },
  'scenery-hospital': { tr: 'Hastane', en: 'Hospital', emoji: '🏥' },
  'scenery-market': { tr: 'Market', en: 'Market', emoji: '🛒' },
  'scenery-bakery': { tr: 'Fırın', en: 'Bakery', emoji: '🥖' },
  'scenery-cinema': { tr: 'Sinema', en: 'Cinema', emoji: '🎬' },
  'scenery-ferris': { tr: 'Dönme dolap', en: 'Ferris wheel', emoji: '🎡' },
  'scenery-park': { tr: 'Park', en: 'Park', emoji: '🌳' },
  'scenery-fountain': { tr: 'Fıskiye', en: 'Fountain', emoji: '⛲' },
  'scenery-windmill': { tr: 'Yel değirmeni', en: 'Windmill', emoji: '🌬️' },
  'scenery-train-repair': { tr: 'Tamirhane', en: 'Repair shop', emoji: '🔧' },
  'scenery-firestation-building': { tr: 'İtfaiye', en: 'Fire station', emoji: '🚒' },
  'scenery-firestation': { tr: 'İtfaiye aracı', en: 'Fire truck', emoji: '🚒' },
  'scenery-ambulance': { tr: 'Ambulans', en: 'Ambulance', emoji: '🚑' },
  'scenery-airplane': { tr: 'Uçak', en: 'Airplane', emoji: '✈️' },
  'scenery-traffic-light': { tr: 'Trafik ışığı', en: 'Traffic light', emoji: '🚦' },
  'scenery-tree': { tr: 'Ağaç', en: 'Tree', emoji: '🌲' },
  'scenery-flower': { tr: 'Çiçek', en: 'Flower', emoji: '🌻' },
  'scenery-cow': { tr: 'İnek', en: 'Cow', emoji: '🐄' },
  'scenery-donkey': { tr: 'Eşek', en: 'Donkey', emoji: '🫏' },
  'scenery-squirrel-courier': { tr: 'Sincap', en: 'Squirrel', emoji: '🐿️' },
  'track-bridge': { tr: 'Köprü', en: 'Bridge', emoji: '🌉' },
  'track-tunnel': { tr: 'Tünel', en: 'Tunnel', emoji: '⛰️' },
  'track-station': { tr: 'Tren garı', en: 'Train station', emoji: '🚉' },
  train: { tr: 'Tren', en: 'Train', emoji: '🚂' },
};

export function sceneWord(itemId: string): SceneWord | null {
  return WORDS[itemId] || null;
}
