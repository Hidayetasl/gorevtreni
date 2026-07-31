import React, { useState, useEffect } from 'react';
import { PlacedWorldItem, ShopItem, UserProfile } from '../types';
import { playTrainWhistle, playPopSound, speakText } from '../utils/audio';
import { Plus, Trash2, Play, Pause, Sparkles, Volume2, FastForward, RotateCcw, MapPin, Eye, Compass, Layers } from 'lucide-react';

// Import generated cartoon assets
import cartoonBg from '../assets/images/cartoon_train_background_1785400076710.jpg';
import pandaLocomotive from '../assets/images/cartoon_panda_locomotive_1785400092467.jpg';

interface TrainWorldViewProps {
  worldItems: PlacedWorldItem[];
  inventory: ShopItem[];
  user: UserProfile;
  onPlaceItem: (item: Omit<PlacedWorldItem, 'id'>) => void;
  onRemoveItem: (id: string) => void;
  onSetActiveTrain?: (icon: string) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
}

type ViewMode = 'ride' | 'builder';
type EnvironmentTheme = 'farm' | 'mountains' | 'sunset' | 'night';

type SceneAnchor = { left: string; top: string; size: string };

// Ana dünya bir oyun sahnesi; kareli "Harita Çizimi" görünümü ise ayrı bir
// düzenleme ekranı. Her eşyanın sahnede doğal ve sabit bir yeri vardır.
// Aynı türden birden çok eşya alındığında sıradaki alternatif nokta kullanılır.
const SCENE_ANCHORS: Record<string, SceneAnchor[]> = {
  'scenery-tree': [
    { left: '13%', top: '30%', size: 'text-4xl sm:text-6xl' },
    { left: '70%', top: '29%', size: 'text-4xl sm:text-6xl' },
    { left: '84%', top: '43%', size: 'text-3xl sm:text-5xl' },
  ],
  'scenery-flower': [
    { left: '76%', top: '62%', size: 'text-3xl sm:text-5xl' },
    { left: '46%', top: '63%', size: 'text-2xl sm:text-4xl' },
  ],
  'scenery-cow': [
    { left: '67%', top: '48%', size: 'text-4xl sm:text-6xl' },
  ],
  'scenery-house': [
    { left: '34%', top: '42%', size: 'text-4xl sm:text-6xl' },
  ],
  'scenery-ferris': [
    { left: '79%', top: '24%', size: 'text-5xl sm:text-7xl' },
  ],
};

