import React, { useState, useEffect, useRef } from 'react';
import { PlacedWorldItem, ShopItem, UserProfile } from '../types';
import { playTrainWhistle, playPopSound, speakText } from '../utils/audio';
import { Plus, Trash2, Play, Pause, Sparkles, Volume2, FastForward, RotateCcw, MapPin, Eye, Compass, Layers, Move, MousePointer2 } from 'lucide-react';

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
}

type ViewMode = 'ride' | 'builder';
type EnvironmentTheme = 'farm' | 'mountains' | 'sunset' | 'night';

// Harita Çizimi'ndeki 8x7'lik yerleşim ızgarasıyla aynı boyut; ana sahnedeki
// dekor pozisyonu artık bu ızgar üzerinden (item.x / item.y) hesaplanıyor —
// böylece çocuğun yerleştirdiği kare ile ana dünyada göründüğü yer birebir eşleşir.
const GRID_COLS = 14; // Kasaba artık yana kaydırmalı: alan kazanmak için sütun sayısı 8'den 14'e çıkarıldı.
const GRID_ROWS = 6; // Üstteki hep boş kalan gökyüzü satırı kaldırıldı, kalan satırlara daha çok dikey alan kaldı.
// Hem Harita Çizimi hem Dünya sahnesi, görünür kutunun bu kadar genişinde bir
// iç içerik barındırır; taşan kısım yana kaydırılarak görülür.
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
  // Öğe artık bu noktaya MERKEZLENEREK çizilir (bkz. -translate-x-1/2/-translate-y-1/2),
  // bu yüzden kenar sütun/satırlarda görsel taşmaması için pay büyütüldü. Satırlar
  // arası boşluk, 7 satırın küçültülmüş görsellerle bile üst üste binmemesi için
  // olabildiğince açıldı.
  const left = 8 + (x / Math.max(GRID_COLS - 1, 1)) * 84; // %8 .. %92
  const top = 8 + (y / Math.max(GRID_ROWS - 1, 1)) * 76; // %8 .. %84
  return { left: `${left}%`, top: `${top}%` };
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
  const [attachedWagons, setAttachedWagons] = useState<string[]>(['passenger', 'passenger_green', 'cargo_coins']);

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
  const trainAssemblyRef = useRef<HTMLDivElement | null>(null);
  // Katarın gerçek genişliğini kanvasa oranla ölçüyoruz; döngü sınırlarını
  // tahmine dayalı sabit yüzdeler yerine bu ölçüme göre kuruyoruz ki katar
  // ekrandan TAMAMEN çıkmadan diğer taraftan "sıçramasın".
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
  const [interactiveMessage, setInteractiveMessage] = useState<string>('Panda Kaptan Rayların Üzerinde Düz Hatta İlerliyor! 🚂💨');

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

  // Ray parçası satın almanın dünyada görünür bir karşılığı olsun diye, sahip
  // olunan düz/viraj parçaları kasabanın arka kısmında ikinci (yedek) bir
  // tren hattı olarak çiziliyor — bu olmadan ray satın almak görünmez kalıyordu.
  const secondRailPieceCount = worldItems.filter(
    (item) => item.itemId === 'track-straight' || item.itemId === 'track-curve',
  ).length;
  const secondRailWidthPercent = Math.min(78, Math.max(0, secondRailPieceCount * 6));

  // Yedek Hat'ın gerçek uçları (world-yüzdesi koordinat sisteminde, ana rayla
  // AYNI sistemde). Tren artık bu tam noktalar arasında ilerliyor, rayın
  // dışına taşmıyor; ön hattın yüksekliği (frontRailTopPercent) ile virajlarla
  // görsel olarak birleşiyor.
  const secondRailStartLeft = 13;
  const secondRailEndLeft = secondRailStartLeft + secondRailWidthPercent;
  // top değerleri, hattın binaların ÖNÜNDEN değil arkasından (yeşil
  // tepelerin içinden) geçmesi için düşürüldü — önceki 34/46 değeri okulun
  // çatısı ve ayçiçeğiyle çakışıp kasabanın ortasından geçiyormuş gibi
  // görünüyordu.
  const secondRailStartTop = 14;
  const secondRailEndTop = 22;
  const frontRailTopPercent = 85;
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
  const [trainPositionIndex, setTrainPositionIndex] = useState(0);

  // Continuous loop for Straight Line Railway Track Motion
  useEffect(() => {
    if (!isTrainRunning || viewMode !== 'ride') return;

    if (!trainImagesReady) return;

    const speedStep = trainSpeed === 'fast' ? 0.65 : trainSpeed === 'slow' ? 0.25 : 0.45;
    const maxBound = 100 + 5;
    const minBound = -(assemblyWidthPercent + 5);
    // NOT: setState updater'ları React StrictMode'da (geliştirmede) birden
    // fazla kez çağrılabilir; bu yüzden burada SADECE saf pozisyon hesabı
    // yapılıyor, yön değişimi gibi yan etkiler ayrı bir effect'te (aşağıda)
    // ref korumasıyla TEK SEFER tetikleniyor.
    const interval = setInterval(() => {
      setTrainXPos((prev) => {
        if (trainDirection === 'right') {
          return prev >= maxBound ? maxBound : prev + speedStep;
        }
        return prev <= minBound ? minBound : prev - speedStep;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isTrainRunning, trainSpeed, trainDirection, viewMode, assemblyWidthPercent, trainImagesReady]);

  // Tren ana rayın ucuna varınca yönünü tersine çevirir (sağdan sola, sonra
  // soldan sağa) — Yedek Hat sadece görsel/dekoratif kalır, tren ona hiç
  // uğramaz. Bir ref ile korunuyor ki StrictMode'un çift-çağrısı yönü iki kez
  // değiştirip birbirini götürmesin.
  const boundHandledRef = useRef(false);
  useEffect(() => {
    if (viewMode !== 'ride') return;
    const maxBound = 100 + 5;
    const minBound = -(assemblyWidthPercent + 5);
    const isAtBound =
      (trainDirection === 'right' && trainXPos >= maxBound) ||
      (trainDirection === 'left' && trainXPos <= minBound);

    if (isAtBound && !boundHandledRef.current) {
      boundHandledRef.current = true;
      setTrainDirection((dir) => (dir === 'right' ? 'left' : 'right'));
    }

    if (!isAtBound) {
      boundHandledRef.current = false;
    }
  }, [trainXPos, trainDirection, assemblyWidthPercent, viewMode]);

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
    handleTileClick(x, y);
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

            {/* Kasabanın arka kısmında ikinci (yedek) tren hattı — sahip olunan
                düz/viraj ray parçalarının dünyada görünür karşılığı. Ana hatla
                AYNI yüzde-koordinat sisteminde, tam iki nokta arasında çiziliyor
                ki tren hiçbir zaman rayın dışına taşmasın; uçlarda ana hatla
                birleşen görünür virajlar da var. */}
            {secondRailPieceCount > 0 && (
              <svg
                className="absolute inset-0 w-full h-full z-[6] pointer-events-none opacity-80"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                title={`Yedek Hat: ${secondRailPieceCount} ray parçası`}
              >
                {/* Sol viraj: Yedek Hat'ın başlangıcını ana hattın yüksekliğine bağlar */}
                <path
                  d={`M ${secondRailStartLeft - 7} ${frontRailTopPercent} Q ${secondRailStartLeft - 7} ${secondRailStartTop}, ${secondRailStartLeft} ${secondRailStartTop}`}
                  fill="none"
                  stroke="#451a03"
                  strokeWidth="1.4"
                  strokeDasharray="1.2 1.4"
                />
                <path
                  d={`M ${secondRailStartLeft - 7} ${frontRailTopPercent} Q ${secondRailStartLeft - 7} ${secondRailStartTop}, ${secondRailStartLeft} ${secondRailStartTop}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="0.4"
                />

                {/* Sağ viraj: Yedek Hat'ın bitişini ana hattın yüksekliğine bağlar */}
                <path
                  d={`M ${secondRailEndLeft} ${secondRailEndTop} Q ${secondRailEndLeft + 7} ${secondRailEndTop}, ${secondRailEndLeft + 7} ${frontRailTopPercent}`}
                  fill="none"
                  stroke="#451a03"
                  strokeWidth="1.4"
                  strokeDasharray="1.2 1.4"
                />
                <path
                  d={`M ${secondRailEndLeft} ${secondRailEndTop} Q ${secondRailEndLeft + 7} ${secondRailEndTop}, ${secondRailEndLeft + 7} ${frontRailTopPercent}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="0.4"
                />

                {/* Yedek Hat'ın kendisi: iki nokta arasında düz çizgi (traversler + raylar) */}
                <line
                  x1={secondRailStartLeft} y1={secondRailStartTop}
                  x2={secondRailEndLeft} y2={secondRailEndTop}
                  stroke="#451a03" strokeWidth="1.4" strokeDasharray="1.2 1.4"
                />
                <line
                  x1={secondRailStartLeft} y1={secondRailStartTop - 0.55}
                  x2={secondRailEndLeft} y2={secondRailEndTop - 0.55}
                  stroke="#e2e8f0" strokeWidth="0.4"
                />
                <line
                  x1={secondRailStartLeft} y1={secondRailStartTop + 0.55}
                  x2={secondRailEndLeft} y2={secondRailEndTop + 0.55}
                  stroke="#e2e8f0" strokeWidth="0.4"
                />
              </svg>
            )}
            {secondRailPieceCount > 0 && (
              <span
                className="absolute z-[6] rounded-full bg-amber-950/80 text-amber-100 text-[7px] sm:text-[9px] font-black px-1.5 py-0.5 shadow whitespace-nowrap pointer-events-none"
                style={{ left: `${secondRailStartLeft}%`, top: `${secondRailStartTop - 4}%` }}
              >
                Yedek Hat 🛤️ {secondRailPieceCount} parça
              </span>
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
                style={{ left: `${puff.x}%` }}
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
                  className="group/item absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-xl px-1 py-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  style={{ left: anchor.left, top: anchor.top, zIndex: 20 + item.y }}
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

            {/* 6. DYNAMIC HORIZONTAL TRAIN ASSEMBLY MOVING ON THE STRAIGHT TRACK */}
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
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'copy';
                      }}
                      onDrop={(event) => handleMapCellDrop(event, c, r)}
                      className={`relative rounded-2xl border transition-all focus:outline-none focus:ring-4 focus:ring-amber-300/70 ${
                        isSelectedTarget || isBuildMode
                          ? 'border-white/45 bg-white/10 hover:border-amber-200 hover:bg-amber-200/20'
                          : 'border-transparent bg-transparent hover:bg-white/10'
                      }`}
                      aria-label={`${c + 1}. sütun ${r + 1}. satır`}
	                    >
	                      {placed && (
	                        <span className="absolute inset-0 flex items-center justify-center">
	                          <span className={`absolute h-[72%] w-[72%] rounded-2xl blur-md ${accent?.glow}`} />
	                          <span className={`relative flex h-[78%] w-[78%] items-center justify-center rounded-2xl border-2 shadow-[0_10px_16px_rgba(15,23,42,0.42)] ring-2 ${accent?.ring}`}>
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
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveItem(placed.id);
                            playPopSound(soundEnabled);
                          }}
                          className="absolute -right-1 -top-1 z-30 rounded-full bg-rose-600 p-1 text-white shadow-lg ring-2 ring-white/80"
                          role="button"
                          aria-label={`${placed.name} kaldır`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
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
