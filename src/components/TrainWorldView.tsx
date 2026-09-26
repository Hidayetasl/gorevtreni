import React, { useState, useEffect, useRef } from 'react';
// Tasarım: Pastel Tren Rotası — kokpit görevleri beyaz/uyarıcı sarı yüzeylerle, başarılar canlı yeşille görünür.
import { PlacedWorldItem, ShopItem, UserProfile } from '../types';
import { playTrainWhistle, playTrainMovementTick, playPopSound, speakText, unlockAudioContext, speakTurkishThenEnglish } from '../utils/audio';

/** Dünya'da yapıya dokununca: 'both' = Türkçe + İngilizce, 'en' = sadece İngilizce. Cihazda hatırlanır. */
const WORD_LANG_KEY = 'ruzgar_world_word_lang_v1';
type WordLang = 'both' | 'en';
import { ArrowLeft, Check, Plus, Trash2, Play, Pause, Sparkles, Volume2, VolumeX, Maximize2, Minimize2, FastForward, RotateCcw, RotateCw, Undo2, WandSparkles, MapPin, Eye, Compass, Layers, Move, MousePointer2 } from 'lucide-react';
import menuTren from '../assets/images/menu-tren.webp';
import menuKasaba from '../assets/images/menu-kasaba.webp';
import menuHangar from '../assets/images/menu-hangar.webp';
import dunyamKapak from '../assets/images/dunyam-kapak.webp';
import kumandaKalk from '../assets/images/kumanda-kalk.webp';
import kumandaKorna from '../assets/images/kumanda-korna.webp';
import kumandaIsik from '../assets/images/kumanda-isik.webp';
import kumandaMotor from '../assets/images/kumanda-motor.webp';
import kumandaYavas from '../assets/images/kumanda-yavas.webp';
import kumandaNormal from '../assets/images/kumanda-normal.webp';
import kumandaHizli from '../assets/images/kumanda-hizli.webp';

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
import yukVagonuImg from '../assets/images/yuk-vagonu.webp';
import yukVagonuTurkuazImg from '../assets/images/yuk-vagonu-turkuaz.webp';
import yolcuVagonuMorImg from '../assets/images/yolcu-vagonu-mor.webp';
import altinVagonuImg from '../assets/images/altin-vagonu.webp';
import elmaVagonuImg from '../assets/images/elma-vagonu.webp';
import oyuncakVagonuImg from '../assets/images/oyuncak-vagonu.webp';
import sipaMaskotImg from '../assets/images/sipa-maskot.webp';
import { SCENERY_IMAGES } from '../utils/sceneryImages';
import { sceneWord } from '../utils/sceneWords';
// Sahnede rayla aynı hizada duran, yandan görünen köprü (mağazada 3D görsel kalır).
import kopruYanImg from '../assets/images/kopru-yan.webp';

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

// menu = Dünya'nın giriş ekranı (üç büyük kutu); diğerleri tek başına açılır.
type ViewMode = 'menu' | 'ride' | 'builder' | 'garage';
const WORLD_SECTIONS: Array<{ id: Exclude<ViewMode, 'menu'>; label: string; detail: string; icon: React.ReactNode }> = [
  { id: 'ride', label: 'Treni sür', detail: 'Kumandayı kullan', icon: <img className="gt-menu-img" src={menuTren} alt="" draggable={false} /> },
  { id: 'builder', label: 'Kasabayı kur', detail: 'Parçaları yerleştir', icon: <img className="gt-menu-img" src={menuKasaba} alt="" draggable={false} /> },
  { id: 'garage', label: 'Hangar', detail: 'Satın aldığın her şey', icon: <img className="gt-menu-img" src={menuHangar} alt="" draggable={false} /> },
];
type EnvironmentTheme = 'farm' | 'mountains' | 'sunset' | 'night';

type TrainLinePosition = { left: number; top: number; direction: 1 | -1 };
type CockpitMissionId = 'start' | 'horn' | 'light' | 'movement' | 'stop';
type CockpitProgress = { dayKey: string; score: number; completed: CockpitMissionId[] };

