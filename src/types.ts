export type TabType = 'tasks' | 'world' | 'shop' | 'videos';

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
  wagonType?: 'passenger' | 'cargo_coins' | 'cargo_fruits' | 'cargo_toys' | 'cargo_animals' | 'cargo_candy' | 'cargo_space';
}

export interface PlacedWorldItem {
  id: string;
  itemId: string;
  x: number; // Grid column (0..9)
  y: number; // Grid row (0..7)
  icon: string;
  name: string;
  rotation?: number;
}

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
  /** Ortak aile verisinde başlangıç seviyesinin bir kez uygulanmasını sağlar. */
  progressVersion?: string;
}

export interface ParentConfig {
  parentName: string;
  /** Yerel, tek ebeveyn PIN'inin geriye uyumlu özeti. */
  pinHash?: string;
}

export interface BonusCard {
  id: string;
  title: string;
  message: string;
  coins: number;
  icon: string;
  createdAt: string;
  claimed: boolean;
}

export interface StoryVideo {
  id: string;
  title: string;
  duration: string;
  thumbnailUrl: string;
  youtubeId: string;
  description: string;
  category: string;
}
