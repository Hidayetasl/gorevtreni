/**
 * Web Audio API Sound Synthesizer & Speech Engine
 * Guarantees crisp, instant game sounds with zero external asset loading delay or 404 errors.
 */

let audioCtx: AudioContext | null = null;
let audioUnlockLogged = false;
let movementSoundLogCount = 0;

function audioLog(message: string, details?: Record<string, unknown>) {
  if (import.meta.env.DEV) console.log(`[Rüzgar ses] ${message}`, details || '');
}

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    // Calling resume here is safe; browsers will resolve it after the next
    // user gesture when the first sound was requested by an animation tick.
    void audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

/**
 * Unlock Web Audio from a real button/pointer gesture. Autoplay policies can
 * keep an AudioContext suspended when it is first created by the train timer.
 */
export function unlockAudioContext(): boolean {
  try {
    const ctx = getAudioContext();
    if (audioCtx.state === 'suspended') void ctx.resume().catch(() => undefined);
    if (!audioUnlockLogged) {
      audioUnlockLogged = true;
      audioLog('Web Audio hazır', { state: ctx.state });
    }
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[Rüzgar ses] Audio context kullanılamıyor', error);
    return false;
  }
}

/**
 * Short tactile button pop sound
 */
export function playPopSound(enabled: boolean = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[Rüzgar ses] Pop sesi henüz kullanılamıyor', e);
  }
}

/**
 * Bright metallic coin collect chime (2 tones: E5 -> B5)
 */
export function playCoinSound(enabled: boolean = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.setValueAtTime(987.77, now + 0.08); // B5

    osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.35);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[Rüzgar ses] Coin sesi üretilemedi', e);
  }
}

/**
 * Very short, low-volume rail movement tick used sparingly while the train moves.
 */
export function playTrainMovementTick(enabled: boolean = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(128, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(78, ctx.currentTime + 0.09);
    // V6 kokpitinde hareket sesi açıkken düşük ama duyulabilir bir ray ritmi.
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
    if (movementSoundLogCount < 3) {
      movementSoundLogCount += 1;
      audioLog('Hareket sesi üretildi', { count: movementSoundLogCount, state: ctx.state });
    }
  } catch (e) {
    console.warn('[Rüzgar ses] Hareket sesi üretilemedi', e);
  }
}

/**
 * Dual-tone realistic steam train whistle sound ("Choo-Choo!")
 */
export function playTrainWhistle(enabled: boolean = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    audioLog('Korna çalıyor', { state: ctx.state });

    const playPulse = (startTime: number, duration: number) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';

      // Train whistle chords: ~470Hz and ~587Hz (Bb4 & D5)
      osc1.frequency.setValueAtTime(466.16, startTime);
      osc2.frequency.setValueAtTime(587.33, startTime);

      gain.gain.setValueAtTime(0.015, startTime);
      gain.gain.linearRampToValueAtTime(0.28, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(startTime);
      osc1.stop(startTime + duration);
      osc2.start(startTime);
      osc2.stop(startTime + duration);
    };

    // Choo-Choo (Short whistle + Long whistle)
    playPulse(now, 0.18);
    playPulse(now + 0.22, 0.45);
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[Rüzgar ses] Korna üretilemedi', e);
  }
}

/**
 * Victory fanfare when task is approved or bonus unlocked!
 */
export function playFanfare(enabled: boolean = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.1);

      gain.gain.setValueAtTime(0.25, now + index * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.1);
      osc.stop(now + index * 0.1 + 0.3);
    });
  } catch (e) {
    console.debug('Fanfare error', e);
  }
}

// Tarayıcının ses listesi ASENKRON yüklenir (ilk çağrıda boş dönebilir). Sesler
// hazır olur olmaz önbelleğe alınıyor ki her konuşmada doğru/kaliteli sesi
// seçebilelim — özellikle İngilizce'de varsayılan (bazen düşük kaliteli veya
// yanlış aksanlı) sesi değil, bilinen net sesleri tercih ediyoruz.
let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const list = window.speechSynthesis.getVoices();
  if (list.length > 0) cachedVoices = list;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// İyi bilinen, net telaffuzlu sesler ÖNCELİK SIRASINA göre denenir (ilk
