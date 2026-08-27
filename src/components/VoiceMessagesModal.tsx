import React, { useState, useEffect, useRef } from 'react';
import { JournalMood, VoiceMessage } from '../types';
import { playPopSound, playCoinSound, speakText } from '../utils/audio';
import { X, Mic, Square, Play, Send, Volume2, MessageCircle, Trash2, RotateCcw, Headphones } from 'lucide-react';

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
  initialTab = 'inbox',
  journalMode = false,
  onJournalSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'record'>('inbox');
  const [messageFilter, setMessageFilter] = useState<'all' | 'received' | 'sent'>('all');
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
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

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
      setRecordingError('Mikrofon açılamadı. Tarayıcı ayarlarından mikrofon izni verip yeniden deneyebilirsin. Kayıt olmadan mesaj gönderilmeyecek.');
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
    const finalTranscript = journalMode ? 'Rüzgar’ın günlüğünden bir ses kaydı 📔' : 'Rüzgar’dan sesli mesaj 🎙️';
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
      senderName: senderRole === 'parent' ? 'Anne & Baba ❤️' : 'Rüzgar 👦',
      transcript: finalTranscript,
      durationSeconds: recordingTime > 0 ? recordingTime : 5,
      audioUrl: persistentAudioUrl,
      kind: journalMode ? 'journal' : 'message',
      title: journalMode ? (journalTitle.trim() || 'Bugünüm') : undefined,
      mood: journalMode ? journalMood : undefined,
    });

    if (journalMode) onJournalSaved?.();

    speakText(finalTranscript, speechEnabled);

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

  const handleDeleteMessage = (id: string) => {
    if (!window.confirm('Bu sesli mesaj silinsin mi?')) return;
    if (playingId === id) handleStopMessage();
    onDeleteMessage(id);
  };

  const handleRedoRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setRecordingError('');
    playPopSound(soundEnabled);
  };

  const visibleMessages = messages.filter((message) => journalMode ? message.kind === 'journal' : message.kind !== 'journal');
  const displayedMessages = journalMode || messageFilter === 'all'
    ? visibleMessages
    : visibleMessages.filter((message) => messageFilter === 'received' ? message.sender !== senderRole : message.sender === senderRole);
  const newMessagesCount = visibleMessages.filter((m) => m.isNew).length;
  const receivedCount = visibleMessages.filter((message) => message.sender !== senderRole).length;
  const sentCount = visibleMessages.filter((message) => message.sender === senderRole).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-[#0e2531] border-2 border-slate-700/80 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[88vh] text-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-2xl shadow-inner">
              🎙️
            </div>
            <div>
              <h2 className="font-game text-lg sm:text-xl font-bold flex items-center gap-2 text-white">
                {journalMode ? 'Günlüğüm' : 'Sesli Notlar'}
                {newMessagesCount > 0 && (
                  <span className="bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded-full animate-bounce">
                    {newMessagesCount} Yeni
                  </span>
                )}
              </h2>
              <p className="text-xs text-sky-100 font-bold">
                {journalMode ? 'Bugününü anlat; günlüğün tarih ve saatle saklansın.' : 'Babama ses bırak, gelen mesajı dinle.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-[#0a1820] p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex-1 py-2.5 rounded-2xl font-game text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'inbox'
                ? 'bg-[#2263df] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#142934]'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{journalMode ? `📔 Günlükler (${visibleMessages.length})` : `📥 Gelenler (${visibleMessages.length})`}</span>
            {newMessagesCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('record')}
            className={`flex-1 py-2.5 rounded-2xl font-game text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'record'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#142934]'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>{journalMode ? '🎙️ Günlük Kaydı' : '🎙️ Babama Gönder'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'inbox' ? (
            <div className="space-y-3">
              {playbackError && (
                <div role="alert" className="rounded-xl border border-amber-300 bg-amber-950/60 px-3 py-2 text-center text-xs font-bold text-amber-100">
                  {playbackError}
                </div>
              )}
              {!journalMode && visibleMessages.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-700 bg-[#091720] p-1.5" aria-label="Mesaj filtresi">
                  {([
                    ['all', `Tümü (${visibleMessages.length})`],
                    ['received', `Gelen (${receivedCount})`],
                    ['sent', `Gönderilen (${sentCount})`],
                  ] as const).map(([filter, label]) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setMessageFilter(filter)}
                      className={`min-h-10 rounded-xl px-1 text-[11px] font-black ${messageFilter === filter ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {displayedMessages.length === 0 ? (
                <div className="bg-[#091720] border border-slate-800 rounded-2xl p-6 text-center text-slate-400 space-y-2">
                  <div className="text-4xl">📭</div>
                  <p className="font-game text-sm font-bold text-slate-300">
                    {journalMode ? 'Henüz günlük kaydın yok!' : 'Henüz sesli mesajınız yok!'}
                  </p>
                  <p className="text-xs">
                    {journalMode ? '🎙️ Günlük Kaydı düğmesine dokunup bugününü anlatabilirsin.' : '“Babama Gönder” düğmesine dokunarak ilk sesli notunu bırakabilirsin.'}
                  </p>
                </div>
              ) : (
                    displayedMessages.map((msg) => {
                  const isPlaying = playingId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`relative bg-[#142a36] border rounded-2xl p-3.5 transition-all shadow-md cursor-pointer ${
                        msg.isNew
                          ? 'border-amber-300 ring-2 ring-amber-400/60 bg-[#193646] animate-pulse'
                          : 'border-slate-700/70'
                      }`}
                      onClick={() => !isPlaying && handlePlayMessage(msg)}
                    >
                      {/* Sender Row */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg">
                            {msg.sender === 'panda'
                              ? '🐼'
                              : msg.sender === 'parent'
                              ? '❤️'
                              : '👦'}
                          </div>
                          <div>
                            <div className="font-game text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                              <span>{msg.senderName}</span>
                              {msg.isNew && (
                                <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase animate-pulse">
                                  YENİ 🔴
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {new Date(msg.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[10px] font-bold text-sky-300">
                              {msg.sender === senderRole ? 'Gönderdiğin kayıt' : 'Sana gelen kayıt'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteMessage(msg.id);
                          }}
                          className="min-w-11 min-h-11 rounded-xl border border-rose-500/60 bg-rose-950/50 text-rose-200 hover:bg-rose-700 hover:text-white flex items-center justify-center transition-colors"
                          aria-label={`${msg.senderName} mesajını sil`}
                          title="Mesajı sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {msg.kind === 'journal' && (msg.title || msg.mood) && (
                        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-indigo-400/30 bg-indigo-950/40 px-3 py-2">
                          <span className="font-game text-xs font-black text-indigo-100">{msg.title || 'Bugünüm'}</span>
                          {msg.mood && <span className="text-xs font-bold text-indigo-200">{moodOptions.find((mood) => mood.value === msg.mood)?.emoji} {moodOptions.find((mood) => mood.value === msg.mood)?.label}</span>}
                        </div>
                      )}

                      {/* Message Content & Waveform */}
                      <div className="bg-[#0a1820] border border-slate-800 rounded-xl p-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handlePlayMessage(msg);
                          }}
                          disabled={isPlaying}
                          className="min-h-14 flex items-center justify-center gap-2 py-2 px-2 rounded-xl font-game text-sm sm:text-base font-bold transition-all shadow-sm bg-[#2263df] hover:bg-[#1c55c5] text-white border border-blue-400 disabled:cursor-default disabled:bg-slate-600 disabled:opacity-70"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>{isPlaying ? 'Dinleniyor…' : 'Oynat'}</span>
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleStopMessage();
                          }}
                          disabled={!isPlaying}
                          className="min-h-14 flex items-center justify-center gap-2 py-2 px-2 rounded-xl font-game text-sm sm:text-base font-bold transition-all shadow-sm bg-rose-600 hover:bg-rose-500 text-white border border-rose-300 disabled:cursor-default disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600"
                        >
                          <Square className="w-4 h-4 fill-current" />
                          <span>Durdur</span>
                        </button>
                      </div>

                      {/* Animated Audio Wave Graphic when playing */}
                      {isPlaying && (
                        <div className="mt-2 flex items-center justify-center gap-1 h-4">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                            <div
                              key={i}
                              className="w-1 bg-amber-400 rounded-full animate-pulse"
                              style={{
                                height: `${Math.floor(Math.random() * 12) + 4}px`,
                                animationDuration: `${0.3 + (i % 3) * 0.2}s`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* SEND VOICE MESSAGE TAB */
            <div className="space-y-4">
              {/* Microphone Recording Console */}
              <div className="bg-[#091720] border-2 border-slate-700/80 rounded-2xl p-5 text-center space-y-4 shadow-inner">
                <div className="space-y-1">
                  <h3 className="font-game text-sm sm:text-base font-bold text-white flex items-center justify-center gap-2">
                    <Mic className="w-4 h-4 text-rose-400" />
                    {journalMode ? 'Bugününü Anlat' : 'Babama Ses Bırak'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Önce konuş, sonra kaydı dinle; hazırsa kaydet.
                  </p>
                </div>

                {journalMode && (
                  <div className="space-y-3 text-left">
                    <label className="block text-xs font-black text-slate-300" htmlFor="journal-title">Bugünün başlığı <span className="font-normal text-slate-500">(istersen)</span></label>
                    <input
                      id="journal-title"
                      value={journalTitle}
                      onChange={(event) => setJournalTitle(event.target.value)}
                      placeholder="Örn. Parkta güzel bir gün"
                      maxLength={45}
                      className="min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-sm font-bold text-white placeholder:text-slate-500 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300/40"
                    />
                    <div>
                      <p className="mb-1.5 text-xs font-black text-slate-300">Bugün kendini nasıl hissediyorsun?</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {moodOptions.map((mood) => (
                          <button
                            key={mood.value}
                            type="button"
                            onClick={() => setJournalMood(mood.value)}
                            aria-label={mood.label}
                            className={`min-h-14 rounded-xl border px-1 py-1 text-center text-[10px] font-black ${journalMood === mood.value ? 'border-amber-300 bg-amber-400/25 text-amber-100 ring-2 ring-amber-300/50' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
                          >
                            <span className="block text-xl">{mood.emoji}</span>
                            {mood.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {recordingError && (
                  <div role="alert" className="rounded-xl border border-amber-300/70 bg-amber-950/70 px-3 py-2 text-left text-xs font-bold leading-relaxed text-amber-100">
                    {recordingError}
                  </div>
                )}

                {/* Clear 3-step recording flow */}
                <div className="flex flex-col items-center justify-center gap-2">
                  {!isRecording && !audioUrl && (
                    <button
                      onClick={startRecording}
                      className="w-full min-h-14 rounded-2xl flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:brightness-110 border-2 border-sky-300 text-white font-game text-base font-black shadow-blue-600/30 shadow-xl active:scale-95"
                    >
                      <Mic className="w-6 h-6" />
                      <span>Konuşmaya Başla</span>
                    </button>
                  )}
                  {isRecording && (
                    <button
                      onClick={stopRecording}
                      className="w-full min-h-14 rounded-2xl flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 border-2 border-rose-300 text-white font-game text-base font-black animate-pulse shadow-rose-600/50 shadow-xl active:scale-95"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      <span>Konuşmam Bitti</span>
                    </button>
                  )}

                  <div className="font-game text-sm font-bold">
                    {isRecording ? (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        Kaydediliyor: {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')}
                      </span>
                    ) : audioUrl ? (
                      <span className="text-emerald-400">Harika! Kaydın hazır. 🎉</span>
                    ) : (
                      <span className="text-slate-400">Büyük mavi düğmeye dokun.</span>
                    )}
                  </div>
                </div>

                {audioUrl && !isRecording && (
                  <div className="space-y-2">
                    <div className="rounded-xl border border-emerald-400/40 bg-emerald-950/35 p-2 text-left">
                      <div className="mb-1 flex items-center gap-2 text-xs font-black text-emerald-100"><Headphones className="h-4 w-4" /> Kaydını önce dinle</div>
                      <audio controls src={audioUrl} className="h-10 w-full" aria-label="Ses kaydı önizlemesi" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleRedoRecording}
                        className="min-h-12 rounded-xl border-2 border-slate-500 bg-slate-800 px-2 text-xs font-black text-slate-100 active:scale-95"
                      >
                        <RotateCcw className="mx-auto mb-0.5 h-4 w-4" /> Yeniden Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSend()}
                        className="min-h-12 rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-500 to-teal-600 px-2 text-xs font-black text-white shadow-md active:scale-95"
                      >
                        <Send className="mx-auto mb-0.5 h-4 w-4" /> {journalMode ? 'Günlüğü Kaydet' : 'Babaya Gönder'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
