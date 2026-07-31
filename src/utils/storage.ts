import { RoutineTask, ShopItem, PlacedWorldItem, UserProfile, ParentConfig, BonusCard, VoiceMessage, StoryVideo } from '../types';
import taskBrushTeethImg from '../assets/images/ruzgar-disfircalama.jpg';
import taskTidyToysImg from '../assets/images/ruzgar-oyuncak.jpg';
import taskEatMealImg from '../assets/images/ruzgar-yemek.jpg';
import taskWashHandsImg from '../assets/images/ruzgar-elyikama.jpg';
import taskDeskStudyImg from '../assets/images/ruzgar-gunluk.jpg';
import taskSleepBedImg from '../assets/images/ruzgar-uyku.jpg';
import taskToiletFlushImg from '../assets/images/ruzgar-tuvalet.jpg';

const STORAGE_KEYS = {
  TASKS: 'ruzgar_tasks_v4',
  SHOP: 'ruzgar_shop_v2',
  WORLD: 'ruzgar_world_v2',
  USER: 'ruzgar_user_v2',
  PARENT: 'ruzgar_parent_v2',
  BONUSES: 'ruzgar_bonuses_v4',
  VOICE_MESSAGES: 'ruzgar_voice_messages_v1',
  VIDEOS: 'ruzgar_videos_v1',
};

const FIRST_DAY_RESET_VERSION = 'ruzgar_first_day_reset_v1';
export const START_LEVEL_VERSION = 'start-with-6-coins-v1';

export const INITIAL_USER: UserProfile = {
  name: 'Rüzgar',
  title: 'Makinist Başı 🚂',
  coins: 6,
  totalCompletedTasks: 0,
  currentStreak: 0,
  soundEnabled: true,
  speechEnabled: true,
  activeTrainIcon: '🚂',
  progressVersion: START_LEVEL_VERSION,
};

export const INITIAL_PARENT: ParentConfig = {
  parentName: 'Baba / Anne',
  // Her yeni cihazda da oyun giriş koduyla aynı ebeveyn PIN'i kullanılır.
  pinHash: hashParentPin('1234'),
};

export const INITIAL_TASKS: RoutineTask[] = [
  // SABAH PROGRAMI
  {
    id: 'task-1',
    title: 'Sabah Dişlerimi Fırçaladım',
    description: 'Sabah uyanınca en az 2 dakika diş fırçalama',
    icon: '🪥',
    imageUrl: taskBrushTeethImg,
    rewardCoins: 2,
    timeOfDay: 'morning',
    status: 'todo',
  },
  {
    id: 'task-2',
    title: 'Yatağımı Topladım',
    description: 'Sabah uyanıp yatağımı düzenledim',
    icon: '🛏️',
    imageUrl: taskSleepBedImg,
    rewardCoins: 2,
    timeOfDay: 'morning',
    status: 'todo',
  },

  // ÖĞLE PROGRAMI
  {
    id: 'task-3',
    title: 'Oyuncaklarımı Topladım',
    description: 'Oyun alanındaki kutuları yerleştirdim',
    icon: '🧸',
    imageUrl: taskTidyToysImg,
    rewardCoins: 3,
    timeOfDay: 'afternoon',
    status: 'todo',
  },
  {
    id: 'task-4',
    title: 'Yemeğimi Bitirdim',
    description: 'Tabaktaki sebze ve yemekleri güzelce yedim',
    icon: '🥦',
    imageUrl: taskEatMealImg,
    rewardCoins: 3,
    timeOfDay: 'afternoon',
    status: 'todo',
  },
  {
    id: 'task-5',
    title: 'Ellerimi Sabunla Yıkadım',
    description: 'Yemekten önce ve dışarıdan gelince 20 saniye köpürttüm',
    icon: '🧼',
    imageUrl: taskWashHandsImg,
    rewardCoins: 2,
    timeOfDay: 'afternoon',
    status: 'todo',
  },

  // AKŞAM PROGRAMI
  {
    id: 'task-6',
    title: 'Gece Dişlerimi Fırçaladım',
    description: 'Yatmadan önce en az 2 dakika diş fırçalama',
    icon: '🪥',
    imageUrl: taskBrushTeethImg,
    rewardCoins: 2,
    timeOfDay: 'evening',
    status: 'todo',
  },
  {
    id: 'task-7',
    title: 'Tuvalet & Sifonu Çektim',
    description: 'Tuvaletimi yapıp sifonu güzelce çektim',
    icon: '🚽',
    imageUrl: taskToiletFlushImg,
    rewardCoins: 2,
    timeOfDay: 'evening',
    status: 'todo',
  },
  {
    id: 'task-8',
    title: 'Günlük Kaydı & Kitap',
    description: 'Günün özetini doldurdum ve masalımı okudum',
    icon: '📚',
    imageUrl: taskDeskStudyImg,
    rewardCoins: 2,
    timeOfDay: 'evening',
    status: 'todo',
  },
  {
    id: 'task-9',
    title: 'Uyku Hazırlığı & Yatak',
    description: 'Pijamalarımı giyip zamanında yatağa girdim',
    icon: '🌙',
    imageUrl: taskSleepBedImg,
    rewardCoins: 4,
    timeOfDay: 'evening',
    status: 'todo',
  },
];

