import React, { useState, useEffect, useRef } from 'react';
// Tasarım: Pastel Tren Rotası — kokpit görevleri beyaz/uyarıcı sarı yüzeylerle, başarılar canlı yeşille görünür.
import { PlacedWorldItem, ShopItem, UserProfile } from '../types';
import { playTrainWhistle, playTrainMovementTick, playPopSound, speakText, unlockAudioContext } from '../utils/audio';
import { Plus, Trash2, Play, Pause, Sparkles, Volume2, FastForward, RotateCcw, RotateCw, Undo2, WandSparkles, MapPin, Eye, Compass, Layers, Move, MousePointer2 } from 'lucide-react';

// Import generated cartoon assets
import cartoonBg from '../assets/images/bos-genis.webp';

// Safari eski bir uygulama kabuğunu kısa süre tutsa bile sabit yol üzerinden
// yedek manzarayı yükleyebilir. `?v=5` eski görsel önbelleğini geçersiz kılar (Ağustos
// 2026: nehir/ayçiçeği tarlası ile genişletilmiş yeni 21:9 manzara).
const stableCartoonBackground = `${import.meta.env.BASE_URL}train-world.webp?v=7`;
import pandaLocomotive from '../assets/images/cartoon_panda_locomotive_1785400092467.webp';
import merkezGarImg from '../assets/images/sincap-koy-gari-v2.webp';
import lokomotifImg from '../assets/images/lokomotif-yesil.webp';
import yolcuVagonuKirmiziImg from '../assets/images/yolcu-vagonu-kirmizi.webp';
import yolcuVagonuYesilImg from '../assets/images/yolcu-vagonu-yesil.webp';
import yukVagonuImg from '../assets/images/yuk-vagonu.webp';
import altinVagonuImg from '../assets/images/altin-vagonu.webp';
import elmaVagonuImg from '../assets/images/elma-vagonu.webp';
import oyuncakVagonuImg from '../assets/images/oyuncak-vagonu.webp';
import sipaMaskotImg from '../assets/images/sipa-maskot.webp';
import { SCENERY_IMAGES } from '../utils/sceneryImages';

interface TrainWorldViewProps {
  worldItems: PlacedWorldItem[];
  inventory: ShopItem[];
  user: UserProfile;
  onPlaceItem: (item: Omit<PlacedWorldItem, 'id'>) => void;
  onRemoveItem: (id: string) => void;
  onSetActiveTrain?: (icon: string) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  onToggleSound?: () => void;
}

type ViewMode = 'ride' | 'builder';
type EnvironmentTheme = 'farm' | 'mountains' | 'sunset' | 'night';

type TrainLinePosition = { left: number; top: number; direction: 1 | -1 };
type CockpitMissionId = 'start' | 'horn' | 'light' | 'movement' | 'stop';
type CockpitProgress = { dayKey: string; score: number; completed: CockpitMissionId[] };

const COCKPIT_PROGRESS_KEY = 'ruzgar_cockpit_missions_v1';
const COCKPIT_MISSIONS: Array<{ id: CockpitMissionId; icon: string; title: string; points: number }> = [
  { id: 'start', icon: '▶️', title: 'Treni başlat', points: 5 },
  { id: 'horn', icon: '📣', title: 'Korna çal', points: 5 },
  { id: 'light', icon: '💡', title: 'Farı yak', points: 5 },
  { id: 'movement', icon: '🔊', title: 'Hareket sesini aç', points: 5 },
  { id: 'stop', icon: '⏸️', title: 'Treni durdur', points: 5 },
];

function getLocalDayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function loadCockpitProgress(): CockpitProgress {
  const fresh: CockpitProgress = { dayKey: getLocalDayKey(), score: 0, completed: [] };
  try {
    const stored = JSON.parse(localStorage.getItem(COCKPIT_PROGRESS_KEY) || 'null') as Partial<CockpitProgress> | null;
    if (!stored || stored.dayKey !== fresh.dayKey) return fresh;
    const completed = Array.isArray(stored.completed)
      ? stored.completed.filter((id): id is CockpitMissionId => COCKPIT_MISSIONS.some((mission) => mission.id === id))
      : [];
    return { dayKey: fresh.dayKey, score: completed.length * 5, completed };
  } catch {
    return fresh;
  }
}

// Tren, sahnenin alt rayında eski oyundaki gibi tek hat üzerinde gidip gelir.
// Progress 0..1 aralığında ping-pong olarak okunur; uçlarda sıçrama olmadan
// yön değiştirir ve katar yalnızca yatay eksende kalır.
function getStraightTrainPosition(progress: number): TrainLinePosition {
  const normalized = ((progress % 1) + 1) % 1;
  const travel = normalized < 0.5 ? normalized * 2 : 2 - normalized * 2;
  return {
    left: 12 + travel * 76,
    top: 78,
    direction: normalized < 0.5 ? 1 : -1,
  };
}

// Harita Çizimi'ndeki 8x7'lik yerleşim ızgarasıyla aynı boyut; ana sahnedeki
// dekor pozisyonu artık bu ızgar üzerinden (item.x / item.y) hesaplanıyor —
// böylece çocuğun yerleştirdiği kare ile ana dünyada göründüğü yer birebir eşleşir.
const GRID_COLS = 14; // Kasaba artık yana kaydırmalı: alan kazanmak için sütun sayısı 8'den 14'e çıkarıldı.
const GRID_ROWS = 6; // Üstteki hep boş kalan gökyüzü satırı kaldırıldı, kalan satırlara daha çok dikey alan kaldı.
// V4 yayın sürümündeki geniş manzara oranı korunur. Mobilde görünür kutu
// kaydırılabilir kalır; böylece eski ray, köprü ve kasaba perspektifi kaybolmaz.
const WORLD_WIDE_PERCENT = Math.round((GRID_COLS / 8) * 100);

// Her eşya türünün ana sahnede kaç büyük çizileceği (konum artık sabit değil,
// sadece görsel boyut sabit kalıyor).
const SCENE_ITEM_SIZE: Record<string, string> = {
  'scenery-tree': 'text-4xl sm:text-6xl',
  'scenery-flower': 'text-3xl sm:text-5xl',
  'scenery-cow': 'text-4xl sm:text-6xl',
  'scenery-house': 'text-2xl sm:text-4xl',
  'scenery-traffic-light': 'text-2xl sm:text-4xl',
  'scenery-park': 'text-3xl sm:text-5xl',
  'scenery-windmill': 'text-3xl sm:text-5xl',
  'scenery-market': 'text-2xl sm:text-4xl',
  'scenery-school': 'text-2xl sm:text-4xl',
  'scenery-hospital': 'text-2xl sm:text-4xl',
  'scenery-train-repair': 'text-3xl sm:text-5xl',
  'scenery-ferris': 'text-5xl sm:text-7xl',
  'scenery-bakery': 'text-3xl sm:text-5xl',
  'scenery-fountain': 'text-3xl sm:text-5xl',
  'scenery-house-2': 'text-2xl sm:text-4xl',
  'scenery-house-3': 'text-2xl sm:text-4xl',
  'scenery-house-4': 'text-2xl sm:text-4xl',
  'scenery-house-5': 'text-2xl sm:text-4xl',
  'scenery-house-6': 'text-2xl sm:text-4xl',
  'scenery-cinema': 'text-2xl sm:text-4xl',
  'scenery-airplane': 'text-3xl sm:text-5xl',
  'scenery-ambulance': 'text-3xl sm:text-5xl',
  'scenery-firestation': 'text-3xl sm:text-5xl',
  'scenery-firestation-building': 'text-2xl sm:text-4xl',
  'scenery-squirrel-courier': 'text-2xl sm:text-4xl',
};

// Gerçek görseli olan eşyaların (SCENERY_IMAGES) ana sahnedeki piksel boyutu.
// Binalar biraz daha büyük ve net görünsün; araçlar (ambulans/itfaiye) ise
// binaların yaklaşık yarısı büyüklüğünde kalsın ki manzarayı kaplamasınlar.
const SCENE_IMG_SIZE: Record<string, string> = {
  'scenery-ambulance': 'w-12 h-12 sm:w-20 sm:h-20',
  'scenery-firestation': 'w-12 h-12 sm:w-20 sm:h-20',
  'scenery-squirrel-courier': 'w-10 h-10 sm:w-16 sm:h-16',
  // Lunapark dönme dolabı + sinema birleşik yapısı, diğer binalardan belirgin
  // şekilde daha yüksek bir görsel olduğu için kendi kutusunda daha uzun.
  'scenery-ferris': 'w-16 h-24 sm:w-24 sm:h-36',
  // Ev modelleri ve okul, diğer binalara göre hafifçe daha büyük görünsün.
  'scenery-house': 'w-20 h-20 sm:w-28 sm:h-28',
  'scenery-house-2': 'w-20 h-20 sm:w-28 sm:h-28',
  'scenery-house-3': 'w-20 h-20 sm:w-28 sm:h-28',
  'scenery-house-4': 'w-20 h-20 sm:w-28 sm:h-28',
  'scenery-house-5': 'w-20 h-20 sm:w-28 sm:h-28',
  'scenery-house-6': 'w-20 h-20 sm:w-28 sm:h-28',
  'scenery-school': 'w-20 h-20 sm:w-28 sm:h-28',
};
const DEFAULT_SCENE_IMG_SIZE = 'w-16 h-16 sm:w-24 sm:h-24';

