import React, { useState, useEffect, useRef } from 'react';
import { JournalMood, VoiceMessage } from '../types';
import { playPopSound, playCoinSound, speakText } from '../utils/audio';
import { ArrowLeft, Check, Mic, Play, RotateCcw, Send, Square, Trash2, X } from 'lucide-react';

interface VoiceMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: VoiceMessage[];
  onSendMessage: (msg: Omit<VoiceMessage, 'id' | 'createdAt' | 'isNew'>) => void;
  onMarkRead: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  senderRole?: 'child' | 'parent';
  /** Gönderen adı: çocuk için Rüzgar, ebeveyn için giriş yapan yetişkin (Baba, Anne...). */
  senderName?: string;
  initialTab?: 'inbox' | 'record';
  journalMode?: boolean;
  onJournalSaved?: () => void;
}

/**
 * Blob URL'leri sayfa yenilenince geçersizleşir. Kısa ses notlarını veri URL'si
 * olarak saklamak ise localStorage'da tekrar açılmalarını sağlar.
 */
const audioBlobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Ses kaydı okunamadı.'));
    reader.readAsDataURL(blob);
  });

/**
 * WAV is deliberately used for outgoing messages. Unlike WebM/Opus, it plays
 * natively in both iPhone Safari and Chrome/Android, so a note sent from a
 * computer cannot become silent on an iPhone.
 */
/** "Baba’dan", "Anne’den", "Rüzgar’dan": ayrılma eki ünlü uyumuna göre -dan/-den. */
const fromName = (name: string) => {
  const vowels = name.toLocaleLowerCase('tr-TR').match(/[aeıioöuü]/g) || [];
  const back = ['a', 'ı', 'o', 'u'].includes(vowels[vowels.length - 1] || 'e');
  const hard = /[fsthşçkp]$/i.test(name);
  return `${name}’${hard ? 't' : 'd'}${back ? 'an' : 'en'}`;
};

const moodOptions: { value: JournalMood; label: string; emoji: string }[] = [
  { value: 'happy', label: 'Neşeli', emoji: '😊' },
  { value: 'calm', label: 'Sakin', emoji: '😌' },
  { value: 'proud', label: 'Gururlu', emoji: '🌟' },
  { value: 'tired', label: 'Yorgun', emoji: '😴' },
  { value: 'sad', label: 'Biraz üzgün', emoji: '💙' },
];