export const INITIAL_SHOP: ShopItem[] = [
  // Tracks (1-2 Coins)
  { id: 'track-straight', name: 'Düz Ray Parçası', category: 'tracks', price: 1, icon: '🛤️', description: 'Tren yolunu uzatmak için düz ray (1 Görev)', unlocked: true, type: 'track', trackType: 'straight' },
  { id: 'track-curve', name: 'Viraj Ray Parçası', category: 'tracks', price: 1, icon: '↩️', description: 'Trenin dönmesini sağlayan kavisli ray (1 Görev)', unlocked: true, type: 'track', trackType: 'curve' },
  { id: 'track-bridge', name: 'Kırmızı Tren Köprüsü', category: 'tracks', price: 4, icon: '🌉', description: 'Nehrin üstünden geçen yüksek kırmızı köprü', unlocked: false, type: 'track', trackType: 'bridge' },
  { id: 'track-station', name: 'Merkez Tren Garı', category: 'tracks', price: 6, icon: '🚉', description: 'Yolcuların bindiği büyük gar istasyonu', unlocked: false, type: 'track', trackType: 'station' },
  { id: 'track-tunnel', name: 'Dağ Tüneli', category: 'tracks', price: 5, icon: '🕳️', description: 'Trenin içinden geçtiği gizemli tünel', unlocked: false, type: 'track', trackType: 'tunnel' },

  // Trains (Ranging from 0 to 12 coins)
  { id: 'train-steam', name: 'Kırmızı Buharlı Tren', category: 'trains', price: 0, icon: '🚂', description: 'Puf puf duman çıkaran klasik kırmızı lokomotif', unlocked: true, type: 'train' },
  { id: 'train-blue', name: 'Mavi Süper Hızlı Tren', category: 'trains', price: 6, icon: '🏎️', description: 'Raylarda şimşek gibi süzülen mavi ekspres (~2-3 görev)', unlocked: false, type: 'train' },
  { id: 'train-gold', name: 'Altın Gar Ekspresi', category: 'trains', price: 10, icon: '🌟', description: 'Parlayan altın kaplama özel çocuk treni (~1 günlük görevler)', unlocked: false, type: 'train' },
  { id: 'train-rainbow', name: 'Gökkuşağı Treni', category: 'trains', price: 14, icon: '🌈', description: 'Rengarenk ışık saçan neşeli lokomotif', unlocked: false, type: 'train' },

  // Wagons (1 to 5 Coins)
  { id: 'wagon-passenger', name: 'Yolcu Vagonu', category: 'wagons', price: 0, icon: '🚃', description: 'Sevimli dostların seyahat ettiği yolcu vagonu', unlocked: true, type: 'wagon', wagonType: 'passenger' },
  { id: 'wagon-coins', name: 'Altın & Hazine Vagonu', category: 'wagons', price: 2, icon: '🪙', description: 'İçinde parlayan altınlar olan hazine vagonu', unlocked: true, type: 'wagon', wagonType: 'cargo_coins' },
  { id: 'wagon-fruits', name: 'Meyve Vagonu', category: 'wagons', price: 2, icon: '🍎', description: 'Taze elma ve muz taşıyan neşeli vagon', unlocked: true, type: 'wagon', wagonType: 'cargo_fruits' },
  { id: 'wagon-toys', name: 'Oyuncak Vagonu', category: 'wagons', price: 3, icon: '🧸', description: 'Sevimli ayıcıklar ve hediyelerle dolu vagon', unlocked: false, type: 'wagon', wagonType: 'cargo_toys' },
  { id: 'wagon-animals', name: 'Hayvan Dostlar Vagonu', category: 'wagons', price: 3, icon: '🦁', description: 'Aslan, zürafa ve sevimli hayvanlar vagonu', unlocked: false, type: 'wagon', wagonType: 'cargo_animals' },
  { id: 'wagon-candy', name: 'Şeker & Dondurma Vagonu', category: 'wagons', price: 4, icon: '🍦', description: 'Renkli dondurmalar ve tatlı şekerler vagonu', unlocked: false, type: 'wagon', wagonType: 'cargo_candy' },
  { id: 'wagon-space', name: 'Uzay & Roket Vagonu', category: 'wagons', price: 5, icon: '🚀', description: 'Uzay roketleri ve yıldızlar taşıyan vagon', unlocked: false, type: 'wagon', wagonType: 'cargo_space' },

  // Scenery & Decorations (1 to 6 coins)
  { id: 'scenery-tree', name: 'Yeşil Çam Ağacı', category: 'scenery', price: 1, icon: '🌳', description: 'Rayların yanına dikilen sevimli doğa ağacı', unlocked: true, type: 'decoration' },
  { id: 'scenery-flower', name: 'Neşeli Ayçiçeği', category: 'scenery', price: 1, icon: '🌻', description: 'Güneşe bakan renkli büyük çiçek', unlocked: true, type: 'decoration' },
  { id: 'scenery-cow', name: 'Çiftlik İneği', category: 'scenery', price: 2, icon: '🐄', description: 'Möö diyen sevimli çiftlik arkadaşı', unlocked: false, type: 'decoration' },
  { id: 'scenery-house', name: 'Kırmızı Çatı Evi', category: 'scenery', price: 3, icon: '🏠', description: 'İstasyon kasabasının tatlı evi', unlocked: true, type: 'decoration' },
  { id: 'scenery-ferris', name: 'Lunapark Dönme Dolabı', category: 'scenery', price: 6, icon: '🎡', description: 'Işıl ışıl dönen dev dönme dolap', unlocked: false, type: 'decoration' },

  // Real World Rewards (Scaled to 1-Day, 2-Day, and 3-Day efforts)
  { id: 'reward-icecream', name: 'Dondurma Keyfi', category: 'rewards', price: 8, icon: '🍦', description: 'En sevdiğin 2 top dondurma ödülü! ⭐ (1 Günlük Başarı)', unlocked: false, type: 'real_reward' },
  { id: 'reward-cartoon', name: '30 Dk Ekstra Çizgi Film', category: 'rewards', price: 10, icon: '🎬', description: 'İstediğin çizgi filmi 30 dakika izleme hakkı ⭐ (1 Günlük Başarı)', unlocked: false, type: 'real_reward' },
  { id: 'reward-park', name: 'Parkta Ekstra Oyun', category: 'rewards', price: 12, icon: '🛝', description: 'Çocuk parkında doyasıya kaydırak ve salıncak keyfi ⭐ (1 Günlük Başarı)', unlocked: false, type: 'real_reward' },
  { id: 'reward-toy', name: 'Sürpriz Küçük Oyuncak', category: 'rewards', price: 22, icon: '🎁', description: 'Marketten seveceğin harika bir sürpriz oyuncak! 🌟🌟 (2 Günlük Tam Başarı)', unlocked: false, type: 'real_reward' },
  { id: 'reward-pizza', name: 'Pizza & Sinema Gecesi', category: 'rewards', price: 32, icon: '🍕', description: 'Ailenle birlikte pizza yeme ve sinema gecesi! 🏆 (3 Günlük Dev Başarı)', unlocked: false, type: 'real_reward' },
];

