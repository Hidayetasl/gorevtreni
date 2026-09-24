import React, { useEffect, useState } from 'react';
import { ParentConfig, StoryVideo } from '../types';
import { hashParentPin } from '../utils/storage';
import { sortVideosNewestFirst } from '../utils/videoOrder';
import { Check, LockKeyhole, Play, X } from 'lucide-react';
import navIzle from '../assets/images/nav-izle.webp';

interface VideosViewProps {
  videos: StoryVideo[];
  parentConfig: ParentConfig;
  onVideoStarted?: (video: StoryVideo) => void;
}

const MINUTE_CHOICES = [10, 20, 30];

/**
 * İzle: yalnızca ebeveynin onayladığı, oynatılabilir videolar. Her izleme ebeveyn
 * PIN'i ve süre sınırıyla başlar; süre bitince video kapanır ve çocuğa nazik bir
 * "süre doldu" kartı gösterilir.
 */
export const VideosView: React.FC<VideosViewProps> = ({
  videos,
  parentConfig,
  onVideoStarted,
}) => {
  // Güvenlik kararı: çocuk yüzeyine yalnızca ebeveyn onaylı ve embed edilebilir içerik çıkar.
  const orderedVideos = sortVideosNewestFirst(videos).filter(
    (video) => video.moderationStatus === 'approved' && video.embeddable === true,
  );
  const [activeVideo, setActiveVideo] = useState<StoryVideo | null>(null);
  const [lockedVideo, setLockedVideo] = useState<StoryVideo | null>(null);
  const [pin, setPin] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [pinError, setPinError] = useState('');
  const [playUntil, setPlayUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timeUp, setTimeUp] = useState(false);

  useEffect(() => {
    if (!activeVideo || !playUntil) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((playUntil - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        setActiveVideo(null);
        setPlayUntil(null);
        setTimeUp(true);
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
    setMinutes(10);
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
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      setPinError('Süre 1 ile 180 dakika arasında olmalı.');
      return;
    }
    if (!lockedVideo || lockedVideo.moderationStatus !== 'approved' || lockedVideo.embeddable !== true) {
      setPinError('Bu video ebeveyn tarafından henüz onaylanmadı.');
      return;
    }
    onVideoStarted?.(lockedVideo);
    setActiveVideo(lockedVideo);
    setPlayUntil(Date.now() + minutes * 60_000);
    setSecondsLeft(minutes * 60);
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
    <div className="gt-watch">
      <div className="gt-head">
        <h1>İzle</h1>
      </div>

      {orderedVideos.length === 0 ? (
        <section className="gt-lcard gt-watch-empty">
          <img src={navIzle} alt="" className="gt-watch-emptyimg" draggable={false} />
          <p className="gt-q">Henüz video yok</p>
          <p className="gt-hint">Bir büyüğün Ebeveyn panelinden sana uygun videolar ekleyebilir.</p>
        </section>
      ) : (
        <>
          <p className="gt-menu-hint">Bir video seç, büyüğün onaylasın.</p>
          <div className="gt-vgrid">
            {orderedVideos.map((video) => (
              <button key={video.id} type="button" className="gt-vcard" onClick={() => askToPlay(video)}>
                <span className="thumb">
                  <img src={video.thumbnailUrl} alt="" draggable={false} />
                  <span className="play" aria-hidden="true"><Play /></span>
                  {/\d+:\d{2}/.test(video.duration || "") && <span className="dur">{video.duration}</span>}
                </span>
                <span className="tt">{video.title}</span>
                <span className="gt-vwatch"><LockKeyhole aria-hidden="true" />İzle</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Ebeveyn PIN'i ve süre seçimi */}
      {lockedVideo && (
        <div className="gt-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="watch-pin-title">
          <div className="gt-sheet-bg" onClick={() => setLockedVideo(null)} aria-hidden="true" />
          <form className="gt-sheet" onSubmit={startTimedVideo}>
            <span className="gt-sheet-tag"><LockKeyhole aria-hidden="true" className="gt-tag-ic" />Büyük onayı</span>
            <img className="gt-vsheet-thumb" src={lockedVideo.thumbnailUrl} alt="" draggable={false} />
            <h2 id="watch-pin-title">{lockedVideo.title}</h2>
            <label className="gt-field">
              <span>Ebeveyn PIN’i</span>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={4}
                value={pin}
                onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                placeholder="••••"
              />
            </label>
            <div className="gt-field">
              <span>Kaç dakika izlesin?</span>
              <div className="gt-seg" role="group" aria-label="İzleme süresi">
                {MINUTE_CHOICES.map((choice) => (
                  <button key={choice} type="button" className={minutes === choice ? 'on' : ''} aria-pressed={minutes === choice} onClick={() => setMinutes(choice)}>
                    {choice} dk
                  </button>
                ))}
              </div>
            </div>
            {pinError && <p role="alert" className="gt-result again">{pinError}</p>}
            <div className="gt-pair">
              <button type="button" className="gt-ghost" onClick={() => setLockedVideo(null)}>Vazgeç</button>
              <button type="submit" className="gt-big mavi"><Play aria-hidden="true" />Başlat</button>
            </div>
          </form>
        </div>
      )}

      {/* Süreli video oynatıcı */}
      {activeVideo && (
        <div className="gt-player" role="dialog" aria-modal="true" aria-label={activeVideo.title}>
          <div className="gt-player-bar">
            <span className="gt-player-time" aria-live="off">⏳ {timeLeftLabel}</span>
            <span className="gt-player-title">{activeVideo.title}</span>
            <button type="button" className="gt-player-close" onClick={stopAndLock} aria-label="Videoyu kapat">
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="gt-player-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`}
              title={activeVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Süre doldu */}
      {timeUp && (
        <div className="gt-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="watch-timeup-title">
          <div className="gt-sheet-bg" onClick={() => setTimeUp(false)} aria-hidden="true" />
          <div className="gt-sheet">
            <span className="gt-sheet-pic" aria-hidden="true">👋</span>
            <h2 id="watch-timeup-title">Süre doldu!</h2>
            <p className="gt-hint">Harika izledin. Şimdi görevlerine ya da Dünya’na dönebilirsin.</p>
            <button type="button" className="gt-big turkuaz" onClick={() => setTimeUp(false)}><Check aria-hidden="true" strokeWidth={3} />Tamam</button>
          </div>
        </div>
      )}
    </div>
  );
};