const COCKPIT_PROGRESS_KEY = 'ruzgar_cockpit_missions_v1';
const COCKPIT_MISSIONS: Array<{ id: CockpitMissionId; icon: string; title: string; points: number }> = [
  { id: 'start', icon: '▶️', title: 'Treni başlat', points: 5 },
  { id: 'horn', icon: '📣', title: 'Korna çal', points: 5 },
  { id: 'light', icon: '💡', title: 'Işığı yak', points: 5 },
  { id: 'movement', icon: '🔊', title: 'Motoru çalıştır', points: 5 },
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

// Gerçek görseli olan eşyaların ana sahnedeki boyu: sahne yüksekliğinin yüzdesi
// (cqh) ve üst sınır (px). Böylece yatay tam ekranda (kısa sahne) binalar treni
// kaplamaz, dik tam ekranda da aşırı büyümez. [yükseklik cqh, en fazla px, en/boy]
type SceneImgBox = [number, number, number?];
// Yeni 3D görseller kenar boşluksuz olduğundan eskisinden büyük görünüyordu;
// binalar lokomotiften küçük kalsın, birbirine binmesin diye ölçüler küçük tutulur.
const SCENE_IMG_BOX: Record<string, SceneImgBox> = {
  'scenery-ambulance': [14, 84],
  'scenery-firestation': [14, 84],
  'scenery-squirrel-courier': [12, 66],
  // Dönme dolap diğer binalardan belirgin şekilde yüksek.
  'scenery-ferris': [30, 170, 0.66],
  'scenery-house': [20, 110],
  'scenery-house-2': [20, 110],
  'scenery-house-3': [20, 110],
  'scenery-house-4': [20, 110],
  'scenery-house-5': [20, 110],
  'scenery-house-6': [20, 110],
  // Kamu binaları evlerden belirgin şekilde büyük.
  'scenery-school': [28, 150],
  'scenery-hospital': [28, 150],
  'scenery-market': [26, 140],
  'scenery-bakery': [26, 140],
  'scenery-cinema': [26, 140],
  'scenery-train-repair': [26, 140],
  'scenery-firestation-building': [26, 140],
};
const DEFAULT_SCENE_IMG_BOX: SceneImgBox = [21, 112];
function sceneImgStyle(itemId: string): React.CSSProperties {
  const [cqh, maxPx, ratio = 1] = SCENE_IMG_BOX[itemId] || DEFAULT_SCENE_IMG_BOX;
  const height = `min(${cqh}cqh, ${maxPx}px)`;
  return { height, width: ratio === 1 ? height : `calc(${height} * ${ratio})` };
}

// Arka plan resmindeki (bos-genis.webp, 1600x686) nehrin orta çizgisi:
// [resim yüksekliği oranı, resim genişliği oranı]. Resim ekranın şekline göre
// kırpıldığından köprü, nehrin rayı kestiği noktaya bu yolla oturtulur.
const BG_SIZE = { w: 1600, h: 686 };
const RIVER_PATH: Array<[number, number]> = [
  [0.6, 0.259], [0.64, 0.183], [0.68, 0.183], [0.72, 0.217], [0.76, 0.271],
  [0.8, 0.292], [0.84, 0.3], [0.9, 0.297], [0.96, 0.275], [1, 0.267],
];
function riverXAt(yFrac: number) {
  const y = Math.min(Math.max(yFrac, RIVER_PATH[0][0]), 1);
  for (let i = 1; i < RIVER_PATH.length; i += 1) {
    const [y1, x1] = RIVER_PATH[i];
    const [y0, x0] = RIVER_PATH[i - 1];
    if (y <= y1) return x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
  }
  return RIVER_PATH[RIVER_PATH.length - 1][1];
}

// Izgara hücresini (0..7, 0..6) ana sahnenin güvenli görüntü alanına (bulut ve
// ray şeridi hariç) eşleyen yardımcı fonksiyon.
// Kasabayı kur ızgarasındaki sütunun ortası (%). Sahnedeki her şey (bina,
// gar, köprü, tünel) bu tek hesapla yerleşir; seçilen kare ile sahne eşleşir.
function columnCenterPercent(x: number) {
  return ((Math.min(Math.max(x, 0), GRID_COLS - 1) + 0.5) / GRID_COLS) * 100;
}

function gridCellToScenePercent(x: number, y: number) {
  const left = columnCenterPercent(x);
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
  const [viewMode, setViewMode] = useState<ViewMode>('menu');
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
    const sources = [lokomotifImg, yolcuVagonuKirmiziImg, yolcuVagonuMorImg, yukVagonuImg, yukVagonuTurkuazImg, altinVagonuImg, elmaVagonuImg, oyuncakVagonuImg];
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
  // Tren sabit piksel boyunda çizilir; kısa sahnede (yatay telefon) binalarla
  // orantılı kalsın diye sahne yüksekliğine göre ölçeklenir (%72–%110).
  const [trainScale, setTrainScale] = useState(1);
  useEffect(() => {
    const canvasEl = rideCanvasRef.current;
    const assemblyEl = trainAssemblyRef.current;
    if (!canvasEl || !assemblyEl || viewMode !== 'ride' || !trainImagesReady) return;

    const measure = () => {
      const canvasWidth = canvasEl.offsetWidth;
      const assemblyWidth = assemblyEl.offsetWidth;
      const scale = Math.min(1.5, Math.max(0.72, canvasEl.offsetHeight / 320));
      setTrainScale(scale);
      if (canvasWidth > 0 && assemblyWidth > 0) {
        setAssemblyWidthPercent(((assemblyWidth * scale) / canvasWidth) * 100);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvasEl);
    observer.observe(assemblyEl);
    return () => observer.disconnect();
  }, [viewMode, attachedWagons, user.activeTrainIcon, trainImagesReady]);
  const [interactiveMessage, setInteractiveMessage] = useState<string>('Panda Kaptan tek ray hattında gidip geliyor! 🚂💨');
  // Durum mesajı sahnenin üstünde birkaç saniyelik bir balon olarak görünür.
  const [bubbleVisible, setBubbleVisible] = useState(true);
  useEffect(() => {
    setBubbleVisible(true);
    const timer = window.setTimeout(() => setBubbleVisible(false), 4500);
    return () => window.clearTimeout(timer);
  }, [interactiveMessage]);
  // Telefonda kaptan görevleri üstteki yıldız rozetine dokununca açılır.
  const [showMissions, setShowMissions] = useState(false);

  // Check unlocked structures from inventory
  const hasPlacedBridge = worldItems.some((item) => item.itemId === 'track-bridge');
  const hasPlacedTunnel = worldItems.some((item) => item.itemId === 'track-tunnel');
  const hasPlacedStation = worldItems.some((item) => item.itemId === 'track-station');

  // Gar, Harita Çizimi'nde seçilen sütuna (x) göre ray hattı üzerinde kayar;
  // ray hep aynı yükseklikte kaldığından dikey konum sabit tutulur.
  const placedStation = worldItems.find((item) => item.itemId === 'track-station');
  const stationLeftPercent = columnCenterPercent(placedStation?.x ?? 6);

  // Köprü ve tünel de Kasabayı kur'da seçilen sütunun ortasına oturur.
  // Birden çok köprü yerleştirilebilir; her biri rayın üstünde çizilir.
  const placedBridges = worldItems.filter((item) => item.itemId === 'track-bridge');
  const placedTunnel = worldItems.find((item) => item.itemId === 'track-tunnel');
  const tunnelLeftPercent = columnCenterPercent(placedTunnel?.x ?? 12);

  // Köprü, nehrin rayı kestiği noktaya oturur (ekranın şekli ne olursa olsun).
  const rideRailRef = useRef<HTMLDivElement | null>(null);
  const [bridgeSpot, setBridgeSpot] = useState<{ left: number; width: number } | null>(null);
  // Arka planın yatay kayması (px): resim genişse (dik tam ekran) nehir, trenin
  // gidip geldiği görünür alana düşecek şekilde kaydırılır.
  const [bgOffsetX, setBgOffsetX] = useState(0);
  useEffect(() => {
    const inner = rideCanvasRef.current?.firstElementChild as HTMLElement | null;
    const rail = rideRailRef.current;
    const canvas = rideCanvasRef.current;
    if (!canvas || !inner || !rail || viewMode !== 'ride') return;
    const measure = () => {
      const box = inner.getBoundingClientRect();
      const railBox = rail.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return;
      // object-cover: resim kutuyu dolduracak kadar büyütülür, dikeyde ortalanır.
      const scale = Math.max(box.width / BG_SIZE.w, box.height / BG_SIZE.h);
      const offsetY = (box.height - BG_SIZE.h * scale) / 2;
      const railY = railBox.top - box.top + railBox.height * (30 / 64);
      const riverFrac = riverXAt((railY - offsetY) / (BG_SIZE.h * scale));
      // Nehir, görünür kutunun %30'una gelsin; resim kutunun dışına taşmasın.
      const slack = box.width - BG_SIZE.w * scale; // <= 0
      const offsetX = Math.min(0, Math.max(slack, canvas.clientWidth * 0.3 - riverFrac * BG_SIZE.w * scale));
      setBgOffsetX(offsetX);
      const riverX = offsetX + riverFrac * BG_SIZE.w * scale;
      // Köprü nehri ayaklarıyla kucaklayacak kadar geniş olur.
      const widthPx = Math.max(box.width * (2 / GRID_COLS), 0.125 * BG_SIZE.w * scale);
      setBridgeSpot({ left: (riverX / box.width) * 100, width: (widthPx / box.width) * 100 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [viewMode]);

  // Sahip olunan düz/viraj ray parçalarının sayısı koleksiyon etiketinde
  // gösterilir; çalışan tren her zaman ana düz hatta gidip gelir.
  const secondRailPieceCount = worldItems.filter(
    (item) => item.itemId === 'track-straight' || item.itemId === 'track-curve',
  ).length;
  // Ana ray üzerindeki V4 ping-pong hareketi; satın alınan parça sayısından bağımsızdır.
  const trainTransform = `scale(${trainDirection === 'left' ? -trainScale : trainScale}, ${trainScale})`;

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
  // Kasabayı kur: haritadaki bir yapıya dokununca seçilir, boş kareye dokununca oraya taşınır.
  const [movingItem, setMovingItem] = useState<PlacedWorldItem | null>(null);
  const [lastMoved, setLastMoved] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<ShopItem | null>(null);
  useEffect(() => { if (selectedInventoryItem) setMovingItem(null); }, [selectedInventoryItem]);
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
    if (!isFullScreen && viewMode !== 'ride') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isFullScreen, viewMode]);

  // Tam ekranda kokpit paneli varsayılan olarak KAPALI — ekranda sadece oyun
  // alanı görünür. 🎛️ düğmesiyle alttan açılan bir panel olarak belirir, oyun
  // alanına dokununca (backdrop) kapanır. Tam ekrandan çıkınca sıfırlanır ki
  // bir dahaki girişte yine sadece oyun alanıyla başlansın.
  const [showCockpitOverlay, setShowCockpitOverlay] = useState(false);
  useEffect(() => {
    if (viewMode !== 'ride') setShowCockpitOverlay(false);
  }, [viewMode]);
  // Dik telefonda "yan çevir" ipucu; bir kez kapatılınca bu oturumda gösterilmez.
  const [rotateHintClosed, setRotateHintClosed] = useState(() => {
    try { return sessionStorage.getItem('ruzgar_rotate_hint_closed') === '1'; } catch { return false; }
  });

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
  // Yapıya/nesneye dokununca adı önce Türkçe, sonra İngilizce söylenir.
  const [wordLang, setWordLang] = useState<WordLang>(() => {
    try { return localStorage.getItem(WORD_LANG_KEY) === 'en' ? 'en' : 'both'; } catch { return 'both'; }
  });
  const toggleWordLang = () => {
    playPopSound(soundEnabled);
    const next: WordLang = wordLang === 'both' ? 'en' : 'both';
    setWordLang(next);
    try { localStorage.setItem(WORD_LANG_KEY, next); } catch { /* yoksay */ }
    setInteractiveMessage(next === 'en' ? '🇬🇧 Sadece İngilizce: bir yapıya dokun!' : '🇹🇷 🇬🇧 Türkçe ve İngilizce: bir yapıya dokun!');
    if (next === 'en') speakText('English', speechEnabled, 0.8, 'en-US', 1.0);
    else speakText('Türkçe ve İngilizce', speechEnabled);
  };
  const sayWord = (itemId: string) => {
    const word = sceneWord(itemId);
    if (!word) return false;
    if (wordLang === 'en') {
      setInteractiveMessage(`${word.emoji} ${word.en}`);
      speakText(word.en, speechEnabled, 0.7, 'en-US', 1.0);
    } else {
      setInteractiveMessage(`${word.emoji} ${word.tr} = ${word.en}`);
      speakTurkishThenEnglish(word.tr, word.en, speechEnabled);
    }
    return true;
  };

  const handleCowClick = () => {
    playPopSound(soundEnabled);
    setCowMooing(true);
    sayWord('scenery-cow');
    setTimeout(() => setCowMooing(false), 2000);
  };

  const handleWindmillClick = () => {
    playPopSound(soundEnabled);
    setWindmillSpinningFast(true);
    sayWord('scenery-windmill');
    setTimeout(() => setWindmillSpinningFast(false), 3000);
  };

  const handleAppleTreeClick = () => {
    playPopSound(soundEnabled);
    setApplesFalling(true);
    sayWord('scenery-tree');
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
    // Elma ağacı ve inek kendi animasyonlarıyla birlikte adlarını söyler.
    if (clickedItem && viewMode === 'ride' && sceneWord(clickedItem.itemId) && !clickedItem.icon.includes('🌳') && !clickedItem.icon.includes('🐄')) {
      sayWord(clickedItem.itemId);
      return;
    }
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
    const placed = placedByCell.get(`${x}:${y}`);
    // Taşıma: önce yapıya dokun (seçilir), sonra boş bir kareye dokun (taşınır).
    if (movingItem) {
      if (placed?.id === movingItem.id) {
        setMovingItem(null);
        playPopSound(soundEnabled);
        setInteractiveMessage('Taşıma iptal edildi.');
        return;
      }
      if (placed) {
        // Dolu kareye dokununca üzerine yazılmaz (yanlışlıkla silinmesin); o yapı seçilir.
        setMovingItem(placed);
        playPopSound(soundEnabled);
        setInteractiveMessage(`${placed.name} seçildi 👆 Şimdi boş bir yere dokun.`);
        return;
      }
      rememberPlacement();
      const { id: _id, ...rest } = movingItem;
      onRemoveItem(movingItem.id);
      onPlaceItem({ ...rest, x, y });
      setMovingItem(null);
      setLastMoved(movingItem.name);
      playPopSound(soundEnabled);
      setInteractiveMessage(`${movingItem.name} taşındı! ✨`);
      return;
    }
    if (selectedInventoryItem) {
      placeInventoryOnMap(selectedInventoryItem, x, y);
      return;
    }
    if (placed) {
      setMovingItem(placed);
      playPopSound(soundEnabled);
      setInteractiveMessage(`${placed.name} seçildi 👆 Taşımak istediğin boş yere dokun.`);
      return;
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
    <div className={`relative ${compact ? 'w-[80px] sm:w-[150px]' : ''} drop-shadow-[0_7px_7px_rgba(0,0,0,0.35)]`} style={compact ? undefined : { width: 'min(46cqh, 250px)' }}>
      <img
        src={merkezGarImg}
        alt="Sincap Köy Garı"
        className="w-full h-auto object-contain"
        draggable={false}
      />
    </div>
  );

  const openSection = (section: ViewMode) => {
    playPopSound(soundEnabled);
    setViewMode(section);
    window.scrollTo({ top: 0 });
  };

  const backToMenu = () => {
    playPopSound(soundEnabled);
    if (isFullScreen) void toggleFullScreen();
    setIsBuildMode(false);
    setSelectedInventoryItem(null);
    setViewMode('menu');
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="world-view gt-world">
      {viewMode === 'menu' ? (
        <>
          <div className="gt-head">
            <h1>Tren Dünyası</h1>
          </div>
          <div className="gt-wmenu">
            <img className="gt-wcover" src={dunyamKapak} alt="Sincap Köy İstasyonu: trende el sallayan küçük kaptan" draggable={false} />
            <div className="gt-wmenu-side">
              <p className="gt-menu-hint">Ne yapmak istersin?</p>
              <div className="gt-menu world" aria-label="Dünya bölümleri">
                {WORLD_SECTIONS.map((section) => (
                  <button key={section.id} type="button" className={`gt-menu-card w-${section.id}`} onClick={() => openSection(section.id)}>
                    <span className="e" aria-hidden="true">{section.icon}</span>
                    <span className="t">{section.label}<small>{section.id === 'ride' ? `⭐ ${cockpitProgress.score} / 25 kaptan yıldızı` : section.detail}</small></span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : viewMode === 'ride' ? null : (
        <>
          <div className="gt-head gt-subhead">
            <button type="button" className="gt-back" onClick={backToMenu} aria-label="Dünya menüsüne geri dön">
              <span className="ar" aria-hidden="true"><ArrowLeft strokeWidth={3.5} /></span>Geri
            </button>
            <h1 className="gt-wtitle">{WORLD_SECTIONS.find((section) => section.id === viewMode)?.icon} {WORLD_SECTIONS.find((section) => section.id === viewMode)?.label}</h1>
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* MODE 1: HIGH-QUALITY CARTOON RIDE GAME CANVAS (MATCHING USER PHOTO)   */}
      {/* ===================================================================== */}
      {viewMode === 'ride' && (
        <div ref={fullScreenStageRef} className={`world-ride-layout gt-game ${showCockpitOverlay ? 'cockpit-open' : ''}`}>
          {/* Oyun ekranı: sahne tüm ekranı kaplar; üstte ince şerit, altta oyun kumandası. */}
          <div className="gt-gbar">
            <button type="button" className="gt-gchip back" onClick={backToMenu} aria-label="Dünya menüsüne geri dön">
              <ArrowLeft strokeWidth={3.5} aria-hidden="true" />
            </button>
            <span className="gt-gchip title"><img src={menuTren} alt="" draggable={false} />Treni sür</span>
            <span className="gt-gchip coin" aria-label={`${user.coins} puan`}><i aria-hidden="true" />{user.coins}</span>
            <button
              type="button"
              onPointerDown={unlockAudioContext}
              onClick={toggleWordLang}
              className={`gt-gchip lang ${wordLang === 'en' ? 'en' : ''}`}
              aria-label={wordLang === 'en' ? 'Yapı adları: sadece İngilizce. Türkçe ve İngilizceye geç' : 'Yapı adları: Türkçe ve İngilizce. Sadece İngilizceye geç'}
              title="Yapı adlarının dili"
            >
              {wordLang === 'en' ? 'EN' : 'TR+EN'}
            </button>
            <button type="button" className="gt-gchip icon" onClick={toggleFullScreen} aria-pressed={isFullScreen} aria-label={isFullScreen ? 'Tam ekrandan çık' : 'Tam ekran'}>
              {isFullScreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            </button>
            <button type="button" className="gt-gchip icon more" aria-expanded={showCockpitOverlay} onClick={() => { playPopSound(soundEnabled); setShowCockpitOverlay((open) => !open); }} aria-label="Diğer kumandalar ve kaptan görevleri">
              <span aria-hidden="true">⋯</span>{cockpitProgress.score > 0 && <b className="stars">⭐{cockpitProgress.score}</b>}
            </button>
          </div>
          <p className={`gt-wbubble gt-gbubble ${bubbleVisible ? 'show' : ''}`} role="status" aria-live="polite">{interactiveMessage}</p>
          {!rotateHintClosed && (
            <button type="button" className="gt-grotate" onClick={() => { setRotateHintClosed(true); try { sessionStorage.setItem('ruzgar_rotate_hint_closed', '1'); } catch { /* yoksay */ } }}>
              <span aria-hidden="true">📱↻</span> Telefonu yan çevir, kasaba büyüsün <b aria-hidden="true">×</b>
            </button>
          )}
          <div className="gt-gpad left" role="group" aria-label="Hız">
            <button type="button" className={trainSpeed === 'slow' ? 'on' : ''} aria-pressed={trainSpeed === 'slow'} aria-label="Yavaş" onClick={() => { playPopSound(soundEnabled); setTrainSpeed('slow'); }}><img src={kumandaYavas} alt="" draggable={false} /></button>
            <button type="button" className={trainSpeed === 'normal' ? 'on' : ''} aria-pressed={trainSpeed === 'normal'} aria-label="Normal hız" onClick={() => { playPopSound(soundEnabled); setTrainSpeed('normal'); }}><img src={kumandaNormal} alt="" draggable={false} /></button>
            <button type="button" className={trainSpeed === 'fast' ? 'on' : ''} aria-pressed={trainSpeed === 'fast'} aria-label="Hızlı" onClick={() => { playPopSound(soundEnabled); setTrainSpeed('fast'); }}><img src={kumandaHizli} alt="" draggable={false} /></button>
          </div>
          <div className="gt-gpad right">
            <button type="button" className={`gt-gbtn horn ${isWhistling ? 'toot' : ''}`} onClick={handleWhistleBlow} onPointerDown={unlockAudioContext} aria-label="Korna çal">
              <img src={kumandaKorna} alt="" draggable={false} /><span>Korna</span>
            </button>
            <button type="button" className={`gt-gbtn go ${isTrainRunning ? 'stop' : ''}`} onClick={handleTrainRunToggle} onPointerDown={unlockAudioContext} aria-pressed={isTrainRunning} aria-label={isTrainRunning ? 'Treni durdur' : 'Treni başlat'}>
              <img src={kumandaKalk} alt="" draggable={false} />
              {isTrainRunning && <b className="pause" aria-hidden="true"><Pause strokeWidth={3} /></b>}
              <span>{isTrainRunning ? 'Dur' : 'Başla'}</span>
            </button>
          </div>
          {/* Main Graphic Canvas Box */}
          <div
            className="world-ride-canvas-shell relative w-full aspect-[16/9] min-h-[300px] overflow-hidden rounded-3xl border-4 border-slate-700 shadow-2xl group select-none sm:min-h-[420px]"
          >
            {/* Kasaba artık daha geniş bir alanda: bu iç kaydırılabilir katman görünür
                kutudan daha geniş, taşan kısım yana kaydırılarak keşfedilir. Hareket eden
                tren ve düdük düğmesi bu katmanın DIŞINDA kalır ki ekranda sabit dursunlar. */}
            <div ref={rideCanvasRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden rounded-3xl">
              <div className="relative h-full" style={{ width: `${WORLD_WIDE_PERCENT}%`, containerType: 'size' }}>
            {/* Background Illustration Image */}
            <img
              src={cartoonBg}
              alt="Cartoon Train Scene"
              onError={(event) => {
                const image = event.currentTarget;
                if (image.src !== stableCartoonBackground) image.src = stableCartoonBackground;
              }}
              // Dik tam ekranda nehir görünür alana kaydırılır (bkz. bgOffsetX).
              style={{ objectPosition: `${bgOffsetX}px 50%` }}
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
                  className="gt-lot group/item absolute flex flex-col items-center gap-0.5 rounded-xl px-1 py-0.5 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  style={{ left: anchor.left, top: anchor.top, zIndex: 20 + item.y, transform: `translate(-50%, -50%) scale(${getSceneDepthScale(item.y)})` }}
                  title={`${item.name} — dokun ve keşfet`}
                >
                  {SCENERY_IMAGES[item.itemId] ? (
                    <img src={SCENERY_IMAGES[item.itemId]} alt={item.name} className="object-contain drop-shadow-[0_5px_5px_rgba(0,0,0,0.45)]" style={sceneImgStyle(item.itemId)} draggable={false} />
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
            <div ref={rideRailRef} className="straight-track absolute bottom-[13%] left-0 z-10 h-10 w-full pointer-events-none sm:h-14">
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
              {/* Köprü rayın içinde çizilir: yandan görünen düz köprünün üstündeki
                  ray sahnedeki raya oturur, tren üstünden geçer. Birden çok köprü
                  alınmış olsa da nehir tek olduğu için bir köprü çizilir. */}
              {hasPlacedBridge && (
                <button
                  type="button"
                  onClick={() => {
                    playPopSound(soundEnabled);
                    sayWord('track-bridge');
                  }}
                  className="absolute cursor-pointer"
                  style={{
                    top: '50%',
                    left: `${bridgeSpot?.left ?? columnCenterPercent(placedBridges[0]?.x ?? 3)}%`,
                    width: `${bridgeSpot?.width ?? (2 / GRID_COLS) * 100}%`,
                    transform: 'translate(-50%, -38%)',
                    pointerEvents: 'auto',
                  }}
                  title="Kırmızı Tren Köprüsü"
                >
                  <img src={kopruYanImg} alt="Kırmızı Tren Köprüsü" width={700} height={270} className="block w-full h-auto drop-shadow-[0_8px_8px_rgba(0,0,0,0.4)]" draggable={false} />
                </button>
              )}
              <div className="absolute left-[7%] top-0 rounded-full border border-sky-200/50 bg-slate-950/75 px-2 py-1 text-[8px] font-black text-sky-100 shadow-lg sm:text-[10px]">↔ TEK HAT · GİDİŞ / DÖNÜŞ{secondRailPieceCount > 0 ? ` · ${secondRailPieceCount} parça` : ''}</div>
            </div>

            {/* Mountain Tunnel Overlay when unlocked or placed */}
            {hasPlacedTunnel && (
              <div
                onClick={() => {
                  playPopSound(soundEnabled);
                  sayWord('track-tunnel');
                }}
                className="absolute bottom-[9.5%] z-25 -rotate-3 cursor-pointer hover:scale-105 transition-transform"
                style={{ left: `${tunnelLeftPercent}%`, transform: 'translateX(-50%)', height: 'min(28cqh, 150px)', width: 'min(40cqh, 216px)' }}
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
                  sayWord('track-station');
                }}
                className="absolute bottom-[20.2%] z-20 cursor-pointer transition-transform hover:scale-105"
                style={{ left: `${stationLeftPercent}%`, transform: 'translateX(-50%)' }}
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
                  sayWord('scenery-donkey');
                }}
                className="absolute cursor-pointer transition-transform hover:scale-105 drop-shadow-[0_5px_5px_rgba(0,0,0,0.3)]"
                // Garın hemen solunda, rayın arkasındaki çimende: tren önünden geçerken de başı görünür.
                style={{ zIndex: 29, bottom: "calc(13% + 17cqh)", left: `${stationLeftPercent}%`, width: 'min(34cqh, 170px)', transform: 'translateX(calc(-100% - min(19cqh, 104px)))' }}
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
                // Ray yatağı alttan %13'te ve sabit piksel yüksekliğinde; tren sahne
                // yüksekliğine göre değil raya göre konumlanır ki her ekranda ray üstünde kalsın.
                bottom: 'calc(13% + var(--gt-rail-lift, 7px))',
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
                        src={yolcuVagonuMorImg}
                        alt="Mor Yolcu Vagonu"
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

                    {type === 'cargo_animals' && (
                      <img
                        src={yukVagonuTurkuazImg}
                        alt="Yük Vagonu"
                        width={480}
                        height={319}
                        className="shrink-0 h-9 sm:h-14 w-auto object-contain mb-0.5"
                        draggable={false}
                      />
                    )}

                    {(type === 'cargo_candy' ||
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

          </div>

          {/* Kokpit açıkken oyun alanına dokununca paneli kapatan görünmez katman. */}
          {showCockpitOverlay && (
            <div
              className="cockpit-overlay-backdrop gt-gsheet-bg"
              onClick={() => setShowCockpitOverlay(false)}
              aria-hidden="true"
            />
          )}

          {/* Kumanda paneli (tam ekranda 🎛️ ile açılan alt sayfa da budur) */}
          <div className="world-control-sidebar gt-wc">
            <section className="gt-wpanel" aria-label="Tren kumandası">
              <div className="gt-wbtns">
                <button
                  type="button"
                  onClick={handleTrainRunToggle}
                  onPointerDown={unlockAudioContext}
                  className={`gt-wbtn ${isTrainRunning ? 'dur' : 'mavi'}`}
                  aria-pressed={isTrainRunning}
                >
                  <span className="pic" aria-hidden="true">
                    <img src={isTrainRunning ? kumandaNormal : kumandaKalk} alt="" draggable={false} />
                    {isTrainRunning && <span className="badge"><Pause strokeWidth={3} /></span>}
                  </span>
                  {isTrainRunning ? 'Dur' : 'Kalk'}
                </button>
                <button
                  type="button"
                  onClick={handleWhistleBlow}
                  onPointerDown={unlockAudioContext}
                  className={`gt-wbtn ${isWhistling ? 'toot' : ''}`}
                  aria-label={hornEnabled ? 'Korna çal' : 'Korna kapalı'}
                >
                  <span className="pic" aria-hidden="true"><img src={kumandaKorna} alt="" draggable={false} /></span>
                  Korna
                </button>
                <button
                  type="button"
                  onClick={handleTrainLightToggle}
                  onPointerDown={unlockAudioContext}
                  className={`gt-wbtn ${trainLightEnabled ? 'on-sari' : ''}`}
                  aria-pressed={trainLightEnabled}
                  aria-label={trainLightEnabled ? 'Işığı kapat' : 'Işığı aç'}
                >
                  <span className="pic" aria-hidden="true"><img src={kumandaIsik} alt="" draggable={false} /></span>
                  Işık
                </button>
                <button
                  type="button"
                  onClick={handleMovementSoundToggle}
                  onPointerDown={unlockAudioContext}
                  className={`gt-wbtn ${movementSoundEnabled ? 'on-mor' : ''}`}
                  aria-pressed={movementSoundEnabled}
                  aria-label={movementSoundEnabled ? 'Motor sesini kapat' : 'Motor sesini aç'}
                >
                  <span className="pic" aria-hidden="true"><img src={kumandaMotor} alt="" draggable={false} /></span>
                  Motor
                </button>
              </div>

              <div className="gt-seg gt-speed" role="group" aria-label="Hız">
                <button type="button" className={trainSpeed === 'slow' ? 'on' : ''} aria-pressed={trainSpeed === 'slow'} onClick={() => setTrainSpeed('slow')}><img src={kumandaYavas} alt="" draggable={false} />Yavaş</button>
                <button type="button" className={trainSpeed === 'normal' ? 'on' : ''} aria-pressed={trainSpeed === 'normal'} onClick={() => setTrainSpeed('normal')}><img src={kumandaNormal} alt="" draggable={false} />Normal</button>
                <button type="button" className={trainSpeed === 'fast' ? 'on' : ''} aria-pressed={trainSpeed === 'fast'} onClick={() => setTrainSpeed('fast')}><img src={kumandaHizli} alt="" draggable={false} />Hızlı</button>
              </div>

              <div className="gt-wtools gt-wide-only">
                <button type="button" className="gt-ghost" onClick={toggleFullScreen} aria-pressed={isFullScreen}>
                  {isFullScreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
                  {isFullScreen ? 'Küçült' : 'Tam ekran'}
                </button>
                {onToggleSound && (
                  <button type="button" className="gt-ghost" onPointerDown={unlockAudioContext} onClick={onToggleSound} aria-pressed={soundEnabled}>
                    {soundEnabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                    {soundEnabled ? 'Ses açık' : 'Ses kapalı'}
                  </button>
                )}
              </div>
            </section>

            {showMissions && <div className="gt-wmis-backdrop" onClick={() => setShowMissions(false)} aria-hidden="true" />}
            <section id="world-missions" className={`gt-wpanel gt-wmissions ${showMissions ? 'open' : ''}`} aria-labelledby="cockpit-missions-title">
              <div className="gt-wrow">
                <span id="cockpit-missions-title" className="gt-label">KAPTAN GÖREVLERİ</span>
                <span className="gt-wstars">⭐ {cockpitProgress.score} / 25</span>
              </div>
              <div className="gt-wbar" role="progressbar" aria-label="Kaptan yıldızları" aria-valuemin={0} aria-valuemax={25} aria-valuenow={cockpitProgress.score}>
                <i style={{ width: `${Math.min(100, (cockpitProgress.score / 25) * 100)}%` }} />
              </div>
              <div className="gt-wmis">
                {COCKPIT_MISSIONS.map((mission) => {
                  const completed = cockpitProgress.completed.includes(mission.id);
                  return (
                    <span key={mission.id} className={completed ? 'ok' : ''}>
                      <span aria-hidden="true">{completed ? '✓' : mission.icon}</span>
                      {mission.title}
                    </span>
                  );
                })}
              </div>
              <button type="button" className="gt-ghost" onClick={() => { setShowMissions(false); setShowCockpitOverlay(false); }}>Tamam</button>
            </section>

          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 2: CUSTOM MAP BUILDER GRID                                        */}
      {/* ===================================================================== */}
      {viewMode === 'builder' && (
        <div className="gt-wbuild">
          <p className="gt-result info" role="status" aria-live="polite">
            {movingItem
              ? `${movingItem.name} seçildi 👆 Taşımak istediğin boş yere dokun. (Vazgeçmek için yine ona dokun.)`
              : selectedInventoryItem
              ? `${selectedInventoryItem.name} seçili. Haritada bir yere dokun.`
              : lastMoved
              ? `${lastMoved} taşındı! ✨ Başka bir şeyi taşımak için ona dokun.`
              : 'Haritadaki bir yapıya dokun, sonra boş bir yere dokun: taşınır. Yeni parça için aşağıdan seç.'}
          </p>
          <div className="gt-wtools four" aria-label="Harita kolaylıkları">
            <button
              type="button"
              className={`gt-ghost ${isBuildMode ? 'on' : ''}`}
              aria-pressed={isBuildMode}
              onClick={() => {
                setIsBuildMode(!isBuildMode);
                if (isBuildMode) setSelectedInventoryItem(null);
              }}
            >
              {isBuildMode ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {isBuildMode ? 'Bitti' : 'Yerleştir'}
            </button>
            <button type="button" className="gt-ghost" onClick={handleAutoPlaceSelected}>
              <WandSparkles aria-hidden="true" />
              Otomatik
            </button>
            <button type="button" className="gt-ghost" onClick={handleRotateSelection}>
              <RotateCw aria-hidden="true" />
              Döndür
            </button>
            <button type="button" className="gt-ghost" onClick={handleUndoPlacement} disabled={placementHistory.length === 0}>
              <Undo2 aria-hidden="true" />
              Geri al
            </button>
          </div>

          {/* Living Graphic Builder Map */}
          <div className="gt-wmap relative rounded-[2rem] border-4 border-sky-800 shadow-2xl overflow-hidden bg-sky-200 min-h-[420px] aspect-[16/9] select-none">
            {/* Kasaba burada da görünür kutudan daha geniş; taşan kısım yana
                kaydırılarak keşfedilir. Köşedeki sabit etiketler bu kaydırılabilir
                katmanın DIŞINDA kalır ki ekranda sabit dursunlar. */}
            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden rounded-[2rem]">
              {/* En az ~54px'lik kareler: küçük telefonda da parmakla rahat dokunulur (harita yana kayar). */}
              <div className="relative h-full" style={{ width: `${WORLD_WIDE_PERCENT}%`, minWidth: GRID_COLS * 54 }}>
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
                style={{ left: `${stationLeftPercent}%`, transform: 'translateX(-50%)' }}
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
                        movingItem && placed?.id === movingItem.id
                          ? 'border-amber-300 bg-amber-300/35 ring-4 ring-amber-400 animate-pulse'
                          : movingItem && !placed
                          ? 'border-white/60 border-dashed bg-white/15 hover:bg-amber-200/20'
                          : previewCell?.x === c && previewCell?.y === r && selectedInventoryItem
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
                            className="absolute -right-1 -top-1 z-30 rounded-full bg-slate-700 p-1 text-white shadow-lg ring-2 ring-white/80"
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

      {(viewMode === 'builder' || viewMode === 'garage') && (
      <section className="gt-wpanel gt-winv" aria-labelledby="world-inventory-title">
        <div className="gt-wrow">
          <span id="world-inventory-title" className="gt-label">SATIN ALDIKLARIM</span>
          <span className="gt-wstars">{unlockedItems.length} parça</span>
        </div>

        {unlockedItems.length === 0 ? (
          <p className="gt-result info">Henüz parça yok. Görevlerden puan topla, Mağaza’dan tren ve vagon al! 🛒</p>
        ) : (
          <div className="gt-wgrid">
            {unlockedItems.map((item) => {
              const isPlaced = worldItems.some((w) => w.itemId === item.id);
              const isTrainActive = item.type === 'train' && user.activeTrainIcon === item.icon;
              const isWagon = item.type === 'wagon' || item.category === 'wagons';
              const isWagonAttached = isWagon && attachedWagons.includes(item.wagonType || 'passenger');
              const selected = selectedInventoryItem?.id === item.id;
              const active = viewMode === 'builder' ? selected : isTrainActive || isWagonAttached || (!isWagon && item.type !== 'train' && isPlaced);
              const actionLabel = viewMode === 'builder'
                ? selected ? 'Haritaya dokun' : isPlaced ? 'Taşı' : 'Haritaya koy'
                : item.type === 'train'
                ? isTrainActive ? 'Sürüyorsun' : 'Bunu sür'
                : isWagon
                ? isWagonAttached ? 'Bağlı' : 'Trene bağla'
                : isPlaced ? 'Dünyanda' : 'Ekle';

              return (
                <div
                  key={item.id}
                  data-testid={`inventory-item-${item.id}`}
                  draggable={viewMode === 'builder'}
                  onDragStart={(event) => handleInventoryDragStart(event, item)}
                  onDragEnd={() => setDraggedInventoryItem(null)}
                  className={`gt-witem ${selected ? 'sel' : ''}`}
                >
                  <span className="pic" aria-hidden="true">
                    {SCENERY_IMAGES[item.id] ? <img src={SCENERY_IMAGES[item.id]} alt="" draggable={false} /> : item.icon}
                  </span>
                  <span className="t">
                    <b>{item.name}</b>
                    <small>{itemKindLabel(item)}</small>
                  </span>
                  <button
                    type="button"
                    className={`gt-wuse ${active ? 'on' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      viewMode === 'builder' ? selectInventoryForMap(item) : handleUseInventoryItem(item);
                    }}
                  >
                    {active && <Check aria-hidden="true" />}
                    {actionLabel}
                  </button>
                </div>
              );
            })}
          </div>
        )}

      {viewMode === 'garage' && (
      <section className="gt-wpanel" aria-label="Vagonlar ve manzara">
        <span className="gt-label">VAGONLAR</span>
        <div className="gt-cats">
          {([
            ['passenger', '🚃', 'Yolcu'],
            ['cargo_coins', '🪙', 'Altın'],
            ['cargo_fruits', '🍎', 'Meyve'],
            ['cargo_toys', '🧸', 'Oyuncak'],
          ] as const).map(([type, icon, label]) => (
            <button key={type} type="button" className={`gt-cat ${attachedWagons.includes(type) ? 'on' : ''}`} aria-pressed={attachedWagons.includes(type)} onClick={() => toggleWagon(type)}>
              <span aria-hidden="true">{icon}</span>{label}
            </button>
          ))}
        </div>
        <span className="gt-label">MANZARA</span>
        <div className="gt-cats">
          {([
            ['farm', '🌾', 'Çiftlik'],
            ['sunset', '🌅', 'Gün batımı'],
            ['night', '🌙', 'Gece'],
          ] as const).map(([theme, icon, label]) => (
            <button key={theme} type="button" className={`gt-cat ${envTheme === theme ? 'on' : ''}`} aria-pressed={envTheme === theme} onClick={() => setEnvTheme(theme)}>
              <span aria-hidden="true">{icon}</span>{label}
            </button>
          ))}
        </div>
        <button type="button" className="gt-big turkuaz" onClick={() => openSection('ride')}>
          <span aria-hidden="true">🚂</span>Treni sür
        </button>
      </section>
      )}
      </section>
      )}
    </div>
  );
};
