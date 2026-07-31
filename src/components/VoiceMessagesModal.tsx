import React, { useState, useEffect, useRef } from 'react';
import { VoiceMessage } from '../types';
import { playPopSound, playCoinSound, speakText } from '../utils/audio';
import { X, Mic, Square, Play, Send, Volume2, MessageCircle } from 'lucide-react';

interface VoiceMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: VoiceMessage[];
  onSendMessage: (msg: Omit<VoiceMessage, 'id' | 'createdAt' | 'isNew'>) => void;
  onMarkRead: (id: string) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  senderRole?: 'child' | 'parent';
  initialTab?: 'inbox' | 'record';
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

export const VoiceMessagesModal: React.FC<VoiceMessagesModalProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onMarkRead,
  soundEnabled,
  speechEnabled,
  senderRole = 'child',
  initialTab = 'inbox',
}) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'record'>('inbox');
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      audioPlayerRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const startRecording = async () => {
    playPopSound(soundEnabled);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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
      // Fallback mode without real mic
      setIsRecording(true);
      setRecordingTime(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    playPopSound(soundEnabled);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    } else {
      // Simulated audio preview if real mic wasn't captured
      setRecordingTime(Math.max(3, recordingTime));
    }
  };

  const handleSend = async () => {
    const finalTranscript = recordingTime > 0 ? 'Rüzgar’dan sesli mesaj 🎙️' : 'Rüzgar’dan sevgiler! ❤️';
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
    });

    speakText(finalTranscript, speechEnabled);

    // Reset recording form
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setActiveTab('inbox');
  };

  const handlePlayMessage = (msg: VoiceMessage) => {
    if (playingId === msg.id) return;
    audioPlayerRef.current?.pause();
    playPopSound(soundEnabled);
    setPlayingId(msg.id);
    onMarkRead(msg.id);

    if (msg.audioUrl) {
      const audio = new Audio(msg.audioUrl);
      audioPlayerRef.current = audio;
      audio.play();
      audio.onended = () => {
        audioPlayerRef.current = null;
        setPlayingId(null);
      };
    } else {
      // Speak transcript using SpeechSynthesis
      speakText(msg.transcript, speechEnabled);
      setTimeout(() => setPlayingId(null), (msg.durationSeconds || 4) * 1000);
    }
  };

  const handleStopMessage = () => {
    audioPlayerRef.current?.pause();
    audioPlayerRef.current = null;
    setPlayingId(null);
  };

  const newMessagesCount = messages.filter((m) => m.isNew).length;

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
                Sesli Notlar
                {newMessagesCount > 0 && (
                  <span className="bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded-full animate-bounce">
                    {newMessagesCount} Yeni
                  </span>
                )}
              </h2>
              <p className="text-xs text-sky-100 font-bold">
                Babama ses bırak, gelen mesajı dinle.
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
            <span>📥 Gelenler ({messages.length})</span>
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
            <span>🎙️ Babama Gönder</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'inbox' ? (
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="bg-[#091720] border border-slate-800 rounded-2xl p-6 text-center text-slate-400 space-y-2">
                  <div className="text-4xl">📭</div>
                  <p className="font-game text-sm font-bold text-slate-300">
                    Henüz sesli mesajınız yok!
                  </p>
                  <p className="text-xs">
                    “Babama Gönder” düğmesine dokunarak ilk sesli notunu bırakabilirsin.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
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
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                      </div>

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
                    Babama Ses Bırak
                  </h3>
                  <p className="text-xs text-slate-400">
                    Önce konuş, sonra kaydı bitir ve gönder.
                  </p>
                </div>

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
                  <button
                    onClick={() => handleSend()}
                    className="w-full min-h-12 px-4 rounded-xl font-game text-sm font-black bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-2 border-emerald-300 hover:brightness-110 shadow-md flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Send className="w-5 h-5" />
                    <span>Babaya Gönder 🚀</span>
                  </button>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
