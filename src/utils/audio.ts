/**
 * Web Audio API Sound Synthesizer & Speech Engine
 * Guarantees crisp, instant game sounds with zero external asset loading delay or 404 errors.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
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
    console.debug('Audio not allowed yet', e);
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
    console.debug('Audio error', e);
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

    const playPulse = (startTime: number, duration: number) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';

      // Train whistle chords: ~470Hz and ~587Hz (Bb4 & D5)
      osc1.frequency.setValueAtTime(466.16, startTime);
      osc2.frequency.setValueAtTime(587.33, startTime);

      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.04);
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
    console.debug('Train sound error', e);
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

// İyi bilinen, net telaffuzlu cihaz-yerel (network gerektirmeyen, dolayısıyla
// daha hızlı ve stabil) sesler öncelikli seçiliyor; bulunamazsa dilin ilk
// yerel sesine, o da yoksa dilin ilk sesine düşülüyor.
const PREFERRED_VOICE_NAMES = ['Samantha', 'Google US English', 'Alex', 'Ava', 'Daniel', 'Google UK English Female'];

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (cachedVoices.length === 0) loadVoices();
  if (cachedVoices.length === 0) return null;
  const langPrefix = lang.slice(0, 2).toLowerCase();
  const pool = cachedVoices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  if (pool.length === 0) return null;
  const preferred = pool.find((v) => PREFERRED_VOICE_NAMES.some((name) => v.name.includes(name)));
  if (preferred) return preferred;
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