const encodeWav = (chunks: Float32Array[], sampleRate: number) => {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, length * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[index]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

export const VoiceMessagesModal: React.FC<VoiceMessagesModalProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onMarkRead,
  onDeleteMessage,
  soundEnabled,
  speechEnabled,
  senderRole = 'child',
  senderName,
  initialTab = 'inbox',
  journalMode = false,
  onJournalSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'record'>('inbox');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState('');
  const [recordingError, setRecordingError] = useState('');
  const [journalTitle, setJournalTitle] = useState('');
  const [journalMood, setJournalMood] = useState<JournalMood>('happy');

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const silenceNodeRef = useRef<GainNode | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      audioPlayerRef.current?.pause();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(journalMode ? 'record' : initialTab);
      setConfirmDeleteId(null);
    }
  }, [isOpen, initialTab, journalMode]);

  if (!isOpen) return null;

  const startRecording = async () => {
    playPopSound(soundEnabled);
    setRecordingError('');
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      // Record standard PCM/WAV whenever Web Audio is available. This is the
      // most reliable shared format for Safari, Chrome and Android.
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        const context = new AudioContextClass();
        await context.resume();
        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(4096, 1, 1);
        const silentGain = context.createGain();
        silentGain.gain.value = 0;
        pcmChunksRef.current = [];
        processor.onaudioprocess = (event) => {
          pcmChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        };
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(context.destination);
        audioContextRef.current = context;
        sourceNodeRef.current = source;
        processorNodeRef.current = processor;
        silenceNodeRef.current = silentGain;
        setIsRecording(true);
        setRecordingTime(0);
        timerIntervalRef.current = window.setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
        return;
      }

      // Very old browsers without Web Audio retain the existing recorder path.
      // Safari, Chrome and Android do not all record the same audio format.  Use
      // the best format the current phone supports and keep that format all the
      // way to Firebase; forcing every recording to `audio/webm` made some
      // iPhone recordings impossible to play back.
      const preferredTypes = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ];
      const supportedType = typeof MediaRecorder.isTypeSupported === 'function'
        ? preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
        : undefined;
      const mediaRecorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const chunkType = audioChunksRef.current.find((chunk) => chunk.type)?.type;
        const mimeType = chunkType || mediaRecorder.mimeType || supportedType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone permission denied or not available:', err);
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setIsRecording(false);
      setRecordingTime(0);
      setRecordingError(senderRole === 'parent'
        ? 'Mikrofon açılamadı. Tarayıcı ayarlarından mikrofon izni verip yeniden deneyin.'
        : 'Mikrofon açılamadı. Bir büyüğünden yardım iste 💜');
    }
  };

  const stopRecording = () => {
    playPopSound(soundEnabled);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsRecording(false);

    if (audioContextRef.current) {
      sourceNodeRef.current?.disconnect();
      processorNodeRef.current?.disconnect();
      silenceNodeRef.current?.disconnect();
      const recording = encodeWav(pcmChunksRef.current, audioContextRef.current.sampleRate);
      const url = URL.createObjectURL(recording);
      setAudioBlob(recording);
      setAudioUrl(url);
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      void audioContextRef.current.close();
      audioContextRef.current = null;
      sourceNodeRef.current = null;
      processorNodeRef.current = null;
      silenceNodeRef.current = null;
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    } else {
      setRecordingError('Bu tarayıcıda ses kaydı başlatılamadı. Mikrofon iznini kontrol edip yeniden dene.');
      setRecordingTime(0);
    }
  };

  const handleSend = async () => {
    if (!audioBlob || !audioUrl) {
      setRecordingError('Önce gerçek bir ses kaydı yapmalısın. Büyük düğmeye dokunup konuş, sonra kaydı dinle.');
      return;
    }
    const name = senderName || (senderRole === 'parent' ? 'Baba' : 'Rüzgar');
    const finalTranscript = journalMode ? 'Günlükten bir ses kaydı 📔' : `${fromName(name)} sesli mesaj 🎙️`;
    let persistentAudioUrl: string | undefined;

    if (audioBlob) {
      try {
        persistentAudioUrl = await audioBlobToDataUrl(audioBlob);
      } catch (error) {
        console.warn('Ses kaydı kalıcı biçime dönüştürülemedi:', error);
      }
    }

    playCoinSound(soundEnabled);

    onSendMessage({
      sender: senderRole === 'parent' ? 'parent' : 'child',
      senderName: name,
      transcript: finalTranscript,
      durationSeconds: recordingTime > 0 ? recordingTime : 5,
      audioUrl: persistentAudioUrl,
      kind: journalMode ? 'journal' : 'message',
      title: journalMode ? (journalTitle.trim() || `Bugünüm · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`) : undefined,
      mood: journalMode ? journalMood : undefined,
    });

    if (journalMode) onJournalSaved?.();

    speakText(journalMode ? 'Günlüğüne kaydedildi. Aferin!' : 'Mesajın gönderildi!', speechEnabled);
    setSavedToast(journalMode ? '📔 Günlüğüne kaydedildi!' : '✓ Mesajın gönderildi!');
    window.setTimeout(() => setSavedToast(''), 2400);

    // Reset recording form
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setJournalTitle('');
    setJournalMood('happy');
    setRecordingError('');
    setActiveTab('inbox');
  };

  const handlePlayMessage = (msg: VoiceMessage) => {
    if (playingId === msg.id) return;
    audioPlayerRef.current?.pause();
    playPopSound(soundEnabled);
    setPlaybackError('');
    setPlayingId(msg.id);

    if (msg.audioUrl) {
      const audio = new Audio();
      // iPhone Safari needs a real media element initiated directly from the
      // button click. `playsInline` also keeps playback within Safari.
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');
      audio.src = msg.audioUrl;
      audioPlayerRef.current = audio;
      audio.onended = () => {
        audioPlayerRef.current = null;
        setPlayingId(null);
      };
      audio.onerror = () => {
        audioPlayerRef.current = null;
        setPlayingId(null);
        setPlaybackError('Ses açılamadı. Telefonun sesini açıp Oynat’a yeniden dokun.');
      };
      void audio.play().then(() => {
        onMarkRead(msg.id);
      }).catch(() => {
        audioPlayerRef.current = null;
        setPlayingId(null);
        setPlaybackError('Ses başlayamadı. Telefonun sesini açıp Oynat’a yeniden dokun.');
      });
    } else {
      // Speak transcript using SpeechSynthesis
      onMarkRead(msg.id);
      speakText(msg.transcript, speechEnabled);
      setTimeout(() => setPlayingId(null), (msg.durationSeconds || 4) * 1000);
    }
  };

  const handleStopMessage = () => {
    audioPlayerRef.current?.pause();
    audioPlayerRef.current = null;
    setPlayingId(null);
  };

  // Silme yalnızca ebeveyn ekranında var; önce büyük bir onay kartı sorar.
  const handleDeleteMessage = (id: string) => {
    if (playingId === id) handleStopMessage();
    onDeleteMessage(id);
    setConfirmDeleteId(null);
  };

  const handleRedoRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setRecordingError('');
    playPopSound(soundEnabled);
  };

  const isParent = senderRole === 'parent';
  const visibleMessages = messages
    .filter((message) => !message.deletedAt)
    .filter((message) => journalMode ? message.kind === 'journal' : message.kind !== 'journal')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const time = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const whoLabel = (msg: VoiceMessage) => {
    if (msg.kind === 'journal') return msg.title || 'Günlüğüm';
    // Aynı rolden başka bir yetişkinin mesajı (Baba açıkken Anne’ninki) kendi adıyla görünür.
    if (msg.sender === senderRole && (!senderName || msg.senderName === senderName || senderRole === 'child')) return 'Senin mesajın';
    const clean = msg.senderName.replace(/[^\p{L}\s&]/gu, '').trim();
    // Eski kayıtlarda "Anne & Baba" gibi birleşik adlar var; onlarda eksiz yaz.
    if (!clean || clean.includes('&')) return clean ? `${clean} gönderdi` : msg.sender === 'child' ? 'Rüzgar’dan' : 'Baba’dan';
    return fromName(clean);
  };
  const avatar = (msg: VoiceMessage) => {
    if (msg.kind === 'journal') return moodOptions.find((mood) => mood.value === msg.mood)?.emoji || '📔';
    if (msg.sender === 'panda') return '🐼';
    return msg.sender === 'parent' ? '❤️' : '🧒';
  };
  const mm = String(Math.floor(recordingTime / 60)).padStart(2, '0');
  const ss = String(recordingTime % 60).padStart(2, '0');
  const title = journalMode ? 'Günümü anlat' : isParent ? 'Rüzgar’la mesajlar' : 'Mesajlar';
  const recordTitle = journalMode ? 'Bugün neler yaptın?' : isParent ? 'Rüzgar’a ses gönder' : 'Ses gönder';
  const confirmMsg = visibleMessages.find((msg) => msg.id === confirmDeleteId);

  return (
    <div className="gt-vm-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <div className="gt-vm">
        <header className="gt-vm-top">
          {activeTab === 'record' && !journalMode ? (
            <button type="button" className="gt-vm-iconbtn back" onClick={() => { handleRedoRecording(); setActiveTab('inbox'); }} aria-label="Mesajlara dön">
              <ArrowLeft aria-hidden="true" strokeWidth={3} />
            </button>
          ) : (
            <span className={`gt-vm-badge ${journalMode ? 'mor' : ''}`} aria-hidden="true">{journalMode ? '📔' : '🎙️'}</span>
          )}
          <h2>{activeTab === 'record' && !journalMode ? recordTitle : title}</h2>
          <button type="button" className="gt-vm-iconbtn" onClick={() => { if (isRecording) stopRecording(); handleStopMessage(); onClose(); }} aria-label="Kapat">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="gt-vm-body">
          {activeTab === 'record' ? (
            /* KAYIT: tek dev mikrofon */
            <section className="gt-vm-rec">
              {journalMode && (
                <>
                  <p className="gt-q">{recordTitle}</p>
                  <p className="gt-vm-sub">Bugün kendini nasıl hissediyorsun?</p>
                  <div className="gt-moods" role="radiogroup" aria-label="Bugünkü duygu">
                    {moodOptions.map((mood) => (
                      <button key={mood.value} type="button" role="radio" aria-checked={journalMood === mood.value} className={journalMood === mood.value ? 'on' : ''} onClick={() => { playPopSound(soundEnabled); setJournalMood(mood.value); }}>
                        <span className="e" aria-hidden="true">{mood.emoji}</span>{mood.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {!audioUrl && (
                <>
                  <button type="button" className={`gt-mic ${isRecording ? 'rec' : ''}`} onClick={isRecording ? stopRecording : startRecording} aria-label={isRecording ? 'Konuşmam bitti' : 'Konuşmaya başla'}>
                    {isRecording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
                  </button>
                  <p className="gt-vm-hint" aria-live="polite">
                    {isRecording ? <><b className="gt-rec-dot" aria-hidden="true" />Dinliyorum… {mm}:{ss}<br />Bitince yine dokun</> : journalMode ? 'Mikrofona dokun ve anlat' : 'Mikrofona dokun ve konuş'}
                  </p>
                </>
              )}

              {audioUrl && !isRecording && (
                <>
                  <span className="gt-vm-ready" aria-hidden="true">🎉</span>
                  <p className="gt-q">Kaydın hazır!</p>
                  <audio controls src={audioUrl} className="gt-vm-audio" aria-label="Kaydını dinle" />
                  <div className="gt-pair">
                    <button type="button" className="gt-ghost" onClick={handleRedoRecording}><RotateCcw aria-hidden="true" />Tekrar</button>
                    <button type="button" className={`gt-big ${journalMode ? 'mor' : ''}`} onClick={() => void handleSend()}>
                      {journalMode ? <Check aria-hidden="true" strokeWidth={3} /> : <Send aria-hidden="true" />}{journalMode ? 'Kaydet' : 'Gönder'}
                    </button>
                  </div>
                </>
              )}

              {recordingError && <p className="gt-result again" role="alert">{recordingError}</p>}

              {journalMode && visibleMessages.length > 0 && (
                <div className="gt-vm-list">
                  <p className="gt-label">ESKİ GÜNLÜKLERİM</p>
                  {visibleMessages.slice(0, 20).map((msg) => renderRow(msg))}
                </div>
              )}
            </section>
          ) : (
            /* GELEN KUTUSU */
            <section className="gt-vm-inbox">
              {playbackError && <p className="gt-result again" role="alert">{playbackError}</p>}
              {visibleMessages.length === 0 ? (
                <div className="gt-vm-empty">
                  <span aria-hidden="true">📭</span>
                  <p className="gt-q">Henüz mesaj yok</p>
                  <p className="gt-vm-sub">{isParent ? 'Aşağıdan Rüzgar’a ilk sesli mesajını gönder.' : 'Aşağıdaki mikrofona dokunup ilk mesajını gönder.'}</p>
                </div>
              ) : (
                <div className="gt-vm-list">
                  {visibleMessages.map((msg) => renderRow(msg))}
                </div>
              )}
            </section>
          )}
        </div>

        {activeTab === 'inbox' && (
          <div className="gt-vm-foot">
            <button type="button" className="gt-big mor" onClick={() => { playPopSound(soundEnabled); setActiveTab('record'); }}>
              <Mic aria-hidden="true" />{recordTitle}
            </button>
          </div>
        )}

        {savedToast && <div className="gt-toast" role="status">{savedToast}</div>}

        {isParent && confirmMsg && (
          <div className="gt-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="vm-del-title">
            <div className="gt-sheet-bg" onClick={() => setConfirmDeleteId(null)} aria-hidden="true" />
            <div className="gt-sheet">
              <span className="gt-sheet-pic" aria-hidden="true">🗑️</span>
              <h2 id="vm-del-title">Bu mesaj silinsin mi?</h2>
              <p className="gt-hint">{whoLabel(confirmMsg)} · {time(confirmMsg.createdAt)}. Bütün cihazlardan silinir.</p>
              <div className="gt-pair">
                <button type="button" className="gt-ghost" onClick={() => setConfirmDeleteId(null)}>Vazgeç</button>
                <button type="button" className="gt-big gt-danger" onClick={() => handleDeleteMessage(confirmMsg.id)}><Trash2 aria-hidden="true" />Sil</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function renderRow(msg: VoiceMessage) {
    const isPlaying = playingId === msg.id;
    const incoming = msg.sender !== senderRole && msg.kind !== 'journal';
    return (
      <div key={msg.id} className={`gt-msg ${msg.isNew && incoming ? 'new' : ''} ${incoming ? 'in' : 'out'}`}>
        <span className="gt-msg-av" aria-hidden="true">{avatar(msg)}</span>
        <span className="gt-msg-t">
          <b>{whoLabel(msg)}</b>
          <small>{time(msg.createdAt)}{msg.durationSeconds ? ` · ${msg.durationSeconds} sn` : ''}</small>
          {msg.isNew && incoming && <span className="gt-msg-new">YENİ</span>}
        </span>
        <button type="button" className={`gt-msg-play ${isPlaying ? 'on' : ''}`} onClick={() => (isPlaying ? handleStopMessage() : handlePlayMessage(msg))} aria-label={isPlaying ? 'Durdur' : 'Dinle'}>
          {isPlaying ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
          {isPlaying ? 'Durdur' : 'Dinle'}
        </button>
        {isParent && (
          <button type="button" className="gt-msg-del" onClick={() => setConfirmDeleteId(msg.id)} aria-label="Mesajı sil">
            <Trash2 aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
};