// Izgara hücresini (0..7, 0..6) ana sahnenin güvenli görüntü alanına (bulut ve
// ray şeridi hariç) eşleyen yardımcı fonksiyon.
function gridCellToScenePercent(x: number, y: number) {
  // Öğeleri güvenli iç çerçevede merkezliyoruz; böylece kenar hücrelerde
  // görseller kesilmez ve mobilde rastgele üst üste binme azalır.
  const left = 8 + (x / Math.max(GRID_COLS - 1, 1)) * 84; // %8 .. %92
  const top = 8 + (y / Math.max(GRID_ROWS - 1, 1)) * 76; // %8 .. %84
  return { left: `${left}%`, top: `${top}%` };
}

function getSceneDepthScale(y: number) {
  // Üst satırlar daha uzakta, alt satırlar oyuncuya daha yakındır.
  const depth = y / Math.max(GRID_ROWS - 1, 1);
  return Number((0.78 + depth * 0.32).toFixed(2));
}

export const TrainWorldView: React.FC<TrainWorldViewProps> = ({
  worldItems,
  inventory,
  user,
  onPlaceItem,
  onRemoveItem,
  onSetActiveTrain,
  soundEnabled,
  speechEnabled,
  onToggleSound,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('ride');
  const [envTheme, setEnvTheme] = useState<EnvironmentTheme>('farm');
  
  // V4 kokpit davranışı: düz hat üzerinde gerçek x-position + ping-pong yön.
  const [trainXPos, setTrainXPos] = useState(10);
  const [isTrainRunning, setIsTrainRunning] = useState(true);
  const [trainSpeed, setTrainSpeed] = useState<'normal' | 'fast' | 'slow'>('normal');
  const [trainDirection, setTrainDirection] = useState<'right' | 'left'>('right');
  const [isWhistling, setIsWhistling] = useState(false);
  const [hornEnabled, setHornEnabled] = useState(true);
  // Sessiz başlangıç: tren görsel olarak hareket eder, far ve ray sesi çocuk açana kadar kapalıdır.
  const [trainLightEnabled, setTrainLightEnabled] = useState(false);
  const [movementSoundEnabled, setMovementSoundEnabled] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [smokePuffs, setSmokePuffs] = useState<{ id: number; x: number; y: number }[]>([]);
  const [attachedWagons, setAttachedWagons] = useState<string[]>(['passenger', 'passenger_green', 'cargo_coins']);
  const [cockpitProgress, setCockpitProgress] = useState<CockpitProgress>(loadCockpitProgress);

  useEffect(() => {
    localStorage.setItem(COCKPIT_PROGRESS_KEY, JSON.stringify(cockpitProgress));
  }, [cockpitProgress]);

  const completeCockpitMission = (missionId: CockpitMissionId) => {
    const today = getLocalDayKey();
    const current = cockpitProgress.dayKey === today
      ? cockpitProgress
      : { dayKey: today, score: 0, completed: [] as CockpitMissionId[] };
    if (current.completed.includes(missionId)) {
      if (cockpitProgress.dayKey !== today) setCockpitProgress(current);
      return;
    }
    const mission = COCKPIT_MISSIONS.find((item) => item.id === missionId);
    if (!mission) return;
    setCockpitProgress({
      dayKey: today,
      score: current.score + mission.points,
      completed: [...current.completed, missionId],
    });
    setInteractiveMessage(`Mini görev tamamlandı: ${mission.title} +${mission.points} puan! ⭐`);
    playPopSound(soundEnabled);
  };

  // Katar görsellerini (lokomotif + vagonlar) animasyon başlamadan ÖNCE tarayıcı
  // belleğine tam yükleyip decode ediyoruz. Bu sayede <img> elemanları ilk kareden
  // itibaren kesin boyutlarıyla render edilir; "auto" genişlik resmin geç
  // yüklenmesi yüzünden geçici olarak yanlış hesaplanmaz.
  const [trainImagesReady, setTrainImagesReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const sources = [lokomotifImg, yolcuVagonuKirmiziImg, yolcuVagonuYesilImg, yukVagonuImg, altinVagonuImg, elmaVagonuImg, oyuncakVagonuImg];
    Promise.all(
      sources.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.src = src;
            const done = () => resolve();
            if (img.decode) {
              img.decode().then(done).catch(done);
            } else {
              img.onload = done;
              img.onerror = done;
            }
          })
      )
    ).then(() => {
      if (!cancelled) setTrainImagesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rideCanvasRef = useRef<HTMLDivElement | null>(null);
  const fullScreenStageRef = useRef<HTMLDivElement | null>(null);
  const trainAssemblyRef = useRef<HTMLDivElement | null>(null);
  // Katarın gerçek genişliği ölçülerek sağ uçta ekrandan taşması önlenir.
  const [assemblyWidthPercent, setAssemblyWidthPercent] = useState(45);
  useEffect(() => {
    const canvasEl = rideCanvasRef.current;
    const assemblyEl = trainAssemblyRef.current;
    if (!canvasEl || !assemblyEl || viewMode !== 'ride' || !trainImagesReady) return;

    const measure = () => {
      const canvasWidth = canvasEl.offsetWidth;
      const assemblyWidth = assemblyEl.offsetWidth;
      if (canvasWidth > 0 && assemblyWidth > 0) {
        setAssemblyWidthPercent((assemblyWidth / canvasWidth) * 100);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvasEl);
    observer.observe(assemblyEl);
    return () => observer.disconnect();
  }, [viewMode, attachedWagons, user.activeTrainIcon, trainImagesReady]);
  const [interactiveMessage, setInteractiveMessage] = useState<string>('Panda Kaptan tek ray hattında gidip geliyor! 🚂💨');

  // Check unlocked structures from inventory
  const hasPlacedBridge = worldItems.some((item) => item.itemId === 'track-bridge');
  const hasPlacedTunnel = worldItems.some((item) => item.itemId === 'track-tunnel');
  const hasPlacedStation = worldItems.some((item) => item.itemId === 'track-station');

  // Gar, Harita Çizimi'nde seçilen sütuna (x) göre ray hattı üzerinde kayar;
  // ray hep aynı yükseklikte kaldığından dikey konum sabit tutulur.
  const placedStation = worldItems.find((item) => item.itemId === 'track-station');
  const stationLeftPercent = placedStation
    ? Math.min(88, Math.max(8, 8 + (placedStation.x / Math.max(GRID_COLS - 1, 1)) * 80))
    : 42;
  const sipaLeftPercent = Math.min(90, Math.max(2, stationLeftPercent - 6));

  // Köprü ve tünel de artık Harita Çizimi'nde seçilen gerçek x konumuna göre
  // kayar; önceden sabit bir yüzdede duruyorlardı (gar için yapılan düzeltmenin
  // aynısı burada da uygulanıyor).
  const placedBridge = worldItems.find((item) => item.itemId === 'track-bridge');
  const bridgeLeftPercent = placedBridge
    ? Math.min(70, Math.max(4, 4 + (placedBridge.x / Math.max(GRID_COLS - 1, 1)) * 80))
    : 26;
  const placedTunnel = worldItems.find((item) => item.itemId === 'track-tunnel');
  const tunnelLeftPercent = placedTunnel
    ? Math.min(85, Math.max(4, 4 + (placedTunnel.x / Math.max(GRID_COLS - 1, 1)) * 90))
    : 88;

  // Sahip olunan düz/viraj ray parçalarının sayısı koleksiyon etiketinde
  // gösterilir; çalışan tren her zaman ana düz hatta gidip gelir.
  const secondRailPieceCount = worldItems.filter(
    (item) => item.itemId === 'track-straight' || item.itemId === 'track-curve',
  ).length;
  // Ana ray üzerindeki V4 ping-pong hareketi; satın alınan parça sayısından bağımsızdır.
  const trainTransform = trainDirection === 'left' ? 'scaleX(-1)' : 'none';

  // Mağazadan "Dünyana Ekle" ile bırakılan her dekor ana manzarada da görünür.
  // Ray yapıları kendi, raya hizalı katmanlarında çizilir.
  const placedSceneItems = worldItems.filter((item) => ![
    'track-straight', 'track-curve', 'track-bridge', 'track-tunnel', 'track-station',
  ].includes(item.itemId) && SCENE_ITEM_SIZE[item.itemId]);

  // Konum artık sabit bir tablodan değil, çocuğun Harita Çizimi'nde seçtiği
  // gerçek (x, y) hücresinden geliyor — yerleştirdiği yer ile ana dünyada
  // gördüğü yer artık birebir aynı.
  const sceneItems = placedSceneItems.map((item) => ({
    item,
    anchor: { ...gridCellToScenePercent(item.x, item.y), size: SCENE_ITEM_SIZE[item.itemId] || 'text-2xl sm:text-4xl' },
  }));

  // Interactive village elements states
  const [cowMooing, setCowMooing] = useState(false);
  const [windmillSpinningFast, setWindmillSpinningFast] = useState(false);
  const [applesFalling, setApplesFalling] = useState(false);

  // Builder grid states
  const [isBuildMode, setIsBuildMode] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<ShopItem | null>(null);
  const [draggedInventoryItem, setDraggedInventoryItem] = useState<ShopItem | null>(null);
  const [placementRotation, setPlacementRotation] = useState(0);
  const [previewCell, setPreviewCell] = useState<{ x: number; y: number } | null>(null);
  const [placementHistory, setPlacementHistory] = useState<PlacedWorldItem[][]>([]);
  const [trainPositionIndex, setTrainPositionIndex] = useState(0);

  const rememberPlacement = () => {
    setPlacementHistory((history) => [...history.slice(-7), worldItems]);
  };

  const handleUndoPlacement = () => {
    const snapshot = placementHistory[placementHistory.length - 1];
    if (!snapshot) return;
    worldItems.forEach((item) => onRemoveItem(item.id));
    snapshot.forEach(({ id: _id, ...item }) => onPlaceItem(item));
    setPlacementHistory((history) => history.slice(0, -1));
    setSelectedInventoryItem(null);
    setPreviewCell(null);
    setInteractiveMessage('Son yerleşim geri alındı! İstersen yeniden deneyebilirsin. ↶');
    playPopSound(soundEnabled);
  };

  // V4-style classic straight-line out-and-back motion.
  useEffect(() => {
    if (!isTrainRunning || viewMode !== 'ride' || !trainImagesReady) return;

    const step = trainSpeed === 'fast' ? 0.45 : trainSpeed === 'slow' ? 0.18 : 0.3;
    let movementTick = 0;
    const interval = setInterval(() => {
      setTrainXPos((prev) => {
        const next = trainDirection === 'right' ? prev + step : prev - step;
        // V4 yayın sürümündeki uçlar: katar sağda hafifçe dışarı taşmadan,
        // solda ise son vagon görünür kalacak şekilde ping-pong yapar.
        const rightLimit = 100 + 5;
        const leftLimit = -(assemblyWidthPercent + 5);

        if (next >= rightLimit) {
          setTrainDirection('left');
          return rightLimit;
        }
        if (next <= leftLimit) {
          setTrainDirection('right');
          return leftLimit;
        }
        return next;
      });

      if (soundEnabled && movementSoundEnabled && movementTick++ % 9 === 0) {
        playTrainMovementTick(true);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [isTrainRunning, trainSpeed, trainDirection, viewMode, trainImagesReady, assemblyWidthPercent, movementSoundEnabled, soundEnabled]);

  // iOS Safari (ve bazı gömülü tarayıcılar) Fullscreen API'yi hiç desteklemez
  // (requestFullscreen tanımsızdır) — bu yüzden mobilde düğme tepki vermiyordu.
  // Native API yoksa veya reddedilirse, saf CSS ile tüm ekranı kaplayan
  // "sahte tam ekran"a (bkz. index.css: .is-fullscreen:not(:fullscreen)) düşülür.
  const toggleFullScreen = async () => {
    const stage = fullScreenStageRef.current;
    if (!stage) return;
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* yoksay, state zaten kapanacak */ }
      setIsFullScreen(false);
      return;
    }
    if (isFullScreen) {
      setIsFullScreen(false);
      return;
    }
    if (typeof stage.requestFullscreen === 'function') {
      try {
        await stage.requestFullscreen();
        return; // isFullScreen, fullscreenchange dinleyicisiyle senkronize edilir.
      } catch {
        // İzin politikası vb. yüzünden reddedildi — CSS moduna düş.
      }
    }
    setIsFullScreen(true);
  };

  useEffect(() => {
    const syncFullScreenState = () => setIsFullScreen(document.fullscreenElement === fullScreenStageRef.current);
    document.addEventListener('fullscreenchange', syncFullScreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullScreenState);
  }, []);

  // Sahte (CSS) tam ekran modundayken arkadaki sayfanın kaymasını engeller —
  // native Fullscreen API zaten bunu kendisi hallediyor, ekstra zararı yok.
  useEffect(() => {
    if (!isFullScreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isFullScreen]);

  // Tam ekranda kokpit paneli varsayılan olarak KAPALI — ekranda sadece oyun
  // alanı görünür. 🎛️ düğmesiyle alttan açılan bir panel olarak belirir, oyun
  // alanına dokununca (backdrop) kapanır. Tam ekrandan çıkınca sıfırlanır ki
  // bir dahaki girişte yine sadece oyun alanıyla başlansın.
  const [showCockpitOverlay, setShowCockpitOverlay] = useState(false);
  useEffect(() => {
    if (!isFullScreen) setShowCockpitOverlay(false);
  }, [isFullScreen]);

  // Korna/düdük eylemi: kokpit düğmesi doğrudan ses üretir; kapalıysa açık bir durum mesajı verir.
  const handleWhistleBlow = () => {
    unlockAudioContext();
    if (!soundEnabled) {
      setInteractiveMessage('Ses kapalı. Önce kokpitteki Ses düğmesine dokun! 🔈');
      return;
    }
    if (!hornEnabled) {
      setInteractiveMessage('Korna kapalı. Korna düğmesine basınca tekrar çalabilir!');
      return;
    }
    playTrainWhistle(soundEnabled);
    completeCockpitMission('horn');
    speakText('Çuf Çuf! Tren kalkıyor!', speechEnabled);
    setIsWhistling(true);
    setInteractiveMessage('ÇUF ÇUF! Panda Kaptan Düdük Çaldı! 🚂💨');

    // Add animated smoke puff bubbles at locomotive chimney position
    const newPuff = { id: Date.now(), x: trainXPos, y: 0 };
    setSmokePuffs((prev) => [...prev.slice(-4), newPuff]);

    setTimeout(() => {
      setIsWhistling(false);
    }, 1500);
  };

  const handleThrottleClick = () => {
    unlockAudioContext();
    if (!isTrainRunning) {
      setIsTrainRunning(true);
      setTrainSpeed('normal');
      completeCockpitMission('start');
      return;
    }
    if (trainSpeed === 'normal') {
      setTrainSpeed('fast');
    } else if (trainSpeed === 'fast') {
      setTrainSpeed('slow');
    } else {
      setIsTrainRunning(false);
      completeCockpitMission('stop');
    }
  };

  const handleTrainRunToggle = () => {
    unlockAudioContext();
    const nextRunning = !isTrainRunning;
    setIsTrainRunning(nextRunning);
    completeCockpitMission(nextRunning ? 'start' : 'stop');
  };

  const handleTrainLightToggle = () => {
    unlockAudioContext();
    const nextEnabled = !trainLightEnabled;
    setTrainLightEnabled(nextEnabled);
    if (nextEnabled) completeCockpitMission('light');
  };

  const handleMovementSoundToggle = () => {
    unlockAudioContext();
    const nextEnabled = !movementSoundEnabled;
    if (import.meta.env.DEV) console.log('[Rüzgar ses] Hareket sesi düğmesi', { enabled: nextEnabled });
    setMovementSoundEnabled(nextEnabled);
    if (nextEnabled) completeCockpitMission('movement');
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
      rememberPlacement();
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
        rotation: placementRotation,
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

    // Auto-place on the actual 14×6 world grid if not placed yet.
    const alreadyPlaced = worldItems.some((w) => w.itemId === item.id);
    if (!alreadyPlaced) {
      rememberPlacement();
      let emptySlot: { x: number; y: number } | undefined;
      for (let r = 0; r < GRID_ROWS && !emptySlot; r += 1) {
        for (let c = 0; c < GRID_COLS; c += 1) {
          if (!worldItems.some((w) => w.x === c && w.y === r)) {
            emptySlot = { x: c, y: r };
            break;
          }
        }
      }
      if (!emptySlot) {
        setInteractiveMessage('Haritan dolu! Önce bir parçayı kaldırıp yeni yer açmalısın.');
        setSelectedInventoryItem(item);
        return;
      }

      onPlaceItem({
        x: emptySlot.x,
        y: emptySlot.y,
        itemId: item.id,
        icon: item.icon,
        name: item.name,
        rotation: placementRotation,
      });

      setInteractiveMessage(`Harikalar Diyarı! ${item.name} dünyana eklendi! ✨`);
      speakText(`${item.name} dünyana eklendi!`, speechEnabled);
    } else {
      setInteractiveMessage(`${item.name} dünyanda yayında! Harita çiziminde yerini değiştirebilirsin. ✨`);
    }

    setSelectedInventoryItem(item);
  };

  const unlockedItems = inventory.filter((i) => i.unlocked);

  const builderItems = unlockedItems.filter((item) => item.type !== 'real_reward');
  const placedByCell = new Map<string, PlacedWorldItem>(
    worldItems.map((item) => [`${item.x}:${item.y}`, item] as [string, PlacedWorldItem])
  );

  const itemKindLabel = (item: ShopItem) => {
    if (item.type === 'train') return 'LOKOMOTİF 🚂';
    if (item.type === 'wagon' || item.category === 'wagons') return 'VAGON 🚃';
    if (item.type === 'track') return 'RAY & YAPI 🛤️';
    return 'DEKORASYON 🌳';
  };

  const placedItemAccent = (item: PlacedWorldItem) => {
    if (item.itemId.startsWith('track-')) {
      return {
        ring: 'ring-sky-300/90 border-sky-200/90 bg-sky-950/40',
        glow: 'bg-sky-300/35',
        label: 'bg-sky-950/90 text-sky-100 border-sky-300/70',
      };
    }
    if (item.itemId.startsWith('train-')) {
      return {
        ring: 'ring-rose-300/90 border-rose-200/90 bg-rose-950/35',
        glow: 'bg-rose-300/35',
        label: 'bg-rose-950/90 text-rose-100 border-rose-300/70',
      };
    }
    if (item.itemId.startsWith('wagon-')) {
      return {
        ring: 'ring-amber-300/90 border-amber-200/90 bg-amber-950/40',
        glow: 'bg-amber-300/35',
        label: 'bg-amber-950/90 text-amber-100 border-amber-300/70',
      };
    }
    return {
      ring: 'ring-emerald-300/90 border-emerald-200/90 bg-emerald-950/35',
      glow: 'bg-emerald-300/35',
      label: 'bg-emerald-950/90 text-emerald-100 border-emerald-300/70',
    };
  };

  const selectInventoryForMap = (item: ShopItem) => {
    playPopSound(soundEnabled);
    setSelectedInventoryItem(item);
    setIsBuildMode(true);
    setInteractiveMessage(`${item.name} seçildi. Haritada istediğin yere dokun veya kartı sürükle! ✨`);
  };

  const placeInventoryOnMap = (item: ShopItem, x: number, y: number) => {
    rememberPlacement();
    const existingAtCell = worldItems.find((placed) => placed.x === x && placed.y === y);
    const existingSameItem = worldItems.find((placed) => placed.itemId === item.id);

    if (existingAtCell) {
      onRemoveItem(existingAtCell.id);
    }
    if (existingSameItem && existingSameItem.id !== existingAtCell?.id) {
      onRemoveItem(existingSameItem.id);
    }

    onPlaceItem({
      itemId: item.id,
      x,
      y,
      icon: item.icon,
      name: item.name,
      rotation: placementRotation,
    });

    if (item.type === 'train' && onSetActiveTrain) {
      onSetActiveTrain(item.icon);
    }
    if (item.type === 'wagon' || item.category === 'wagons') {
      const wagonType = item.wagonType || 'passenger';
      if (!attachedWagons.includes(wagonType)) {
        setAttachedWagons((prev) => [...prev, wagonType]);
      }
    }

    playPopSound(soundEnabled);
    setSelectedInventoryItem(item);
    setInteractiveMessage(`${item.name} haritaya yerleştirildi! ✨`);
  };

  const handleMapCellDrop = (event: React.DragEvent<HTMLButtonElement>, x: number, y: number) => {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain');
    const item = draggedInventoryItem || builderItems.find((candidate) => candidate.id === draggedId);
    if (item) {
      placeInventoryOnMap(item, x, y);
    }
    setDraggedInventoryItem(null);
  };

  const handleInventoryDragStart = (event: React.DragEvent<HTMLDivElement>, item: ShopItem) => {
    setDraggedInventoryItem(item);
    setSelectedInventoryItem(item);
    setIsBuildMode(true);
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData('text/plain', item.id);
  };

  const handleMapCellClick = (x: number, y: number) => {
    if (selectedInventoryItem) {
      placeInventoryOnMap(selectedInventoryItem, x, y);
      return;
    }
    const placed = placedByCell.get(`${x}:${y}`);
    if (isBuildMode && placed) {
      const sourceItem = builderItems.find((item) => item.id === placed.itemId);
      if (sourceItem) {
        setSelectedInventoryItem(sourceItem);
        setPlacementRotation(placed.rotation || 0);
        setInteractiveMessage(`${placed.name} seçildi. Yeni hücreye dokunarak taşıyabilirsin.`);
        return;
      }
    }
    handleTileClick(x, y);
  };

  const handleRotatePlacedItem = (placed: PlacedWorldItem) => {
    rememberPlacement();
    const { id: _id, ...item } = placed;
    onRemoveItem(placed.id);
    onPlaceItem({ ...item, rotation: ((placed.rotation || 0) + 90) % 360 });
    setPlacementRotation(((placed.rotation || 0) + 90) % 360);
    setInteractiveMessage(`${placed.name} döndürüldü! ↻`);
    playPopSound(soundEnabled);
  };

  const handleRotateSelection = () => {
    if (!selectedInventoryItem) {
      setInteractiveMessage('Önce bir parça seç, sonra döndürme düğmesine dokun.');
      return;
    }
    setPlacementRotation((rotation) => (rotation + 90) % 360);
    setInteractiveMessage(`${selectedInventoryItem.name} ${((placementRotation + 90) % 360)}° döndürülmeye hazır.`);
    playPopSound(soundEnabled);
  };

  const handleAutoPlaceSelected = () => {
    if (!selectedInventoryItem) {
      setInteractiveMessage('Önce envanterden bir parça seç.');
      return;
    }
    const emptySlot = Array.from({ length: GRID_ROWS }).flatMap((_, row) =>
      Array.from({ length: GRID_COLS }).map((__, column) => ({ x: column, y: row }))
    ).find(({ x, y }) => !worldItems.some((placed) => placed.x === x && placed.y === y));
    if (!emptySlot) {
      setInteractiveMessage('Haritan dolu! Önce bir parçayı kaldırıp yer aç.');
      return;
    }
    placeInventoryOnMap(selectedInventoryItem, emptySlot.x, emptySlot.y);
    setInteractiveMessage(`${selectedInventoryItem.name} ilk boş hücreye yerleştirildi! ✨`);
  };

  const clearMapSelection = () => {
    setSelectedInventoryItem(null);
    setPreviewCell(null);
    setInteractiveMessage('Parça seçimi temizlendi. Haritayı keşfetmeye devam edebilirsin.');
  };

  const renderSincapStation = (compact = false) => (
    <div className={`relative ${compact ? 'w-[80px] sm:w-[150px]' : 'w-[95px] sm:w-[199px]'} drop-shadow-[0_7px_7px_rgba(0,0,0,0.35)]`}>
      <img
        src={merkezGarImg}
        alt="Sincap Köy Garı"
        className="w-full h-auto object-contain"
        draggable={false}
      />
    </div>
  );

  return (
    <div className="world-view space-y-2.5 pb-20">
      {/* Top Header Section */}
      <div className="world-view-header flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div>
          <div className="text-[11px] font-black text-sky-700 uppercase tracking-widest flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-orange-800" />
            <span>BENİM CANLI TRENİM</span>
          </div>
          <h2 className="font-game text-2xl sm:text-3xl font-black text-slate-900">
            Tren Dünyası
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Çizgi film kalitesinde tren sür ve kendi dünyanı tasarla!
          </p>
        </div>

        {/* View Mode Toggle Switcher */}
        <div className="world-view-mode-switcher flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setViewMode('ride')}
            className={`world-mode-button px-3.5 py-2 rounded-xl font-game font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all ${
              viewMode === 'ride'
                ? 'bg-[#2b6f91] text-white shadow-md border border-sky-200/70'
                : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <span>🚂 Sürüş Modu</span>
          </button>
          <button
            onClick={() => setViewMode('builder')}
            className={`world-mode-button px-3.5 py-2 rounded-xl font-game font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all ${
              viewMode === 'builder'
                ? 'bg-[#2b6f91] text-white shadow-md border border-sky-200/70'
                : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <span>🗺️ Harita Çizimi</span>
          </button>
        </div>
      </div>

      {/* Interactive Status & Quick Whistle Bar */}
      <div className="world-status-bar flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-900 shadow-sm sm:p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleWhistleBlow}
            className={`cockpit-status-whistle flex h-11 w-11 items-center justify-center rounded-xl border border-orange-200/60 bg-[#24485a] text-xl text-orange-100 shadow-md transition-transform active:scale-90 ${
              isWhistling ? 'animate-bounce ring-4 ring-orange-300' : ''
            }`}
            title="Düdük Çal! Çuf Çuf!"
          >
            📢
          </button>
          <div>
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-orange-300 animate-spin" />
              <span>Canlı Tren Durumu</span>
            </div>
            <h3 className="font-game text-xs sm:text-sm font-black text-slate-800">
              {interactiveMessage}
            </h3>
          </div>
        </div>

        <button
          onClick={handleWhistleBlow}
          className="world-status-action flex items-center gap-1.5 rounded-xl border border-sky-200/60 bg-[#2b6f91] px-3 py-2 font-game text-xs font-black text-white shadow-md transition-transform active:scale-95 sm:px-4 sm:text-sm"
        >
          <span>DÜDÜK ÇAL 📢</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: HIGH-QUALITY CARTOON RIDE GAME CANVAS (MATCHING USER PHOTO)   */}
      {/* ===================================================================== */}
      {viewMode === 'ride' && (
        <div ref={fullScreenStageRef} className={`world-ride-layout space-y-4 ${isFullScreen ? 'is-fullscreen' : ''} ${showCockpitOverlay ? 'cockpit-open' : ''}`}>
          {/* Main Graphic Canvas Box */}
          <div
            className="world-ride-canvas-shell relative w-full aspect-[16/9] min-h-[300px] overflow-hidden rounded-3xl border-4 border-slate-700 shadow-2xl group select-none sm:min-h-[420px]"
          >
            {/* Oyun ekranının köşesinde her zaman görünür tam ekran düğmesi — kokpit
                paneline kaydırmaya gerek kalmadan tek dokunuşla giriş/çıkış. */}
            <button
              type="button"
              onClick={toggleFullScreen}
              className="absolute top-2 right-2 z-30 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/70 bg-black/50 text-lg text-white shadow-lg backdrop-blur-sm transition-transform active:scale-90 sm:h-11 sm:w-11"
              aria-pressed={isFullScreen}
              aria-label={isFullScreen ? 'Tam ekrandan çık' : 'Tam ekranı aç'}
              title={isFullScreen ? 'Tam ekrandan çık' : 'Tam ekranı aç'}
            >
              {isFullScreen ? '⤢' : '⛶'}
            </button>
            {/* Tam ekranda kokpit varsayılan olarak gizli olduğu için, onu açmaya
                yarayan ayrı bir köşe düğmesi — sadece tam ekran modunda görünür. */}
            {isFullScreen && (
              <button
                type="button"
                onClick={() => setShowCockpitOverlay((current) => !current)}
                className="absolute top-2 left-2 z-30 flex h-10 items-center gap-1 rounded-full border-2 border-white/70 bg-black/50 px-3 text-sm font-black text-white shadow-lg backdrop-blur-sm transition-transform active:scale-90 sm:h-11"
                aria-pressed={showCockpitOverlay}
                aria-label={showCockpitOverlay ? 'Kokpiti kapat' : 'Kokpiti aç'}
                title={showCockpitOverlay ? 'Kokpiti kapat' : 'Kokpiti aç'}
              >
                🎛️
              </button>
            )}
            {/* Kasaba artık daha geniş bir alanda: bu iç kaydırılabilir katman görünür
                kutudan daha geniş, taşan kısım yana kaydırılarak keşfedilir. Hareket eden
                tren ve düdük düğmesi bu katmanın DIŞINDA kalır ki ekranda sabit dursunlar. */}
            <div ref={rideCanvasRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden rounded-3xl">
              <div className="relative h-full" style={{ width: `${WORLD_WIDE_PERCENT}%` }}>
            {/* Background Illustration Image */}
            <img
              src={cartoonBg}
              alt="Cartoon Train Scene"
              onError={(event) => {
                const image = event.currentTarget;
                if (image.src !== stableCartoonBackground) image.src = stableCartoonBackground;
              }}
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
                  style={{ left: `${puff.x}%`, top: `${puff.y}%`, transform: 'translate(-50%, -50%)' }}
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
                  className="group/item absolute flex flex-col items-center gap-0.5 rounded-xl px-1 py-0.5 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  style={{ left: anchor.left, top: anchor.top, zIndex: 20 + item.y, transform: `translate(-50%, -50%) scale(${getSceneDepthScale(item.y)})` }}
                  title={`${item.name} — dokun ve keşfet`}
                >
                  {SCENERY_IMAGES[item.itemId] ? (
                    <img src={SCENERY_IMAGES[item.itemId]} alt={item.name} className={`${SCENE_IMG_SIZE[item.itemId] || DEFAULT_SCENE_IMG_SIZE} object-contain drop-shadow-[0_5px_5px_rgba(0,0,0,0.45)]`} draggable={false} />
                  ) : (
                    <span className={`${anchor.size} leading-none drop-shadow-[0_3px_3px_rgba(15,23,42,0.55)]`}>{item.icon}</span>
                  )}
                  <span className="pointer-events-none absolute -bottom-4 max-w-20 truncate rounded-full bg-slate-950/80 px-1.5 py-0.5 text-[8px] font-black text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover/item:opacity-100 group-focus/item:opacity-100 group-active/item:opacity-100 sm:text-[10px]">
                    {item.name}
                  </span>
                </button>
              );
            })}

            {/* 4. CLASSIC STRAIGHT TWO-WAY RAIL */}
            <div className="straight-track absolute bottom-[13%] left-0 z-10 h-10 w-full pointer-events-none sm:h-14">
              <svg className="h-full w-full" viewBox="0 0 1000 64" preserveAspectRatio="none" role="img" aria-label="Tek düz tren hattı, gidiş ve dönüş">
                <defs>
                  <linearGradient id="straightRailSteelGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="45%" stopColor="#cbd5e1" />
                    <stop offset="75%" stopColor="#64748b" />
                    <stop offset="100%" stopColor="#334155" />
                  </linearGradient>
                </defs>
                <rect x="0" y="8" width="1000" height="44" rx="5" fill="#17212b" opacity="0.82" />
                <rect x="0" y="13" width="1000" height="34" rx="4" fill="#6b4428" opacity="0.52" />
                <line x1="0" y1="30" x2="1000" y2="30" stroke="#451a03" strokeWidth="17" strokeDasharray="9 13" />
                <line x1="0" y1="20" x2="1000" y2="20" stroke="url(#straightRailSteelGradient)" strokeWidth="3" />
                <line x1="0" y1="40" x2="1000" y2="40" stroke="url(#straightRailSteelGradient)" strokeWidth="3" />
                <line x1="0" y1="19" x2="1000" y2="19" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
                <line x1="0" y1="39" x2="1000" y2="39" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
              </svg>
              <div className="absolute left-[7%] top-0 rounded-full border border-sky-200/50 bg-slate-950/75 px-2 py-1 text-[8px] font-black text-sky-100 shadow-lg sm:text-[10px]">↔ TEK HAT · GİDİŞ / DÖNÜŞ{secondRailPieceCount > 0 ? ` · ${secondRailPieceCount} parça` : ''}</div>
            </div>

            {/* Red Steel Bridge Overlay when unlocked or placed */}
            {hasPlacedBridge && (
              <div
                onClick={() => {
                  playPopSound(soundEnabled);
                  setInteractiveMessage('Kırmızı Tren Köprüsü: Tren köprünün altından güvenle geçiyor! 🌉✨');
                  speakText('Kırmızı tren köprüsü aktif!', speechEnabled);
                }}
                className="absolute bottom-[11%] w-[21%] h-12 sm:h-16 z-25 cursor-pointer hover:scale-105 transition-transform"
                style={{ left: `${bridgeLeftPercent}%` }}
                title="Kırmızı Tren Köprüsü"
              >
                <div className="group/bridge relative w-full h-full flex items-end justify-center">
                  <img
                    src={SCENERY_IMAGES['track-bridge']}
                    alt="Kırmızı Tren Köprüsü"
                    className="w-full h-full object-contain drop-shadow-[0_8px_8px_rgba(0,0,0,0.4)]"
                    draggable={false}
                  />
                  <span className="pointer-events-none absolute -top-2 bg-red-950/90 text-red-200 border border-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg opacity-0 transition-opacity duration-150 group-hover/bridge:opacity-100 group-focus/bridge:opacity-100 group-active/bridge:opacity-100">
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
                className="absolute bottom-[9.5%] w-32 sm:w-48 h-20 sm:h-28 z-25 -rotate-3 cursor-pointer hover:scale-105 transition-transform"
                style={{ left: `${tunnelLeftPercent}%` }}
                title="Dağ Tüneli"
              >
                <div className="group/tunnel relative w-full h-full flex items-end justify-center">
                  <img
                    src={SCENERY_IMAGES['track-tunnel']}
                    alt="Dağ Tüneli"
                    className="w-full h-full object-contain drop-shadow-[0_8px_8px_rgba(0,0,0,0.4)]"
                    draggable={false}
                  />
                  <span className="pointer-events-none absolute -top-2 bg-emerald-950/90 text-emerald-200 border border-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg opacity-0 transition-opacity duration-150 group-hover/tunnel:opacity-100 group-focus/tunnel:opacity-100 group-active/tunnel:opacity-100">
                    Dağ Tüneli ⛰️
                  </span>
                </div>
              </div>
            )}

            {/* Merkezî Tren Garı — mağazadan alındığında ana ray hattında görünür. */}
            {hasPlacedStation && (
              <div
                onClick={() => {
                  playPopSound(soundEnabled);
                  setInteractiveMessage('Sincap Köy Garı: Yolcular treni neşeyle bekliyor! 🚉🎟️');
                  speakText('Sincap Köy Garı yolcuları treni bekliyor!', speechEnabled);
                }}
                className="absolute bottom-[20.2%] z-20 cursor-pointer transition-transform hover:scale-105"
                style={{ left: `${stationLeftPercent}%` }}
                title="Sincap Köy Garı"
              >
                {renderSincapStation()}
              </div>
            )}

            {/* Sıpa Maskotu — Gar satın alınınca hemen yanında beliren, ücretsiz dekor */}
            {hasPlacedStation && (
              <div
                onClick={() => {
                  playPopSound(soundEnabled);
                  setInteractiveMessage('Sıpa Sincap Ekspres\'i meraklı gözlerle izliyor! 🫏✨');
                  speakText('Sevimli sıpa treni izliyor!', speechEnabled);
                }}
                className="absolute bottom-[27%] z-20 w-[100px] sm:w-[140px] cursor-pointer transition-transform hover:scale-105 drop-shadow-[0_5px_5px_rgba(0,0,0,0.3)]"
                style={{ left: `${sipaLeftPercent}%` }}
                title="Sıpa"
              >
                <img src={sipaMaskotImg} alt="Sıpa" width={480} height={319} className="w-full h-auto object-contain" draggable={false} />
              </div>
            )}

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

              </div>
            </div>

            {/* 6. DYNAMIC TRAIN ASSEMBLY ON THE CLASSIC STRAIGHT TRACK */}
            <div
              ref={trainAssemblyRef}
              className="absolute z-30 flex items-end flex-row-reverse pointer-events-auto cursor-pointer"
              style={{
                left: `${trainXPos}%`,
                bottom: '16.2%',
                width: 'max-content',
                transform: trainTransform,
                transformOrigin: trainDirection === 'left' ? 'right bottom' : 'left bottom',
                transition: 'left 75ms linear, transform 260ms ease-in-out',
              }}
              onClick={handleWhistleBlow}
              title="Sincap Ekspres! Tıkla ve düdük çal!"
            >
              {/* Locomotive (Leading at the front of the train!) */}
              <div className="relative flex items-end drop-shadow-xl z-10">
                <div className="relative w-20 sm:w-32 h-14 sm:h-20 flex items-end">
                  <img
                    src={lokomotifImg}
                    alt="Sincap Ekspres Lokomotifi"
                    width={480}
                    height={319}
                    className="w-full h-auto object-contain"
                    draggable={false}
                  />
                  {trainLightEnabled && (
                    <span
                      className="train-headlight train-headlight--front"
                      aria-label="Tren farı açık"
                    />
                  )}
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
                      <img
                        src={yolcuVagonuKirmiziImg}
                        alt="Yolcu Vagonu"
                        width={480}
                        height={319}
                        className="shrink-0 h-9 sm:h-14 w-auto object-contain mb-0.5"
                        draggable={false}
                      />
                    )}

                    {type === 'passenger_green' && (
                      <img
                        src={yolcuVagonuYesilImg}
                        alt="Yeşil Yolcu Vagonu"
                        width={480}
                        height={319}
                        className="shrink-0 h-9 sm:h-14 w-auto object-contain mb-0.5"
                        draggable={false}
                      />
                    )}

                    {type === 'cargo_coins' && (
                      <img
                        src={altinVagonuImg}
                        alt="Altın & Hazine Vagonu"
                        width={480}
                        height={319}
                        className="shrink-0 h-9 sm:h-14 w-auto object-contain mb-0.5"
                        draggable={false}
                      />
                    )}

                    {type === 'cargo_fruits' && (
                      <img
                        src={elmaVagonuImg}
                        alt="Meyve Vagonu"
                        width={480}
                        height={319}
                        className="shrink-0 h-8 sm:h-12 w-auto object-contain mb-0.5"
                        draggable={false}
                      />
                    )}

                    {type === 'cargo_toys' && (
                      <img
                        src={oyuncakVagonuImg}
                        alt="Oyuncak Vagonu"
                        width={480}
                        height={319}
                        className="shrink-0 h-9 sm:h-14 w-auto object-contain mb-0.5"
                        draggable={false}
                      />
                    )}

                    {(type === 'cargo_animals' ||
                      type === 'cargo_candy' ||
                      type === 'cargo_space') && (
                      <img
                        src={yukVagonuImg}
                        alt="Yük Vagonu"
                        width={480}
                        height={319}
                        className="shrink-0 h-9 sm:h-14 w-auto object-contain mb-0.5"
                        draggable={false}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Overlay Round Whistle Action Button on Bottom Right (Matching Screenshot Style) */}
            <div className="absolute bottom-4 right-4 z-40">
              <button
                type="button"
                onClick={handleWhistleBlow}
                onPointerDown={unlockAudioContext}
                className="cockpit-floating-horn w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-[#C9483D] hover:bg-[#B94137] text-white flex items-center justify-center shadow-2xl border-4 border-white active:scale-90 transition-transform ring-4 ring-[#E7B4A8]"
                title="Düdük Çal!"
                aria-label="Düdük çal"
              >
                <span className="text-2xl sm:text-4xl">📢</span>
              </button>
            </div>
          </div>

          {/* Kokpit açıkken oyun alanına dokununca paneli kapatan görünmez katman. */}
          {isFullScreen && showCockpitOverlay && (
            <div
              className="cockpit-overlay-backdrop"
              onClick={() => setShowCockpitOverlay(false)}
              aria-hidden="true"
            />
          )}

          {/* Controls & Customizer Toolbar */}
          <div className="world-control-sidebar grid grid-cols-1 gap-3 md:grid-cols-2">
            <section className="cockpit-mission-panel rounded-[1.6rem] border border-[#F3D878] bg-[#FFF9D7] p-3 text-[#4E342E] shadow-lg md:col-span-2" aria-labelledby="cockpit-missions-title">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p id="cockpit-missions-title" className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9A5B00]">Bugünün Kokpit Görevleri</p>
                  <p className="mt-0.5 text-xs font-bold text-[#5D514D]">Kontrollere dokun, yıldızlarını topla!</p>
                </div>
                <div className="shrink-0 rounded-full border border-[#F6B73C] bg-white/85 px-2.5 py-1 text-xs font-black text-[#8A5700]">
                  {cockpitProgress.score} / 25 puan ⭐
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/90 border border-[#F3E5AB]" role="progressbar" aria-label="Günlük kokpit puanı" aria-valuemin={0} aria-valuemax={25} aria-valuenow={cockpitProgress.score}>
                <div className="h-full rounded-full bg-gradient-to-r from-[#F6B73C] via-[#FF8A65] to-[#4CAF50] transition-[width] duration-200" style={{ width: `${Math.min(100, (cockpitProgress.score / 25) * 100)}%` }} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {COCKPIT_MISSIONS.map((mission) => {
                  const completed = cockpitProgress.completed.includes(mission.id);
                  return (
                    <div key={mission.id} className={`flex min-w-0 items-center gap-1.5 rounded-xl border px-2 py-1.5 text-[10px] font-bold ${completed ? 'border-[#A5D6A7] bg-[#E8F5E9] text-[#2E7D32]' : 'border-[#F3E5AB] bg-white/85 text-[#5D514D]'}`}>
                      <span aria-hidden="true" className="shrink-0 text-sm">{completed ? '✅' : mission.icon}</span>
                      <span className="truncate">{mission.title}</span>
                    </div>
                  );
                })}
              </div>
            </section>
            <div className="world-utility-controls grid grid-cols-4 gap-2 rounded-[2rem] border-4 border-slate-800/80 bg-[#0a1b26] p-2 text-white md:col-span-2">
              <button
                type="button"
                onClick={handleThrottleClick}
                onPointerDown={unlockAudioContext}
                className={`cockpit-control-button flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 transition-all active:scale-95 sm:h-16 ${
                  isTrainRunning ? 'border-emerald-500/70 bg-emerald-950/35' : 'border-slate-700 bg-slate-900/55'
                }`}
                title="Hız kolu: dur, yavaş, normal ve hızlı"
                aria-label="Treni durdur veya hızını değiştir"
              >
                <span className="text-3xl leading-none drop-shadow-md sm:text-4xl">🕹️</span>
                <span className="cockpit-control-label text-[10px] font-black text-sky-700">Hız / Dur</span>
              </button>
              <button
                type="button"
                onClick={handleWhistleBlow}
                onPointerDown={unlockAudioContext}
                className={`cockpit-control-button flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 transition-all active:scale-95 sm:h-16 ${hornEnabled ? 'border-amber-300/90 bg-amber-950/45' : 'border-slate-700 bg-slate-900/55'}`}
                title={hornEnabled ? 'Korna çal — ses açık' : 'Korna kapalı'}
                aria-label={hornEnabled ? 'Korna çal — ses açık' : 'Korna kapalı'}
                aria-pressed={hornEnabled}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-4 border-yellow-200 bg-yellow-400 text-xl shadow-lg sm:h-12 sm:w-12 sm:text-2xl">🎺</span>
                <span className="cockpit-control-label text-[10px] font-black text-amber-800">Korna</span>
              </button>
              <button
                type="button"
                onClick={handleTrainLightToggle}
                onPointerDown={unlockAudioContext}
                className={`cockpit-control-button flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 transition-all active:scale-95 sm:h-16 ${
                  trainLightEnabled ? 'border-sky-400/70 bg-sky-950/35' : 'border-slate-700 bg-slate-900/55'
                }`}
                title="Işıkları aç veya kapat"
                aria-label={trainLightEnabled ? 'Farı kapat' : 'Farı aç'}
                aria-pressed={trainLightEnabled}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg sm:h-10 sm:w-10 sm:text-xl ${trainLightEnabled ? 'bg-sky-500' : 'bg-slate-700'}`}>💡</span>
                <span className="cockpit-control-label text-[10px] font-black text-sky-700">Far</span>
                <span className={`h-1.5 w-6 rounded-full ${trainLightEnabled ? 'bg-sky-300' : 'bg-slate-600'}`} />
              </button>
              <button
                type="button"
                onClick={handleMovementSoundToggle}
                onPointerDown={unlockAudioContext}
                className={`cockpit-control-button flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 transition-all active:scale-95 sm:h-16 ${
                  movementSoundEnabled ? 'border-orange-400/70 bg-orange-950/35' : 'border-slate-700 bg-slate-900/55'
                }`}
                title="Hareket sesini aç veya kapat"
                aria-label={movementSoundEnabled ? 'Hareket sesini kapat' : 'Hareket sesini aç'}
                aria-pressed={movementSoundEnabled}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg sm:h-10 sm:w-10 sm:text-xl ${movementSoundEnabled ? 'bg-orange-500' : 'bg-slate-700'}`}>🔊</span>
                <span className="cockpit-control-label text-[10px] font-black text-orange-800">Hareket sesi</span>
                <span className={`h-1.5 w-6 rounded-full ${movementSoundEnabled ? 'bg-orange-300' : 'bg-slate-600'}`} />
              </button>
              <div className="cockpit-utility-footer col-span-4 flex items-center justify-between gap-1 border-t border-sky-200/15 pt-1">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">Tren Kokpiti</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={toggleFullScreen} className="cockpit-utility-button rounded-lg border border-sky-300/30 bg-[#183b4b] px-2 py-1 text-[11px] font-black text-sky-50 active:scale-95" aria-pressed={isFullScreen} aria-label={isFullScreen ? 'Tam ekrandan çık' : 'Tam ekranı aç'}>
                    {isFullScreen ? '⤢ Çık' : '⛶ Tam Ekran'}
                  </button>
                  {onToggleSound && (
                    <button type="button" onPointerDown={unlockAudioContext} onClick={onToggleSound} className="cockpit-utility-button rounded-lg border border-sky-300/30 bg-[#183b4b] px-2 py-1 text-[11px] font-black text-sky-50 active:scale-95" aria-label={soundEnabled ? 'Ana sesi kapat' : 'Ana sesi aç'}>
                      {soundEnabled ? '🔈 Ses' : '🔇 Sessiz'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Speed & Direction Controls */}
            <div className="bg-[#15303e] border border-slate-700/60 rounded-3xl p-3.5 text-white space-y-2">
              <div className="text-xs font-bold text-sky-700 flex items-center gap-1.5 uppercase tracking-wider">
                <FastForward className="w-4 h-4 text-sky-700" />
                <span>Tren Sürüş Kontrolleri</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleTrainRunToggle}
                  onPointerDown={unlockAudioContext}
                  className={`cockpit-secondary-button flex items-center gap-1.5 rounded-xl border px-3 py-2 font-game text-sm font-black text-white shadow-sm transition-transform active:scale-95 ${
                    isTrainRunning
                      ? 'border-sky-200/60 bg-[#2b6f91] hover:bg-[#347fa5]'
                      : 'border-sky-300/25 bg-[#183b4b] hover:bg-[#214b5e]'
                  }`}
                >
                  {isTrainRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isTrainRunning ? 'Treni Durdur' : 'Treni Başlat'}</span>
                </button>

                <div className="cockpit-speed-group flex items-center gap-1 bg-[#0a1820] p-1 rounded-2xl border border-slate-700">
                  <button
                    onClick={() => setTrainSpeed('slow')}
                    className={`cockpit-speed-button px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      trainSpeed === 'slow' ? 'bg-[#2b6f91] text-white' : 'text-slate-400'
                    }`}
                  >
                    🐢 Yavaş
                  </button>
                  <button
                    onClick={() => setTrainSpeed('normal')}
                    className={`cockpit-speed-button px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      trainSpeed === 'normal' ? 'bg-[#2b6f91] text-white' : 'text-slate-400'
                    }`}
                  >
                    🚂 Normal
                  </button>
                  <button
                    onClick={() => setTrainSpeed('fast')}
                    className={`cockpit-speed-button px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      trainSpeed === 'fast' ? 'bg-[#2b6f91] text-white' : 'text-slate-400'
                    }`}
                  >
                    🚀 Hızlı
                  </button>
                </div>

                <div className="cockpit-track-status flex items-center gap-1.5 rounded-2xl border border-emerald-300/40 bg-emerald-950/40 px-3 py-2 text-xs font-bold text-emerald-100">
                  <Compass className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Tek hat · Gidiş / Dönüş</span>
                </div>
              </div>
            </div>

            {/* Wagon Selector & Theme Switcher */}
            <div className="bg-[#15303e] border border-slate-700/60 rounded-3xl p-3.5 text-white space-y-2">
              <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Vagon Ekle & Manzara Değiştir</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleWagon('passenger')}
                  className={`cockpit-option-button px-3 py-1.5 rounded-xl font-game text-xs font-bold border transition-all ${
                    attachedWagons.includes('passenger')
                      ? 'bg-[#2b6f91] border-sky-200/60 text-white'
                      : 'bg-[#102b3a] border-sky-300/15 text-slate-400'
                  }`}
                >
                  🚃 Yolcu Vagonu
                </button>

                <button
                  type="button"
                  onClick={() => toggleWagon('cargo_coins')}
                  className={`cockpit-option-button px-3 py-1.5 rounded-xl font-game text-xs font-bold border transition-all ${
                    attachedWagons.includes('cargo_coins')
                      ? 'bg-[#2b6f91] border-sky-200/60 text-white'
                      : 'bg-[#102b3a] border-sky-300/15 text-slate-400'
                  }`}
                >
                  🪙 Altın Vagonu
                </button>

                <button
                  type="button"
                  onClick={() => toggleWagon('cargo_fruits')}
                  className={`cockpit-option-button px-3 py-1.5 rounded-xl font-game text-xs font-bold border transition-all ${
                    attachedWagons.includes('cargo_fruits')
                      ? 'bg-[#2b6f91] border-sky-200/60 text-white'
                      : 'bg-[#102b3a] border-sky-300/15 text-slate-400'
                  }`}
                >
                  🍎 Meyve Vagonu
                </button>

                <button
                  type="button"
                  onClick={() => toggleWagon('cargo_toys')}
                  className={`cockpit-option-button px-3 py-1.5 rounded-xl font-game text-xs font-bold border transition-all ${
                    attachedWagons.includes('cargo_toys')
                      ? 'bg-[#2b6f91] border-sky-200/60 text-white'
                      : 'bg-[#102b3a] border-sky-300/15 text-slate-400'
                  }`}
                >
                  🧸 Oyuncak Vagonu
                </button>
              </div>

              {/* Theme switcher options */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-bold">Tema:</span>
                <button
                  type="button"
                  onClick={() => setEnvTheme('farm')}
                  className={`cockpit-theme-button px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                    envTheme === 'farm' ? 'bg-[#2b6f91] text-white' : 'bg-[#102b3a] text-slate-400'
                  }`}
                >
                  🌾 Çiftlik
                </button>
                <button
                  type="button"
                  onClick={() => setEnvTheme('sunset')}
                  className={`cockpit-theme-button px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                    envTheme === 'sunset' ? 'bg-[#2b6f91] text-white' : 'bg-[#102b3a] text-slate-400'
                  }`}
                >
                  🌅 Gün Batımı
                </button>
                <button
                  type="button"
                  onClick={() => setEnvTheme('night')}
                  className={`cockpit-theme-button px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                    envTheme === 'night' ? 'bg-[#2b6f91] text-white' : 'bg-[#102b3a] text-slate-400'
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
          <div className="bg-[#15303e] border border-slate-700/60 rounded-3xl p-3.5 text-white flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              {selectedInventoryItem ? (
                <MousePointer2 className="w-4 h-4 text-amber-300" />
              ) : (
                <Plus className="w-4 h-4 text-emerald-400" />
              )}
              <span>
                {selectedInventoryItem
                  ? `${selectedInventoryItem.name} seçili. Haritada bir noktaya dokun veya kartı sürükle.`
                  : 'Satın alınan bir parçayı seç; kasaba haritasında istediğin noktaya yerleştir.'}
              </span>
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Harita kolaylıkları">
            <button
              type="button"
              onClick={handleAutoPlaceSelected}
              className="min-h-12 rounded-2xl border-2 border-emerald-300 bg-emerald-600 px-2 py-2 font-game text-xs font-black text-white shadow-md active:scale-95"
            >
              <WandSparkles className="mx-auto mb-0.5 h-4 w-4" />
              Otomatik Yerleştir
            </button>
            <button
              type="button"
              onClick={handleRotateSelection}
              className="min-h-12 rounded-2xl border-2 border-sky-300 bg-sky-700 px-2 py-2 font-game text-xs font-black text-white shadow-md active:scale-95"
            >
              <RotateCw className="mx-auto mb-0.5 h-4 w-4" />
              Döndür ({placementRotation}°)
            </button>
            <button
              type="button"
              onClick={handleUndoPlacement}
              disabled={placementHistory.length === 0}
              className="min-h-12 rounded-2xl border-2 border-amber-300 bg-amber-500 px-2 py-2 font-game text-xs font-black text-amber-950 shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Undo2 className="mx-auto mb-0.5 h-4 w-4" />
              Geri Al
            </button>
            <button
              type="button"
              onClick={clearMapSelection}
              className="min-h-12 rounded-2xl border-2 border-slate-500 bg-slate-700 px-2 py-2 font-game text-xs font-black text-white shadow-md active:scale-95"
            >
              Seçimi Temizle
            </button>
          </div>

          {/* Living Graphic Builder Map */}
          <div className="relative rounded-[2rem] border-4 border-sky-800 shadow-2xl overflow-hidden bg-sky-200 min-h-[420px] aspect-[16/9] select-none">
            {/* Kasaba burada da görünür kutudan daha geniş; taşan kısım yana
                kaydırılarak keşfedilir. Köşedeki sabit etiketler bu kaydırılabilir
                katmanın DIŞINDA kalır ki ekranda sabit dursunlar. */}
            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden rounded-[2rem]">
              <div className="relative h-full" style={{ width: `${WORLD_WIDE_PERCENT}%` }}>
            <img
              src={stableCartoonBackground}
              alt="Harita çizimi kasaba arka planı"
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
              onError={(event) => {
                const image = event.currentTarget;
                if (image.src !== cartoonBg) image.src = cartoonBg;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-emerald-950/10 pointer-events-none" />

            {/* Soft railway reference, matching ride mode instead of a flat green board */}
            <div className="absolute bottom-[14%] left-0 w-full h-12 sm:h-16 z-10 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 1000 44" preserveAspectRatio="none">
                <rect x="0" y="7" width="1000" height="30" fill="#1e293b" opacity="0.75" />
                <rect x="0" y="11" width="1000" height="22" fill="#78350f" opacity="0.32" />
                <line x1="0" y1="22" x2="1000" y2="22" stroke="#451a03" strokeWidth="16" strokeDasharray="6 10" opacity="0.9" />
                <rect x="0" y="13" width="1000" height="3" fill="#e2e8f0" />
                <rect x="0" y="29" width="1000" height="3" fill="#94a3b8" />
              </svg>
            </div>

            {hasPlacedStation && (
              <div
                className="absolute bottom-[18%] z-[15] pointer-events-none opacity-95"
                style={{ left: `${stationLeftPercent}%` }}
              >
                {renderSincapStation(true)}
              </div>
            )}

            {/* Gentle placement cells over the living town */}
            <div
              className="absolute inset-3 sm:inset-5 z-30 grid gap-1.5 sm:gap-2"
              style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: GRID_ROWS }).map((_, r) =>
	                Array.from({ length: GRID_COLS }).map((_, c) => {
	                  const placed = placedByCell.get(`${c}:${r}`);
	                  const isSelectedTarget = Boolean(selectedInventoryItem);
	                  const accent = placed ? placedItemAccent(placed) : null;

	                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      data-testid={`map-cell-${c}-${r}`}
                      onClick={() => handleMapCellClick(c, r)}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setPreviewCell({ x: c, y: r });
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'copy';
                        setPreviewCell({ x: c, y: r });
                      }}
                      onDragLeave={() => setPreviewCell((current) => current?.x === c && current?.y === r ? null : current)}
                      onDrop={(event) => {
                        handleMapCellDrop(event, c, r);
                        setPreviewCell(null);
                      }}
                      className={`relative rounded-2xl border transition-all focus:outline-none focus:ring-4 focus:ring-amber-300/70 ${
                        previewCell?.x === c && previewCell?.y === r && selectedInventoryItem
                          ? 'border-amber-200 bg-amber-200/30 ring-4 ring-amber-300/40'
                          : placed && isBuildMode
                          ? 'border-emerald-300/70 bg-emerald-400/10 hover:border-amber-200 hover:bg-amber-200/20'
                          : isSelectedTarget || isBuildMode
                          ? 'border-white/45 bg-white/10 hover:border-amber-200 hover:bg-amber-200/20'
                          : 'border-transparent bg-transparent hover:bg-white/10'
                      }`}
                      aria-label={`${c + 1}. sütun ${r + 1}. satır${placed ? `, ${placed.name}` : ''}`}
                    >
                      {!placed && previewCell?.x === c && previewCell?.y === r && selectedInventoryItem && (
                        <span className="absolute inset-1 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-200/25 opacity-90">
                          {SCENERY_IMAGES[selectedInventoryItem.id] ? (
                            <img src={SCENERY_IMAGES[selectedInventoryItem.id]} alt="Önizleme" className="h-full w-full object-contain opacity-75" draggable={false} />
                          ) : (
                            <span className="text-2xl opacity-80">{selectedInventoryItem.icon}</span>
                          )}
                        </span>
                      )}
                      {placed && (
	                        <span className="absolute inset-0 flex items-center justify-center">
	                          <span className={`absolute h-[72%] w-[72%] rounded-2xl blur-md ${accent?.glow}`} />
	                          <span className={`relative flex h-[78%] w-[78%] items-center justify-center rounded-2xl border-2 shadow-[0_10px_16px_rgba(15,23,42,0.42)] ring-2 ${accent?.ring}`} style={{ transform: `rotate(${placed.rotation || 0}deg)` }}>
	                            <span className="absolute inset-1 rounded-xl bg-white/10" />
	                            <span className="relative flex h-full w-full items-center justify-center text-2xl sm:text-4xl drop-shadow-[0_4px_5px_rgba(0,0,0,0.75)] transition-transform hover:scale-110">
	                              {SCENERY_IMAGES[placed.itemId] ? (
	                                <img src={SCENERY_IMAGES[placed.itemId]} alt={placed.name} className="h-full w-full object-contain" draggable={false} />
	                              ) : (
	                                placed.icon
	                              )}
	                            </span>
	                          </span>
	                          <span className={`absolute -bottom-1 left-1/2 max-w-[92%] -translate-x-1/2 truncate rounded-full border px-1.5 py-0.5 text-[8px] font-black leading-none shadow-md ${accent?.label}`}>
	                            {placed.name}
	                          </span>
	                        </span>
	                      )}

                      {/* Delete button in build mode */}
                      {isBuildMode && placed && (
                        <>
                          <span
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemoveItem(placed.id);
                              setPlacementHistory((history) => [...history.slice(-7), worldItems]);
                              setInteractiveMessage(`${placed.name} kaldırıldı. İstersen Geri Al düğmesine dokunabilirsin.`);
                              playPopSound(soundEnabled);
                            }}
                            className="absolute -right-1 -top-1 z-30 rounded-full bg-rose-600 p-1 text-white shadow-lg ring-2 ring-white/80"
                            role="button"
                            aria-label={`${placed.name} kaldır`}
                            title="Kaldır"
                          >
                            <Trash2 className="w-3 h-3" />
                          </span>
                          <span
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRotatePlacedItem(placed);
                            }}
                            className="absolute -left-1 -top-1 z-30 rounded-full bg-sky-600 p-1 text-white shadow-lg ring-2 ring-white/80"
                            role="button"
                            aria-label={`${placed.name} döndür`}
                            title="Döndür"
                          >
                            <RotateCw className="w-3 h-3" />
                          </span>
                        </>
                      )}
                    </button>
                  );
                })
              )}
            </div>
              </div>
            </div>

            <div className="absolute left-4 top-4 z-30 rounded-2xl bg-slate-950/70 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur-sm">
              Harita Çizimi
            </div>
            <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-2xl bg-slate-950/70 px-3 py-2 text-xs font-bold text-sky-100 shadow-lg backdrop-blur-sm">
              <Move className="h-4 w-4 text-amber-300" />
              <span>Sürükle veya seçip dokun</span>
            </div>
          </div>
        </div>
      )}

      {/* Purchased Items Panel */}
      <div className="bg-[#0e2531]/80 backdrop-blur-md border border-slate-700/80 rounded-3xl p-4 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-game text-white text-base sm:text-lg font-bold flex items-center gap-2">
              <span>📦</span> Satın Alınanlar
            </h3>
            <p className="text-xs text-slate-300">
              {viewMode === 'builder'
                ? 'Kartı sürükle ya da seçip kasaba haritasında bir noktaya dokun.'
                : 'Dokunarak dünyana yerleştir, tren lokomotifini değiştir veya haritada çiz!'}
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
                  data-testid={`inventory-item-${item.id}`}
                  draggable={viewMode === 'builder'}
                  onDragStart={(event) => handleInventoryDragStart(event, item)}
                  onDragEnd={() => setDraggedInventoryItem(null)}
                  onClick={() => {
                    if (viewMode === 'builder') {
                      selectInventoryForMap(item);
                    }
                  }}
                  className={`bg-[#15303d] border rounded-2xl p-3 flex flex-col justify-between transition-all shadow-md ${
                    selectedInventoryItem?.id === item.id
                      ? 'border-amber-300 ring-2 ring-amber-300/50 bg-[#1e4152]'
                      : 'border-slate-700/70 hover:border-slate-500'
                  } ${viewMode === 'builder' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-[#0a1820] border border-slate-700 flex items-center justify-center text-3xl shadow-inner flex-shrink-0 overflow-hidden">
                      {SCENERY_IMAGES[item.id] ? (
                        <img src={SCENERY_IMAGES[item.id]} alt={item.name} className="w-full h-full object-contain p-0.5" draggable={false} />
                      ) : (
                        item.icon
                      )}
                    </div>
                    <div>
                      <h4 className="font-game text-sm font-bold text-white line-clamp-1">
                        {item.name}
                      </h4>
                      <span className="text-[10px] text-sky-300 uppercase tracking-wider font-bold">
                        {itemKindLabel(item)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700/60">
                    {item.type === 'train' ? (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          viewMode === 'builder' ? selectInventoryForMap(item) : handleUseInventoryItem(item);
                        }}
                        className={`w-full py-2 px-3 rounded-xl font-game text-xs font-bold border transition-all ${
                          viewMode === 'builder'
                            ? 'bg-amber-500 text-amber-950 border-amber-300'
                            : isTrainActive
                            ? 'bg-emerald-600 text-white border-emerald-400'
                            : 'bg-[#2263df] hover:bg-[#1c55c5] text-white border-blue-400'
                        }`}
                      >
                        {viewMode === 'builder'
                          ? selectedInventoryItem?.id === item.id
                            ? 'Seçildi, Haritaya Dokun'
                            : isPlaced
                            ? 'Yerini Değiştir'
                            : 'Haritaya Yerleştir'
                          : isTrainActive
                          ? 'Sürüşte Etkin 🚂'
                          : 'Bu Treni Sür 🚂'}
                      </button>
                    ) : item.type === 'wagon' || item.category === 'wagons' ? (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          viewMode === 'builder' ? selectInventoryForMap(item) : handleUseInventoryItem(item);
                        }}
                        className={`w-full py-2 px-3 rounded-xl font-game text-xs font-bold border transition-all ${
                          viewMode === 'builder'
                            ? 'bg-amber-500 text-amber-950 border-amber-300'
                            : attachedWagons.includes(item.wagonType || 'passenger')
                            ? 'bg-emerald-600 text-white border-emerald-400'
                            : 'bg-[#2263df] hover:bg-[#1c55c5] text-white border-blue-400'
                        }`}
                      >
                        {viewMode === 'builder'
                          ? selectedInventoryItem?.id === item.id
                            ? 'Seçildi, Haritaya Dokun'
                            : isPlaced
                            ? 'Yerini Değiştir'
                            : 'Haritaya Yerleştir'
                          : attachedWagons.includes(item.wagonType || 'passenger')
                          ? 'Trene Bağlı 🚃'
                          : 'Trene Bağla 🚃'}
                      </button>
                    ) : (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          viewMode === 'builder' ? selectInventoryForMap(item) : handleUseInventoryItem(item);
                        }}
                        className="w-full py-2 px-3 rounded-xl font-game text-xs font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 border border-amber-300 hover:brightness-105 shadow-sm"
                      >
                        {viewMode === 'builder'
                          ? selectedInventoryItem?.id === item.id
                            ? 'Seçildi, Haritaya Dokun'
                            : isPlaced
                            ? 'Yerini Değiştir'
                            : 'Haritaya Yerleştir'
                          : isPlaced
                          ? 'Dünyanda Yayında ✨'
                          : 'Dünyana Ekle 🪄'}
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
