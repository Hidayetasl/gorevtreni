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

/**
 * Web Speech API text-to-speech engine for encouraging Turkish feedback
 */
export function speakText(text: string, enabled: boolean = true, rate: number = 0.95) {
  if (!enabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // Stop ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.pitch = 1.2; // Slightly higher energetic pitch for children
    utterance.rate = rate; // Çağıran, gerektiğinde (ör. harf öğretimi) daha yavaş bir hız verebilir
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.debug('TTS error', e);
  }
}
