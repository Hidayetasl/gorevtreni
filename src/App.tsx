/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { TabType, RoutineTask, ShopItem, PlacedWorldItem, UserProfile, ParentConfig, BonusCard, VoiceMessage, StoryVideo, ActivityLogEntry } from './types';
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
  INITIAL_TASKS,
  INITIAL_SHOP,
  INITIAL_WORLD,
  INITIAL_USER,
  INITIAL_PARENT,
  INITIAL_BONUSES,
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
import { ParentModal } from './components/ParentModal';
import { BonusModal } from './components/BonusModal';
import { RewardClaimModal } from './components/RewardClaimModal';
import { VoiceMessagesModal } from './components/VoiceMessagesModal';
import { SimpleAccessGate } from './components/SimpleAccessGate';
import { createFamilyCode, familyExists, getFamilyCode, getFamilyData, getInviteFamilyCode, isCloudConfigured, saveFamilyCode, subscribeToFamily, uploadFamilyData } from './utils/cloudSync';
import { mergeVideosById, sortVideosNewestFirst } from './utils/videoOrder';

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
  const [familyCode, setFamilyCode] = useState(() => getFamilyCode());
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

  // Davet bağlantısı (?aile=...) başka bir telefonda açıldığında aile kodu
  // otomatik doğrulanır. PIN sadece ebeveyn kilididir; eşitleme anahtarı
  // değildir. Böylece iki kavram karışmaz.
  useEffect(() => {
    const inviteCode = getInviteFamilyCode();
    if (!cloudEnabled || !isCloudConfigured || !inviteCode || inviteCode === familyCode) return;
    let cancelled = false;
    setCloudStatus('Davet bağlantısı doğrulanıyor…');
    familyExists(inviteCode)
      .then((exists) => {
        if (cancelled) return;
        if (!exists) {
          setCloudStatus('Davet bağlantısı geçersiz. Ebeveynden yeni bağlantıyı isteyin.');
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

  const currentFamilyData = (): import('./utils/cloudSync').FamilyData => ({ user, parentConfig, tasks, shop, world, bonuses, voiceMessages, videos, activityLog });

  useEffect(() => {
    latestFamilyDataRef.current = currentFamilyData();
  }, [user, parentConfig, tasks, shop, world, bonuses, voiceMessages, videos, activityLog]);

  useEffect(() => {
    if (!cloudEnabled || !isCloudConfigured || !familyCode) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setCloudStatus('Aile verisine bağlanıyor…');
    (async () => {
      try {
        if (!(await familyExists(familyCode))) await uploadFamilyData(familyCode, currentFamilyData());
        if (cancelled) return;
        unsubscribe = await subscribeToFamily(familyCode, (remote, metadata) => {
          if (metadata.fromCache) {
            setCloudStatus(navigator.onLine ? 'Bulut doğrulanıyor…' : 'Çevrimdışı: kayıtlı oyun açık');
            return;
          }
          remoteUpdateRef.current = true;
          const syncedUser: UserProfile = {
            ...INITIAL_USER,
            ...remote.user,
          };

          const syncedShop = mergeShopItemsWithCatalog(remote.shop);
          const shopCatalogChanged = syncedShop.length !== remote.shop.length;

          setUser(syncedUser); setParentConfig(remote.parentConfig);
          setTasks(remote.tasks);
          setShop(syncedShop); setWorld(remote.world); setBonuses(remote.bonuses);
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
          if (shopCatalogChanged || combinedVideos.length > remoteVideos.length || combinedMessages.length > remoteMessages.length || combinedActivityLog.length > remoteActivityLog.length) {
            // Bu cihazda olup henüz buluta gitmemiş videoyu/notu/etkinliği ve yeni
            // mağaza katalog parçalarını koru; buluttaki diğer güncel veriler aynen kalır.
            uploadFamilyData(familyCode, { ...remote, shop: syncedShop, videos: syncedVideos, voiceMessages: combinedMessages, activityLog: combinedActivityLog })
              .catch(() => setCloudStatus('Çevrimdışı: yerel not veya video bu cihazda güvenle bekliyor'));
          }
        }, (message) => setCloudStatus(`Eşitleme hatası: ${message}`));
      } catch (error) {
        setCloudStatus(error instanceof Error ? `Eşitleme hatası: ${error.message}` : 'Eşitleme hatası oluştu.');
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
  }, [user, parentConfig, tasks, shop, world, bonuses, voiceMessages, videos, activityLog, familyCode, cloudEnabled]);

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
      if (combinedVideos.length > remoteVideos.length || combinedMessages.length > remoteMessages.length || combinedActivityLog.length > remoteActivityLog.length) {
        await uploadFamilyData(familyCode, { ...remote, shop: mergeShopItemsWithCatalog(remote.shop), videos: combinedVideos, voiceMessages: combinedMessages, activityLog: combinedActivityLog });
      }
      remoteUpdateRef.current = true;
      setUser({
        ...INITIAL_USER,
        ...remote.user,
      });
      setParentConfig(remote.parentConfig); setTasks(remote.tasks); setShop(mergeShopItemsWithCatalog(remote.shop));
      setWorld(remote.world); setBonuses(remote.bonuses); setVoiceMessages(combinedMessages); setVideos(combinedVideos); setActivityLog(combinedActivityLog);
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

  const handleJoinFamily = async (code: string) => {
    const normalized = saveFamilyCode(code);
    if (!(await familyExists(normalized))) throw new Error('Bu aile koduyla kayıt bulunamadı.');
    // Yeni aile verisi gelene kadar bu cihazdaki eski verinin yeni aileyi
    // ezmesini engelle. Önce yalnızca buluttaki aile kaydı okunur.
    syncReadyRef.current = false;
    remoteUpdateRef.current = true;
    setFamilyCode(normalized);
    setCloudStatus('Aile verisi yükleniyor…');
  };

  // Etkinlik geçmişi: ebeveyn panelindeki "ne zaman girmiş, ne yapmış" akışı
  // için tek, hafif bir kayıt fonksiyonu. Liste 300 kayıtla sınırlı tutulur.
  const logActivity = (type: ActivityLogEntry['type'], label: string, detail?: string) => {
    const entry: ActivityLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      label,
      detail,
      timestamp: new Date().toISOString(),
    };
    setActivityLog((prev) => [entry, ...prev].slice(0, 300));
  };

  // Task Completion / Approval Logic
  const handleMarkTaskDone = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'pending_approval', completedAt: new Date().toISOString() } : t))
    );
  };

  const handleApproveTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === 'completed') return;
    const now = new Date().toISOString();
    const todayKey = getLocalDateKey(now);

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'completed', approvedAt: now } : t))
    );

    setUser((prev) => ({
      ...prev,
      coins: prev.coins + task.rewardCoins,
      totalCompletedTasks: prev.totalCompletedTasks + 1,
      lastTaskResetDate: todayKey,
    }));
    logActivity('task_complete', task.title, `+${task.rewardCoins} Tren Parası`);
  };

  const handleApproveAllTasks = () => {
    const pending = tasks.filter((t) => t.status === 'pending_approval');
    if (pending.length === 0) return;

    const totalReward = pending.reduce((sum, t) => sum + t.rewardCoins, 0);
    const now = new Date().toISOString();
    const todayKey = getLocalDateKey(now);

    setTasks((prev) =>
      prev.map((t) => (t.status === 'pending_approval' ? { ...t, status: 'completed', approvedAt: now } : t))
    );

    setUser((prev) => ({
      ...prev,
      coins: prev.coins + totalReward,
      totalCompletedTasks: prev.totalCompletedTasks + pending.length,
      lastTaskResetDate: todayKey,
    }));
    pending.forEach((task) => logActivity('task_complete', task.title, `+${task.rewardCoins} Tren Parası`));
  };

  const handleRejectTask = (taskId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'todo' } : t)));
  };

  const handleReactivateTask = (taskId: string) => {
    const todayKey = getLocalDateKey();
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId && isRoutineTask(t) ? reopenRoutineTask(t) : t))
    );
    setUser((prev) => ({ ...prev, lastTaskResetDate: todayKey }));
  };

  const handleReactivateAllRoutineTasks = () => {
    const todayKey = getLocalDateKey();
    setTasks((prev) => prev.map((t) => (isRoutineTask(t) && t.status === 'completed' ? reopenRoutineTask(t) : t)));
    setUser((prev) => ({ ...prev, lastTaskResetDate: todayKey }));
  };

  const handleAddTask = (newTaskData: Omit<RoutineTask, 'id' | 'status'>) => {
    const newTask: RoutineTask = {
      ...newTaskData,
      id: `task-${Date.now()}`,
      status: 'todo',
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Shop & Inventory Handlers
  const handleBuyItem = (itemId: string, price: number) => {
    const item = shop.find((s) => s.id === itemId);
    setUser((prev) => ({ ...prev, coins: Math.max(0, prev.coins - price) }));
    setShop((prev) => prev.map((item) => (item.id === itemId ? { ...item, unlocked: true } : item)));
    logActivity('purchase', item?.name || itemId, `-${price} Tren Parası`);
  };

  const handleSetActiveTrain = (icon: string) => {
    setUser((prev) => ({ ...prev, activeTrainIcon: icon }));
  };

  // World Canvas Handlers
  const handlePlaceItem = (itemData: Omit<PlacedWorldItem, 'id'>) => {
    const newItem: PlacedWorldItem = {
      ...itemData,
      id: `world-${Date.now()}`,
    };
    setWorld((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (placedId: string) => {
    setWorld((prev) => prev.filter((item) => item.id !== placedId));
  };

  // Bonus Handlers
  const handleSendBonus = (bonusData: Omit<BonusCard, 'id' | 'claimed' | 'createdAt'>) => {
    const newBonus: BonusCard = {
      ...bonusData,
      id: `bonus-${Date.now()}`,
      createdAt: new Date().toISOString(),
      claimed: false,
    };
    setBonuses((prev) => [newBonus, ...prev]);
  };

  const handleClaimBonus = (bonusId: string, bonusCoins: number) => {
    setBonuses((prev) => prev.map((b) => (b.id === bonusId ? { ...b, claimed: true } : b)));
    setUser((prev) => ({ ...prev, coins: prev.coins + bonusCoins }));
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
    setTasks(INITIAL_TASKS.map((task) => ({ ...task })));
    setIsParentModalOpen(false);
  };

  const handleAddVideo = (newVid: Omit<StoryVideo, 'id'>) => {
    const video: StoryVideo = {
      ...newVid,
      id: `v-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    pendingSyncRef.current = true;
    setVideos((prev) => {
      const nextVideos = sortVideosNewestFirst([video, ...prev]);
      latestFamilyDataRef.current = { ...currentFamilyData(), videos: nextVideos };
      return nextVideos;
    });
    setCloudStatus('Video eklendi, bulut eşitlemesi bekliyor…');
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
      id: `vm-${Date.now()}`,
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

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending_approval').length;
  const unreadVoiceCount = voiceMessages.filter((m) => m.isNew).length;
  const unclaimedBonus = bonuses.find((b) => !b.claimed) || null;

  if (!hasGameAccess) return <SimpleAccessGate onUnlock={() => setHasGameAccess(true)} />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0e2531] via-[#112f3e] to-[#2f7533] text-slate-100 relative selection:bg-sky-200">
      {/* Background Animated Sky & Clouds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Floating Sun */}
        <div className="absolute top-4 right-6 w-16 h-16 sm:w-20 sm:h-20 bg-amber-300 rounded-full shadow-[0_0_40px_rgba(251,191,36,0.8)] animate-sun-spin flex items-center justify-center text-3xl opacity-90">
          ☀️
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
        />

        {/* Main Content Body */}
        <main className="flex-1 p-3 sm:p-5">
          {activeTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              onMarkTaskDone={handleMarkTaskDone}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
              onOpenVoiceModal={openVoiceModal}
              onOpenJournal={openJournal}
              unreadVoiceCount={unreadVoiceCount}
            />
          )}

          {activeTab === 'world' && (
            <TrainWorldView
              worldItems={world}
              inventory={shop}
              user={user}
              onPlaceItem={handlePlaceItem}
              onRemoveItem={handleRemoveItem}
              onSetActiveTrain={handleSetActiveTrain}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
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
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <Navigation
          activeTab={activeTab}
          onChangeTab={(tab) => setActiveTab(tab)}
          onOpenParentModal={() => setIsParentModalOpen(true)}
          pendingCount={pendingCount}
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
