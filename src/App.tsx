/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Tasarım: Pastel Tren Rotası — krem zemin, sıcak kahve metin ve sakin gökyüzü mavisi istasyon alanları.
import React, { useState, useEffect, useRef } from 'react';
import { ActiveChildDevice, AdultName, TabType, RoutineTask, ShopItem, PlacedWorldItem, UserProfile, ParentConfig, BonusCard, VoiceMessage, StoryVideo, ActivityLogEntry, CoinLedgerEntry } from './types';
import {
  getStoredTasks,
  saveStoredTasks,
  getStoredShop,
  saveStoredShop,
  mergeShopItemsWithCatalog,
  getStoredWorld,
  saveStoredWorld,
  getStoredUser,
  saveStoredUser,
  getStoredParent,
  saveStoredParent,
  getStoredBonuses,
  saveStoredBonuses,
  getStoredVoiceMessages,
  saveStoredVoiceMessages,
  getStoredVideos,
  saveStoredVideos,
  getStoredActivityLog,
  saveStoredActivityLog,
  getStoredCoinLedger,
  saveStoredCoinLedger,
  INITIAL_TASKS,
  INITIAL_SHOP,
  INITIAL_WORLD,
  INITIAL_USER,
  INITIAL_PARENT,
  INITIAL_BONUSES,
  getOrCreateDeviceId,
  INITIAL_VOICE_MESSAGES,
  INITIAL_VIDEOS,
  START_LEVEL_VERSION,
} from './utils/storage';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { TasksView } from './components/TasksView';
import { TrainWorldView } from './components/TrainWorldView';
import { ShopView } from './components/ShopView';
import { VideosView } from './components/VideosView';
import { LearnView } from './components/LearnView';
import { ParentModal } from './components/ParentModal';
import { BonusModal } from './components/BonusModal';
import { RewardClaimModal } from './components/RewardClaimModal';
import { VoiceMessagesModal } from './components/VoiceMessagesModal';
import { SimpleAccessGate } from './components/SimpleAccessGate';
import { acceptFamilyInvite, createFamilyCode, familyExists, getAdultName, getFamilyCode, getFamilyData, getInviteFamilyCode, isCloudConfigured, mergeById, saveFamilyCode, signOutAdult, subscribeToAuth, subscribeToFamily, uploadFamilyData } from './utils/cloudSync';
import { mergeVideosById, sortVideosNewestFirst } from './utils/videoOrder';
import { buildDailyProgress, calculateCurrentStreak, weeklyCompletion } from './utils/progress';
import { validateYoutubeVideo } from './utils/youtubeValidation';

const routineTaskIds = new Set(INITIAL_TASKS.map((task) => task.id));
const routineTaskTemplates = new Map(INITIAL_TASKS.map((task) => [task.id, task]));

function getBrowserDeviceLabel(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  let browser = 'Bilinmeyen Tarayıcı';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/CriOS/.test(ua)) browser = 'Chrome (iOS)';
  else if (/FxiOS/.test(ua)) browser = 'Firefox (iOS)';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';
  let device = '';
  if (/iPhone/.test(ua)) device = 'iPhone';
  else if (/iPad/.test(ua)) device = 'iPad';
  else if (/Android/.test(ua)) device = 'Android';
  else if (/Macintosh/.test(ua)) device = 'Mac';
  else if (/Windows/.test(ua)) device = 'Windows';
  else if (/Linux/.test(ua)) device = 'Linux';
  return device ? `${browser} · ${device}` : browser;
}