export const INITIAL_WORLD: PlacedWorldItem[] = [
  // Tracks forming a nice mini world loop
  { id: 'w-1', itemId: 'track-straight', x: 2, y: 3, icon: '🛤️', name: 'Düz Ray' },
  { id: 'w-2', itemId: 'track-straight', x: 3, y: 3, icon: '🛤️', name: 'Düz Ray' },
  { id: 'w-3', itemId: 'track-straight', x: 4, y: 3, icon: '🛤️', name: 'Düz Ray' },
  { id: 'w-4', itemId: 'track-straight', x: 5, y: 3, icon: '🛤️', name: 'Düz Ray' },
  { id: 'w-5', itemId: 'track-curve', x: 6, y: 3, icon: '↩️', name: 'Viraj Ray' },
  { id: 'w-6', itemId: 'track-straight', x: 6, y: 4, icon: '🛤️', name: 'Düz Ray' },
  { id: 'w-7', itemId: 'track-straight', x: 6, y: 5, icon: '🛤️', name: 'Düz Ray' },
  { id: 'w-8', itemId: 'track-curve', x: 6, y: 6, icon: '↩️', name: 'Viraj Ray' },
  { id: 'w-9', itemId: 'track-straight', x: 5, y: 6, icon: '🛤️', name: 'Düz Ray' },
  { id: 'w-10', itemId: 'track-straight', x: 4, y: 6, icon: '🛤️', name: 'Düz Ray' },
  { id: 'w-11', itemId: 'track-straight', x: 3, y: 6, icon: '🛤️', name: 'Düz Ray' },
  { id: 'w-12', itemId: 'track-curve', x: 2, y: 6, icon: '↩️', name: 'Viraj Ray' },
  { id: 'w-13', itemId: 'track-straight', x: 2, y: 5, icon: '🛤️', name: 'Düz Ray' },
  { id: 'w-14', itemId: 'track-curve', x: 2, y: 4, icon: '↩️', name: 'Viraj Ray' },

  // Scenery inside and around the track
  { id: 'w-15', itemId: 'scenery-tree', x: 3, y: 4, icon: '🌳', name: 'Çam Ağacı' },
  { id: 'w-16', itemId: 'scenery-house', x: 4, y: 4, icon: '🏠', name: 'Kırmızı Ev' },
  { id: 'w-17', itemId: 'scenery-flower', x: 5, y: 4, icon: '🌻', name: 'Güneş Çiçeği' },
  { id: 'w-18', itemId: 'scenery-tree', x: 7, y: 2, icon: '🌳', name: 'Çam Ağacı' },
  { id: 'w-19', itemId: 'scenery-tree', x: 1, y: 2, icon: '🌳', name: 'Çam Ağacı' },
];

