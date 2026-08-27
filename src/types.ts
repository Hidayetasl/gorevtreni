export type TabType = 'tasks' | 'world' | 'shop' | 'videos' | 'learn';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export type TaskStatus = 'todo' | 'pending_approval' | 'completed';

export interface RoutineTask {
  id: string;
  title: string;
  description: string;
  icon: string;
  imageUrl?: string;
  rewardCoins: number;
  timeOfDay: TimeOfDay;
  status: TaskStatus;
  isExtra?: boolean;
  completedAt?: string;
  approvedAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export type ShopCategory = 'tracks' | 'trains' | 'wagons' | 'scenery' | 'rewards';

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  price: number;
  icon: string;
  description: string;
  unlocked: boolean;
  type: 'track' | 'train' | 'wagon' | 'decoration' | 'real_reward';
  trackType?: 'straight' | 'curve' | 'bridge' | 'station' | 'tunnel';
  wagonType?: 'passenger' | 'passenger_green' | 'cargo_coins' | 'cargo_fruits' | 'cargo_toys' | 'cargo_animals' | 'cargo_candy' | 'cargo_space';
  updatedAt?: string;
}

export interface PlacedWorldItem {
  id: string;
  itemId: string;
  x: number; // Grid column (0..9)
  y: number; // Grid row (0..7)
  icon: string;
  name: string;
  rotation?: number;
  updatedAt?: string;
  deletedAt?: string;
}

export type JournalMood = 'happy' | 'calm' | 'proud' | 'tired' | 'sad';

export interface VoiceMessage {
  id: string;
  sender: 'parent' | 'child' | 'panda';
  senderName: string;
  audioUrl?: string;
  transcript: string;
  durationSeconds: number;
  createdAt: string;
  isNew: boolean;
  kind?: 'message' | 'journal';
  title?: string;
  mood?: JournalMood;
}

export interface CoinLedgerEntry {
  id: string;
  type: 'initial' | 'task_reward' | 'bonus_reward' | 'purchase' | 'reset';
  coinDelta: number;
  referenceId?: string;
  balanceAfter?: number;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  title: string;
  coins: number;
  totalCompletedTasks: number;
  currentStreak: number;
  soundEnabled: boolean;
  speechEnabled: boolean;
  activeTrainIcon: string;
  /** Ebeveynin açtığı Heceleme oyunu seviyeleri (1=2 heceli, 2=3 heceli, 3=4 heceli). */
  syllableGameLevels?: number[];
  /** Ortak aile verisinde başlangıç seviyesinin bir kez uygulanmasını sağlar. */
  progressVersion?: string;
  /** Rutin görevlerin en son hangi yerel takvim gününde açıldığını tutar. */
  lastTaskResetDate?: string;
}

export interface ParentConfig {
  parentName: string;
  /** Yerel, tek ebeveyn PIN'inin geriye uyumlu özeti. */
  pinHash?: string;
}

export type AdultName = 'Baba' | 'Anne' | 'Anneanne';

export interface ActiveChildDevice {
  deviceId: string;
  setByUid: string;
  setByName: AdultName;
  setAt: string;
  label?: string;
}

export interface BonusCard {
  id: string;
  title: string;
  message: string;
  coins: number;
  icon: string;
  createdAt: string;
  claimed: boolean;
  updatedAt?: string;
}

export type ActivityType =
  | 'app_open'
  | 'task_complete'
  | 'task_approved'
  | 'task_rejected'
  | 'purchase'
  | 'video_started'
  | 'video_blocked';

export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  label: string;
  detail?: string;
  timestamp: string;
  taskId?: string;
  dateKey?: string;
  scheduledTaskCount?: number;
  /** Uygulama açılışları için: oturumun ne kadar sürdüğü (ms). */
  durationMs?: number;
}

export type VideoModerationStatus = 'pending' | 'approved' | 'blocked';

export interface StoryVideo {
  id: string;
  title: string;
  duration: string;
  thumbnailUrl: string;
  youtubeId: string;
  description: string;
  category: string;
  createdAt?: string;
  /** Çocuk ekranında yalnızca approved içerik gösterilir. */
  moderationStatus?: VideoModerationStatus;
  /** Sunucu doğrulaması veya ebeveynin manuel testinden sonra true olur. */
  embeddable?: boolean;
  privacyStatus?: 'public' | 'unlisted' | 'private' | 'unknown';
  madeForKids?: boolean;
  sourceChannelId?: string;
  sourceChannelTitle?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  lastCheckedAt?: string;
  failureReason?: string;
}
