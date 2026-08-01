import React, { useEffect, useState } from 'react';
import { ParentConfig, StoryVideo } from '../types';
import { hashParentPin } from '../utils/storage';
import { sortVideosNewestFirst } from '../utils/videoOrder';
import { Tv, Play, X, Youtube, LockKeyhole, Timer } from 'lucide-react';

interface VideosViewProps {
  videos: StoryVideo[];
  parentConfig: ParentConfig;
}

export const VideosView: React.FC<VideosViewProps> = ({
  videos,
  parentConfig,
}) => {
  const orderedVideos = sortVideosNewestFirst(videos);
  const [activeVideo, setActiveVideo] = useState<StoryVideo | null>(null);
  const [lockedVideo, setLockedVideo] = useState<StoryVideo | null>(null);
  const [pin, setPin] = useState('');
  const [minutes, setMinutes] = useState('10');
  const [pinError, setPinError] = useState('');
  const [playUntil, setPlayUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!activeVideo || !playUntil) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((playUntil - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        setActiveVideo(null);
        setPlayUntil(null);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [activeVideo, playUntil]);

  const askToPlay = (video: StoryVideo) => {
    setLockedVideo(video);
    setPin('');
    setPinError('');
  };

  const startTimedVideo = (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setPinError('PIN 4 rakam olmalı.');
      return;
    }
    if (!parentConfig.pinHash || hashParentPin(pin) !== parentConfig.pinHash) {
      setPinError('PIN yanlış.');
      return;
    }
    const duration = Number(minutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
      setPinError('Süre 1 ile 180 dakika arasında olmalı.');
      return;
    }
    setActiveVideo(lockedVideo);
    setPlayUntil(Date.now() + duration * 60_000);
    setSecondsLeft(duration * 60);
    setLockedVideo(null);
    setPin('');
  };

  const stopAndLock = () => {
    setActiveVideo(null);
    setPlayUntil(null);
    setSecondsLeft(0);
  };

  const timeLeftLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-4 pb-28">
      {/* View Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <div className="text-[11px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-sky-400" />
            EĞLENCELİ ÇİZGİ FİLMLER & VİDEOLAR
          </div>
          <h2 className="font-game text-2xl sm:text-3xl font-black text-white">
            İzlet
          </h2>
        </div>

        {/* Ebeveyn PIN Info Badge */}
        <div className="bg-[#102430] border border-rose-500/60 text-rose-300 px-3 py-1.5 rounded-2xl font-game text-[11px] font-bold shadow-md flex items-center gap-1.5">
          <Youtube className="w-4 h-4 text-red-500 fill-red-500" />
          <span>🔐 Ebeveyn Portalı'ndan Eklenir</span>
        </div>
      </div>

      {/* Video Cards Grid */}
      {orderedVideos.length === 0 ? (
        <div className="bg-[#122834] border border-slate-700/80 rounded-3xl p-8 text-center text-slate-300 space-y-3">
          <div className="text-5xl animate-bounce">📺</div>
          <h3 className="font-game text-lg font-bold text-white">Henüz Eklenmiş Video Yok</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Sağ üstteki 🔐 Ebeveyn Portalı butonuna basıp PIN şifrenizi girerek çocuğunuz için YouTube çizgi filmleri ve eğitici videolar ekleyebilirsiniz!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {orderedVideos.map((video) => (
            <div
              key={video.id}
              className="bg-[#15303e] rounded-3xl p-3.5 border-2 border-slate-600 shadow-lg hover:border-sky-400 transition-all group text-white relative flex flex-col justify-between"
            >
              <div>
                <div
                  onClick={() => askToPlay(video)}
                  className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 mb-3 border border-slate-800 cursor-pointer"
                >
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                    <div className="w-13 h-13 rounded-full bg-red-600 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform border-2 border-white">
                      <Play className="w-6 h-6 fill-white translate-x-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    {video.duration}
                  </div>
                  <div className="absolute top-2 left-2 bg-[#2263df] text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    {video.category}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <h3
                    onClick={() => askToPlay(video)}
                    className="font-game text-white text-sm sm:text-base font-bold group-hover:text-sky-300 transition-colors cursor-pointer"
                  >
                    {video.title}
                  </h3>

                </div>

                <p className="text-xs text-slate-100 font-medium mt-1 line-clamp-2">
                  {video.description}
                </p>
              </div>

              <button
                onClick={() => askToPlay(video)}
                className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-game text-xs font-bold border border-rose-400 flex items-center justify-center gap-1.5 shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>🔐 Ebeveynle İzle</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Ebeveyn PIN'i ve süre belirleme */}
      {lockedVideo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
          <form onSubmit={startTimedVideo} className="bg-[#0f1d27] rounded-3xl max-w-sm w-full overflow-hidden border-2 border-amber-400/70 shadow-2xl text-white">
            <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-600 flex items-center gap-2">
              <LockKeyhole className="w-5 h-5" />
              <h3 className="font-game font-bold">Ebeveynle İzleme Zamanı</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm font-bold text-slate-100">{lockedVideo.title}</p>
              <label className="block text-xs font-bold text-slate-300">Ebeveyn PIN’i
                <input autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-1.5 w-full min-h-12 rounded-xl border border-slate-600 bg-slate-950 px-3 text-center text-xl tracking-[0.45em] font-black" placeholder="••••" />
              </label>
              <label className="block text-xs font-bold text-slate-300">Kaç dakika izlesin?
                <div className="mt-1.5 flex items-center gap-2">
                  <Timer className="w-5 h-5 text-amber-300" />
                  <input inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value.replace(/\D/g, '').slice(0, 3))} className="min-h-12 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 text-center text-lg font-black" />
                  <span className="text-sm">dakika</span>
                </div>
              </label>
              {pinError && <p role="alert" className="rounded-xl bg-rose-950/80 border border-rose-400 px-3 py-2 text-xs font-bold text-rose-200">{pinError}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setLockedVideo(null)} className="min-h-12 rounded-xl border border-slate-600 font-game text-sm">Vazgeç</button>
                <button type="submit" className="min-h-12 rounded-xl bg-emerald-600 border border-emerald-300 font-game text-sm font-bold">▶ Başlat</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Süreli Video Oynatıcı */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-[#0f1d27] rounded-3xl max-w-2xl w-full overflow-hidden border-2 border-sky-500/70 shadow-2xl text-white">
            <div className="p-3.5 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 truncate pr-2">
                <Tv className="w-5 h-5 flex-shrink-0" />
                <h3 className="font-game text-xs sm:text-sm font-bold truncate">
                  {activeVideo.title}
                </h3>
              </div>
              <button
                onClick={stopAndLock}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-3 sm:p-4 space-y-3">
              <div className="aspect-video rounded-2xl overflow-hidden bg-black relative shadow-inner border border-slate-800">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1`}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="rounded-2xl border border-amber-400/70 bg-amber-950/50 px-3 py-2 flex items-center justify-between gap-2">
                <span className="font-game text-xs text-amber-200">⏳ Kalan süre: {timeLeftLabel}</span>
                <button onClick={stopAndLock} className="min-h-10 rounded-xl bg-rose-600 px-3 text-xs font-game font-bold">■ Durdur ve Kilitle</button>
              </div>
              <div className="bg-[#091720] p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-300 font-medium">
                  {activeVideo.description}
                </p>
                <span className="bg-[#2263df] text-white text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0">
                  {activeVideo.category}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