export const TrainWorldView: React.FC<TrainWorldViewProps> = ({
  worldItems,
  inventory,
  user,
  onPlaceItem,
  onRemoveItem,
  onSetActiveTrain,
  soundEnabled,
  speechEnabled,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('ride');
  const [envTheme, setEnvTheme] = useState<EnvironmentTheme>('farm');
  
  // Interactive train states for ride mode (straight railway track line)
  const [trainXPos, setTrainXPos] = useState(10);
  const [isTrainRunning, setIsTrainRunning] = useState(true);
  const [trainSpeed, setTrainSpeed] = useState<'normal' | 'fast' | 'slow'>('normal');
  const [trainDirection, setTrainDirection] = useState<'right' | 'left'>('right');
  const [isWhistling, setIsWhistling] = useState(false);
  const [smokePuffs, setSmokePuffs] = useState<{ id: number; x: number }[]>([]);
  const [attachedWagons, setAttachedWagons] = useState<string[]>(['passenger', 'cargo_coins', 'cargo_fruits']);
  const [interactiveMessage, setInteractiveMessage] = useState<string>('Panda Kaptan Rayların Üzerinde Düz Hatta İlerliyor! 🚂💨');

  // Check unlocked structures from inventory
  const hasPlacedBridge = worldItems.some((item) => item.itemId === 'track-bridge');
  const hasPlacedTunnel = worldItems.some((item) => item.itemId === 'track-tunnel');
  const hasPlacedStation = worldItems.some((item) => item.itemId === 'track-station');

  // Mağazadan "Dünyana Ekle" ile bırakılan her dekor ana manzarada da görünür.
  // Ray yapıları kendi, raya hizalı katmanlarında çizilir.
  const placedSceneItems = worldItems.filter((item) => ![
    'track-straight', 'track-curve', 'track-bridge', 'track-tunnel', 'track-station',
  ].includes(item.itemId) && SCENE_ANCHORS[item.itemId]);

  const sceneItems = (() => {
    const usedAnchors = new Map<string, number>();
    return placedSceneItems.map((item) => {
      const anchors = SCENE_ANCHORS[item.itemId];
      const used = usedAnchors.get(item.itemId) || 0;
      usedAnchors.set(item.itemId, used + 1);
      return { item, anchor: anchors[used % anchors.length] };
    });
  })();

  // Interactive village elements states
  const [cowMooing, setCowMooing] = useState(false);
  const [windmillSpinningFast, setWindmillSpinningFast] = useState(false);
  const [applesFalling, setApplesFalling] = useState(false);
  const [townFountainActive, setTownFountainActive] = useState(false);
  const [activeHouseTab, setActiveHouseTab] = useState<string | null>(null);

  // Builder grid states
  const [isBuildMode, setIsBuildMode] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<ShopItem | null>(null);
  const [trainPositionIndex, setTrainPositionIndex] = useState(0);

  // Continuous loop for Straight Line Railway Track Motion
  useEffect(() => {
    if (!isTrainRunning || viewMode !== 'ride') return;

    const speedStep = trainSpeed === 'fast' ? 0.65 : trainSpeed === 'slow' ? 0.25 : 0.45;
    const interval = setInterval(() => {
      setTrainXPos((prev) => {
        if (trainDirection === 'right') {
          return prev >= 110 ? -50 : prev + speedStep;
        } else {
          return prev <= -50 ? 110 : prev - speedStep;
        }
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isTrainRunning, trainSpeed, trainDirection, viewMode]);

  // Whistle horn action
  const handleWhistleBlow = () => {
    playTrainWhistle(soundEnabled);
    speakText('Çuf Çuf! Tren kalkıyor!', speechEnabled);
    setIsWhistling(true);
    setInteractiveMessage('ÇUF ÇUF! Panda Kaptan Düdük Çaldı! 🚂💨');

    // Add animated smoke puff bubbles at locomotive chimney position
    const newPuff = { id: Date.now(), x: trainXPos + (trainDirection === 'right' ? 8 : -8) };
    setSmokePuffs((prev) => [...prev.slice(-4), newPuff]);

    setTimeout(() => {
      setIsWhistling(false);
    }, 1500);
  };

  // Filter track items for builder mode
  const trackItems = worldItems.filter((item) =>
    item.name.toLowerCase().includes('ray') ||
    item.icon.includes('🛤️') ||
    item.icon.includes('↩️') ||
    item.icon.includes('🌉') ||
    item.icon.includes('🚉')
  );

  // Train track item for builder grid mode
  const currentTrainTrack = trackItems[trainPositionIndex] || trackItems[0] || { x: 4, y: 3 };

  // Interactive item tap handlers in cartoon mode
  const handleCowClick = () => {
    playPopSound(soundEnabled);
    setCowMooing(true);
    setInteractiveMessage('İnek: Möööö! Taze ot yiyor 🐄🌾');
    speakText('İnek möö diyor!', speechEnabled);
    setTimeout(() => setCowMooing(false), 2000);
  };

  const handleWindmillClick = () => {
    playPopSound(soundEnabled);
    setWindmillSpinningFast(true);
    setInteractiveMessage('Rüzgar türbini süper hızlı dönüyor! 🌬️⚡');
    speakText('Rüzgar türbini hızlı dönüyor!', speechEnabled);
    setTimeout(() => setWindmillSpinningFast(false), 3000);
  };

  const handleAppleTreeClick = () => {
    playPopSound(soundEnabled);
    setApplesFalling(true);
    setInteractiveMessage('Ağaçtan taze kırmızı elmalar düştü! 🍎🍏');
    speakText('Ağaçtan elmalar düştü!', speechEnabled);
    setTimeout(() => setApplesFalling(false), 2500);
  };

  const handleTileClick = (x: number, y: number) => {
    playPopSound(soundEnabled);

    if (isBuildMode && selectedInventoryItem) {
      const existing = worldItems.find((i) => i.x === x && i.y === y);
      if (existing) {
        onRemoveItem(existing.id);
      }
      onPlaceItem({
        itemId: selectedInventoryItem.id,
        x,
        y,
        icon: selectedInventoryItem.icon,
        name: selectedInventoryItem.name,
      });
      setInteractiveMessage(`${selectedInventoryItem.name} haritaya yerleştirildi! ✨`);
      return;
    }

    const clickedItem = worldItems.find((i) => i.x === x && i.y === y);
    if (clickedItem) {
      if (clickedItem.icon.includes('🌳')) {
        handleAppleTreeClick();
      } else if (clickedItem.icon.includes('🐄')) {
        handleCowClick();
      } else if (clickedItem.icon.includes('🚉')) {
        setInteractiveMessage('İstasyondaki yolcular Rüzgar\'a el sallıyor! 👋');
        speakText('İstasyondaki yolcular el sallıyor!', speechEnabled);
      } else {
        setInteractiveMessage(`${clickedItem.name} nesnesine dokundun! ✨`);
      }
    }
  };

  const toggleWagon = (type: string) => {
    playPopSound(soundEnabled);
    if (attachedWagons.includes(type)) {
      if (attachedWagons.length > 1) {
        setAttachedWagons(attachedWagons.filter((w) => w !== type));
        setInteractiveMessage('Vagon çıkarıldı! 🚃');
      }
    } else {
      setAttachedWagons([...attachedWagons, type]);
      setInteractiveMessage('Yeni vagon trene bağlandı! 🚃✨');
    }
  };

  // Instant Inventory item activator & placer
  const handleUseInventoryItem = (item: ShopItem) => {
    playPopSound(soundEnabled);

    if (item.type === 'train') {
      if (onSetActiveTrain) {
        onSetActiveTrain(item.icon);
      }
      setInteractiveMessage(`Yeni Lokomotif Seçildi: ${item.name}! 🚂✨`);
      speakText(`${item.name} lokomotifiniz olarak seçildi!`, speechEnabled);
      return;
    }

    if (item.type === 'wagon' || item.category === 'wagons') {
      const wType = item.wagonType || 'passenger';
      if (!attachedWagons.includes(wType)) {
        setAttachedWagons((prev) => [...prev, wType]);
        setInteractiveMessage(`Yeni Vagon Bağlandı: ${item.name}! 🚃✨`);
        speakText(`${item.name} treninize başarıyla bağlandı!`, speechEnabled);
      } else {
        setInteractiveMessage(`${item.name} zaten treninizin arkasında bağlı! 🚃💨`);
      }
      setSelectedInventoryItem(item);
      return;
    }

    // Auto-place on world grid if not placed yet
    const alreadyPlaced = worldItems.some((w) => w.itemId === item.id);
    if (!alreadyPlaced) {
      let slotX = 2;
      let slotY = 2;
      for (let r = 0; r < 7; r++) {
        let found = false;
        for (let c = 0; c < 8; c++) {
          if (!worldItems.some((w) => w.x === c && w.y === r)) {
            slotX = c;
            slotY = r;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      onPlaceItem({
        itemId: item.id,
        x: slotX,
        y: slotY,
        icon: item.icon,
        name: item.name,
      });

      setInteractiveMessage(`Harikalar Diyarı! ${item.name} dünyana eklendi! ✨`);
      speakText(`${item.name} dünyana eklendi!`, speechEnabled);
    } else {
      setInteractiveMessage(`${item.name} dünyanda yayında! Harita çiziminde yerini değiştirebilirsin. ✨`);
    }

    setSelectedInventoryItem(item);
  };

  const unlockedItems = inventory.filter((i) => i.unlocked);

  const GRID_COLS = 8;
  const GRID_ROWS = 7;

  return (
    <div className="space-y-2.5 pb-20">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div>
          <div className="text-[11px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>BENİM CANLI TRENİM</span>
          </div>
          <h2 className="font-game text-2xl sm:text-3xl font-black text-white">
            Tren Dünyası
          </h2>
          <p className="text-xs text-slate-300 font-medium mt-0.5">
            Çizgi film kalitesinde tren sür ve kendi dünyanı tasarla!
          </p>
        </div>

        {/* View Mode Toggle Switcher */}
        <div className="flex items-center gap-1.5 bg-[#0a1822] p-1 rounded-2xl border border-slate-700 shadow-inner">
          <button
            onClick={() => setViewMode('ride')}
            className={`px-3.5 py-2 rounded-xl font-game font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all ${
              viewMode === 'ride'
                ? 'bg-[#2263df] text-white shadow-md border border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🚂 Sürüş Modu</span>
          </button>
          <button
            onClick={() => setViewMode('builder')}
            className={`px-3.5 py-2 rounded-xl font-game font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all ${
              viewMode === 'builder'
                ? 'bg-[#2263df] text-white shadow-md border border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🗺️ Harita Çizimi</span>
          </button>
        </div>
      </div>

      {/* Interactive Status & Quick Whistle Bar */}
      <div className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 rounded-3xl p-2.5 sm:p-3 text-white shadow-xl border-b-4 border-blue-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleWhistleBlow}
            className={`w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-950 font-game text-2xl flex items-center justify-center border-b-4 border-amber-600 shadow-lg active:scale-90 transition-transform ${
              isWhistling ? 'animate-bounce ring-4 ring-yellow-300' : ''
            }`}
            title="Düdük Çal! Çuf Çuf!"
          >
            📢
          </button>
          <div>
            <div className="text-[11px] font-bold text-sky-200 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin" />
              <span>Canlı Tren Durumu</span>
            </div>
            <h3 className="font-game text-xs sm:text-sm font-black text-white drop-shadow-sm">
              {interactiveMessage}
            </h3>
          </div>
        </div>

        <button
          onClick={handleWhistleBlow}
          className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-game font-black text-xs sm:text-sm px-4 py-2 rounded-2xl shadow-md border-b-2 border-red-700 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
        >
          <span>DÜDÜK ÇAL 📢</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: HIGH-QUALITY CARTOON RIDE GAME CANVAS (MATCHING USER PHOTO)   */}
      {/* ===================================================================== */}
      {viewMode === 'ride' && (
        <div className="space-y-4">
          {/* Main Graphic Canvas Box */}
          <div className="relative w-full aspect-[16/9] min-h-[300px] sm:min-h-[420px] rounded-3xl overflow-hidden border-4 border-slate-700 shadow-2xl group select-none">
            {/* Background Illustration Image */}
            <img
              src={cartoonBg}
              alt="Cartoon Train Scene"
              className={`w-full h-full object-cover transition-all duration-700 ${
                envTheme === 'sunset'
                  ? 'sepia hue-rotate-15 contrast-110'
                  : envTheme === 'night'
                  ? 'brightness-50 hue-rotate-180 contrast-125'
                  : envTheme === 'mountains'
                  ? 'saturate-150 contrast-105'
                  : ''
              }`}
            />

            {/* Environment Filters Overlay (Sunset / Night Sky Effects) */}
            {envTheme === 'sunset' && (
              <div className="absolute inset-0 bg-gradient-to-b from-orange-500/20 via-pink-500/10 to-purple-900/30 pointer-events-none" />
            )}
            {envTheme === 'night' && (
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-indigo-950/50 to-slate-900/60 pointer-events-none">
                <div className="absolute top-4 right-10 text-4xl animate-pulse">🌙</div>
                <div className="absolute top-8 left-1/4 text-yellow-200 text-xs">✨</div>
                <div className="absolute top-12 left-2/3 text-yellow-200 text-sm">✨</div>
              </div>
            )}

            {/* Clickable Interactive Scenery Hotspots */}

            {/* 1. Grazing Cows on the Field */}
            <div
              onClick={handleCowClick}
              className={`absolute bottom-[28%] left-[8%] sm:left-[12%] z-20 cursor-pointer transition-transform hover:scale-110 ${
                cowMooing ? 'animate-bounce scale-125' : ''
              }`}
              title="İnek üzerine tıkla!"
            >
              <div className="relative">
                <span className="text-4xl sm:text-6xl drop-shadow-lg">🐄</span>
                {cowMooing && (
                  <div className="absolute -top-10 left-0 bg-white text-slate-900 font-game font-black text-xs px-2 py-1 rounded-xl shadow-lg border border-slate-300 animate-pop">
                    MÖÖÖÖ! 🌾
                  </div>
                )}
              </div>
            </div>

            {/* 2. Apple Tree with Falling Apples */}
            <div
              onClick={handleAppleTreeClick}
              className={`absolute bottom-[32%] right-[15%] sm:right-[22%] z-20 cursor-pointer transition-transform hover:scale-105 ${
                applesFalling ? 'animate-wiggle' : ''
              }`}
              title="Ağaca tıkla!"
            >
              <div className="relative">
                <span className="text-4xl sm:text-6xl drop-shadow-lg">🌳</span>
                {applesFalling && (
                  <div className="absolute top-8 left-2 flex gap-1 animate-bounce">
                    <span className="text-base sm:text-xl">🍎</span>
                    <span className="text-base sm:text-xl">🍏</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Spinning Windmills Hotspot */}
            <div
              onClick={handleWindmillClick}
              className="absolute top-[18%] right-[12%] sm:right-[18%] z-20 cursor-pointer"
              title="Rüzgar türbinine tıkla!"
            >
              <div className={`transition-transform duration-300 ${windmillSpinningFast ? 'scale-125' : 'hover:scale-110'}`}>
                <span className={`text-3xl sm:text-5xl inline-block drop-shadow-md ${
                  windmillSpinningFast ? 'animate-spin' : 'animate-spin-slow'
                }`}>
                  ⚙️
                </span>
              </div>
            </div>

            {/* 4. Drifting Sky Clouds */}
            <div className="absolute top-4 left-6 z-10 text-2xl sm:text-4xl opacity-80 animate-cloud-slow pointer-events-none">
              ☁️
            </div>
            <div className="absolute top-10 left-1/2 z-10 text-3xl sm:text-5xl opacity-70 animate-cloud-fast pointer-events-none">
              ☁️
            </div>

            {/* Floating Smoke Puff Bubbles generated from whistle */}
            {smokePuffs.map((puff) => (
              <div
                key={puff.id}
                className="absolute bottom-[48%] z-30 text-2xl sm:text-4xl animate-float-smoke pointer-events-none"
                style={{ left: `${puff.left}%` }}
              >
                💨
              </div>
            ))}

            {/* Mağazadan yerleştirilen dekorlar: sadece harita çiziminde değil, ana dünyada da kalıcı görünür. */}
            {sceneItems.map(({ item, anchor }) => {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTileClick(item.x, item.y)}
                  className="absolute z-25 flex flex-col items-center gap-0.5 rounded-xl px-1 py-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  style={{ left: anchor.left, top: anchor.top }}
                  title={`${item.name} — dokun ve keşfet`}
                >
                  <span className={`${anchor.size} leading-none drop-shadow-[0_3px_3px_rgba(15,23,42,0.55)]`}>{item.icon}</span>
                  <span className="max-w-20 truncate rounded-full bg-slate-950/80 px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm sm:text-[10px]">
                    {item.name}
                  </span>
                </button>
              );
            })}

            {/* 4. STRAIGHT HORIZONTAL RAILWAY TRACK OVERLAY */}
            <div className="absolute bottom-[13%] left-0 w-full h-10 sm:h-14 z-10 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 1000 40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="railSteelGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="40%" stopColor="#cbd5e1" />
                    <stop offset="70%" stopColor="#64748b" />
                    <stop offset="100%" stopColor="#334155" />
                  </linearGradient>
                </defs>

                {/* Gravel Ballast Track Bed Foundation */}
                <rect x="0" y="8" width="1000" height="26" fill="#1e293b" opacity="0.85" />
                <rect x="0" y="11" width="1000" height="20" fill="#78350f" opacity="0.45" />

                {/* Wooden Ties / Railway Sleepers */}
                <line x1="0" y1="21" x2="1000" y2="21" stroke="#451a03" strokeWidth="16" strokeDasharray="6 10" />

                {/* Top Steel Rail (Where train wheels sit!) */}
                <rect x="0" y="13" width="1000" height="3" fill="url(#railSteelGradient)" />
                <line x1="0" y1="13.5" x2="1000" y2="13.5" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />

                {/* Bottom Steel Rail */}
                <rect x="0" y="27" width="1000" height="3" fill="url(#railSteelGradient)" />
                <line x1="0" y1="27.5" x2="1000" y2="27.5" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
              </svg>
            </div>

            {/* Red Steel Bridge Overlay when unlocked or placed */}
            {hasPlacedBridge && (
              <div
                onClick={() => {
                  playPopSound(soundEnabled);
                  setInteractiveMessage('Kırmızı Tren Köprüsü: Tren köprünün altından güvenle geçiyor! 🌉✨');
                  speakText('Kırmızı tren köprüsü aktif!', speechEnabled);
                }}
                className="absolute bottom-[11%] left-[26%] w-[26%] h-16 sm:h-24 z-25 cursor-pointer hover:scale-105 transition-transform"
                title="Kırmızı Tren Köprüsü"
              >
                <div className="relative w-full h-full flex items-end justify-center">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 200 70">
                    <path d="M0,60 Q100,-10 200,60" fill="none" stroke="#dc2626" strokeWidth="8" />
                    <path d="M10,60 Q100,5 190,60" fill="none" stroke="#ef4444" strokeWidth="4" />
                    <rect x="20" y="45" width="8" height="20" fill="#7f1d1d" />
                    <rect x="95" y="20" width="10" height="45" fill="#7f1d1d" />
                    <rect x="170" y="45" width="8" height="20" fill="#7f1d1d" />
                  </svg>
                  <span className="absolute -top-2 bg-red-950/90 text-red-200 border border-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                    Kırmızı Tren Köprüsü 🌉
                  </span>
                </div>
              </div>
            )}

            {/* Mountain Tunnel Overlay when unlocked or placed */}
            {hasPlacedTunnel && (
              <div
                onClick={() => {
                  playPopSound(soundEnabled);
                  setInteractiveMessage('Dağ Tüneli: Tren dağın altındaki tünelden çuf çuf geçiyor! 🕳️⛰️');
                  speakText('Dağ tüneli aktif!', speechEnabled);
                }}
                className="absolute bottom-[10%] right-[1%] w-24 sm:w-36 h-20 sm:h-28 z-25 cursor-pointer hover:scale-105 transition-transform"
                title="Dağ Tüneli"
              >
                <div className="relative w-full h-full flex items-end">
                  <span className="text-5xl sm:text-7xl absolute -top-4 right-2 z-10 drop-shadow-lg">⛰️</span>
                  <div className="absolute bottom-0 right-1 w-20 sm:w-28 h-14 sm:h-20 bg-slate-950 rounded-t-full border-4 border-amber-900/90 flex items-center justify-center shadow-2xl">
                    <span className="text-2xl sm:text-4xl">🕳️</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. CUTE CARTOON VILLAGE TOWN CENTER (Above the Straight Track) */}
            <div className="absolute top-[28%] left-[12%] w-[76%] h-[42%] z-20 pointer-events-auto flex items-center justify-around px-2">
              {/* House 1: Bakery / Cafe */}
              <div
                onClick={() => {
                  playPopSound(soundEnabled);
                  setActiveHouseTab('bakery');
                  setInteractiveMessage('Kasaba Fırını: Taze sıcak simit ve ekmek kokuyor! 🥖🥐');
                  speakText('Fırından sıcak ekmek kokusu geliyor!', speechEnabled);
                }}
                className="cursor-pointer transition-transform hover:scale-110 relative group"
                title="Fırına tıkla!"
              >
                <span className="text-3xl sm:text-5xl drop-shadow-md">🥐</span>
                <span className="absolute -top-3 left-1 text-xs animate-ping">💨</span>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-amber-900/90 text-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  Fırın
                </div>
              </div>

              {/* Town Fountain (Centerpiece) */}
              <div
                onClick={() => {
                  playPopSound(soundEnabled);
                  setTownFountainActive(true);
                  setInteractiveMessage('Kasaba fıskiyesinden su köpürdü! ⛲💦');
                  speakText('Kasaba fıskiyesi çalışıyor!', speechEnabled);
                  setTimeout(() => setTownFountainActive(false), 2500);
                }}
                className={`cursor-pointer transition-transform hover:scale-110 relative ${
                  townFountainActive ? 'scale-125' : ''
                }`}
                title="Havuzlu fıskiyeye tıkla!"
              >
                <span className="text-3xl sm:text-5xl drop-shadow-md">⛲</span>
                {townFountainActive && (
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-base sm:text-2xl animate-bounce">
                    💦
                  </span>
                )}
              </div>

              {/* House 2: Village School */}
              <div
                onClick={() => {
                  playPopSound(soundEnabled);
                  setActiveHouseTab('school');
                  setInteractiveMessage('Kasaba Okulu: Ziller çalıyor, çocuklar neşeyle ders işliyor! 🔔🏫');
                  speakText('Kasaba okulunda ders başladı!', speechEnabled);
                }}
                className="cursor-pointer transition-transform hover:scale-110 relative group"
                title="Okula tıkla!"
              >
                <span className="text-3xl sm:text-5xl drop-shadow-md">🏫</span>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-900/90 text-blue-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  Okul
                </div>
              </div>

              {/* House 3: Cute Clockhouse */}
              <div
                onClick={() => {
                  playPopSound(soundEnabled);
                  setActiveHouseTab('house');
                  setInteractiveMessage('Sevimli Kasaba Evi: Neşeli aile treni selamlıyor! 🏡👋');
                  speakText('Evdeki aile treni selamlıyor!', speechEnabled);
                }}
                className="cursor-pointer transition-transform hover:scale-110 relative group"
                title="Ev üzerine tıkla!"
              >
                <span className="text-3xl sm:text-5xl drop-shadow-md">🏡</span>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-emerald-900/90 text-emerald-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  Kasaba Evi
                </div>
              </div>
            </div>

            {/* Merkezî Tren Garı — mağazadan alındığında ana ray hattında görünür. */}
            {hasPlacedStation && <div
              onClick={() => {
                playPopSound(soundEnabled);
                setInteractiveMessage('Sincap Köy Garı: Yolcular treni neşeyle bekliyor! 🚉🎟️');
                speakText('Tren istasyonundaki yolcular el sallıyor!', speechEnabled);
              }}
              className="absolute bottom-[24%] left-[6%] z-20 cursor-pointer hover:scale-105 transition-transform"
              title="Sincap Köy Garına tıkla!"
            >
              <div className="flex items-center gap-1.5 bg-amber-950/90 border-2 border-amber-500/80 px-2.5 py-1 rounded-xl shadow-xl">
                <span className="text-2xl sm:text-4xl">🚉</span>
                <span className="font-game text-[10px] sm:text-xs text-amber-300 font-bold whitespace-nowrap">
                  Sincap Köy Garı
                </span>
              </div>
            </div>}

            {/* Floating Smoke Puff Bubbles generated from whistle */}
            {smokePuffs.map((puff) => (
              <div
                key={puff.id}
                className="absolute z-50 text-2xl sm:text-4xl animate-float-smoke pointer-events-none"
                style={{
                  left: `${puff.x}%`,
                  bottom: '26%',
                }}
              >
                💨
              </div>
            ))}

            {/* 6. DYNAMIC HORIZONTAL TRAIN ASSEMBLY MOVING ON THE STRAIGHT TRACK */}
            <div
              className="absolute bottom-[16.2%] z-30 transition-all duration-75 flex items-end flex-row-reverse pointer-events-auto cursor-pointer"
              style={{
                left: `${trainXPos}%`,
                transform: trainDirection === 'left' ? 'scaleX(-1)' : 'none',
              }}
              onClick={handleWhistleBlow}
              title="Panda Kaptan Treni! Tıkla ve düdük çal!"
            >
              {/* Locomotive (Leading at the front of the train!) */}
              <div className="relative flex items-end drop-shadow-xl z-10">
                <div className="relative w-18 sm:w-28 h-14 sm:h-20 flex items-end">
                  <svg viewBox="0 0 120 75" className="w-full h-full overflow-visible">
                    {/* Front Headlight Beam */}
                    <polygon points="100,42 140,20 140,65" fill="#fef08a" opacity="0.45" />

                    {/* Main Steam Engine Red Boiler Body */}
                    <rect x="32" y="28" width="65" height="30" rx="6" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
                    <rect x="42" y="28" width="5" height="30" fill="#fbbf24" opacity="0.9" />
                    <rect x="72" y="28" width="5" height="30" fill="#fbbf24" opacity="0.9" />

                    {/* Boiler Nose Front */}
                    <path d="M97,28 Q107,43 97,58 Z" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="2" />

                    {/* Headlight Lamp */}
                    <circle cx="103" cy="43" r="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
                    <circle cx="103" cy="43" r="2.5" fill="#fef08a" />

                    {/* Steam Chimney Funnel */}
                    <path d="M84,28 L82,14 L92,14 L90,28 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
                    <rect x="80" y="12" width="14" height="4" rx="1" fill="#f59e0b" />

                    {/* Driver Cabin (Royal Blue) */}
                    <rect x="4" y="10" width="34" height="48" rx="5" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
                    <rect x="2" y="8" width="38" height="6" rx="2" fill="#dc2626" />

                    {/* Cabin Window with Panda Driver */}
                    <rect x="9" y="18" width="24" height="20" rx="4" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />

                    {/* Panda Face inside window */}
                    <circle cx="21" cy="28" r="7" fill="#ffffff" stroke="#1e293b" strokeWidth="0.8" />
                    <circle cx="16" cy="22" r="2.5" fill="#0f172a" />
                    <circle cx="26" cy="22" r="2.5" fill="#0f172a" />
                    <circle cx="18" cy="27" r="1.2" fill="#0f172a" />
                    <circle cx="24" cy="27" r="1.2" fill="#0f172a" />
                    <ellipse cx="21" cy="30" rx="1.5" ry="1" fill="#0f172a" />
                    <path d="M15,20 Q21,15 27,20 Z" fill="#1e3a8a" />
                    <rect x="15" y="19" width="12" height="2" fill="#fbbf24" />

                    {/* Front Cow Catcher Grill */}
                    <polygon points="98,58 112,58 107,50 98,50" fill="#334155" stroke="#0f172a" strokeWidth="1" />

                    {/* Steel Wheels Sitting Directly on Rails */}
                    <g className="animate-spin-slow" style={{ transformOrigin: '20px 60px' }}>
                      <circle cx="20" cy="60" r="9" fill="#0f172a" stroke="#fbbf24" strokeWidth="2" />
                      <circle cx="20" cy="60" r="3" fill="#94a3b8" />
                      <line x1="12" y1="60" x2="28" y2="60" stroke="#fbbf24" strokeWidth="1.5" />
                    </g>
                    <g className="animate-spin-slow" style={{ transformOrigin: '48px 60px' }}>
                      <circle cx="48" cy="60" r="7.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="2" />
                      <circle cx="48" cy="60" r="2.5" fill="#94a3b8" />
                      <line x1="42" y1="60" x2="54" y2="60" stroke="#fbbf24" strokeWidth="1.5" />
                    </g>
                    <g className="animate-spin-slow" style={{ transformOrigin: '76px 60px' }}>
                      <circle cx="76" cy="60" r="7.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="2" />
                      <circle cx="76" cy="60" r="2.5" fill="#94a3b8" />
                      <line x1="70" y1="60" x2="82" y2="60" stroke="#fbbf24" strokeWidth="1.5" />
                    </g>

                    {/* Side Rod */}
                    <rect x="20" y="58" width="56" height="4" rx="2" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
                  </svg>
                </div>
                {/* Steam Smoke Puff from Chimney */}
                <span className="absolute -top-4 right-3 text-xs sm:text-base animate-ping opacity-80">
                  💨
                </span>
              </div>

              {/* Main Coupler connecting Locomotive to the first wagon */}
              <div className="w-2.5 sm:w-3.5 h-1.5 bg-slate-800 rounded-full mb-2 -mx-0.5 border border-slate-600" />

              {/* Connected Wagons (Trailing seamlessly behind the locomotive) */}
              <div className="flex items-end flex-row-reverse">
                {attachedWagons.map((type, idx) => (
                  <React.Fragment key={type}>
                    {idx > 0 && (
                      <div className="w-2.5 sm:w-3.5 h-1.5 bg-slate-800 rounded-full mb-2 -mx-0.5 border border-slate-600" />
                    )}

                    {type === 'passenger' && (
                      <div className="relative shrink-0 bg-red-700 h-9 sm:h-14 w-14 sm:w-24 rounded-xl border-2 border-red-950 ring-1 ring-red-300/80 shadow-lg flex items-center justify-around px-1 mb-0.5 opacity-100">
                        <div className="w-3 sm:w-5 h-4 sm:h-6 bg-amber-200 rounded flex items-center justify-center text-[10px] sm:text-xs">
                          🐱
                        </div>
                        <div className="w-3 sm:w-5 h-4 sm:h-6 bg-amber-200 rounded flex items-center justify-center text-[10px] sm:text-xs">
                          🐰
                        </div>
                        <div className="w-3 sm:w-5 h-4 sm:h-6 bg-amber-200 rounded flex items-center justify-center text-[10px] sm:text-xs">
                          🐻
                        </div>
                        {/* Wheels directly touching top steel rail */}
                        <div className="absolute -bottom-2 left-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                        <div className="absolute -bottom-2 right-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                      </div>
                    )}

                    {type === 'cargo_coins' && (
                      <div className="relative shrink-0 bg-amber-600 h-8 sm:h-12 w-12 sm:w-20 rounded-lg border-2 border-amber-950 ring-1 ring-amber-200/80 shadow-lg flex items-center justify-center mb-0.5 opacity-100">
                        <div className="absolute -top-3 text-xs sm:text-lg flex items-center gap-0.5 animate-bounce">
                          <span>🪙</span>
                          <span>🪙</span>
                        </div>
                        <div className="absolute -bottom-2 left-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                        <div className="absolute -bottom-2 right-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                      </div>
                    )}

                    {type === 'cargo_fruits' && (
                      <div className="relative shrink-0 bg-emerald-600 h-8 sm:h-12 w-12 sm:w-20 rounded-lg border-2 border-emerald-950 ring-1 ring-emerald-200/80 shadow-lg flex items-center justify-center mb-0.5 opacity-100">
                        <div className="absolute -top-3 text-xs sm:text-lg flex items-center gap-0.5">
                          <span>🍎</span>
                          <span>🍌</span>
                        </div>
                        <div className="absolute -bottom-2 left-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                        <div className="absolute -bottom-2 right-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                      </div>
                    )}

                    {type === 'cargo_toys' && (
                      <div className="relative shrink-0 bg-purple-600 h-8 sm:h-12 w-12 sm:w-20 rounded-lg border-2 border-purple-950 ring-1 ring-purple-200/80 shadow-lg flex items-center justify-center mb-0.5 opacity-100">
                        <div className="absolute -top-3 text-xs sm:text-lg flex items-center gap-0.5">
                          <span>🧸</span>
                          <span>🎁</span>
                        </div>
                        <div className="absolute -bottom-2 left-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                        <div className="absolute -bottom-2 right-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                      </div>
                    )}

                    {type === 'cargo_animals' && (
                      <div className="relative shrink-0 bg-orange-600 h-8 sm:h-12 w-12 sm:w-20 rounded-lg border-2 border-orange-950 ring-1 ring-orange-200/80 shadow-lg flex items-center justify-center mb-0.5 opacity-100">
                        <div className="absolute -top-3 text-xs sm:text-lg flex items-center gap-0.5 animate-bounce">
                          <span>🦁</span>
                          <span>🦒</span>
                        </div>
                        <div className="absolute -bottom-2 left-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                        <div className="absolute -bottom-2 right-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                      </div>
                    )}

                    {type === 'cargo_candy' && (
                      <div className="relative shrink-0 bg-pink-600 h-8 sm:h-12 w-12 sm:w-20 rounded-lg border-2 border-pink-950 ring-1 ring-pink-200/80 shadow-lg flex items-center justify-center mb-0.5 opacity-100">
                        <div className="absolute -top-3 text-xs sm:text-lg flex items-center gap-0.5">
                          <span>🍦</span>
                          <span>🍭</span>
                        </div>
                        <div className="absolute -bottom-2 left-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                        <div className="absolute -bottom-2 right-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-amber-400 animate-spin-slow" />
                      </div>
                    )}

                    {type === 'cargo_space' && (
                      <div className="relative shrink-0 bg-indigo-700 h-8 sm:h-12 w-12 sm:w-20 rounded-lg border-2 border-indigo-950 ring-1 ring-indigo-200/80 shadow-lg flex items-center justify-center mb-0.5 opacity-100">
                        <div className="absolute -top-3 text-xs sm:text-lg flex items-center gap-0.5 animate-pulse">
                          <span>🚀</span>
                          <span>⭐</span>
                        </div>
                        <div className="absolute -bottom-2 left-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-cyan-400 animate-spin-slow" />
                        <div className="absolute -bottom-2 right-1.5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-slate-900 border-2 border-cyan-400 animate-spin-slow" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Overlay Round Whistle Action Button on Bottom Right (Matching Screenshot Style) */}
            <div className="absolute bottom-4 right-4 z-40">
              <button
                onClick={handleWhistleBlow}
                className="w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-red-500 via-orange-500 to-yellow-400 text-white flex items-center justify-center shadow-2xl border-4 border-white active:scale-90 transition-transform ring-4 ring-orange-500/50"
                title="Düdük Çal!"
              >
                <span className="text-2xl sm:text-4xl">📢</span>
              </button>
            </div>
          </div>

          {/* Controls & Customizer Toolbar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Speed & Direction Controls */}
            <div className="bg-[#15303e] border border-slate-700/60 rounded-3xl p-3.5 text-white space-y-2">
              <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5 uppercase tracking-wider">
                <FastForward className="w-4 h-4 text-sky-300" />
                <span>Tren Sürüş Kontrolleri</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsTrainRunning(!isTrainRunning)}
                  className={`px-3.5 py-2 rounded-2xl font-game text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    isTrainRunning
                      ? 'bg-amber-500 hover:bg-amber-600 text-amber-950 border-amber-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400'
                  }`}
                >
                  {isTrainRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isTrainRunning ? 'Treni Durdur' : 'Treni Başlat'}</span>
                </button>

                <div className="flex items-center gap-1 bg-[#0a1820] p-1 rounded-2xl border border-slate-700">
                  <button
                    onClick={() => setTrainSpeed('slow')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      trainSpeed === 'slow' ? 'bg-sky-500 text-white' : 'text-slate-400'
                    }`}
                  >
                    🐢 Yavaş
                  </button>
                  <button
                    onClick={() => setTrainSpeed('normal')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      trainSpeed === 'normal' ? 'bg-sky-500 text-white' : 'text-slate-400'
                    }`}
                  >
                    🚂 Normal
                  </button>
                  <button
                    onClick={() => setTrainSpeed('fast')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      trainSpeed === 'fast' ? 'bg-amber-500 text-amber-950' : 'text-slate-400'
                    }`}
                  >
                    🚀 Hızlı
                  </button>
                </div>

                <button
                  onClick={() => setTrainDirection(trainDirection === 'right' ? 'left' : 'right')}
                  className="px-3 py-2 rounded-2xl bg-[#0e2531] border border-slate-700 hover:bg-[#1a3a4d] text-xs font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Yön Değiştir</span>
                </button>
              </div>
            </div>

            {/* Wagon Selector & Theme Switcher */}
            <div className="bg-[#15303e] border border-slate-700/60 rounded-3xl p-3.5 text-white space-y-2">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-4 h-4 text-emerald-300" />
                <span>Vagon Ekle & Manzara Değiştir</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => toggleWagon('passenger')}
                  className={`px-3 py-1.5 rounded-xl font-game text-xs font-bold border transition-all ${
                    attachedWagons.includes('passenger')
                      ? 'bg-red-600 border-red-400 text-white'
                      : 'bg-[#0a1820] border-slate-700 text-slate-400'
                  }`}
                >
                  🚃 Yolcu Vagonu
                </button>

                <button
                  onClick={() => toggleWagon('cargo_coins')}
                  className={`px-3 py-1.5 rounded-xl font-game text-xs font-bold border transition-all ${
                    attachedWagons.includes('cargo_coins')
                      ? 'bg-amber-500 border-amber-300 text-amber-950'
                      : 'bg-[#0a1820] border-slate-700 text-slate-400'
                  }`}
                >
                  🪙 Altın Vagonu
                </button>

                <button
                  onClick={() => toggleWagon('cargo_fruits')}
                  className={`px-3 py-1.5 rounded-xl font-game text-xs font-bold border transition-all ${
                    attachedWagons.includes('cargo_fruits')
                      ? 'bg-emerald-600 border-emerald-300 text-white'
                      : 'bg-[#0a1820] border-slate-700 text-slate-400'
                  }`}
                >
                  🍎 Meyve Vagonu
                </button>

                <button
                  onClick={() => toggleWagon('cargo_toys')}
                  className={`px-3 py-1.5 rounded-xl font-game text-xs font-bold border transition-all ${
                    attachedWagons.includes('cargo_toys')
                      ? 'bg-purple-600 border-purple-300 text-white'
                      : 'bg-[#0a1820] border-slate-700 text-slate-400'
                  }`}
                >
                  🧸 Oyuncak Vagonu
                </button>
              </div>

              {/* Theme switcher options */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-bold">Tema:</span>
                <button
                  onClick={() => setEnvTheme('farm')}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                    envTheme === 'farm' ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  🌾 Çiftlik
                </button>
                <button
                  onClick={() => setEnvTheme('sunset')}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                    envTheme === 'sunset' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  🌅 Gün Batımı
                </button>
                <button
                  onClick={() => setEnvTheme('night')}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                    envTheme === 'night' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  🌌 Gece
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 2: CUSTOM MAP BUILDER GRID                                        */}
      {/* ===================================================================== */}
      {viewMode === 'builder' && (
        <div className="space-y-4">
          <div className="bg-[#15303e] border border-slate-700/60 rounded-3xl p-3.5 text-white flex items-center justify-between">
            <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Haritana istediğin rayı ve süsü yerleştirmek için aşağıdaki parçaları seç!</span>
            </div>
            <button
              onClick={() => {
                setIsBuildMode(!isBuildMode);
                if (isBuildMode) setSelectedInventoryItem(null);
              }}
              className={`px-4 py-2 rounded-2xl font-game text-xs font-bold border transition-all ${
                isBuildMode
                  ? 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-[#2263df] border-blue-400 text-white'
              }`}
            >
              {isBuildMode ? 'İnşayı Tamamla' : 'Parça Yerleştir'}
            </button>
          </div>

          {/* Living Grid Canvas Map */}
          <div className="relative bg-gradient-to-b from-emerald-400 via-green-500 to-emerald-600 rounded-3xl p-3 sm:p-4 border-4 border-emerald-700 shadow-2xl overflow-hidden min-h-[380px]">
            {/* Grid Map */}
            <div className="relative z-10 grid grid-cols-8 gap-1.5 sm:gap-2">
              {Array.from({ length: GRID_ROWS }).map((_, r) =>
                Array.from({ length: GRID_COLS }).map((_, c) => {
                  const placed = worldItems.find((item) => item.x === c && item.y === r);
                  const isTrainHere = currentTrainTrack.x === c && currentTrainTrack.y === r;

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => handleTileClick(c, r)}
                      className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition-all ${
                        isBuildMode
                          ? 'border-2 border-dashed border-white/60 bg-emerald-600/30 hover:bg-white/40'
                          : 'bg-emerald-400/30 hover:bg-white/20'
                      }`}
                    >
                      {placed && (
                        <span className="text-2xl sm:text-4xl filter drop-shadow-md transform hover:scale-125 transition-transform">
                          {placed.icon}
                        </span>
                      )}

                      {/* Moving Locomotive on grid */}
                      {isTrainHere && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center animate-bounce">
                          <span className="absolute -top-3 text-xs animate-ping opacity-75">💨</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWhistleBlow();
                            }}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-red-500 to-amber-500 text-2xl sm:text-3xl flex items-center justify-center border-2 border-white shadow-xl ring-4 ring-yellow-400/80 active:scale-125"
                          >
                            {user.activeTrainIcon || '🚂'}
                          </button>
                        </div>
                      )}

                      {/* Delete button in build mode */}
                      {isBuildMode && placed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveItem(placed.id);
                            playPopSound(soundEnabled);
                          }}
                          className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Panel */}
      <div className="bg-[#0e2531]/80 backdrop-blur-md border border-slate-700/80 rounded-3xl p-4 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-game text-white text-base sm:text-lg font-bold flex items-center gap-2">
              <span>📦</span> Mağazadan Kazanılan Tren & Dünya Parçaları
            </h3>
            <p className="text-xs text-slate-300">
              Dokunarak dünyana yerleştir, tren lokomotifini değiştir veya haritada çiz!
            </p>
          </div>
          <span className="bg-sky-900/80 text-sky-200 border border-sky-600/60 text-xs font-bold px-3 py-1 rounded-full w-fit">
            {unlockedItems.length} Parça Açık
          </span>
        </div>

        {unlockedItems.length === 0 ? (
          <div className="bg-[#091720] border border-slate-700/60 rounded-2xl p-4 text-center">
            <p className="text-xs sm:text-sm text-amber-300 font-bold">
              Henüz satın alınmış parça yok! 🛒
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Görevleri tamamlayıp kazandığın altın puanlarla Mağaza'dan yeni tren, köprü ve vagonlar satın alabilirsin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {unlockedItems.map((item) => {
              const isPlaced = worldItems.some((w) => w.itemId === item.id);
              const isTrainActive = item.type === 'train' && user.activeTrainIcon === item.icon;

              return (
                <div
                  key={item.id}
                  className={`bg-[#15303d] border rounded-2xl p-3 flex flex-col justify-between transition-all shadow-md ${
                    selectedInventoryItem?.id === item.id
                      ? 'border-sky-400 ring-2 ring-sky-500/50 bg-[#1e4152]'
                      : 'border-slate-700/70 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-[#0a1820] border border-slate-700 flex items-center justify-center text-3xl shadow-inner flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-game text-sm font-bold text-white line-clamp-1">
                        {item.name}
                      </h4>
                      <span className="text-[10px] text-sky-300 uppercase tracking-wider font-bold">
                        {item.type === 'train'
                          ? 'Lokomotif 🚂'
                          : item.type === 'wagon' || item.category === 'wagons'
                          ? 'Vagon 🚃'
                          : item.type === 'track'
                          ? 'Ray & Yapı 🌉'
                          : 'Dekorasyon 🌳'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700/60">
                    {item.type === 'train' ? (
                      <button
                        onClick={() => handleUseInventoryItem(item)}
                        className={`w-full py-2 px-3 rounded-xl font-game text-xs font-bold border transition-all ${
                          isTrainActive
                            ? 'bg-emerald-600 text-white border-emerald-400'
                            : 'bg-[#2263df] hover:bg-[#1c55c5] text-white border-blue-400'
                        }`}
                      >
                        {isTrainActive ? 'Sürüşte Etkin 🚂' : 'Bu Treni Sür 🚂'}
                      </button>
                    ) : item.type === 'wagon' || item.category === 'wagons' ? (
                      <button
                        onClick={() => handleUseInventoryItem(item)}
                        className={`w-full py-2 px-3 rounded-xl font-game text-xs font-bold border transition-all ${
                          attachedWagons.includes(item.wagonType || 'passenger')
                            ? 'bg-emerald-600 text-white border-emerald-400'
                            : 'bg-[#2263df] hover:bg-[#1c55c5] text-white border-blue-400'
                        }`}
                      >
                        {attachedWagons.includes(item.wagonType || 'passenger')
                          ? 'Trene Bağlı 🚃'
                          : 'Trene Bağla 🚃'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUseInventoryItem(item)}
                        className="w-full py-2 px-3 rounded-xl font-game text-xs font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 border border-amber-300 hover:brightness-105 shadow-sm"
                      >
                        {isPlaced ? 'Dünyanda Yayında ✨' : 'Dünyana Ekle 🪄'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
