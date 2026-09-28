/**
 * Dünya sahnesindeki yapı ve nesnelerin kısa Türkçe adı ve İngilizcesi.
 * Rüzgar bir yapıya dokununca önce Türkçesi, sonra İngilizcesi söylenir.
 */
export type SceneWord = { tr: string; en: string; emoji: string };

export type WordLang = 'both' | 'en';

/**
 * Dünya yapıları, görev nesneleri ve kısa kalıplar için ortak içerik.
 * Yeni bir dil katmanı değildir; Dünya'daki mevcut TR+EN / EN tercihini
 * görevlerin de aynı kaynaktan okuyabilmesi için genişletir.
 */
export const WORD_LANG_KEY = 'ruzgar_world_word_lang_v1';

const CONTENT_WORDS = {
  apple: { tr: 'Elma', en: 'Apple', emoji: '🍎' },
  bread: { tr: 'Ekmek', en: 'Bread', emoji: '🍞' },
  milk: { tr: 'Süt', en: 'Milk', emoji: '🥛' },
} as const satisfies Record<string, SceneWord>;

const CONTENT_PHRASES = {
  breadQuestion: { tr: 'Bread hangisi?', en: 'Which one is Bread?', emoji: '🍞' },
  breadTryAgain: { tr: 'Bir daha deneyelim. Bread, ekmek demek.', en: 'Try again. This is Bread.', emoji: '🍞' },
  breadCorrect: { tr: 'Evet! Bread, ekmek demek.', en: 'Yes! This is Bread.', emoji: '🍞' },
  giveBread: { tr: 'Ekmeği ver', en: 'Give the bread', emoji: '🍞' },
  thankYou: { tr: 'Teşekkür ederim!', en: 'Thank you!', emoji: '🙏' },
} as const satisfies Record<string, SceneWord>;

export type ContentWordId = keyof typeof CONTENT_WORDS;
export type ContentPhraseId = keyof typeof CONTENT_PHRASES;

export function contentWord(id: ContentWordId): SceneWord {
  return CONTENT_WORDS[id];
}

export function contentPhrase(id: ContentPhraseId): SceneWord {
  return CONTENT_PHRASES[id];
}

export function readWordLang(): WordLang {
  try {
    return window.localStorage.getItem(WORD_LANG_KEY) === 'en' ? 'en' : 'both';
  } catch {
    return 'both';
  }
}

export function saveWordLang(language: WordLang) {
  try {
    window.localStorage.setItem(WORD_LANG_KEY, language);
  } catch {
    // Depolama kapalıysa mevcut oturumdaki state yine çalışmaya devam eder.
  }
}

export function contentText(content: Pick<SceneWord, 'tr' | 'en'>, language: WordLang): string {
  return language === 'en' ? content.en : `${content.tr} ${content.en}`;
}

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