export const INITIAL_BONUSES: BonusCard[] = [];

// Önceki deneme sürümünde iki örnek mesaj gösteriliyordu. Bunlar gerçek aile
// mesajı olmadığı için yeni cihazlarda görünmez; eski kayıtlardan da bir kez
// ayıklanır. Gerçek ses kayıtlarının hiçbirine dokunulmaz.
export const INITIAL_VOICE_MESSAGES: VoiceMessage[] = [];
const DEMO_VOICE_MESSAGE_IDS = new Set(['vm-1', 'vm-2']);

// Helper functions for LocalStorage
export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error loading key ${key}`, e);
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving key ${key}`, e);
  }
}

/** Web Crypto olmayan yerel ağ adreslerinde de çalışan, yalnızca yerel PIN özeti. */
export function hashParentPin(pin: string): string {
  let hash = 2166136261;
  for (let index = 0; index < pin.length; index += 1) {
    hash ^= pin.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v4-${(hash >>> 0).toString(36)}`;
}

export const getStoredTasks = (): RoutineTask[] => {
  const stored = loadFromStorage<RoutineTask[]>(STORAGE_KEYS.TASKS, INITIAL_TASKS);
  // Önceki V4 kayıtlarındaki görev durumu/puanı korunur; sadece bu sürümün
  // Rüzgar görselleri yerleşir.
  return stored.map((task) => {
    const template = INITIAL_TASKS.find((initial) => initial.id === task.id);
    return template?.imageUrl ? { ...task, imageUrl: template.imageUrl } : task;
  });
};
export const saveStoredTasks = (tasks: RoutineTask[]) => saveToStorage(STORAGE_KEYS.TASKS, tasks);

export const getStoredShop = (): ShopItem[] => {
  const stored = loadFromStorage<ShopItem[]>(STORAGE_KEYS.SHOP, INITIAL_SHOP);
  return INITIAL_SHOP.map((initial) => {
    const existing = stored.find((s) => s.id === initial.id);
    return existing
      ? { ...initial, unlocked: existing.unlocked || initial.unlocked }
      : initial;
  });
};
export const saveStoredShop = (shop: ShopItem[]) => saveToStorage(STORAGE_KEYS.SHOP, shop);

export const getStoredWorld = () => loadFromStorage<PlacedWorldItem[]>(STORAGE_KEYS.WORLD, INITIAL_WORLD);
export const saveStoredWorld = (world: PlacedWorldItem[]) => saveToStorage(STORAGE_KEYS.WORLD, world);

export const getStoredUser = (): UserProfile => {
  const stored = loadFromStorage<UserProfile>(STORAGE_KEYS.USER, INITIAL_USER);

  // V4'ün ilk gerçek başlangıcı: yalnızca görev ilerlemesi ve para sıfırlanır.
  // Mağaza, envanter, tren dünyası, PIN, mesajlar ve videolar korunur.
  if (typeof window !== 'undefined' && window.localStorage.getItem(FIRST_DAY_RESET_VERSION) !== 'done') {
    const firstDayUser = {
      ...INITIAL_USER,
      name: stored.name || INITIAL_USER.name,
      soundEnabled: stored.soundEnabled ?? INITIAL_USER.soundEnabled,
      speechEnabled: stored.speechEnabled ?? INITIAL_USER.speechEnabled,
      activeTrainIcon: stored.activeTrainIcon || INITIAL_USER.activeTrainIcon,
    };
    saveToStorage(STORAGE_KEYS.USER, firstDayUser);
    saveToStorage(STORAGE_KEYS.TASKS, INITIAL_TASKS.map((task) => ({ ...task })));
    window.localStorage.setItem(FIRST_DAY_RESET_VERSION, 'done');
    return firstDayUser;
  }

  // Yeni ortak başlangıç seviyesi: görevler açılır, 6 Tren Parası verilir.
  // Bu işaret profilin içinde taşındığı için ailede sadece bir kez uygulanır.
  if (stored.progressVersion !== START_LEVEL_VERSION) {
    const startLevelUser = {
      ...stored,
      coins: 6,
      totalCompletedTasks: 0,
      currentStreak: 0,
      progressVersion: START_LEVEL_VERSION,
    };
    saveToStorage(STORAGE_KEYS.USER, startLevelUser);
    saveToStorage(STORAGE_KEYS.TASKS, INITIAL_TASKS.map((task) => ({ ...task })));
    return startLevelUser;
  }

  return stored;
};
export const saveStoredUser = (user: UserProfile) => saveToStorage(STORAGE_KEYS.USER, user);

export const getStoredParent = (): ParentConfig => {
  const stored = loadFromStorage<ParentConfig & { pin?: string }>(STORAGE_KEYS.PARENT, INITIAL_PARENT);
  if (stored.pinHash) return { parentName: stored.parentName || INITIAL_PARENT.parentName, pinHash: stored.pinHash };
  // Önceki V4 denemelerindeki düz metin PIN'i veri silmeden tek PIN özetine taşınır.
  if (typeof stored.pin === 'string' && /^\d{4}$/.test(stored.pin)) {
    const migrated = { parentName: stored.parentName || INITIAL_PARENT.parentName, pinHash: hashParentPin(stored.pin) };
    saveToStorage(STORAGE_KEYS.PARENT, migrated);
    return migrated;
  }
  return { ...INITIAL_PARENT, parentName: stored.parentName || INITIAL_PARENT.parentName };
};
export const saveStoredParent = (parent: ParentConfig) => saveToStorage(STORAGE_KEYS.PARENT, parent);

export const getStoredBonuses = () => loadFromStorage<BonusCard[]>(STORAGE_KEYS.BONUSES, INITIAL_BONUSES);
export const saveStoredBonuses = (bonuses: BonusCard[]) => saveToStorage(STORAGE_KEYS.BONUSES, bonuses);

export const INITIAL_VIDEOS: StoryVideo[] = [
  {
    id: 'v1',
    title: 'NokNok Treni & Diş Fırçalama Şarkısı',
    duration: '3:45',
    thumbnailUrl: 'https://img.youtube.com/vi/3G1P2cMYeXw/hqdefault.jpg',
    youtubeId: '3G1P2cMYeXw',
    description: 'Neşeli tren ile sabah ve akşam diş fırçalama alışkanlığı şarkısı!',
    category: 'Diş Fırçalama',
  },
  {
    id: 'v2',
    title: 'Kırmızı Buharlı Lokomotifin Masalı',
    duration: '5:20',
    thumbnailUrl: 'https://img.youtube.com/vi/W3q8Od5qJio/hqdefault.jpg',
    youtubeId: 'W3q8Od5qJio',
    description: 'Bütün görevlerini bitirip istasyona ulaşan küçük trenin hikayesi.',
    category: 'Uyku Masalı',
  },
  {
    id: 'v3',
    title: 'Oyuncak Toplama Dansı Treni',
    duration: '4:10',
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ',
    description: 'Odadaki oyuncakları vagona doldurma oyunu ve şarkısı!',
    category: 'Düzen & Temizlik',
  },
  {
    id: 'v4',
    title: 'Renkler ve Sayılar Tren Yolculuğu',
    duration: '6:15',
    thumbnailUrl: 'https://img.youtube.com/vi/L_LUpnjgPso/hqdefault.jpg',
    youtubeId: 'L_LUpnjgPso',
    description: 'Vagonlardaki meyvelerle 1\'den 10\'a kadar sayma macerası!',
    category: 'Eğitici Oyun',
  },
];

export function extractYoutubeId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  if (trimmed.length === 11 && !trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }
  return trimmed;
}

export const getStoredVoiceMessages = () => {
  const messages = loadFromStorage<VoiceMessage[]>(STORAGE_KEYS.VOICE_MESSAGES, INITIAL_VOICE_MESSAGES);
  const cleaned = messages.filter((message) => !DEMO_VOICE_MESSAGE_IDS.has(message.id));
  if (cleaned.length !== messages.length) saveToStorage(STORAGE_KEYS.VOICE_MESSAGES, cleaned);
  return cleaned;
};
export const saveStoredVoiceMessages = (msgs: VoiceMessage[]) => saveToStorage(STORAGE_KEYS.VOICE_MESSAGES, msgs);

export const getStoredVideos = () => loadFromStorage<StoryVideo[]>(STORAGE_KEYS.VIDEOS, INITIAL_VIDEOS);
export const saveStoredVideos = (videos: StoryVideo[]) => saveToStorage(STORAGE_KEYS.VIDEOS, videos);