// eşleşen kazanır). macOS/iOS'un normal konuşma sesleri (Samantha, Ava, Alex,
// Daniel, Karen) ile Chrome'un ağ tabanlı Google sesleri en başta; işletim
// sistemlerinin "eğlence/karakter" sesleri (aşağıdaki kara listede) hiçbir
// zaman seçilmez — aksi halde cihazda başka uygun ses yoksa yanlışlıkla
// robotik/komik bir ses (ör. "Zarvox", "Bahh", "Albert") seçilebiliyordu, bu
// da "telaffuz net değil" şikayetinin bir kısmının kaynağıydı.
const PREFERRED_VOICE_NAMES = [
  'Google US English',
  'Samantha',
  'Ava',
  'Alex',
  'Microsoft Aria Online (Natural)',
  'Microsoft Guy Online (Natural)',
  'Microsoft Zira',
  'Microsoft David',
  'Karen',
  'Daniel',
  'Google UK English Female',
];

// macOS/iOS'un "eğlence" (novelty) sesleri: dil öğretimi için ASLA uygun
// değil, net biçimde hariç tutulur.
const BLOCKED_VOICE_NAMES = [
  'Albert', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Eddy', 'Flo',
  'Fred', 'Grandma', 'Grandpa', 'Jester', 'Junior', 'Organ', 'Org', 'Ralph',
  'Reed', 'Rocko', 'Sandy', 'Shelley', 'Superstar', 'Trinoids', 'Whisper',
  'Wobble', 'Zarvox', 'Bad News', 'Good News', 'İyi Haber', 'Kötü Haber',
];

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (cachedVoices.length === 0) loadVoices();
  if (cachedVoices.length === 0) return null;
  const langPrefix = lang.slice(0, 2).toLowerCase();
  const allowed = cachedVoices.filter(
    (v) => v.lang.toLowerCase().startsWith(langPrefix) && !BLOCKED_VOICE_NAMES.some((name) => v.name.includes(name)),
  );
  if (allowed.length === 0) return null;
  // Önce istenen dilin TAM eşleşmesi (ör. tam olarak "en-US"), sonra dil
  // önekiyle eşleşen herhangi bir ses (ör. "en-GB") denenir.
  const exact = allowed.filter((v) => v.lang.toLowerCase() === lang.toLowerCase());
  const pool = exact.length > 0 ? exact : allowed;
  for (const name of PREFERRED_VOICE_NAMES) {
    const match = pool.find((v) => v.name.includes(name));
    if (match) return match;
  }
  const local = pool.find((v) => v.localService);
  return local || pool[0];
}

/**
 * Web Speech API text-to-speech engine for encouraging Turkish feedback.
 * `lang` varsayılan olarak Türkçe'dir; İngilizce kelime/telaffuz öğretimi gibi
 * durumlar için 'en-US' geçilebilir (tarayıcının İngilizce sesi kullanılır).
 * `pitch` varsayılan olarak çocuklar için hafif enerjik (1.2); İngilizce
 * kelime öğretiminde netlik için genelde 1.0 (doğal) geçiriliyor — aşırı
 * pitch kayması sentezlenmiş sesi anlaşılmaz/bozuk hale getirebiliyor.
 */
export function speakText(text: string, enabled: boolean = true, rate: number = 0.95, lang: string = 'tr-TR', pitch: number = 1.2) {
  if (!enabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // Stop ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.pitch = pitch;
    utterance.rate = rate; // Çağıran, gerektiğinde (ör. harf öğretimi) daha yavaş bir hız verebilir
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.debug('TTS error', e);
  }
}
