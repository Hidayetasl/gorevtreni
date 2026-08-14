import React, { useCallback, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { playCoinSound, playPopSound, speakText } from '../utils/audio';
import { BookOpen, Volume2, Sparkles, RotateCcw, Mic, PartyPopper } from 'lucide-react';

interface LearnViewProps {
  soundEnabled: boolean;
  speechEnabled: boolean;
  /** Ebeveynin ayarladığı açık Heceleme seviyeleri (1=2 heceli, 2=3 heceli, 3=4 heceli). */
  syllableGameLevels?: number[];
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

type Mode = 'kesfet' | 'bul' | 'hece';

export const LearnView: React.FC<LearnViewProps> = ({ soundEnabled, speechEnabled, syllableGameLevels }) => {
  const [mode, setMode] = useState<Mode>('kesfet');

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
      setDiscovered((prev) => {
        const next = new Set(prev);
        next.add(quizTarget.entry.letter);
        return next;
      });
      speakText(`Doğru! ${quizTarget.word.word}, ${quizTarget.entry.letter[0]} ile başlar.`, speechEnabled, 0.75);
      if (quizAdvanceTimeoutRef.current) window.clearTimeout(quizAdvanceTimeoutRef.current);
      quizAdvanceTimeoutRef.current = window.setTimeout(nextQuizTarget, 1800);
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

  const handleModeChange = (nextMode: Mode) => {
    playPopSound(soundEnabled);
    if (quizAdvanceTimeoutRef.current) window.clearTimeout(quizAdvanceTimeoutRef.current);
    if (syllableAdvanceTimeoutRef.current) window.clearTimeout(syllableAdvanceTimeoutRef.current);
    stopListening();
    setMicState('idle');
    if (nextMode === 'bul') nextQuizTarget();
    if (nextMode === 'hece') nextSyllableRound(activeHeceLevel);
    setMode(nextMode);
  };

  // Bileşen kapanırken açık kalmış bir mikrofon dinlemesi olmasın.
  React.useEffect(() => () => stopListening(), [stopListening]);

  // Aynı harfin farklı resimleriyle birkaç kez denendiği halde bulunamazsa
  // (harf havuzu tükendiyse bile) çocuğun tamamen takılıp kalmaması için son
  // çare olarak ipucu gösteriliyor.
  const showHint = quizWrongTries >= 3;

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <div className="text-[11px] font-black text-sky-400 uppercase tracking-widest">
            HARF TRENİ
          </div>
          <h2 className="font-game text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-sky-300" />
            <span>{mode === 'kesfet' ? 'Sesleri Keşfet' : mode === 'bul' ? 'Hangi Harf?' : 'Heceleri Birleştir'}</span>
          </h2>
        </div>
        <div className="rounded-2xl bg-sky-900/60 border border-sky-700/60 px-3 py-1.5 text-right">
          <div className="text-[10px] font-bold text-sky-300 uppercase tracking-wide">
            {mode === 'kesfet' ? 'Keşfedilen' : mode === 'bul' ? 'Doğru' : 'Tamamlanan'}
          </div>
          <div className="font-game text-lg font-black text-white">
            {mode === 'kesfet' ? `${discovered.size} / ${LETTER_ENTRIES.length}` : mode === 'bul' ? quizCorrectCount : wordCompleteCount}
          </div>
        </div>
      </div>

      {/* Mod Seçici */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => handleModeChange('kesfet')}
          className={`py-2.5 rounded-2xl font-game text-[11px] sm:text-sm font-black border-2 transition-all active:scale-95 ${
            mode === 'kesfet'
              ? 'bg-sky-500 border-sky-300 text-white shadow-md'
              : 'bg-[#173340] border-sky-800/60 text-slate-300'
          }`}
        >
          🔤 Keşfet
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('bul')}
          className={`py-2.5 rounded-2xl font-game text-[11px] sm:text-sm font-black border-2 transition-all active:scale-95 ${
            mode === 'bul'
              ? 'bg-emerald-500 border-emerald-300 text-white shadow-md'
              : 'bg-[#173340] border-sky-800/60 text-slate-300'
          }`}
        >
          🧠 Bul
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('hece')}
          className={`py-2.5 rounded-2xl font-game text-[11px] sm:text-sm font-black border-2 transition-all active:scale-95 ${
            mode === 'hece'
              ? 'bg-purple-500 border-purple-300 text-white shadow-md'
              : 'bg-[#173340] border-sky-800/60 text-slate-300'
          }`}
        >
          🎈 Heceler
        </button>
      </div>

      {mode === 'kesfet' && (
        <>
          <div className="rounded-2xl bg-sky-950/40 border border-sky-800/50 px-4 py-3 flex items-center gap-2.5">
            <Volume2 className="w-5 h-5 text-sky-300 flex-shrink-0" />
            <p className="text-xs sm:text-sm font-semibold text-sky-100 leading-relaxed">
              Bir harfe dokun, sesini ve o sesle başlayan kelimeyi dinle!
            </p>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 sm:gap-3">
            {LETTER_ENTRIES.map((entry) => {
              const primary = entry.words[0];
              const isActive = activeLetter === entry.letter;
              const isDiscovered = discovered.has(entry.letter);
              return (
                <button
                  key={entry.letter}
                  type="button"
                  onClick={() => handleLetterTap(entry)}
                  title={entry.note ? `${primary.word} (${entry.note})` : primary.word}
                  className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 py-3 px-1.5 shadow-md transition-all duration-200 active:scale-90 ${
                    isActive
                      ? 'scale-110 border-amber-300 bg-amber-400 text-yellow-950 shadow-amber-500/40'
                      : isDiscovered
                      ? 'border-emerald-400/70 bg-emerald-900/40 text-emerald-100 hover:brightness-110'
                      : 'border-sky-700/60 bg-[#173340] text-slate-100 hover:bg-[#1f4253]'
                  }`}
                >
                  <span className="font-game text-xl sm:text-2xl font-black leading-none">{entry.letter}</span>
                  <span className="text-lg sm:text-xl leading-none">{primary.emoji}</span>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide truncate max-w-full">
                    {primary.word}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode === 'bul' && (
        <>
          <div className="rounded-2xl bg-emerald-950/40 border border-emerald-800/50 px-4 py-3 flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-300 flex-shrink-0" />
            <p className="text-xs sm:text-sm font-semibold text-emerald-100 leading-relaxed">
              Resme bak, "Söyle" butonuna dokun ve adını yüksek sesle söyle, sonra hangi harfle başladığını alfabeden bul!
            </p>
          </div>

          {/* Hedef resim */}
          <div
            className={`rounded-3xl border-2 py-8 flex flex-col items-center justify-center gap-2 transition-colors duration-300 ${
              quizFeedback === 'correct'
                ? 'border-emerald-300 bg-emerald-500/20'
                : quizFeedback === 'wrong'
                ? 'border-rose-400 bg-rose-500/10 animate-shake'
                : 'border-sky-800/60 bg-[#0f2a35]'
            }`}
          >
            <span className="text-6xl sm:text-7xl">{quizTarget.word.emoji}</span>

            {micSupported ? (
              <button
                type="button"
                onClick={handleSpeakWord}
                disabled={micState === 'listening'}
                className={`flex items-center gap-1.5 rounded-xl border px-4 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                  micState === 'listening'
                    ? 'bg-rose-600/80 border-rose-400 text-white animate-pulse'
                    : micState === 'correct'
                    ? 'bg-emerald-600 border-emerald-300 text-white'
                    : 'bg-emerald-900/50 border-emerald-700/60 text-emerald-200'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                {micState === 'listening' ? 'Dinliyorum…' : 'Söyle'}
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-slate-400">
                Bu cihazda ses tanıma yok — yine de yüksek sesle söyle!
              </span>
            )}

            {micState === 'correct' && (
              <span className="text-xs font-bold text-emerald-300">Harika söyledin! 🎉</span>
            )}
            {micState === 'no-match' && (
              <span className="text-xs font-bold text-amber-300">Seni tam duyamadım, tekrar dener misin?</span>
            )}
            {micState === 'denied' && (
              <span className="text-xs font-bold text-rose-300">Mikrofon izni gerekiyor</span>
            )}
            {micState === 'error' && (
              <span className="text-xs font-bold text-rose-300">Bir sorun oldu, tekrar dener misin?</span>
            )}

            {quizFeedback === 'correct' && (
              <span className="font-game text-lg font-black text-emerald-200">
                Doğru! {quizTarget.word.word} → {quizTarget.entry.letter[0]}
              </span>
            )}
            {showHint && quizFeedback !== 'correct' && (
              <span className="font-game text-sm font-black text-amber-300">
                İpucu: {quizTarget.word.word[0]} ile başlıyor…
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (quizAdvanceTimeoutRef.current) window.clearTimeout(quizAdvanceTimeoutRef.current);
                nextQuizTarget();
              }}
              className="mt-1 flex items-center gap-1 rounded-xl bg-sky-900/60 border border-sky-700/60 px-3 py-1.5 text-[11px] font-bold text-sky-200"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Başka resim
            </button>
          </div>

          {/* Alfabe seçim tuşları — sadece harf, kelime/emoji yok ki cevabı ele vermesin */}
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {LETTER_ENTRIES.map((entry) => (
              <button
                key={entry.letter}
                type="button"
                onClick={() => handleQuizGuess(entry)}
                disabled={quizFeedback === 'correct'}
                className="rounded-xl border-2 border-sky-700/60 bg-[#173340] py-2.5 font-game text-sm sm:text-base font-black text-slate-100 transition-all active:scale-90 hover:bg-[#1f4253] disabled:opacity-40"
              >
                {entry.letter}
              </button>
            ))}
          </div>
        </>
      )}

      {mode === 'hece' && (
        <>
          <div className="rounded-2xl bg-purple-950/40 border border-purple-800/50 px-4 py-3 flex items-center gap-2.5">
            <PartyPopper className="w-5 h-5 text-purple-300 flex-shrink-0" />
            <p className="text-xs sm:text-sm font-semibold text-purple-100 leading-relaxed">
              Heceleri sırayla dokun, resmin adını tamamla! Karışık balonların içinde doğru heceler saklı.
            </p>
          </div>

          {/* Seviye göstergesi — ebeveyn ayarında açık olan seviyeler arasında ilerleme */}
          <div className="flex items-center justify-between rounded-2xl bg-purple-900/40 border border-purple-700/50 px-3.5 py-2">
            <span className="font-game text-xs sm:text-sm font-black text-purple-100">
              Seviye {activeHeceLevel} · {activeHeceLevel + 1} Heceli
            </span>
            {allowedLevels[allowedLevels.length - 1] !== activeHeceLevel ? (
              <span className="text-[10px] sm:text-xs font-bold text-purple-300">
                Sonraki seviye: {Math.min(heceLevelProgress, LEVEL_UP_THRESHOLD)}/{LEVEL_UP_THRESHOLD}
              </span>
            ) : (
              <span className="text-[10px] sm:text-xs font-bold text-purple-300">En üst açık seviye 🏆</span>
            )}
          </div>

          {/* Hedef resim + tamamlanan hece dizisi */}
          <div className="rounded-3xl border-2 border-purple-800/60 bg-[#1a0f2e] py-6 flex flex-col items-center justify-center gap-3">
            <span className="text-6xl sm:text-7xl">{syllableRound.target.emoji}</span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {syllableRound.target.syllables.map((syllable, index) => {
                const isFilled = index < selectedSyllables.length;
                return (
                  <span
                    key={`${syllable}-${index}`}
                    className={`min-w-[2.5rem] sm:min-w-[3.5rem] rounded-xl border-2 px-2 py-1.5 text-center font-game text-base sm:text-xl font-black transition-all ${
                      isFilled
                        ? 'border-emerald-300 bg-emerald-500/30 text-emerald-100'
                        : 'border-dashed border-purple-600/60 text-purple-500'
                    }`}
                  >
                    {isFilled ? selectedSyllables[index] : '—'}
                  </span>
                );
              })}
            </div>
            {selectedSyllables.length === syllableRound.target.syllables.length && (
              <span className="font-game text-lg font-black text-emerald-200">
                🎉 {syllableRound.target.word}!
              </span>
            )}
          </div>

          {/* Karışık hece balonları */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {syllableRound.pool.map((tile, index) => {
              const palette = ['bg-sky-600 border-sky-300', 'bg-rose-600 border-rose-300', 'bg-amber-500 border-amber-200', 'bg-emerald-600 border-emerald-300', 'bg-purple-600 border-purple-300', 'bg-teal-600 border-teal-300'];
              const colorClass = palette[index % palette.length];
              const isWrong = wrongTileId === tile.id;
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => handleTileTap(tile)}
                  className={`relative rounded-full border-2 py-4 font-game text-base sm:text-lg font-black text-white shadow-md transition-all active:scale-90 ${colorClass} ${
                    isWrong ? 'animate-shake' : 'hover:brightness-110'
                  }`}
                >
                  {tile.text}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              if (syllableAdvanceTimeoutRef.current) window.clearTimeout(syllableAdvanceTimeoutRef.current);
              nextSyllableRound(activeHeceLevel);
            }}
            className="flex items-center gap-1 rounded-xl bg-purple-900/60 border border-purple-700/60 px-3 py-1.5 text-[11px] font-bold text-purple-200"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Başka kelime
          </button>
        </>
      )}
    </div>
  );
};
