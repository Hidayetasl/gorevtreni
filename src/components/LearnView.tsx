import React, { useCallback, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { playCoinSound, playPopSound, speakText } from '../utils/audio';
import { Volume2, RotateCcw, Mic, ArrowLeft } from 'lucide-react';

interface LearnViewProps {
  soundEnabled: boolean;
  speechEnabled: boolean;
  /** Ebeveynin ayarladığı açık Heceleme seviyeleri (1=2 heceli, 2=3 heceli, 3=4 heceli). */
  syllableGameLevels?: number[];
  /** Doğru cevapta çağrılır; App her 10 doğruda 1 puan verir. */
  onCorrectAnswer?: () => void;
  /** Sonraki puana doğru giden sayaç (0..answersPerCoin-1). */
  answersTowardNextCoin?: number;
  answersPerCoin?: number;
}

type WordEntry = { word: string; emoji: string };
type LetterEntry = { letter: string; note?: string; words: WordEntry[] };

// Ses Temelli Cümle Yöntemi (MEB'in 2005'ten beri kullandığı resmi ilk okuma-
// yazma yöntemi): önce sesi tanıma, sonra hece/kelime/cümle. Her harfe BİRDEN
// FAZLA örnek kelime bağlı — aynı harfi farklı görsellerle tekrar görmek tek
// bir örneği ezberlemekten çok, sesi genellemeyi (kalıcı öğrenmeyi) sağlıyor.
const LETTER_ENTRIES: LetterEntry[] = [
  { letter: 'Aa', words: [{ word: 'Ayı', emoji: '🐻' }, { word: 'Araba', emoji: '🚗' }, { word: 'Ay', emoji: '🌙' }] },
  { letter: 'Bb', words: [{ word: 'Balık', emoji: '🐟' }, { word: 'Balon', emoji: '🎈' }, { word: 'Bebek', emoji: '👶' }] },
  { letter: 'Cc', words: [{ word: 'Ceviz', emoji: '🌰' }, { word: 'Cetvel', emoji: '📏' }] },
  { letter: 'Çç', words: [{ word: 'Çilek', emoji: '🍓' }, { word: 'Çanta', emoji: '👜' }, { word: 'Çiçek', emoji: '🌸' }] },
  { letter: 'Dd', words: [{ word: 'Domates', emoji: '🍅' }, { word: 'Deniz', emoji: '🌊' }, { word: 'Diş', emoji: '🦷' }] },
  { letter: 'Ee', words: [{ word: 'Elma', emoji: '🍎' }, { word: 'Ejderha', emoji: '🐉' }, { word: 'Eldiven', emoji: '🧤' }] },
  { letter: 'Ff', words: [{ word: 'Fil', emoji: '🐘' }, { word: 'Fare', emoji: '🐭' }, { word: 'Feribot', emoji: '⛴️' }] },
  { letter: 'Gg', words: [{ word: 'Gemi', emoji: '🚢' }, { word: 'Gitar', emoji: '🎸' }, { word: 'Güneş', emoji: '☀️' }] },
  { letter: 'Ğğ', note: 'Kelime başında olmaz, sesi yumuşatır', words: [{ word: 'Dağ', emoji: '🏔️' }] },
  { letter: 'Hh', words: [{ word: 'Horoz', emoji: '🐓' }, { word: 'Hediye', emoji: '🎁' }, { word: 'Havuç', emoji: '🥕' }] },
  { letter: 'Iı', words: [{ word: 'Irmak', emoji: '🏞️' }, { word: 'Ispanak', emoji: '🥬' }] },
  { letter: 'İi', words: [{ word: 'İnek', emoji: '🐄' }, { word: 'İğne', emoji: '📌' }] },
  { letter: 'Jj', words: [{ word: 'Jimnastik', emoji: '🤸' }] },
  { letter: 'Kk', words: [{ word: 'Kedi', emoji: '🐱' }, { word: 'Kalem', emoji: '✏️' }, { word: 'Kelebek', emoji: '🦋' }] },
  { letter: 'Ll', words: [{ word: 'Limon', emoji: '🍋' }, { word: 'Lamba', emoji: '💡' }, { word: 'Lale', emoji: '🌷' }] },
  { letter: 'Mm', words: [{ word: 'Muz', emoji: '🍌' }, { word: 'Maymun', emoji: '🐵' }, { word: 'Mum', emoji: '🕯️' }] },
  { letter: 'Nn', words: [{ word: 'Nokta', emoji: '🔵' }, { word: 'Nane', emoji: '🌿' }] },
  { letter: 'Oo', words: [{ word: 'Orman', emoji: '🌲' }, { word: 'Okul', emoji: '🏫' }, { word: 'Oyuncak', emoji: '🧸' }] },
  { letter: 'Öö', words: [{ word: 'Ördek', emoji: '🦆' }, { word: 'Örümcek', emoji: '🕷️' }] },
  { letter: 'Pp', words: [{ word: 'Papağan', emoji: '🦜' }, { word: 'Patates', emoji: '🥔' }, { word: 'Piyano', emoji: '🎹' }] },
  { letter: 'Rr', words: [{ word: 'Roket', emoji: '🚀' }, { word: 'Radyo', emoji: '📻' }, { word: 'Resim', emoji: '🖼️' }] },
  { letter: 'Ss', words: [{ word: 'Sincap', emoji: '🐿️' }, { word: 'Saat', emoji: '⏰' }, { word: 'Salyangoz', emoji: '🐌' }] },
  { letter: 'Şş', words: [{ word: 'Şemsiye', emoji: '☂️' }, { word: 'Şeker', emoji: '🍬' }, { word: 'Şapka', emoji: '🎩' }] },
  { letter: 'Tt', words: [{ word: 'Tren', emoji: '🚂' }, { word: 'Top', emoji: '⚽' }, { word: 'Tavşan', emoji: '🐰' }] },
  { letter: 'Uu', words: [{ word: 'Uçak', emoji: '✈️' }, { word: 'Uzay', emoji: '🌌' }] },
  { letter: 'Üü', words: [{ word: 'Üzüm', emoji: '🍇' }, { word: 'Üçgen', emoji: '🔺' }] },
  { letter: 'Vv', words: [{ word: 'Vapur', emoji: '⛴️' }, { word: 'Video', emoji: '📹' }] },
  { letter: 'Yy', words: [{ word: 'Yıldız', emoji: '⭐' }, { word: 'Yılan', emoji: '🐍' }, { word: 'Yumurta', emoji: '🥚' }] },
  { letter: 'Zz', words: [{ word: 'Zürafa', emoji: '🦒' }, { word: 'Zil', emoji: '🔔' }] },
];

// Ğ bir kelimenin BAŞINDA olmadığı için (sesi yumuşatır) "hangi harfle
// başlar" bulmacasında hedef olarak seçilmiyor; yanlış şık olarak alfabe
// tuşlarında yine de görünüyor.
const QUIZ_POOL = LETTER_ENTRIES.filter((item) => item.letter !== 'Ğğ');

function pickRandomWord(entry: LetterEntry, excludeWord?: string): WordEntry {
  const pool = entry.words.length > 1 && excludeWord
    ? entry.words.filter((w) => w.word !== excludeWord)
    : entry.words;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomTarget(excludeLetter?: string): { entry: LetterEntry; word: WordEntry } {
  const pool = excludeLetter ? QUIZ_POOL.filter((item) => item.letter !== excludeLetter) : QUIZ_POOL;
  const entry = pool[Math.floor(Math.random() * pool.length)];
  return { entry, word: pickRandomWord(entry) };
}

// Türkçe büyük/küçük harf kurallarına göre (İ/i, I/ı) karşılaştırma için sadeleştirme.
function normalizeTurkish(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .trim()
    .replace(/[.,!?]/g, '');
}

// --- Heceleme oyunu verisi ---
// Heceler standart Türkçe hecelemeye göre ayrılmıştır (iki ünlü arasında tek
// ünsüz sonraki heceye, iki ünsüz varsa biri öncekine biri sonrakine geçer).
// Tek heceli kelimeler bu oyuna dahil edilmez (birleştirilecek hece olmaz).
// level: 1 = 2 heceli (başlangıç), 2 = 3 heceli, 3 = 4 heceli (en zor).
type SyllableWord = { word: string; syllables: string[]; emoji: string; level: 1 | 2 | 3 };
const SYLLABLE_WORDS: SyllableWord[] = [
  // Seviye 1 — 2 heceli
  { word: 'Kedi', syllables: ['Ke', 'Di'], emoji: '🐱', level: 1 },
  { word: 'Elma', syllables: ['El', 'Ma'], emoji: '🍎', level: 1 },
  { word: 'Balon', syllables: ['Ba', 'Lon'], emoji: '🎈', level: 1 },
  { word: 'Tavşan', syllables: ['Tav', 'Şan'], emoji: '🐰', level: 1 },
  { word: 'Kalem', syllables: ['Ka', 'Lem'], emoji: '✏️', level: 1 },
  { word: 'Ayı', syllables: ['A', 'Yı'], emoji: '🐻', level: 1 },
  { word: 'Limon', syllables: ['Li', 'Mon'], emoji: '🍋', level: 1 },
  { word: 'Sincap', syllables: ['Sin', 'Cap'], emoji: '🐿️', level: 1 },
  { word: 'Roket', syllables: ['Ro', 'Ket'], emoji: '🚀', level: 1 },
  { word: 'Horoz', syllables: ['Ho', 'Roz'], emoji: '🐓', level: 1 },
  { word: 'Yıldız', syllables: ['Yıl', 'Dız'], emoji: '⭐', level: 1 },
  { word: 'Gemi', syllables: ['Ge', 'Mi'], emoji: '🚢', level: 1 },
  { word: 'Yılan', syllables: ['Yı', 'Lan'], emoji: '🐍', level: 1 },
  { word: 'Üzüm', syllables: ['Ü', 'Züm'], emoji: '🍇', level: 1 },
  { word: 'Balık', syllables: ['Ba', 'Lık'], emoji: '🐟', level: 1 },
  // Seviye 2 — 3 heceli
  { word: 'Patates', syllables: ['Pa', 'Ta', 'Tes'], emoji: '🥔', level: 2 },
  { word: 'Domates', syllables: ['Do', 'Ma', 'Tes'], emoji: '🍅', level: 2 },
  { word: 'Zürafa', syllables: ['Zü', 'Ra', 'Fa'], emoji: '🦒', level: 2 },
  { word: 'Şemsiye', syllables: ['Şem', 'Si', 'Ye'], emoji: '☂️', level: 2 },
  { word: 'Örümcek', syllables: ['Ö', 'Rüm', 'Cek'], emoji: '🕷️', level: 2 },
  // Seviye 3 — 4 heceli
  { word: 'Kaplumbağa', syllables: ['Kap', 'Lum', 'Ba', 'Ğa'], emoji: '🐢', level: 3 },
  { word: 'Ayakkabı', syllables: ['A', 'Yak', 'Ka', 'Bı'], emoji: '👟', level: 3 },
  { word: 'Gökkuşağı', syllables: ['Gök', 'Ku', 'Şa', 'Ğı'], emoji: '🌈', level: 3 },
  { word: 'Bilgisayar', syllables: ['Bil', 'Gi', 'Sa', 'Yar'], emoji: '💻', level: 3 },
  { word: 'Salatalık', syllables: ['Sa', 'La', 'Ta', 'Lık'], emoji: '🥒', level: 3 },
];

// Bu kadar kelime doğru tamamlanınca, açık bir üst seviye varsa oraya geçilir.
const LEVEL_UP_THRESHOLD = 5;

type SyllableTile = { id: string; text: string };
let syllableTileSeq = 0;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSyllableRound(level: number, excludeWord?: string): { target: SyllableWord; pool: SyllableTile[] } {
  const levelWords = SYLLABLE_WORDS.filter((w) => w.level === level);
  const filtered = excludeWord ? levelWords.filter((w) => w.word !== excludeWord) : levelWords;
  // Aynı seviyede tek kelime kalırsa (uç durum), yine de bir hedef seçilebilsin.
  const candidates = filtered.length > 0 ? filtered : levelWords;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  // Hedefin heceleri + AYNI seviyeden 2-3 farklı kelimenin karışık, dikkat
  // dağıtıcı heceleri — böylece hece uzunluğu/zorluğu tutarlı kalır.
  const distractorWords = shuffle(levelWords.filter((w) => w.word !== target.word)).slice(0, 3);
  const distractorSyllables = distractorWords.flatMap((w) => w.syllables).slice(0, 5);
  const tiles: SyllableTile[] = shuffle([...target.syllables, ...distractorSyllables]).map((text) => {
    syllableTileSeq += 1;
    return { id: `tile-${syllableTileSeq}`, text };
  });
  return { target, pool: tiles };
}

// --- İngilizce öğrenme verisi (işitsel öğrenme: resim + İngilizce kelime sesi) ---
// Somut, günlük kelimeler kategori kategori. Her kategori tek başına bir emoji
// setiyle temsil edilebilecek şekilde seçildi (renkler = renkli daireler,
// sayılar = rakam emojileri, vb.) — gerçek fotoğraf gerektirmiyor.
type EnglishCategoryId = 'colors' | 'numbers' | 'animals' | 'family' | 'toys' | 'food' | 'phrases';
type EnglishWord = { word: string; tr: string; emoji: string; category: EnglishCategoryId };

const ENGLISH_CATEGORIES: { id: EnglishCategoryId; label: string; icon: string }[] = [
  { id: 'colors', label: 'Renkler', icon: '🎨' },
  { id: 'numbers', label: 'Sayılar', icon: '🔢' },
  { id: 'animals', label: 'Hayvanlar', icon: '🐾' },
  { id: 'family', label: 'Aile', icon: '👪' },
  { id: 'toys', label: 'Oyuncaklar', icon: '🧸' },
  { id: 'food', label: 'Yiyecekler', icon: '🍎' },
  { id: 'phrases', label: 'Kalıplar', icon: '💬' },
];

const ENGLISH_WORDS: EnglishWord[] = [
  // Renkler
  { word: 'Red', tr: 'Kırmızı', emoji: '🔴', category: 'colors' },
  { word: 'Blue', tr: 'Mavi', emoji: '🔵', category: 'colors' },
  { word: 'Green', tr: 'Yeşil', emoji: '🟢', category: 'colors' },
  { word: 'Yellow', tr: 'Sarı', emoji: '🟡', category: 'colors' },
  { word: 'Orange', tr: 'Turuncu', emoji: '🟠', category: 'colors' },
  { word: 'Purple', tr: 'Mor', emoji: '🟣', category: 'colors' },
  { word: 'Black', tr: 'Siyah', emoji: '⚫', category: 'colors' },
  { word: 'White', tr: 'Beyaz', emoji: '⚪', category: 'colors' },
  { word: 'Brown', tr: 'Kahverengi', emoji: '🟤', category: 'colors' },
  // Sayılar
  { word: 'One', tr: 'Bir', emoji: '1️⃣', category: 'numbers' },
  { word: 'Two', tr: 'İki', emoji: '2️⃣', category: 'numbers' },
  { word: 'Three', tr: 'Üç', emoji: '3️⃣', category: 'numbers' },
  { word: 'Four', tr: 'Dört', emoji: '4️⃣', category: 'numbers' },
  { word: 'Five', tr: 'Beş', emoji: '5️⃣', category: 'numbers' },
  { word: 'Six', tr: 'Altı', emoji: '6️⃣', category: 'numbers' },
  { word: 'Seven', tr: 'Yedi', emoji: '7️⃣', category: 'numbers' },
  { word: 'Eight', tr: 'Sekiz', emoji: '8️⃣', category: 'numbers' },
  { word: 'Nine', tr: 'Dokuz', emoji: '9️⃣', category: 'numbers' },
  { word: 'Ten', tr: 'On', emoji: '🔟', category: 'numbers' },
  // Hayvanlar
  { word: 'Dog', tr: 'Köpek', emoji: '🐶', category: 'animals' },
  { word: 'Cat', tr: 'Kedi', emoji: '🐱', category: 'animals' },
  { word: 'Fish', tr: 'Balık', emoji: '🐟', category: 'animals' },
  { word: 'Bird', tr: 'Kuş', emoji: '🐦', category: 'animals' },
  { word: 'Rabbit', tr: 'Tavşan', emoji: '🐰', category: 'animals' },
  { word: 'Duck', tr: 'Ördek', emoji: '🦆', category: 'animals' },
  { word: 'Horse', tr: 'At', emoji: '🐴', category: 'animals' },
  { word: 'Lion', tr: 'Aslan', emoji: '🦁', category: 'animals' },
  { word: 'Bear', tr: 'Ayı', emoji: '🐻', category: 'animals' },
  { word: 'Frog', tr: 'Kurbağa', emoji: '🐸', category: 'animals' },
  // Aile
  { word: 'Mom', tr: 'Anne', emoji: '👩', category: 'family' },
  { word: 'Dad', tr: 'Baba', emoji: '👨', category: 'family' },
  { word: 'Baby', tr: 'Bebek', emoji: '👶', category: 'family' },
  { word: 'Sister', tr: 'Kız kardeş', emoji: '👧', category: 'family' },
  { word: 'Brother', tr: 'Erkek kardeş', emoji: '👦', category: 'family' },
  { word: 'Grandma', tr: 'Anneanne / Babaanne', emoji: '👵', category: 'family' },
  { word: 'Grandpa', tr: 'Dede', emoji: '👴', category: 'family' },
  // Oyuncaklar
  { word: 'Ball', tr: 'Top', emoji: '⚽', category: 'toys' },
  { word: 'Teddy Bear', tr: 'Oyuncak Ayı', emoji: '🧸', category: 'toys' },
  { word: 'Car', tr: 'Araba', emoji: '🚗', category: 'toys' },
  { word: 'Balloon', tr: 'Balon', emoji: '🎈', category: 'toys' },
  { word: 'Kite', tr: 'Uçurtma', emoji: '🪁', category: 'toys' },
  { word: 'Puzzle', tr: 'Yapboz', emoji: '🧩', category: 'toys' },
  { word: 'Blocks', tr: 'Bloklar', emoji: '🧱', category: 'toys' },
  // Yiyecekler
  { word: 'Apple', tr: 'Elma', emoji: '🍎', category: 'food' },
  { word: 'Banana', tr: 'Muz', emoji: '🍌', category: 'food' },
  { word: 'Milk', tr: 'Süt', emoji: '🥛', category: 'food' },
  { word: 'Bread', tr: 'Ekmek', emoji: '🍞', category: 'food' },
  { word: 'Egg', tr: 'Yumurta', emoji: '🥚', category: 'food' },
  { word: 'Cake', tr: 'Pasta', emoji: '🎂', category: 'food' },
  { word: 'Cheese', tr: 'Peynir', emoji: '🧀', category: 'food' },
  { word: 'Cookie', tr: 'Kurabiye', emoji: '🍪', category: 'food' },
  // Kalıplar
  { word: 'Hello', tr: 'Merhaba', emoji: '👋', category: 'phrases' },
  { word: 'Thank you', tr: 'Teşekkür ederim', emoji: '🙏', category: 'phrases' },
  { word: 'My name is Rüzgar', tr: 'Benim adım Rüzgar', emoji: '🙋', category: 'phrases' },
];

function buildEnglishFindRound(category: EnglishCategoryId, excludeWord?: string): { target: EnglishWord; choices: EnglishWord[] } {
  const pool = ENGLISH_WORDS.filter((w) => w.category === category);
  const filtered = excludeWord ? pool.filter((w) => w.word !== excludeWord) : pool;
  const candidates = filtered.length > 0 ? filtered : pool;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const distractors = shuffle(pool.filter((w) => w.word !== target.word)).slice(0, 3);
  const choices = shuffle([target, ...distractors]);
  return { target, choices };
}

function pickRandomEnglishWord(category: EnglishCategoryId, excludeWord?: string): EnglishWord {
  const pool = ENGLISH_WORDS.filter((w) => w.category === category);
  const filtered = excludeWord ? pool.filter((w) => w.word !== excludeWord) : pool;
  const candidates = filtered.length > 0 ? filtered : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// İngilizce Web Speech API sonuçlarını karşılaştırmak için sadeleştirme
// (Türkçe büyük/küçük harf kurallarına ihtiyaç yok, düz İngilizce metin).
function normalizeEnglish(text: string): string {
  return text.toLowerCase().trim().replace(/[.,!?]/g, '');
}

type EnglishGameType = 'find' | 'repeat';

type Mode = 'kesfet' | 'bul' | 'hece' | 'ingilizce';

const LEARNING_WAGONS: Array<{ id: Mode; label: string; detail: string; icon: string }> = [
  { id: 'kesfet', label: 'Sesi Keşfet', detail: 'Harfleri dinle', icon: '🔤' },
  { id: 'bul', label: 'Hangi Harf?', detail: 'Resmi ve sesi bul', icon: '🧠' },
  { id: 'hece', label: 'Heceleri Birleştir', detail: 'Kelimeyi tamamla', icon: '🎈' },
  { id: 'ingilizce', label: 'İngilizce', detail: 'Kelime öğren', icon: '🌍' },
];

const DAILY_LEARNING_GOAL = 3;

function getLocalLearnDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function readDailyLearningCount() {
  try {
    const saved = JSON.parse(localStorage.getItem('ruzgar_daily_learning_v1') || 'null') as { dateKey?: string; count?: number } | null;
    return saved?.dateKey === getLocalLearnDateKey() ? Math.min(DAILY_LEARNING_GOAL, Math.max(0, Number(saved.count) || 0)) : 0;
  } catch {
    return 0;
  }
}

export const LearnView: React.FC<LearnViewProps> = ({ soundEnabled, speechEnabled, syllableGameLevels, onCorrectAnswer, answersTowardNextCoin = 0, answersPerCoin = 10 }) => {
  // Sayaç 9'dan 0'a döndüğünde bir puan kazanılmıştır: kısa bir kutlama göster.
  const [coinToast, setCoinToast] = useState(false);
  const previousTowardRef = useRef(answersTowardNextCoin);
  React.useEffect(() => {
    if (previousTowardRef.current === answersPerCoin - 1 && answersTowardNextCoin === 0) {
      setCoinToast(true);
      speakText('Harika! On doğru cevap, bir puan kazandın!', speechEnabled, 0.85);
      const timer = window.setTimeout(() => setCoinToast(false), 2600);
      previousTowardRef.current = answersTowardNextCoin;
      return () => window.clearTimeout(timer);
    }
    previousTowardRef.current = answersTowardNextCoin;
  }, [answersTowardNextCoin, answersPerCoin, speechEnabled]);
  // null = Öğren menüsü (dört büyük kutu). Bir oyuna girilince yalnızca o görünür.
  const [mode, setMode] = useState<Mode | null>(null);
  const [dailyLearnCount, setDailyLearnCount] = useState(readDailyLearningCount);

  const registerLearningAction = useCallback(() => {
    setDailyLearnCount((current) => {
      const next = Math.min(DAILY_LEARNING_GOAL, current + 1);
      try {
        localStorage.setItem('ruzgar_daily_learning_v1', JSON.stringify({ dateKey: getLocalLearnDateKey(), count: next }));
      } catch {
        // Yerel depolama kapalıysa öğrenme akışı yine de devam eder.
      }
      return next;
    });
  }, []);

  // --- Keşfet modu: harfe dokun, sesini + örnek kelimeyi dinle ---
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<Set<string>>(new Set());
  // İkinci (kelime) parçasının zamanlayıcısı: art arda hızlı dokunuşlarda eski
  // bir kelimenin gecikmeli olarak araya girmesini önlemek için ref'te tutulup
  // her yeni dokunuşta iptal ediliyor.
  const wordTimeoutRef = useRef<number | null>(null);

  const handleLetterTap = (entry: LetterEntry) => {
    const primary = entry.words[0];
    playPopSound(soundEnabled);
    setActiveLetter(entry.letter);
    if (wordTimeoutRef.current) window.clearTimeout(wordTimeoutRef.current);
    // Harf ve örnek kelime, çocuğun rahat ayırt edebilmesi için ayrı ayrı ve
    // aralarında gerçek bir duraklamayla, yavaş bir hızda okunuyor.
    speakText(entry.letter[0], speechEnabled, 0.6);
    wordTimeoutRef.current = window.setTimeout(() => {
      speakText(primary.word, speechEnabled, 0.72);
    }, 900);
    const wasNewLetter = !discovered.has(entry.letter);
    if (wasNewLetter) registerLearningAction();
    setDiscovered((prev) => {
      const next = new Set(prev);
      next.add(entry.letter);
      return next;
    });
    window.setTimeout(() => setActiveLetter((current) => (current === entry.letter ? null : current)), 600);
  };

  // --- Bul modu: sadece resmi gör, çocuk kelimeyi kendi söyler (isterse
  // resme dokunup uygulamadan da dinleyebilir), sonra hangi harfle
  // başladığını alfabeden seçer. Yanlış seçilirse AYNI harfin BAŞKA bir
  // örnek resmiyle tekrar sorulur — birden fazla farklı görselle pekiştirme,
  // tek bir resmi ezberlemekten daha kalıcı öğrenmeyi hedefliyor. ---
  const [quizTarget, setQuizTarget] = useState(() => pickRandomTarget());
  const [quizFeedback, setQuizFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [quizWrongTries, setQuizWrongTries] = useState(0);
  const [quizCorrectCount, setQuizCorrectCount] = useState(0);
  const quizAdvanceTimeoutRef = useRef<number | null>(null);

  // --- Söyle: Rüzgar kelimeyi kendi sesiyle söyler, tarayıcı mikrofonla
  // dinleyip doğru söyleyip söylemediğini kontrol eder (Web Speech API).
  // Tanıma başarısız/desteklenmiyorsa oyunu ASLA kilitlemiyor — harfi bulma
  // adımı buna bağlı değil, sadece ek bir doğrulama/teşvik katmanı.
  const [micState, setMicState] = useState<'idle' | 'listening' | 'correct' | 'no-match' | 'denied' | 'error'>('idle');
  const recognitionRef = useRef<any>(null);
  const micSupported = typeof window !== 'undefined'
    && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.abort(); } catch { /* yoksay */ }
    recognitionRef.current = null;
  }, []);

  const nextQuizTarget = useCallback(() => {
    stopListening();
    setMicState('idle');
    setQuizTarget((current) => pickRandomTarget(current.entry.letter));
    setQuizFeedback('idle');
    setQuizWrongTries(0);
  }, [stopListening]);

  const swapToAnotherPictureSameLetter = useCallback(() => {
    stopListening();
    setMicState('idle');
    setQuizTarget((current) => ({ entry: current.entry, word: pickRandomWord(current.entry, current.word.word) }));
  }, [stopListening]);

  const handleSpeakWord = () => {
    if (!micSupported || micState === 'listening') return;
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = 'tr-TR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    setMicState('listening');

    recognition.onresult = (event: any) => {
      const target = normalizeTurkish(quizTarget.word.word);
      const results = event.results?.[0];
      const said: string[] = results ? Array.from(results).map((r: any) => normalizeTurkish(r.transcript)) : [];
      const isMatch = said.some((text) => text === target || text.includes(target) || target.includes(text));
      if (isMatch) {
        playCoinSound(soundEnabled);
        speakText('Harika söyledin! Hadi harfi bul!', speechEnabled, 0.8);
        setMicState('correct');
      } else {
        playPopSound(soundEnabled);
        speakText('Yanlış, tekrar dener misin?', speechEnabled, 0.8);
        setMicState('no-match');
      }
    };
    recognition.onerror = (event: any) => {
      const denied = event?.error === 'not-allowed' || event?.error === 'service-not-allowed';
      if (!denied) {
        playPopSound(soundEnabled);
        speakText('Seni duyamadım, tekrar dener misin?', speechEnabled, 0.8);
      }
      setMicState(denied ? 'denied' : 'no-match');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setMicState((current) => (current === 'listening' ? 'idle' : current));
    };

    try {
      recognition.start();
    } catch {
      setMicState('error');
    }
  };

  const handleQuizGuess = (entry: LetterEntry) => {
    if (quizFeedback === 'correct') return;
    const isCorrect = entry.letter[0] === quizTarget.entry.letter[0];
    if (isCorrect) {
      playCoinSound(soundEnabled);
      setQuizFeedback('correct');
      setQuizCorrectCount((count) => count + 1);
      onCorrectAnswer?.();
        const wasNewQuizLetter = !discovered.has(quizTarget.entry.letter);
        if (wasNewQuizLetter) registerLearningAction();
        setDiscovered((prev) => {
          const next = new Set(prev);
          next.add(quizTarget.entry.letter);
          return next;
        });
      speakText(`Doğru! ${quizTarget.word.word}, ${quizTarget.entry.letter[0]} ile başlar.`, speechEnabled, 0.75);
      if (quizAdvanceTimeoutRef.current) window.clearTimeout(quizAdvanceTimeoutRef.current);
      quizAdvanceTimeoutRef.current = window.setTimeout(nextQuizTarget, 2600);
    } else {
      playPopSound(soundEnabled);
      setQuizFeedback('wrong');
      setQuizWrongTries((tries) => tries + 1);
      // Aynı resmi tekrar sormak yerine, aynı harfin BAŞKA bir örneğini
      // göster — birkaç farklı görselle pekiştirme daha kalıcı oluyor.
      speakText('Yanlış, tekrar dene! Aynı harfle başlayan başka bir resim.', speechEnabled, 0.8);
      window.setTimeout(() => {
        swapToAnotherPictureSameLetter();
        setQuizFeedback('idle');
      }, 900);
    }
  };

  // --- Heceleme modu: hedef resmin hecelerini, karışık hece balonlarından
  // SIRAYLA seçip kelimeyi tamamlıyor. Yanlış balon sadece sallanıp geri
  // dönüyor (ceza yok). Kelime tamamlanınca "patlama" kutlaması + yeni
  // kelime/balon seti geliyor. Ses Temelli Yöntem'in "sesten hece, heceden
  // kelime" aşamasına karşılık geliyor.
  // Ebeveynin ayarladığı açık seviyeler (ör. [1], [2], [1,2,3]) — hiçbiri
  // seçili değilse güvenli varsayılan olarak sadece Seviye 1 açık kabul edilir.
  const allowedLevels = React.useMemo(() => {
    const raw: number[] = syllableGameLevels && syllableGameLevels.length > 0 ? syllableGameLevels : [1];
    const unique = raw.filter((level, index) => raw.indexOf(level) === index);
    return unique.sort((a, b) => a - b);
  }, [syllableGameLevels]);

  const [activeHeceLevel, setActiveHeceLevel] = useState<number>(allowedLevels[0]);
  // Aktif seviyede kaç kelime art arda doğru tamamlandı — LEVEL_UP_THRESHOLD'a
  // ulaşınca (bir üst seviye açıksa) otomatik seviye atlanır.
  const [heceLevelProgress, setHeceLevelProgress] = useState(0);
  const [syllableRound, setSyllableRound] = useState(() => buildSyllableRound(allowedLevels[0]));
  const [selectedSyllables, setSelectedSyllables] = useState<string[]>([]);
  const [wrongTileId, setWrongTileId] = useState<string | null>(null);
  const [wordCompleteCount, setWordCompleteCount] = useState(0);
  const syllableAdvanceTimeoutRef = useRef<number | null>(null);

  const nextSyllableRound = useCallback((level: number) => {
    setSyllableRound((current) => buildSyllableRound(level, current.target.level === level ? current.target.word : undefined));
    setSelectedSyllables([]);
    setWrongTileId(null);
  }, []);

  // Ebeveyn ayarları değişip aktif seviye artık kapatılmışsa (ör. Seviye 2
  // kapatıldı ama oyun o an Seviye 2'deydi), en düşük açık seviyeye dönülür.
  React.useEffect(() => {
    if (!allowedLevels.includes(activeHeceLevel)) {
      const fallbackLevel = allowedLevels[0];
      setActiveHeceLevel(fallbackLevel);
      setHeceLevelProgress(0);
      nextSyllableRound(fallbackLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedLevels]);

  const handleTileTap = (tile: SyllableTile) => {
    const expectedIndex = selectedSyllables.length;
    const expected = syllableRound.target.syllables[expectedIndex];
    if (normalizeTurkish(tile.text) === normalizeTurkish(expected)) {
      playPopSound(soundEnabled);
      const nextSelected = [...selectedSyllables, tile.text];
      setSelectedSyllables(nextSelected);
      // Kullanılan hece balonu havuzdan kalkar (patlar).
      setSyllableRound((current) => ({ ...current, pool: current.pool.filter((t) => t.id !== tile.id) }));

      if (nextSelected.length === syllableRound.target.syllables.length) {
        playCoinSound(soundEnabled);
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        setWordCompleteCount((count) => count + 1);
        onCorrectAnswer?.();
        registerLearningAction();

        const currentLevelIndex = allowedLevels.indexOf(activeHeceLevel);
        const nextAllowedLevel = currentLevelIndex >= 0 && currentLevelIndex < allowedLevels.length - 1
          ? allowedLevels[currentLevelIndex + 1]
          : null;
        const updatedProgress = heceLevelProgress + 1;

        if (syllableAdvanceTimeoutRef.current) window.clearTimeout(syllableAdvanceTimeoutRef.current);

        if (nextAllowedLevel !== null && updatedProgress >= LEVEL_UP_THRESHOLD) {
          // Seviye atlama: kutlama + biraz daha büyük konfeti + yeni seviyeden kelime.
          speakText(`${syllableRound.target.word}! Harika, yeni bir seviyeye geçiyorsun!`, speechEnabled, 0.8);
          confetti({ particleCount: 100, spread: 90, origin: { y: 0.5 } });
          setHeceLevelProgress(0);
          setActiveHeceLevel(nextAllowedLevel);
          syllableAdvanceTimeoutRef.current = window.setTimeout(() => nextSyllableRound(nextAllowedLevel), 2400);
        } else {
          speakText(`${syllableRound.target.word}! Harika, kelimeyi tamamladın!`, speechEnabled, 0.8);
          setHeceLevelProgress(updatedProgress);
          syllableAdvanceTimeoutRef.current = window.setTimeout(() => nextSyllableRound(activeHeceLevel), 2000);
        }
      }
    } else {
      playPopSound(soundEnabled);
      setWrongTileId(tile.id);
      window.setTimeout(() => setWrongTileId((current) => (current === tile.id ? null : current)), 400);
    }
  };

  // --- İngilizce modu: kategori seç, ardından "Dinle & Bul" (dinle → doğru
  // resmi seç) veya "Tekrar Et" (mikrofonla kelimeyi tekrar söyle) oyunu.
  // Türkçe 'bul' modundan tamamen ayrı state/ref kullanıyor ki iki mikrofon
  // akışı birbirine karışmasın. ---
  const [englishCategory, setEnglishCategory] = useState<EnglishCategoryId>('animals');
  // İngilizce'de önce konu kartları; bir konu seçilince o ders açılır.
  const [englishPicked, setEnglishPicked] = useState(false);
  const [englishGameType, setEnglishGameType] = useState<EnglishGameType>('find');
  const [englishRound, setEnglishRound] = useState(() => buildEnglishFindRound('animals'));
  const [englishFeedback, setEnglishFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [englishCorrectCount, setEnglishCorrectCount] = useState(0);
  const [englishRepeatWord, setEnglishRepeatWord] = useState<EnglishWord>(() => pickRandomEnglishWord('animals'));
  const [englishMicState, setEnglishMicState] = useState<'idle' | 'listening' | 'correct' | 'no-match' | 'denied' | 'error'>('idle');
  const englishRecognitionRef = useRef<any>(null);
  const englishAdvanceTimeoutRef = useRef<number | null>(null);

  const stopEnglishListening = useCallback(() => {
    try { englishRecognitionRef.current?.abort(); } catch { /* yoksay */ }
    englishRecognitionRef.current = null;
  }, []);

  const nextEnglishFindRound = useCallback((category: EnglishCategoryId) => {
    stopEnglishListening();
    setEnglishRound((current) => buildEnglishFindRound(category, current.target.category === category ? current.target.word : undefined));
    setEnglishFeedback('idle');
  }, [stopEnglishListening]);

  const nextEnglishRepeatWord = useCallback((category: EnglishCategoryId) => {
    stopEnglishListening();
    setEnglishMicState('idle');
    setEnglishRepeatWord((current) => pickRandomEnglishWord(category, current.category === category ? current.word : undefined));
  }, [stopEnglishListening]);

  const handleEnglishCategoryChange = (category: EnglishCategoryId) => {
    playPopSound(soundEnabled);
    setEnglishCategory(category);
    if (englishGameType === 'find') nextEnglishFindRound(category);
    else nextEnglishRepeatWord(category);
  };

  const handleEnglishGameTypeChange = (gameType: EnglishGameType) => {
    playPopSound(soundEnabled);
    setEnglishGameType(gameType);
    if (gameType === 'find') nextEnglishFindRound(englishCategory);
    else nextEnglishRepeatWord(englishCategory);
  };

  const handleEnglishSpeakTarget = () => {
    const word = englishGameType === 'find' ? englishRound.target.word : englishRepeatWord.word;
    // Doğal perde (pitch 1.0) + yavaş hız: yüksek pitch sentezlenmiş İngilizce
    // sesi bozup anlaşılmaz yapıyordu, netlik için düzeltildi.
    speakText(word, speechEnabled, 0.7, 'en-US', 1.0);
  };

  const handleEnglishChoiceTap = (choice: EnglishWord) => {
    if (englishFeedback === 'correct') return;
    const isCorrect = choice.word === englishRound.target.word;
    if (isCorrect) {
      playCoinSound(soundEnabled);
      registerLearningAction();
      setEnglishFeedback('correct');
      setEnglishCorrectCount((count) => count + 1);
      onCorrectAnswer?.();
      speakText('Great job!', speechEnabled, 0.85, 'en-US', 1.05);
      if (englishAdvanceTimeoutRef.current) window.clearTimeout(englishAdvanceTimeoutRef.current);
      // Çocuk doğru cevabı rahatça görebilsin diye yeni kelimeye geçmeden önce biraz beklenir.
      englishAdvanceTimeoutRef.current = window.setTimeout(() => nextEnglishFindRound(englishCategory), 2600);
    } else {
      playPopSound(soundEnabled);
      setEnglishFeedback('wrong');
      window.setTimeout(() => setEnglishFeedback((current) => (current === 'wrong' ? 'idle' : current)), 500);
    }
  };

  const handleEnglishMicRepeat = () => {
    if (!micSupported || englishMicState === 'listening') return;
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    englishRecognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    setEnglishMicState('listening');

    recognition.onresult = (event: any) => {
      const target = normalizeEnglish(englishRepeatWord.word);
      const results = event.results?.[0];
      const said: string[] = results ? Array.from(results).map((r: any) => normalizeEnglish(r.transcript)) : [];
      const isMatch = said.some((text) => text === target || text.includes(target) || target.includes(text));
      if (isMatch) {
        playCoinSound(soundEnabled);
        registerLearningAction();
        speakText('Great job!', speechEnabled, 0.85, 'en-US', 1.05);
        setEnglishMicState('correct');
        setEnglishCorrectCount((count) => count + 1);
        onCorrectAnswer?.();
        if (englishAdvanceTimeoutRef.current) window.clearTimeout(englishAdvanceTimeoutRef.current);
        englishAdvanceTimeoutRef.current = window.setTimeout(() => nextEnglishRepeatWord(englishCategory), 1800);
      } else {
        playPopSound(soundEnabled);
        setEnglishMicState('no-match');
      }
    };
    recognition.onerror = (event: any) => {
      const denied = event?.error === 'not-allowed' || event?.error === 'service-not-allowed';
      setEnglishMicState(denied ? 'denied' : 'no-match');
    };
    recognition.onend = () => {
      englishRecognitionRef.current = null;
      setEnglishMicState((current) => (current === 'listening' ? 'idle' : current));
    };

    try {
      recognition.start();
    } catch {
      setEnglishMicState('error');
    }
  };

  // Oyundan çıkarken bekleyen geçişler ve açık mikrofon kapatılır.
  const stopActivity = () => {
    if (quizAdvanceTimeoutRef.current) window.clearTimeout(quizAdvanceTimeoutRef.current);
    if (syllableAdvanceTimeoutRef.current) window.clearTimeout(syllableAdvanceTimeoutRef.current);
    if (englishAdvanceTimeoutRef.current) window.clearTimeout(englishAdvanceTimeoutRef.current);
    stopListening();
    stopEnglishListening();
    setMicState('idle');
    setEnglishMicState('idle');
  };

  const handleModeChange = (nextMode: Mode) => {
    playPopSound(soundEnabled);
    stopActivity();
    if (nextMode === 'bul') nextQuizTarget();
    if (nextMode === 'hece') nextSyllableRound(activeHeceLevel);
    if (nextMode === 'ingilizce') setEnglishPicked(false);
    setMode(nextMode);
  };

  const handleEnglishPick = (category: EnglishCategoryId) => {
    handleEnglishCategoryChange(category);
    setEnglishPicked(true);
  };

  // Tek geri düğmesi: İngilizce dersinden konulara, diğer her yerden Öğren menüsüne.
  const handleBack = () => {
    playPopSound(soundEnabled);
    stopActivity();
    if (mode === 'ingilizce' && englishPicked) {
      setEnglishPicked(false);
      return;
    }
    setMode(null);
  };

  // Bileşen kapanırken açık kalmış bir mikrofon dinlemesi olmasın.
  React.useEffect(() => () => stopListening(), [stopListening]);
  React.useEffect(() => () => stopEnglishListening(), [stopEnglishListening]);

  // Aynı harfin farklı resimleriyle birkaç kez denendiği halde bulunamazsa
  // (harf havuzu tükendiyse bile) çocuğun tamamen takılıp kalmaması için son
  // çare olarak ipucu gösteriliyor.
  const showHint = quizWrongTries >= 3;

  const modeDone: Record<Mode, boolean> = {
    kesfet: discovered.size > 0,
    bul: quizCorrectCount > 0,
    hece: wordCompleteCount > 0,
    ingilizce: englishCorrectCount > 0,
  };
  const micMessage = (state: typeof micState, successText: string) => {
    if (state === 'correct') return <p className="gt-result good" role="status">{successText}</p>;
    if (state === 'no-match') return <p className="gt-result again" role="status">Seni tam duyamadım, tekrar dener misin?</p>;
    if (state === 'denied') return <p className="gt-result info" role="status">Mikrofon izni gerekiyor. Bir büyüğünden izin vermesini iste.</p>;
    if (state === 'error') return <p className="gt-result info" role="status">Bir sorun oldu, tekrar dener misin?</p>;
    return null;
  };

  const currentWagon = LEARNING_WAGONS.find((wagon) => wagon.id === mode);
  const currentCategory = ENGLISH_CATEGORIES.find((cat) => cat.id === englishCategory);
  const backLabel = mode === 'ingilizce' && englishPicked ? 'İngilizce' : 'Öğren';
  const screenTitle = mode === 'ingilizce' && englishPicked && currentCategory
    ? `${currentCategory.icon} ${currentCategory.label}`
    : currentWagon ? `${currentWagon.icon} ${currentWagon.label}` : '';

  if (mode === null) {
    return (
      <div>
        <div className="gt-head">
          <h1>Öğren</h1>
          <span className="gt-goal" aria-label={`Bugünkü hedef ${dailyLearnCount} / ${DAILY_LEARNING_GOAL} keşif`}>
            <span aria-hidden="true">⭐</span><b>{dailyLearnCount}/{DAILY_LEARNING_GOAL}</b>
          </span>
          <span className="gt-goal coin" aria-label={`Her ${answersPerCoin} doğru cevapta 1 puan. Şu an ${answersTowardNextCoin}`}>
            <span className="gt-coin-dot small" aria-hidden="true" /><b>{answersTowardNextCoin}/{answersPerCoin}</b>
          </span>
        </div>
        <p className="gt-menu-hint">Ne öğrenmek istersin?</p>
        <div className="gt-menu" aria-label="Öğrenme oyunları">
          {LEARNING_WAGONS.map((wagon) => (
            <button key={wagon.id} type="button" className={`gt-menu-card w-${wagon.id}`} onClick={() => handleModeChange(wagon.id)}>
              <span className="e" aria-hidden="true">{wagon.icon}</span>
              <span className="t">{wagon.label}<small>{wagon.detail}</small></span>
              {modeDone[wagon.id] && <span className="ok" aria-label="Bugün oynandı">✓</span>}
            </button>
          ))}
        </div>
        {coinToast && <div className="gt-toast" role="status">🎉 {answersPerCoin} doğru cevap! +1 puan kazandın.</div>}
      </div>
    );
  }

  return (
    <div>
      <div className="gt-head gt-subhead">
        <button type="button" className="gt-back" onClick={handleBack} aria-label={`${backLabel} bölümüne geri dön`}>
          <span className="ar" aria-hidden="true"><ArrowLeft strokeWidth={3.5} /></span>Geri
        </button>
        <h1>{screenTitle}</h1>
        <span className="gt-goal coin" aria-label={`Her ${answersPerCoin} doğru cevapta 1 puan. Şu an ${answersTowardNextCoin}`}>
          <span className="gt-coin-dot small" aria-hidden="true" /><b>{answersTowardNextCoin}/{answersPerCoin}</b>
        </span>
      </div>
      {coinToast && <div className="gt-toast" role="status">🎉 {answersPerCoin} doğru cevap! +1 puan kazandın.</div>}

      {mode === 'kesfet' && (
        <section className="gt-lcard" aria-label="Sesleri keşfet">
          <p className="gt-hint">Bir harfe dokun, sesini ve o sesle başlayan kelimeyi dinle.</p>
          <span className="gt-count">Keşfedilen: {discovered.size} / {LETTER_ENTRIES.length}</span>
          <div className="gt-letters">
            {LETTER_ENTRIES.map((entry) => {
              const primary = entry.words[0];
              return (
                <button
                  key={entry.letter}
                  type="button"
                  onClick={() => handleLetterTap(entry)}
                  title={entry.note ? `${primary.word} (${entry.note})` : primary.word}
                  className={`gt-letter ${activeLetter === entry.letter ? 'on' : discovered.has(entry.letter) ? 'seen' : ''}`}
                >
                  <span className="l">{entry.letter}</span>
                  <span className="em" aria-hidden="true">{primary.emoji}</span>
                  <span className="w">{primary.word}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {mode === 'bul' && (
        <section className="gt-lcard" aria-label="Hangi harf">
          <span className={`gt-picture ${quizFeedback === 'correct' ? 'good' : quizFeedback === 'wrong' ? 'again' : ''}`} role="img" aria-label="Bu resmin adı ne?">{quizTarget.word.emoji}</span>
          <p className="gt-hint">Resmin adını yüksek sesle söyle, sonra hangi harfle başladığını bul.</p>
          <div className="gt-pair">
            {micSupported && (
              <button type="button" className={`gt-mid ${micState === 'listening' ? 'listening' : 'turkuaz'}`} onClick={handleSpeakWord} disabled={micState === 'listening'}>
                <Mic aria-hidden="true" />{micState === 'listening' ? 'Dinliyorum…' : 'Söyle'}
              </button>
            )}
            <button type="button" className="gt-ghost" style={{ flex: 1 }} onClick={() => { if (quizAdvanceTimeoutRef.current) window.clearTimeout(quizAdvanceTimeoutRef.current); nextQuizTarget(); }}>
              <RotateCcw aria-hidden="true" />Başka resim
            </button>
          </div>
          {!micSupported && <p className="gt-result info">Bu cihazda ses tanıma yok. Yine de yüksek sesle söyle!</p>}
          {micMessage(micState, 'Harika söyledin! 🎉 Hadi harfi bul.')}
          {quizFeedback === 'correct' && <p className="gt-result good" role="status">✓ Doğru! {quizTarget.word.word}, “{quizTarget.entry.letter[0]}” ile başlar.</p>}
          {quizFeedback === 'wrong' && <p className="gt-result again" role="status">Olmadı. Aynı harfle başlayan başka bir resim geliyor.</p>}
          {showHint && quizFeedback !== 'correct' && <p className="gt-result info">İpucu: {quizTarget.word.word[0]} ile başlıyor…</p>}
          <p className="gt-q">Hangi harfle başlıyor?</p>
          {/* Sadece harfler; kelime ve resim yok ki cevabı ele vermesin. */}
          <div className="gt-letters compact">
            {LETTER_ENTRIES.map((entry) => (
              <button key={entry.letter} type="button" className={`gt-letter ${quizFeedback === 'correct' && entry.letter === quizTarget.entry.letter ? 'ok' : ''}`} onClick={() => handleQuizGuess(entry)} disabled={quizFeedback === 'correct'}>
                <span className="l">{entry.letter}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {mode === 'hece' && (
        <section className="gt-lcard" aria-label="Heceleri birleştir">
          <span className="gt-lvl">
            SEVİYE {activeHeceLevel} · {activeHeceLevel + 1} HECELİ
            {allowedLevels[allowedLevels.length - 1] !== activeHeceLevel
              ? ` · sonraki seviye ${Math.min(heceLevelProgress, LEVEL_UP_THRESHOLD)}/${LEVEL_UP_THRESHOLD}`
              : ' · en üst seviye 🏆'}
          </span>
          <span className="gt-picture" role="img" aria-label="Bu resmin adını hecelerle tamamla">{syllableRound.target.emoji}</span>
          <div className="gt-slots" aria-label="Seçilen heceler">
            {syllableRound.target.syllables.map((syllable, index) => (
              <span key={`${syllable}-${index}`} className={index < selectedSyllables.length ? 'f' : ''}>
                {index < selectedSyllables.length ? selectedSyllables[index] : ''}
              </span>
            ))}
          </div>
          {selectedSyllables.length === syllableRound.target.syllables.length ? (
            <p className="gt-result good" role="status">🎉 {syllableRound.target.word}! Heceleri doğru sıraladın.</p>
          ) : (
            <p className="gt-q">Heceleri sırayla dokun</p>
          )}
          <div className="gt-balloons">
            {syllableRound.pool.map((tile) => (
              <button key={tile.id} type="button" className={`gt-balloon ${wrongTileId === tile.id ? 'wig' : ''}`} onClick={() => handleTileTap(tile)}>
                {tile.text}
              </button>
            ))}
          </div>
          <button type="button" className="gt-ghost" onClick={() => { if (syllableAdvanceTimeoutRef.current) window.clearTimeout(syllableAdvanceTimeoutRef.current); nextSyllableRound(activeHeceLevel); }}>
            <RotateCcw aria-hidden="true" />Başka kelime
          </button>
        </section>
      )}

      {mode === 'ingilizce' && (
        !englishPicked ? (
        <>
          <p className="gt-menu-hint">Hangi konuyu öğrenelim?</p>
          <div className="gt-menu cats" aria-label="İngilizce konuları">
            {ENGLISH_CATEGORIES.map((cat) => (
              <button key={cat.id} type="button" className="gt-menu-card" onClick={() => handleEnglishPick(cat.id)}>
                <span className="e" aria-hidden="true">{cat.icon}</span>
                <span className="t">{cat.label}</span>
              </button>
            ))}
          </div>
        </>
        ) : (
        <section className="gt-lcard" aria-label={`İngilizce: ${currentCategory?.label || ''}`}>
          <div className="gt-seg" role="tablist" aria-label="Oyun türü">
            <button type="button" role="tab" aria-selected={englishGameType === 'find'} className={englishGameType === 'find' ? 'on' : ''} onClick={() => handleEnglishGameTypeChange('find')}>👂 Dinle ve bul</button>
            <button type="button" role="tab" aria-selected={englishGameType === 'repeat'} className={englishGameType === 'repeat' ? 'on' : ''} onClick={() => handleEnglishGameTypeChange('repeat')}>🗣️ Tekrar et</button>
          </div>

          {englishGameType === 'find' && (
            <>
              <button type="button" className="gt-big mavi" onClick={handleEnglishSpeakTarget}>
                <Volume2 aria-hidden="true" />Dinle
              </button>
              <p className="gt-q">Duyduğun kelimenin resmine dokun</p>
              {englishFeedback === 'correct' && <p className="gt-result good" role="status">✓ {englishRound.target.emoji} {englishRound.target.word} = {englishRound.target.tr}</p>}
              {englishFeedback === 'wrong' && <p className="gt-result again" role="status">Olmadı, bir daha dinle.</p>}
              <div className="gt-choices">
                {englishRound.choices.map((choice) => (
                  <button key={choice.word} type="button" className={`gt-choice ${englishFeedback === 'correct' && choice.word === englishRound.target.word ? 'ok' : ''}`} onClick={() => handleEnglishChoiceTap(choice)} disabled={englishFeedback === 'correct'} aria-label={`Seçenek ${choice.tr}`}>
                    {choice.emoji}
                  </button>
                ))}
              </div>
              <button type="button" className="gt-ghost" onClick={() => { if (englishAdvanceTimeoutRef.current) window.clearTimeout(englishAdvanceTimeoutRef.current); nextEnglishFindRound(englishCategory); }}>
                <RotateCcw aria-hidden="true" />Başka kelime
              </button>
            </>
          )}

          {englishGameType === 'repeat' && (
            <>
              <span className="gt-picture" aria-hidden="true">{englishRepeatWord.emoji}</span>
              <span className="gt-en" lang="en">{englishRepeatWord.word}</span>
              <span className="gt-tr">{englishRepeatWord.tr}</span>
              <div className="gt-pair">
                <button type="button" className="gt-mid mavi" onClick={handleEnglishSpeakTarget}><Volume2 aria-hidden="true" />Dinle</button>
                {micSupported && (
                  <button type="button" className={`gt-mid ${englishMicState === 'listening' ? 'listening' : 'turkuaz'}`} onClick={handleEnglishMicRepeat} disabled={englishMicState === 'listening'}>
                    <Mic aria-hidden="true" />{englishMicState === 'listening' ? 'Dinliyorum…' : 'Tekrar et'}
                  </button>
                )}
              </div>
              {!micSupported && <p className="gt-result info">Bu cihazda ses tanıma yok. Yine de yüksek sesle söyle!</p>}
              {micMessage(englishMicState, 'Great job! 🎉')}
              <button type="button" className="gt-ghost" onClick={() => { if (englishAdvanceTimeoutRef.current) window.clearTimeout(englishAdvanceTimeoutRef.current); nextEnglishRepeatWord(englishCategory); }}>
                <RotateCcw aria-hidden="true" />Başka kelime
              </button>
            </>
          )}
        </section>
        )
      )}
    </div>
  );
};
