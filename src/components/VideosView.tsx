import React, { useState } from 'react';
import { StoryVideo } from '../types';
import { extractYoutubeId } from '../utils/storage';
import { Tv, Play, X, Plus, Trash2, Youtube, Sparkles, Check } from 'lucide-react';

interface VideosViewProps {
  videos: StoryVideo[];
  onDeleteVideo?: (id: string) => void;
}

export const VideosView: React.FC<VideosViewProps> = ({
  videos,
  onDeleteVideo,
}) => {
  const [activeVideo, setActiveVideo] = useState<StoryVideo | null>(null);

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
      {videos.length === 0 ? (
        <div className="bg-[#122834] border border-slate-700/80 rounded-3xl p-8 text-center text-slate-300 space-y-3">
          <div className="text-5xl animate-bounce">📺</div>
          <h3 className="font-game text-lg font-bold text-white">Henüz Eklenmiş Video Yok</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Sağ üstteki 🔐 Ebeveyn Portalı butonuna basıp PIN şifrenizi girerek çocuğunuz için YouTube çizgi filmleri ve eğitici videolar ekleyebilirsiniz!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="bg-[#15303e] rounded-3xl p-3.5 border-2 border-slate-600 shadow-lg hover:border-sky-400 transition-all group text-white relative flex flex-col justify-between"
            >
              <div>
                <div
                  onClick={() => setActiveVideo(video)}
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
                    onClick={() => setActiveVideo(video)}
                    className="font-game text-white text-sm sm:text-base font-bold group-hover:text-sky-300 transition-colors cursor-pointer"
                  >
                    {video.title}
                  </h3>

                  <button
                    onClick={() => onDeleteVideo(video.id)}
                    className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                    title="Videoyu Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-100 font-medium mt-1 line-clamp-2">
                  {video.description}
                </p>
              </div>

              <button
                onClick={() => setActiveVideo(video)}
                className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-game text-xs font-bold border border-rose-400 flex items-center justify-center gap-1.5 shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Videoyu İzle</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Video Modal Player */}
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
                onClick={() => setActiveVideo(null)}
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