function getLocalDateKey(value: Date | string = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateLedgerBalance(ledger: CoinLedgerEntry[], fallback: number) {
  if (ledger.length === 0) return fallback;
  let balance = 0;
  for (const entry of [...ledger].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    balance = typeof entry.balanceAfter === 'number' ? entry.balanceAfter : balance + entry.coinDelta;
  }
  return Math.max(0, balance);
}

function getCloudErrorMessage(error: unknown, fallback = 'Eşitleme sırasında bir sorun oluştu.') {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (raw.includes('auth/network-request-failed') || raw.includes('network-request-failed')) {
    return 'İnternet bağlantısı sorunu. Lütfen bağlantınızı kontrol edip tekrar deneyin.';
  }
  if (raw.includes('permission-denied') || raw.includes('insufficient permissions')) {
    return 'Bulut erişim izni reddedildi. Aile bağlantısını veya ayarları kontrol edin.';
  }
  if (raw.includes('Firebase yapılandırması eksik')) {
    return 'Bulut eşitlemesi yapılandırılmamış. Oyun bu cihazda yerel olarak çalışıyor.';
  }
  return fallback;
}

function isRoutineTask(task: RoutineTask) {
  return !task.isExtra && routineTaskIds.has(task.id);
}

function getTaskDateKey(task: RoutineTask) {
  return getLocalDateKey(task.approvedAt || task.completedAt || '');
}

function reopenRoutineTask(task: RoutineTask): RoutineTask {
  const template = routineTaskTemplates.get(task.id);
  return {
    ...task,
    imageUrl: template?.imageUrl || task.imageUrl,
    status: 'todo',
    completedAt: undefined,
    approvedAt: undefined,
  };
}

function reopenCompletedRoutineTasksFromPastDays(tasks: RoutineTask[], todayKey: string) {
  let changed = false;
  const nextTasks = tasks.map((task) => {
    const taskDateKey = getTaskDateKey(task);
    if (isRoutineTask(task) && task.status === 'completed' && taskDateKey !== todayKey) {
      changed = true;
      return reopenRoutineTask(task);
    }
    return task;
  });

  return { tasks: nextTasks, changed };
}

/**
 * A stale/empty Firebase world must not erase a real local placement. This is
 * intentionally conservative: a non-empty remote world remains authoritative;
 * only an empty/malformed remote value falls back to the current local world or
 * the published defaults.
 */
function chooseSyncedWorld(remoteWorld: unknown, localWorld: PlacedWorldItem[]) {
  const remote = Array.isArray(remoteWorld) ? remoteWorld as PlacedWorldItem[] : [];
  if (remote.length > 0) return remote;
  return localWorld.length > 0 ? localWorld : INITIAL_WORLD;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  // Kullanıcı Google hesabı görmez. Firebase anonim oturumu arka planda
  // çalışır; gizli aile bağlantısına katılan cihazlar aynı veriyi eşitler.
  const cloudEnabled = true;
  const [hasGameAccess, setHasGameAccess] = useState(() => localStorage.getItem('ruzgar_game_access_v1') === 'open');

  // Persistent States
  const [user, setUser] = useState<UserProfile>(() => getStoredUser());
  const [parentConfig, setParentConfig] = useState<ParentConfig>(() => getStoredParent());
  const [tasks, setTasks] = useState<RoutineTask[]>(() => getStoredTasks());
  const [shop, setShop] = useState<ShopItem[]>(() => getStoredShop());
  const [world, setWorld] = useState<PlacedWorldItem[]>(() => getStoredWorld());
  const [bonuses, setBonuses] = useState<BonusCard[]>(() => getStoredBonuses());
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>(() => getStoredVoiceMessages());
  const [videos, setVideos] = useState<StoryVideo[]>(() => getStoredVideos());
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(() => getStoredActivityLog());
  const [coinLedger, setCoinLedger] = useState<CoinLedgerEntry[]>(() => {
    const stored = getStoredCoinLedger();
    if (stored.length > 0) return stored;
    const openingBalance = getStoredUser().coins;
    return [{ id: 'migration-opening-balance-v1', type: 'initial', coinDelta: openingBalance, balanceAfter: openingBalance, createdAt: new Date().toISOString() }];
  });
  const [familyCode, setFamilyCode] = useState(() => getFamilyCode());
  const [activeChildDevice, setActiveChildDevice] = useState<ActiveChildDevice | null | undefined>(undefined);
  const [adultUser, setAdultUser] = useState<{ uid: string; name: AdultName } | null>(null);
  const [cloudStatus, setCloudStatus] = useState(isCloudConfigured ? 'Bağlantı hazırlanıyor…' : 'Firebase yapılandırması bekleniyor');
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [networkEpoch, setNetworkEpoch] = useState(0);
  const remoteUpdateRef = useRef(false);
  const syncReadyRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const latestFamilyDataRef = useRef<import('./utils/cloudSync').FamilyData | null>(null);
  const videosRef = useRef(videos);
  const voiceMessagesRef = useRef(voiceMessages);
  const activityLogRef = useRef(activityLog);
  const authUidRef = useRef<string | null | undefined>(undefined);
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());

  useEffect(() => {
    if (!isCloudConfigured) return;
    let cancelled = false;
    const unsubscribe = subscribeToAuth((firebaseUser) => {
      if (cancelled) return;
      const nextUid = firebaseUser?.uid || null;
      if (authUidRef.current !== nextUid) {
        authUidRef.current = nextUid;
        setNetworkEpoch((value) => value + 1);
      }
      const adultName = getAdultName(firebaseUser);
      setAdultUser(adultName && firebaseUser ? { uid: firebaseUser.uid, name: adultName } : null);
    }, () => {
      if (!cancelled) setAdultUser(null);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  // Davet bağlantısı (?aile=...) başka bir telefonda açıldığında aile kodu
  // otomatik doğrulanır. PIN sadece ebeveyn kilididir; eşitleme anahtarı
  // değildir. Böylece iki kavram karışmaz.
  useEffect(() => {
    const inviteCode = getInviteFamilyCode();
    if (!cloudEnabled || !isCloudConfigured || !inviteCode || inviteCode === familyCode) return;
    let cancelled = false;
    setCloudStatus('Davet bağlantısı doğrulanıyor…');
    familyExists(inviteCode)
      .then(async (exists) => {
        if (cancelled) return;
        if (!exists) {
          setCloudStatus('Davet bağlantısı geçersiz. Ebeveynden yeni bağlantıyı isteyin.');
          return;
        }
        try {
          await acceptFamilyInvite(inviteCode);
        } catch (error) {
          if (!cancelled) setCloudStatus(getCloudErrorMessage(error, 'Davet kabul edilemedi.'));
          return;
        }
        saveFamilyCode(inviteCode);
        setFamilyCode(inviteCode);
        setCloudStatus('Aile verisi yükleniyor…');
      })
      .catch(() => !cancelled && setCloudStatus('Davet bağlantısı şu an doğrulanamadı. İnternet bağlantısını kontrol edin.'));
    return () => { cancelled = true; };
  }, [familyCode, cloudEnabled]);

  // Modal States
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceModalInitialTab, setVoiceModalInitialTab] = useState<'inbox' | 'record'>('inbox');
  const [isJournalMode, setIsJournalMode] = useState(false);
  const [purchasedItemModal, setPurchasedItemModal] = useState<ShopItem | null>(null);

  // Sync to LocalStorage
  useEffect(() => saveStoredUser(user), [user]);
  useEffect(() => saveStoredParent(parentConfig), [parentConfig]);
  useEffect(() => saveStoredTasks(tasks), [tasks]);
  useEffect(() => saveStoredShop(shop), [shop]);
  useEffect(() => saveStoredWorld(world), [world]);
  useEffect(() => saveStoredBonuses(bonuses), [bonuses]);
  useEffect(() => saveStoredVoiceMessages(voiceMessages), [voiceMessages]);
  useEffect(() => { voiceMessagesRef.current = voiceMessages; }, [voiceMessages]);
  useEffect(() => saveStoredVideos(videos), [videos]);
  useEffect(() => { videosRef.current = videos; }, [videos]);
  useEffect(() => saveStoredActivityLog(activityLog), [activityLog]);
  useEffect(() => { activityLogRef.current = activityLog; }, [activityLog]);
  useEffect(() => saveStoredCoinLedger(coinLedger), [coinLedger]);

  useEffect(() => {
    const todayKey = getLocalDateKey();
    const normalized = reopenCompletedRoutineTasksFromPastDays(tasks, todayKey);
    if (normalized.changed) setTasks(normalized.tasks);
    if (user.lastTaskResetDate !== todayKey) {
      setUser((prev) => (
        prev.lastTaskResetDate === todayKey
          ? prev
          : { ...prev, lastTaskResetDate: todayKey }
      ));
    }
  }, [tasks, user.lastTaskResetDate]);

  const currentFamilyData = (): import('./utils/cloudSync').FamilyData => ({
    user, parentConfig, tasks, shop, world, bonuses, voiceMessages, videos, activityLog, coinLedger,
    activeChildDevice,
  });

  useEffect(() => {
    latestFamilyDataRef.current = currentFamilyData();
  }, [user, parentConfig, tasks, shop, world, bonuses, voiceMessages, videos, activityLog, coinLedger, activeChildDevice]);

  useEffect(() => {
    if (!cloudEnabled || !isCloudConfigured || !familyCode) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setCloudStatus('Aile verisine bağlanıyor…');
    (async () => {
      try {
        // Eski sürümde aile koduyla giriş yapan cihazlar davet kabulünü
        // atlamış olabilir. Abonelikten önce üyeliği idempotent biçimde tamamla;
        // böylece Firestore rules bu cihazın aile verisini okumasına izin verir.
        if (await familyExists(familyCode)) await acceptFamilyInvite(familyCode);
        else await uploadFamilyData(familyCode, currentFamilyData());
        if (cancelled) return;
        unsubscribe = await subscribeToFamily(familyCode, (remote, metadata) => {
          if (metadata.fromCache) {
            setCloudStatus(navigator.onLine ? 'Bulut doğrulanıyor…' : 'Çevrimdışı: kayıtlı oyun açık');
            return;
          }
          remoteUpdateRef.current = true;
          setActiveChildDevice(remote.activeChildDevice ?? null);
          const syncedLedger = mergeById(remote.coinLedger || [], coinLedger);
          const syncedUser: UserProfile = {
            ...INITIAL_USER,
            ...remote.user,
            coins: calculateLedgerBalance(syncedLedger, remote.user.coins),
          };

          const syncedShop = mergeShopItemsWithCatalog(remote.shop);
          const shopCatalogChanged = syncedShop.length !== remote.shop.length;
          const localWorld = latestFamilyDataRef.current?.world || [];
          const mergedWorld = mergeById(remote.world || [], localWorld, true);
          const syncedWorld = mergedWorld.filter((item) => !item.deletedAt);
          const remoteWorldCount = Array.isArray(remote.world) ? remote.world.length : 0;
          const worldChanged = JSON.stringify(mergedWorld) !== JSON.stringify(remote.world || []);

          setUser(syncedUser); setParentConfig(remote.parentConfig);
          setTasks(mergeById(remote.tasks || [], tasks));
          setShop(mergeById(syncedShop, shop)); setWorld(syncedWorld); setBonuses(mergeById(remote.bonuses || [], bonuses));
          setCoinLedger(syncedLedger);
          const remoteMessages = remote.voiceMessages || [];
          const localMessages = voiceMessagesRef.current;
          const combinedMessages = [...remoteMessages];
          for (const message of localMessages) {
            if (!combinedMessages.some((remoteMessage) => remoteMessage.id === message.id)) combinedMessages.push(message);
          }
          setVoiceMessages(combinedMessages);
          const remoteVideos = remote.videos || [];
          const localVideos = videosRef.current;
          const combinedVideos = [...remoteVideos];
          for (const video of localVideos) {
            if (!combinedVideos.some((remoteVideo) => remoteVideo.id === video.id)) combinedVideos.push(video);
          }
          const syncedVideos = sortVideosNewestFirst(combinedVideos);
          setVideos(syncedVideos);
          const remoteActivityLog = remote.activityLog || [];
          const localActivityLog = activityLogRef.current;
          const combinedActivityLog = [...remoteActivityLog];
          for (const entry of localActivityLog) {
            if (!combinedActivityLog.some((remoteEntry) => remoteEntry.id === entry.id)) combinedActivityLog.push(entry);
          }
          setActivityLog(combinedActivityLog);
          setCloudStatus('Eşitlendi ✓');
          pendingSyncRef.current = false;
          window.setTimeout(() => { remoteUpdateRef.current = false; }, 600);
          syncReadyRef.current = true;
          if (shopCatalogChanged || worldChanged || combinedVideos.length > remoteVideos.length || combinedMessages.length > remoteMessages.length || combinedActivityLog.length > remoteActivityLog.length) {
            // Bu cihazda olup henüz buluta gitmemiş dünya yerleşimini, videoyu,
            // notu/etkinliği ve yeni mağaza katalog parçalarını koru; buluttaki
            // diğer güncel veriler aynen kalır.
            uploadFamilyData(familyCode, { ...remote, shop: syncedShop, world: mergedWorld, videos: syncedVideos, voiceMessages: combinedMessages, activityLog: combinedActivityLog, coinLedger: syncedLedger })
              .catch(() => setCloudStatus('Çevrimdışı: yerel dünya, not veya video bu cihazda güvenle bekliyor'));
          }
        }, (message) => setCloudStatus(`Eşitleme hatası: ${getCloudErrorMessage(message)}`));
      } catch (error) {
        setCloudStatus(`Eşitleme hatası: ${getCloudErrorMessage(error)}`);
      }
    })();
    return () => { cancelled = true; unsubscribe?.(); syncReadyRef.current = false; };
  // family code changes intentionally recreate the subscription.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyCode, cloudEnabled, networkEpoch]);

  useEffect(() => {
    if (!cloudEnabled || !isCloudConfigured || !familyCode || !syncReadyRef.current || remoteUpdateRef.current) return;
    if (!navigator.onLine) {
      pendingSyncRef.current = true;
      setCloudStatus('Çevrimdışı: değişiklikler bu cihazda güvenle bekliyor');
      return;
    }
    const timer = window.setTimeout(() => {
      uploadFamilyData(familyCode, currentFamilyData())
        .then(() => { pendingSyncRef.current = false; setCloudStatus('Eşitlendi ✓'); })
        .catch(() => { pendingSyncRef.current = true; setCloudStatus('Çevrimdışı: değişiklikler bu cihazda güvenle bekliyor'); });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [user, parentConfig, tasks, shop, world, bonuses, voiceMessages, videos, activityLog, coinLedger, activeChildDevice, familyCode, cloudEnabled]);

  // Uygulama her açıldığında (sekme/sayfa yüklendiğinde) hangi tarayıcı/cihazdan
  // girildiğini kaydeder; sekme arka plana alınınca veya kapanınca aynı kaydın
  // üzerine ne kadar süre kaldığını (durationMs) yazar. Ebeveyn panelindeki
  // etkinlik geçmişinde görünür.
  useEffect(() => {
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sessionStart = Date.now();
    const entry: ActivityLogEntry = {
      id,
      type: 'app_open',
      label: 'Uygulama açıldı',
      detail: getBrowserDeviceLabel(),
      timestamp: new Date().toISOString(),
    };
    setActivityLog((prev) => [entry, ...prev].slice(0, 300));

    const updateDuration = () => {
      const durationMs = Date.now() - sessionStart;
      setActivityLog((prev) => prev.map((e) => (e.id === id ? { ...e, durationMs } : e)));
    };
    const handleVisibility = () => { if (document.hidden) updateDuration(); };
    window.addEventListener('pagehide', updateDuration);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      updateDuration();
      window.removeEventListener('pagehide', updateDuration);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  // Yalnızca ilk yüklemede bir kez çalışsın istiyoruz.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setCloudStatus('İnternet geldi, bulutla eşitleniyor…');
      setNetworkEpoch((value) => value + 1);
    };
    const handleOffline = () => setCloudStatus('Çevrimdışı: kayıtlı oyun açık');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (!familyCode) {
      setCloudStatus('Önce Ebeveyn > Ayarlar bölümünden aile eşitlemesini başlatın.');
      return;
    }
    if (!navigator.onLine) {
      pendingSyncRef.current = true;
      setCloudStatus('Çevrimdışısınız. İnternet gelince otomatik eşitlenecek.');
      return;
    }
    setIsManualSyncing(true);
    setCloudStatus('Şimdi eşitleniyor…');
    try {
      if (pendingSyncRef.current && latestFamilyDataRef.current) {
        await uploadFamilyData(familyCode, latestFamilyDataRef.current);
        pendingSyncRef.current = false;
      }
      const remote = await getFamilyData(familyCode);
      if (!remote) throw new Error('Bu aile kaydı bulunamadı.');
      const remoteVideos = remote.videos || [];
      const combinedVideos = mergeVideosById(remoteVideos, videosRef.current);
      // Sesli notları/günlükleri de video birleştirmesiyle aynı güvenli mantıkla
      // birleştiriyoruz: buluta henüz ulaşmamış yerel bir kayıt manuel eşitlemeyle
      // asla silinmemeli (otomatik arka plan eşitlemesiyle aynı davranış).
      const remoteMessages = remote.voiceMessages || [];
      const localMessages = voiceMessagesRef.current;
      const combinedMessages = [...remoteMessages];
      for (const message of localMessages) {
        if (!combinedMessages.some((remoteMessage) => remoteMessage.id === message.id)) combinedMessages.push(message);
      }
      const remoteActivityLog = remote.activityLog || [];
      const localActivityLog = activityLogRef.current;
      const combinedActivityLog = [...remoteActivityLog];
      for (const entry of localActivityLog) {
        if (!combinedActivityLog.some((remoteEntry) => remoteEntry.id === entry.id)) combinedActivityLog.push(entry);
      }
      const mergedWorld = mergeById(remote.world || [], world, true);
      const syncedWorld = mergedWorld.filter((item) => !item.deletedAt);
      const remoteWorldCount = Array.isArray(remote.world) ? remote.world.length : 0;
      const worldChanged = JSON.stringify(mergedWorld) !== JSON.stringify(remote.world || []);
      const syncedLedger = mergeById(remote.coinLedger || [], coinLedger);
      if (worldChanged || combinedVideos.length > remoteVideos.length || combinedMessages.length > remoteMessages.length || combinedActivityLog.length > remoteActivityLog.length) {
        await uploadFamilyData(familyCode, { ...remote, shop: mergeShopItemsWithCatalog(remote.shop), world: mergedWorld, videos: combinedVideos, voiceMessages: combinedMessages, activityLog: combinedActivityLog, coinLedger: syncedLedger });
      }
      remoteUpdateRef.current = true;
      setUser({
        ...INITIAL_USER,
        ...remote.user,
        coins: calculateLedgerBalance(syncedLedger, remote.user.coins),
      });
      setCoinLedger(syncedLedger);
      setParentConfig(remote.parentConfig); setTasks(remote.tasks); setShop(mergeShopItemsWithCatalog(remote.shop));
      setWorld(syncedWorld); setBonuses(mergeById(remote.bonuses || [], bonuses)); setVoiceMessages(combinedMessages); setVideos(combinedVideos); setActivityLog(combinedActivityLog);
      setActiveChildDevice(remote.activeChildDevice ?? null);
      window.setTimeout(() => { remoteUpdateRef.current = false; }, 600);
      syncReadyRef.current = true;
      setCloudStatus('Eşitlendi ✓');
    } catch (error) {
      pendingSyncRef.current = true;
      setCloudStatus(error instanceof Error ? `Eşitleme hatası: ${error.message}` : 'Eşitleme tamamlanamadı.');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleCreateFamily = async () => {
    const code = createFamilyCode();
    setFamilyCode(code);
    setCloudStatus('Aile oluşturuluyor…');
    try {
      await uploadFamilyData(code, currentFamilyData());
      syncReadyRef.current = true;
      setCloudStatus('Eşitlendi ✓');
    } catch (error) { setCloudStatus(error instanceof Error ? `Eşitleme hatası: ${error.message}` : 'Eşitleme başlatılamadı.'); }
    return code;
  };

  const handleSetActiveChildDevice = async (checked: boolean) => {
    if (!adultUser) return;
    const nextValue: ActiveChildDevice | null = checked
      ? {
          deviceId: deviceIdRef.current,
          setByUid: adultUser.uid,
          setByName: adultUser.name,
          setAt: new Date().toISOString(),
          label: `${adultUser.name} · ${getBrowserDeviceLabel()}`,
        }
      : null;
    setActiveChildDevice(nextValue);
  };

  const handleOpenAdultLogin = () => setHasGameAccess(false);

  const handleSwitchAccount = async () => {
    if (isCloudConfigured) {
      try { await signOutAdult(); } catch (error) { setCloudStatus(getCloudErrorMessage(error, 'Hesaptan çıkış yapılamadı.')); }
    }
    setAdultUser(null);
    setActiveChildDevice(undefined);
    setHasGameAccess(false);
  };

  const handleJoinFamily = async (code: string) => {
    const normalized = saveFamilyCode(code);
    if (!(await familyExists(normalized))) throw new Error('Bu davet bağlantısı geçersiz veya kapatılmış.');
    await acceptFamilyInvite(normalized);
    // Yeni aile verisi gelene kadar bu cihazdaki eski verinin yeni aileyi
    // ezmesini engelle. Önce yalnızca buluttaki aile kaydı okunur.
    syncReadyRef.current = false;
    remoteUpdateRef.current = true;
    setFamilyCode(normalized);
    setCloudStatus('Aile verisi yükleniyor…');
  };

  // Etkinlik geçmişi: ebeveyn panelindeki "ne zaman girmiş, ne yapmış" akışı
  // için tek, hafif bir kayıt fonksiyonu. Liste 300 kayıtla sınırlı tutulur.
  const appendCoinLedger = (entry: Omit<CoinLedgerEntry, 'id' | 'createdAt'> & { id?: string }) => {
    const ledgerEntry: CoinLedgerEntry = {
      ...entry,
      id: entry.id || `coin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    setCoinLedger((prev) => [...prev, ledgerEntry]);
  };

  const logActivity = (
    type: ActivityLogEntry['type'],
    label: string,
    detail?: string,
    metadata: Pick<ActivityLogEntry, 'taskId' | 'dateKey' | 'scheduledTaskCount'> = {},
  ) => {
    const entry: ActivityLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      label,
      detail,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    setActivityLog((prev) => [entry, ...prev].slice(0, 300));
  };

  // Task Completion / Approval Logic
  const handleMarkTaskDone = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status !== 'todo') return;
    const completedAt = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'pending_approval', completedAt, updatedAt: completedAt } : t))
    );
    logActivity('task_complete', task.title, 'Çocuk görevi tamamladı; ebeveyn onayı bekleniyor.', {
      taskId,
      dateKey: getLocalDateKey(completedAt),
      scheduledTaskCount: tasks.filter((item) => !item.isExtra).length,
    });
  };

  const handleApproveTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status !== 'pending_approval') return;
    const now = new Date().toISOString();
    const todayKey = getLocalDateKey(now);

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'completed', approvedAt: now, updatedAt: now } : t))
    );

    setUser((prev) => ({
      ...prev,
      coins: prev.coins + task.rewardCoins,
      totalCompletedTasks: prev.totalCompletedTasks + 1,
      lastTaskResetDate: todayKey,
    }));
    appendCoinLedger({ id: `task-reward-${task.id}-${task.completedAt || now}`, type: 'task_reward', coinDelta: task.rewardCoins, referenceId: task.id });
    logActivity('task_approved', task.title, `+${task.rewardCoins} Tren Parası`, {
      taskId,
      dateKey: todayKey,
      scheduledTaskCount: tasks.filter((item) => !item.isExtra).length,
    });
  };

  const handleApproveAllTasks = () => {
    const pending = tasks.filter((t) => t.status === 'pending_approval');
    if (pending.length === 0) return;

    const totalReward = pending.reduce((sum, t) => sum + t.rewardCoins, 0);
    const now = new Date().toISOString();
    const todayKey = getLocalDateKey(now);

    setTasks((prev) =>
      prev.map((t) => (t.status === 'pending_approval' ? { ...t, status: 'completed', approvedAt: now, updatedAt: now } : t))
    );

    setUser((prev) => ({
      ...prev,
      coins: prev.coins + totalReward,
      totalCompletedTasks: prev.totalCompletedTasks + pending.length,
      lastTaskResetDate: todayKey,
    }));
    pending.forEach((task) => {
      appendCoinLedger({ id: `task-reward-${task.id}-${task.completedAt || now}`, type: 'task_reward', coinDelta: task.rewardCoins, referenceId: task.id });
      logActivity('task_approved', task.title, `+${task.rewardCoins} Tren Parası`, {
      taskId: task.id,
      dateKey: todayKey,
        scheduledTaskCount: tasks.filter((item) => !item.isExtra).length,
      });
    });
  };

  const handleRejectTask = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    const now = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'todo', completedAt: undefined, approvedAt: undefined, updatedAt: now } : t)));
    if (task) logActivity('task_rejected', task.title, 'Ebeveyn görevi yeniden yapılmak üzere geri gönderdi.', {
      taskId,
      dateKey: getLocalDateKey(),
      scheduledTaskCount: tasks.filter((item) => !item.isExtra).length,
    });
  };

  const handleReactivateTask = (taskId: string) => {
    const todayKey = getLocalDateKey();
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId && isRoutineTask(t) ? { ...reopenRoutineTask(t), updatedAt: new Date().toISOString() } : t))
    );
    setUser((prev) => ({ ...prev, lastTaskResetDate: todayKey }));
  };

  const handleReactivateAllRoutineTasks = () => {
    const todayKey = getLocalDateKey();
    const now = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (isRoutineTask(t) && t.status === 'completed' ? { ...reopenRoutineTask(t), updatedAt: now } : t)));
    setUser((prev) => ({ ...prev, lastTaskResetDate: todayKey }));
  };

  const handleAddTask = (newTaskData: Omit<RoutineTask, 'id' | 'status'>) => {
    const newTask: RoutineTask = {
      ...newTaskData,
      id: `task-${Date.now()}`,
      status: 'todo',
      updatedAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Shop & Inventory Handlers
  const handleBuyItem = (itemId: string, price: number) => {
    const item = shop.find((s) => s.id === itemId);
    if (!item || item.unlocked || !Number.isFinite(price) || price < 0 || user.coins < price) return;
    setUser((prev) => ({ ...prev, coins: prev.coins - price }));
    setShop((prev) => prev.map((item) => (item.id === itemId ? { ...item, unlocked: true, updatedAt: new Date().toISOString() } : item)));
    appendCoinLedger({ id: `purchase-${itemId}`, type: 'purchase', coinDelta: -price, referenceId: itemId });
    logActivity('purchase', item?.name || itemId, `-${price} Tren Parası`);
  };

  const handleSetActiveTrain = (icon: string) => {
    setUser((prev) => ({ ...prev, activeTrainIcon: icon }));
  };

  // World Canvas Handlers
  const makeStableId = (prefix: string) => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const handlePlaceItem = (itemData: Omit<PlacedWorldItem, 'id'>) => {
    const newItem: PlacedWorldItem = {
      ...itemData,
      id: makeStableId('world'),
      updatedAt: new Date().toISOString(),
    };
    setWorld((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (placedId: string) => {
    setWorld((prev) => prev.map((item) => item.id === placedId ? { ...item, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item));
  };

  // Bonus Handlers
  const handleSendBonus = (bonusData: Omit<BonusCard, 'id' | 'claimed' | 'createdAt'>) => {
    const newBonus: BonusCard = {
      ...bonusData,
      id: `bonus-${Date.now()}`,
      createdAt: new Date().toISOString(),
      claimed: false,
      updatedAt: new Date().toISOString(),
    };
    setBonuses((prev) => [newBonus, ...prev]);
  };

  const handleClaimBonus = (bonusId: string, bonusCoins: number) => {
    const bonus = bonuses.find((item) => item.id === bonusId);
    if (!bonus || bonus.claimed) return;
    const now = new Date().toISOString();
    setBonuses((prev) => prev.map((b) => (b.id === bonusId ? { ...b, claimed: true, updatedAt: now } : b)));
    setUser((prev) => ({ ...prev, coins: prev.coins + bonus.coins }));
    appendCoinLedger({ id: `bonus-reward-${bonusId}`, type: 'bonus_reward', coinDelta: bonus.coins, referenceId: bonusId });
  };

  const handleToggleSound = () => {
    setUser((prev) => ({
      ...prev,
      soundEnabled: !prev.soundEnabled,
      speechEnabled: !prev.speechEnabled,
    }));
  };

  const handleResetData = () => {
    setUser((current) => ({
      ...current,
      coins: 6,
      totalCompletedTasks: 0,
      currentStreak: 0,
      progressVersion: START_LEVEL_VERSION,
    }));
    setTasks(INITIAL_TASKS.map((task) => ({ ...task, updatedAt: new Date().toISOString() })));
    setCoinLedger((prev) => [...prev, { id: `coin-reset-${Date.now()}`, type: 'reset', coinDelta: 0, balanceAfter: 6, createdAt: new Date().toISOString() }]);
    setIsParentModalOpen(false);
  };

  const handleAddVideo = (newVid: Omit<StoryVideo, 'id'>) => {
    const video: StoryVideo = {
      ...newVid,
      id: `v-${Date.now()}`,
      createdAt: new Date().toISOString(),
      moderationStatus: 'pending',
      embeddable: false,
      privacyStatus: 'unknown',
      lastCheckedAt: new Date().toISOString(),
    };
    pendingSyncRef.current = true;
    setVideos((prev) => {
      const nextVideos = sortVideosNewestFirst([video, ...prev]);
      latestFamilyDataRef.current = { ...currentFamilyData(), videos: nextVideos };
      return nextVideos;
    });
    setCloudStatus('Video eklendi, bulut eşitlemesi bekliyor…');
  };

  const handleApproveVideo = async (id: string) => {
    const video = videos.find((item) => item.id === id);
    if (!video) return;
    setCloudStatus('YouTube videosu doğrulanıyor…');
    const validation = await validateYoutubeVideo(video.youtubeId);
    const verifiedAt = new Date().toISOString();
    pendingSyncRef.current = true;

    setVideos((prev) => {
      const nextVideos = sortVideosNewestFirst(prev.map((item) => item.id === id
        ? validation.ok
          ? {
              ...item,
              title: validation.title || item.title,
              moderationStatus: 'approved' as const,
              embeddable: validation.embeddable,
              privacyStatus: validation.privacyStatus || 'unknown',
              madeForKids: validation.madeForKids,
              sourceChannelId: validation.channelId,
              sourceChannelTitle: validation.channelTitle,
              verifiedAt,
              lastCheckedAt: verifiedAt,
              verifiedBy: parentConfig.parentName,
              failureReason: undefined,
              thumbnailUrl: `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`,
            }
          : {
              ...item,
              moderationStatus: 'pending' as const,
              embeddable: false,
              lastCheckedAt: verifiedAt,
              failureReason: validation.failureReason || 'Video doğrulanamadı.',
            }
        : item));
      latestFamilyDataRef.current = { ...currentFamilyData(), videos: nextVideos };
      return nextVideos;
    });
    setCloudStatus(validation.ok
      ? 'Video doğrulandı ve çocuk ekranında gösteriliyor.'
      : `Video onaylanamadı: ${validation.failureReason || 'Video kullanılamıyor.'}`);
  };

  const handleBlockVideo = (id: string) => {
    pendingSyncRef.current = true;
    setVideos((prev) => {
      const nextVideos = prev.map((video) => video.id === id
        ? { ...video, moderationStatus: 'blocked' as const, embeddable: false, failureReason: 'Ebeveyn tarafından engellendi' }
        : video);
      latestFamilyDataRef.current = { ...currentFamilyData(), videos: nextVideos };
      return nextVideos;
    });
    setCloudStatus('Video çocuk ekranından kaldırıldı, bulut eşitlemesi bekliyor…');
  };

  const handleVideoStarted = (video: StoryVideo) => {
    logActivity('video_started', video.title, 'Ebeveyn PIN ile süreli izleme başlatıldı.', { dateKey: getLocalDateKey() });
  };

  const handleDeleteVideo = (id: string) => {
    pendingSyncRef.current = true;
    setVideos((prev) => {
      const nextVideos = prev.filter((v) => v.id !== id);
      latestFamilyDataRef.current = { ...currentFamilyData(), videos: nextVideos };
      return nextVideos;
    });
    setCloudStatus('Video listesi güncellendi, bulut eşitlemesi bekliyor…');
  };

  const handleSendVoiceMessage = (msgData: Omit<VoiceMessage, 'id' | 'createdAt' | 'isNew'>) => {
    const newMsg: VoiceMessage = {
      ...msgData,
      id: makeStableId('vm'),
      createdAt: new Date().toISOString(),
      isNew: true,
    };
    setVoiceMessages((prev) => [newMsg, ...prev]);
  };

  const handleMarkReadVoiceMessage = (id: string) => {
    setVoiceMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isNew: false } : m)));
  };

  const handleDeleteVoiceMessage = (id: string) => {
    setVoiceMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const openVoiceModal = (initialTab: 'inbox' | 'record' = 'inbox') => {
    setVoiceModalInitialTab(initialTab);
    setIsJournalMode(false);
    setIsVoiceModalOpen(true);
  };

  const openJournal = (initialTab: 'inbox' | 'record' = 'inbox') => {
    setVoiceModalInitialTab(initialTab);
    setIsJournalMode(true);
    setIsVoiceModalOpen(true);
  };

  const handleJournalSaved = () => {
    const journalTask = tasks.find((task) => task.id === 'task-8');
    if (journalTask?.status === 'todo') handleMarkTaskDone('task-8');
  };

  const dailyProgress = buildDailyProgress(tasks, activityLog);
  const calculatedStreak = calculateCurrentStreak(dailyProgress);
  const weeklyStats = weeklyCompletion(dailyProgress);

  useEffect(() => {
    if (user.currentStreak !== calculatedStreak) {
      setUser((prev) => prev.currentStreak === calculatedStreak ? prev : { ...prev, currentStreak: calculatedStreak });
    }
  }, [calculatedStreak, user.currentStreak]);

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending_approval').length;
  const unreadVoiceCount = voiceMessages.filter((m) => m.isNew).length;
  const unclaimedBonus = bonuses.find((b) => !b.claimed) || null;

  if (!hasGameAccess) {
    // Giriş kodu artık doğrudan aile kodu: doğru kod hem oyunu açar hem bu
    // cihazı aynı aile verisine bağlar, ayrı bir "eşleşme" adımına gerek kalmaz.
    return (
        <SimpleAccessGate
          onUnlock={(code) => {
            if (code) setFamilyCode(code);
            setHasGameAccess(true);
          }}
        />
    );
  }

  return (
    <div className="app-shell min-h-screen bg-[#F9F6F0] text-[#4E342E] relative selection:bg-[#FFF59D]">
      {/* Background Animated Sky & Clouds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Floating Sun */}
        <div className="absolute top-4 right-6 w-14 h-14 sm:w-18 sm:h-18 bg-[#FFF59D] rounded-full shadow-[0_0_34px_rgba(255,193,7,0.24)] animate-sun-spin flex items-center justify-center text-3xl opacity-60">
          ☀
        </div>

        {/* Floating Sky Clouds */}
        <div className="absolute top-10 left-[-80px] text-4xl opacity-70 animate-cloud-slow">☁️</div>
        <div className="absolute top-24 left-1/4 text-5xl opacity-50 animate-cloud-fast">☁️</div>
        <div className="absolute top-16 right-1/3 text-3xl opacity-60 animate-cloud-slow">☁️</div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 max-w-5xl mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <Header
          user={user}
          activeTab={activeTab}
          onChangeTab={(tab) => setActiveTab(tab)}
          onToggleSound={handleToggleSound}
          onOpenParentModal={() => setIsParentModalOpen(true)}
          completedTasksCount={completedCount}
          totalTasksCount={tasks.length}
          hasUnclaimedBonus={!!unclaimedBonus}
          onOpenBonusModal={() => {}}
          pendingCount={pendingCount}
          onOpenVoiceModal={() => openVoiceModal('inbox')}
          unreadVoiceCount={unreadVoiceCount}
          cloudStatus={cloudStatus}
          onManualSync={handleManualSync}
          isSyncing={isManualSyncing}
          adultName={adultUser?.name}
          onOpenAdultLogin={adultUser ? undefined : handleOpenAdultLogin}
          onSwitchAccount={adultUser ? handleSwitchAccount : undefined}
        />

        {(adultUser || activeChildDevice) && (
          <section className="mx-2 mt-2 rounded-2xl border border-sky-200 bg-white/85 px-3 py-2.5 shadow-sm sm:mx-3" aria-label="Aile cihaz durumu">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {adultUser ? (
                <label className="flex min-h-10 items-center gap-2 text-xs font-extrabold text-slate-700">
                  <input
                    type="checkbox"
                    checked={activeChildDevice?.deviceId === deviceIdRef.current}
                    onChange={(event) => void handleSetActiveChildDevice(event.target.checked)}
                    className="h-5 w-5 accent-emerald-600"
                  />
                  <span>Bu cihaz şu an çocuğun aktif cihazı</span>
                </label>
              ) : <span className="text-xs font-bold text-slate-500">Yetişkin girişi yapılmadı</span>}
              <p className="text-xs font-black text-sky-800 sm:text-right">
                {activeChildDevice
                  ? <>Şu an aktif çocuk cihazı: <span className="text-emerald-700">{activeChildDevice.label || activeChildDevice.setByName}</span></>
                  : 'Aktif çocuk cihazı henüz seçilmedi.'}
              </p>
            </div>
          </section>
        )}

        {/* Main Content Body */}
        <main className="app-main flex-1 p-2 sm:p-3">
          {activeTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              onMarkTaskDone={handleMarkTaskDone}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
              onOpenVoiceModal={openVoiceModal}
              onOpenJournal={openJournal}
            />
          )}

          {activeTab === 'world' && (
            <TrainWorldView
              worldItems={world.filter((item) => !item.deletedAt)}
              inventory={shop}
              user={user}
              onPlaceItem={handlePlaceItem}
              onRemoveItem={handleRemoveItem}
              onSetActiveTrain={handleSetActiveTrain}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
              onToggleSound={handleToggleSound}
            />
          )}

          {activeTab === 'shop' && (
            <ShopView
              shopItems={shop}
              user={user}
              onBuyItem={handleBuyItem}
              onSetActiveTrain={handleSetActiveTrain}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
              onOpenGiftModal={(item) => setPurchasedItemModal(item)}
            />
          )}

          {activeTab === 'videos' && (
            <VideosView
              videos={videos}
              parentConfig={parentConfig}
              onVideoStarted={handleVideoStarted}
            />
          )}

          {activeTab === 'learn' && (
            <LearnView
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
              syllableGameLevels={user.syllableGameLevels}
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <Navigation
          activeTab={activeTab}
          onChangeTab={(tab) => setActiveTab(tab)}
          onOpenParentModal={() => setIsParentModalOpen(true)}
        />

        {/* Parent Engine Room Modal */}
        <ParentModal
          isOpen={isParentModalOpen}
          onClose={() => setIsParentModalOpen(false)}
          tasks={tasks}
          parentConfig={parentConfig}
          userProfile={user}
          onApproveTask={handleApproveTask}
          onApproveAllTasks={handleApproveAllTasks}
          onRejectTask={handleRejectTask}
          onReactivateTask={handleReactivateTask}
          onReactivateAllRoutineTasks={handleReactivateAllRoutineTasks}
          onAddTask={handleAddTask}
          onDeleteTask={handleDeleteTask}
          onSendBonus={handleSendBonus}
          onUpdateParentConfig={setParentConfig}
          onUpdateUserProfile={setUser}
          onResetData={handleResetData}
          soundEnabled={user.soundEnabled}
          speechEnabled={user.speechEnabled}
          onOpenVoiceModal={() => openVoiceModal('record')}
          videos={videos}
          onAddVideo={handleAddVideo}
          onDeleteVideo={handleDeleteVideo}
          cloudConfigured={cloudEnabled && isCloudConfigured}
          cloudStatus={cloudStatus}
          familyCode={familyCode}
          onCreateFamily={handleCreateFamily}
          onJoinFamily={handleJoinFamily}
          activityLog={activityLog}
          voiceMessages={voiceMessages}
          weeklyStats={weeklyStats}
          onApproveVideo={handleApproveVideo}
          onBlockVideo={handleBlockVideo}
        />

        {/* Voice Messages Modal */}
        <VoiceMessagesModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          messages={voiceMessages}
          onSendMessage={handleSendVoiceMessage}
          onMarkRead={handleMarkReadVoiceMessage}
          onDeleteMessage={handleDeleteVoiceMessage}
          soundEnabled={user.soundEnabled}
          speechEnabled={user.speechEnabled}
          initialTab={voiceModalInitialTab}
          journalMode={isJournalMode}
          onJournalSaved={handleJournalSaved}
        />

        {/* Unclaimed Bonus Card Modal */}
        {unclaimedBonus && (
          <BonusModal
            bonus={unclaimedBonus}
            onClaim={handleClaimBonus}
            soundEnabled={user.soundEnabled}
            speechEnabled={user.speechEnabled}
          />
        )}

        {/* Purchased Item Gift Modal */}
        {purchasedItemModal && (
          <RewardClaimModal
            item={purchasedItemModal}
            onClose={() => setPurchasedItemModal(null)}
            speechEnabled={user.speechEnabled}
          />
        )}
      </div>
    </div>
  );
}
