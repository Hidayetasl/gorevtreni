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
import { TrainWorldView } from './components/TrainWorldView';
import { ShopView } from './components/ShopView';
import { VideosView } from './components/VideosView';
import { LearnView } from './components/LearnView';
import { ParentModal } from './components/ParentModal';
import { BonusModal } from './components/BonusModal';
import { VoiceMessagesModal } from './components/VoiceMessagesModal';
import { AuthGate } from './components/AuthGate';
import { ChildShell } from './components/child/ChildShell';
import { TasksHome } from './components/child/TasksHome';
import { combineVoiceMessages, mergeKeptLocal, stableStringify, stampAfter } from './utils/syncMerge';
import { acceptFamilyInvite, createFamilyCode, familyExists, getCurrentUid, mergeCoinLedger, mergeShopUnlocks, unlockPaidItems, getKnownAdultName, createJoinInvite, forgetAdultName, ACCESS_ENDED_KEY, getFamilyCode, getFamilyData, getInviteFamilyCode, isCloudConfigured, mergeById, saveFamilyCode, signOutAdult, subscribeToAuth, subscribeToFamily, uploadFamilyData } from './utils/cloudSync';
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

// Ailenin başlangıç bakiyesi kaydı. Tarihi en başa sabitlenir; böylece hiçbir
// cihazın bu kaydı "en yeni bakiye" gibi davranıp sonraki hareketleri silemez.
const OPENING_LEDGER_ID = 'migration-opening-balance-v1';
const OPENING_LEDGER_TIME = '1970-01-01T00:00:00.000Z';
const VERIFIED_UID_KEY = 'ruzgar_verified_adult_uid_v1';
// Öğren: ana kazanç yolu rutin görevler kalsın diye puan birikimli verilir.
const LEARN_ANSWERS_PER_COIN = 10;

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
  // Alttaki menüde bulunulan sekmeye yeniden basılınca o bölüm ana menüsünden
  // başlasın (ör. Öğren → İngilizce → Renkler'deyken "Öğren"e basmak).
  const [tabResetKey, setTabResetKey] = useState(0);
  const handleChangeTab = (tab: TabType) => {
    if (tab === activeTab) setTabResetKey((value) => value + 1);
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };
  // Kullanıcı Google hesabı görmez. Firebase anonim oturumu arka planda
  // çalışır; gizli aile bağlantısına katılan cihazlar aynı veriyi eşitler.
  const cloudEnabled = true;
  // Bu cihaz giriş kapısını hangi yetişkin hesabıyla tamamladı? Eski sürümün
  // "oyun açık" işareti kullanılmaz: aksi halde eski bir cihaz, aile verisi
  // yüklenmeden kendi eski verisiyle senkrona başlayıp aileyi eziyordu.
  const [verifiedUid, setVerifiedUid] = useState(() => localStorage.getItem(VERIFIED_UID_KEY) || '');

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
    return [{ id: OPENING_LEDGER_ID, type: 'initial', coinDelta: openingBalance, balanceAfter: openingBalance, createdAt: OPENING_LEDGER_TIME }];
  });
  const [familyCode, setFamilyCode] = useState(() => getFamilyCode());
  const [activeChildDevice, setActiveChildDevice] = useState<ActiveChildDevice | null | undefined>(undefined);
  const [adultUser, setAdultUser] = useState<{ uid: string; name: AdultName } | null>(null);
  // Aile kaydından: bu hesap davet oluşturabilir mi, süreli erişimi ne zaman biter.
  const [isInviteAdmin, setIsInviteAdmin] = useState(false);
  const [accessUntil, setAccessUntil] = useState<number | null>(null);
  // Firebase oturumu diskten geri yüklenene kadar giriş ekranını gösterme.
  const [authChecked, setAuthChecked] = useState(!isCloudConfigured);
  const [cloudStatus, setCloudStatus] = useState(isCloudConfigured ? 'Bağlantı hazırlanıyor…' : 'Firebase yapılandırması bekleniyor');
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [networkEpoch, setNetworkEpoch] = useState(0);
  const syncReadyRef = useRef(false);
  // Buluta henüz ulaşmamış yerel değişiklik var mı? Yalnızca başarılı bir
  // yüklemeden sonra temizlenir; çevrimdışıyken ve bulut güncellemesi
  // arasında yapılan değişiklikler böylece kaybolmaz.
  const dirtyRef = useRef(false);
  const localVersionRef = useRef(0);
  const uploadTimerRef = useRef<number | undefined>(undefined);
  // Aynı anda tek yükleme: kendi yüklememizin buluttan dönen yankısı yeni bir
  // yüklemeyi tetikleyip cihazları birbirine sonsuz yazdırmasın.
  const uploadInFlightRef = useRef(false);
  // Buluttan en son uygulanan durum (dilim başına nesne kimliği). Bundan farklı
  // her dilim, bu cihazda yapılmış ve henüz gönderilmemiş bir değişikliktir.
  const appliedRef = useRef<Record<string, unknown>>({});
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
      const adultName = getKnownAdultName(firebaseUser);
      setAdultUser(adultName && firebaseUser ? { uid: firebaseUser.uid, name: adultName } : null);
      setAuthChecked(true);
    }, () => {
      if (!cancelled) { setAdultUser(null); setAuthChecked(true); }
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
  // Sesli mesaj ekranını kim açtı: çocuk (üst çubuk) ya da ebeveyn (panel).
  const [voiceSenderRole, setVoiceSenderRole] = useState<'child' | 'parent'>('child');

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

  // Senkron yalnızca giriş kapısı tamamlandıktan sonra başlar. Böylece eski bir
  // cihazın yerel verisi, aile verisiyle değiştirilmeden buluta karışamaz.
  const sessionReady = !isCloudConfigured || (Boolean(adultUser) && verifiedUid === adultUser?.uid);

  useEffect(() => {
    if (!cloudEnabled || !isCloudConfigured || !familyCode || !sessionReady) return;
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
          setActiveChildDevice(remote.activeChildDevice ?? null);
          const myUid = getCurrentUid();
          setIsInviteAdmin(Boolean(remote.adminUids?.includes(myUid)));
          setAccessUntil(remote.memberExpiry?.[myUid] || null);
          // Bu callback yalnızca familyCode/cloudEnabled/networkEpoch değişince yeniden
          // kurulur (effect deps'e bakın), bu yüzden `tasks`/`shop`/`bonuses`/`coinLedger`
          // React state değişkenleri burada donmuş kalır. Onaylanan bir görev, birleştirme
          // bu eski kapanışa göre yapılırsa hemen sonra gelen herhangi bir snapshot'ta
          // "onay bekliyor" durumuna geri düşüyordu. `latestFamilyDataRef` her render'da
          // güncellendiği için (bkz. `world` için zaten yapılan aynı düzeltme) güncel
          // veriyi okumak üzere onu kullanıyoruz.
          const localData = latestFamilyDataRef.current;
          const hadLocalChanges = dirtyRef.current;
          const syncedLedger = mergeCoinLedger(remote.coinLedger || [], localData?.coinLedger || coinLedger);
          const syncedUser: UserProfile = {
            ...INITIAL_USER,
            ...remote.user,
            // Gönderilmemiş yerel ayar (ses, tren, seviye) varsa bulut kopyası ezmesin.
            ...(hadLocalChanges && localData ? localData.user : {}),
            coins: calculateLedgerBalance(syncedLedger, remote.user.coins),
          };
          const syncedParentConfig = hadLocalChanges && localData
            ? { ...remote.parentConfig, ...localData.parentConfig, pinHash: localData.parentConfig.pinHash || remote.parentConfig?.pinHash }
            : remote.parentConfig;

          const syncedShop = mergeShopItemsWithCatalog(remote.shop);
          const shopCatalogChanged = syncedShop.length !== remote.shop.length;
          const localWorld = latestFamilyDataRef.current?.world || [];
          const mergedWorld = mergeById(remote.world || [], localWorld, true);
          const syncedWorld = mergedWorld.filter((item) => !item.deletedAt);
          const remoteWorldCount = Array.isArray(remote.world) ? remote.world.length : 0;
          const worldChanged = stableStringify(mergedWorld) !== stableStringify(remote.world || []);

          const syncedTasks = mergeById(remote.tasks || [], localData?.tasks || tasks, true);
          const mergedShop = unlockPaidItems(mergeShopUnlocks(syncedShop, localData?.shop || shop), syncedLedger);
          const syncedBonuses = mergeById(remote.bonuses || [], localData?.bonuses || bonuses);
          setUser(syncedUser); setParentConfig(syncedParentConfig);
          setTasks(syncedTasks);
          setShop(mergedShop); setWorld(syncedWorld); setBonuses(syncedBonuses);
          setCoinLedger(syncedLedger);
          const remoteMessages = remote.voiceMessages || [];
          const localMessages = voiceMessagesRef.current;
          const combinedMessages = combineVoiceMessages(remoteMessages, localMessages);
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
          // Uygulanan durumu kaydet: bundan sonraki farklılıklar yerel değişikliktir.
          appliedRef.current = {
            user: syncedUser, parentConfig: syncedParentConfig, tasks: syncedTasks, shop: mergedShop, world: syncedWorld,
            bonuses: syncedBonuses, voiceMessages: combinedMessages, videos: syncedVideos, activityLog: combinedActivityLog,
            coinLedger: syncedLedger, activeChildDevice: remote.activeChildDevice ?? null,
          };
          syncReadyRef.current = true;
          // Birleştirmede bu cihazdan gelen (buluta henüz gitmemiş) bir şey kaldıysa gönder.
          const keptLocal = (hadLocalChanges && !uploadInFlightRef.current) || shopCatalogChanged || worldChanged
            || combinedVideos.length > remoteVideos.length || combinedMessages.length > remoteMessages.length
            || combinedMessages.some((message) => message.deletedAt && !remoteMessages.find((remoteMessage) => remoteMessage.id === message.id)?.deletedAt)
            || combinedActivityLog.length > remoteActivityLog.length
            || mergeKeptLocal(remote.tasks || [], syncedTasks) || mergeKeptLocal(syncedShop, mergedShop)
            || mergeKeptLocal(remote.bonuses || [], syncedBonuses) || mergeKeptLocal(remote.coinLedger || [], syncedLedger);
          if (keptLocal) {
            dirtyRef.current = true;
            scheduleUploadRef.current(0);
          } else {
            setCloudStatus('Eşitlendi ✓');
          }
        }, (message) => setCloudStatus(`Eşitleme hatası: ${getCloudErrorMessage(message)}`));
      } catch (error) {
        setCloudStatus(`Eşitleme hatası: ${getCloudErrorMessage(error)}`);
      }
    })();
    return () => { cancelled = true; unsubscribe?.(); syncReadyRef.current = false; };
  // family code changes intentionally recreate the subscription.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyCode, cloudEnabled, networkEpoch, sessionReady]);

  // Yükleme: yerel değişiklik varken 0,9 sn bekleyip (arka arkaya dokunuşları
  // birleştirerek) tek seferde gönderir. Başarısız olursa değişiklik işaretli
  // kalır; internet geri gelince veya bir sonraki bulut güncellemesinde tekrar denenir.
  const scheduleUploadRef = useRef<(delay?: number) => void>(() => {});
  scheduleUploadRef.current = (delay = 900) => {
    if (!cloudEnabled || !isCloudConfigured || !familyCode || !sessionReady) return;
    window.clearTimeout(uploadTimerRef.current);
    uploadTimerRef.current = window.setTimeout(() => {
      if (!dirtyRef.current || !latestFamilyDataRef.current || uploadInFlightRef.current) return;
      if (!navigator.onLine) {
        setCloudStatus('Çevrimdışı: değişiklikler bu cihazda güvenle bekliyor');
        return;
      }
      const version = localVersionRef.current;
      uploadInFlightRef.current = true;
      uploadFamilyData(familyCode, latestFamilyDataRef.current)
        .then(() => {
          uploadInFlightRef.current = false;
          // Yükleme sürerken yeni bir değişiklik olduysa işaret kalır ve o da gönderilir.
          if (localVersionRef.current === version) dirtyRef.current = false;
          else scheduleUploadRef.current();
          setCloudStatus('Eşitlendi ✓');
        })
        .catch(() => {
          uploadInFlightRef.current = false;
          setCloudStatus('Çevrimdışı: değişiklikler bu cihazda güvenle bekliyor');
        });
    }, delay);
  };

  useEffect(() => {
    if (!cloudEnabled || !isCloudConfigured || !familyCode || !sessionReady || !syncReadyRef.current) return;
    const current: Record<string, unknown> = { user, parentConfig, tasks, shop, world, bonuses, voiceMessages, videos, activityLog, coinLedger, activeChildDevice };
    const changed = Object.keys(current).some((key) => current[key] !== appliedRef.current[key]);
    if (!changed && !dirtyRef.current) return;
    if (changed) {
      localVersionRef.current += 1;
      appliedRef.current = { ...current };
    }
    dirtyRef.current = true;
    scheduleUploadRef.current();
  }, [user, parentConfig, tasks, shop, world, bonuses, voiceMessages, videos, activityLog, coinLedger, activeChildDevice, familyCode, cloudEnabled, sessionReady]);

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

    // Her kayıt tüm aile belgesini buluta yazar. Uygulamalar arasında hızlı gidip
    // gelmek (ya da sekmenin sık gizlenip görünmesi) her seferinde yazma
    // yapmasın: arka plana geçişte en fazla dakikada bir, kapanışta her zaman.
    let lastRecordedAt = 0;
    const updateDuration = (force = false) => {
      if (!force && Date.now() - lastRecordedAt < 60_000) return;
      lastRecordedAt = Date.now();
      const durationMs = Date.now() - sessionStart;
      setActivityLog((prev) => prev.map((e) => (e.id === id ? { ...e, durationMs } : e)));
    };
    const handlePageHide = () => updateDuration(true);
    const handleVisibility = () => { if (document.hidden) updateDuration(); };
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      updateDuration(true);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  // Yalnızca ilk yüklemede bir kez çalışsın istiyoruz.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setCloudStatus('İnternet geldi, bulutla eşitleniyor…');
      setNetworkEpoch((value) => value + 1);
      if (dirtyRef.current) scheduleUploadRef.current(300);
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
      dirtyRef.current = true;
      setCloudStatus('Çevrimdışısınız. İnternet gelince otomatik eşitlenecek.');
      return;
    }
    setIsManualSyncing(true);
    setCloudStatus('Şimdi eşitleniyor…');
    try {
      if (dirtyRef.current && latestFamilyDataRef.current) {
        await uploadFamilyData(familyCode, latestFamilyDataRef.current);
        dirtyRef.current = false;
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
      const combinedMessages = combineVoiceMessages(remoteMessages, localMessages);
      const remoteActivityLog = remote.activityLog || [];
      const localActivityLog = activityLogRef.current;
      const combinedActivityLog = [...remoteActivityLog];
      for (const entry of localActivityLog) {
        if (!combinedActivityLog.some((remoteEntry) => remoteEntry.id === entry.id)) combinedActivityLog.push(entry);
      }
      const mergedWorld = mergeById(remote.world || [], world, true);
      const syncedWorld = mergedWorld.filter((item) => !item.deletedAt);
      const remoteWorldCount = Array.isArray(remote.world) ? remote.world.length : 0;
      const worldChanged = stableStringify(mergedWorld) !== stableStringify(remote.world || []);
      const syncedLedger = mergeCoinLedger(remote.coinLedger || [], coinLedger);
      if (worldChanged || combinedVideos.length > remoteVideos.length || combinedMessages.length > remoteMessages.length || combinedMessages.some((message) => message.deletedAt && !remoteMessages.find((remoteMessage) => remoteMessage.id === message.id)?.deletedAt) || combinedActivityLog.length > remoteActivityLog.length) {
        await uploadFamilyData(familyCode, { ...remote, shop: mergeShopItemsWithCatalog(remote.shop), world: mergedWorld, videos: combinedVideos, voiceMessages: combinedMessages, activityLog: combinedActivityLog, coinLedger: syncedLedger });
      }
      setUser({
        ...INITIAL_USER,
        ...remote.user,
        coins: calculateLedgerBalance(syncedLedger, remote.user.coins),
      });
      setCoinLedger(syncedLedger);
      setParentConfig(remote.parentConfig); setTasks(mergeById(remote.tasks || [], tasks, true)); setShop((current) => unlockPaidItems(mergeShopUnlocks(mergeShopItemsWithCatalog(remote.shop), current), syncedLedger));
      setWorld(syncedWorld); setBonuses(mergeById(remote.bonuses || [], bonuses)); setVoiceMessages(combinedMessages); setVideos(combinedVideos); setActivityLog(combinedActivityLog);
      setActiveChildDevice(remote.activeChildDevice ?? null);
      syncReadyRef.current = true;
      setCloudStatus('Eşitlendi ✓');
    } catch (error) {
      dirtyRef.current = true;
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

  const handleSwitchAccount = async () => {
    setIsInviteAdmin(false);
    if (isCloudConfigured) {
      try { await signOutAdult(); } catch (error) { setCloudStatus(getCloudErrorMessage(error, 'Hesaptan çıkış yapılamadı.')); }
    }
    setAdultUser(null);
    setActiveChildDevice(undefined);
    localStorage.removeItem(VERIFIED_UID_KEY);
    setVerifiedUid('');
  };

  // Süreli davetle katılan hesabın süresi bitince bu cihaz çıkış yapar ve
  // giriş ekranında "erişim süresi doldu" der (bulut kuralları da erişimi kapatır).
  useEffect(() => {
    if (!accessUntil) return;
    const check = () => {
      if (Date.now() < accessUntil) return;
      try { localStorage.setItem(ACCESS_ENDED_KEY, '1'); } catch { /* yoksay */ }
      forgetAdultName(getCurrentUid());
      setAccessUntil(null);
      void handleSwitchAccount();
    };
    check();
    const timer = window.setInterval(check, 60 * 1000);
    document.addEventListener('visibilitychange', check);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessUntil]);

  const handleJoinFamily = async (code: string) => {
    const normalized = saveFamilyCode(code);
    if (!(await familyExists(normalized))) throw new Error('Bu davet bağlantısı geçersiz veya kapatılmış.');
    await acceptFamilyInvite(normalized);
    // Yeni aile verisi gelene kadar bu cihazdaki eski verinin yeni aileyi
    // ezmesini engelle. Önce yalnızca buluttaki aile kaydı okunur.
    syncReadyRef.current = false;
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
      prev.map((t) => (t.id === taskId ? { ...t, status: 'pending_approval', completedAt, updatedAt: stampAfter(t.updatedAt) } : t))
    );
    logActivity('task_complete', task.title, 'Çocuk görevi tamamladı; ebeveyn onayı bekleniyor.', {
      taskId,
      dateKey: getLocalDateKey(completedAt),
      scheduledTaskCount: tasks.filter((item) => !item.isExtra && !item.deletedAt).length,
    });
  };

  const handleApproveTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status !== 'pending_approval') return;
    const now = new Date().toISOString();
    const todayKey = getLocalDateKey(now);

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'completed', approvedAt: now, updatedAt: stampAfter(t.updatedAt) } : t))
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
      scheduledTaskCount: tasks.filter((item) => !item.isExtra && !item.deletedAt).length,
    });
  };

  const handleApproveAllTasks = () => {
    const pending = tasks.filter((t) => t.status === 'pending_approval' && !t.deletedAt);
    if (pending.length === 0) return;

    const totalReward = pending.reduce((sum, t) => sum + t.rewardCoins, 0);
    const now = new Date().toISOString();
    const todayKey = getLocalDateKey(now);

    setTasks((prev) =>
      prev.map((t) => (t.status === 'pending_approval' && !t.deletedAt ? { ...t, status: 'completed', approvedAt: now, updatedAt: stampAfter(t.updatedAt) } : t))
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
        scheduledTaskCount: tasks.filter((item) => !item.isExtra && !item.deletedAt).length,
      });
    });
  };

  const handleRejectTask = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    const now = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'todo', completedAt: undefined, approvedAt: undefined, updatedAt: stampAfter(t.updatedAt) } : t)));
    if (task) logActivity('task_rejected', task.title, 'Ebeveyn görevi yeniden yapılmak üzere geri gönderdi.', {
      taskId,
      dateKey: getLocalDateKey(),
      scheduledTaskCount: tasks.filter((item) => !item.isExtra && !item.deletedAt).length,
    });
  };

  const handleReactivateTask = (taskId: string) => {
    const todayKey = getLocalDateKey();
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId && isRoutineTask(t) ? { ...reopenRoutineTask(t), updatedAt: stampAfter(t.updatedAt) } : t))
    );
    setUser((prev) => ({ ...prev, lastTaskResetDate: todayKey }));
  };

  const handleReactivateAllRoutineTasks = () => {
    const todayKey = getLocalDateKey();
    const now = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (isRoutineTask(t) && t.status === 'completed' ? { ...reopenRoutineTask(t), updatedAt: stampAfter(t.updatedAt) } : t)));
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

  // Silinen görev listeden atılmaz, "silindi" olarak işaretlenir. Aksi halde
  // diğer cihazlardaki kopya bir sonraki eşitlemede görevi geri getiriyordu.
  const handleDeleteTask = (taskId: string) => {
    const now = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, deletedAt: now, updatedAt: stampAfter(t.updatedAt) } : t)));
  };

  // Shop & Inventory Handlers
  const handleBuyItem = (itemId: string, price: number) => {
    const item = shop.find((s) => s.id === itemId);
    // Gerçek ödüller (dondurma, park...) tekrar tekrar alınabilir: kilit açılmaz,
    // her alış defterde ayrı bir kayıt olur. Diğer ürünler bir kez alınır.
    const repeatable = item?.type === 'real_reward';
    if (!item || (!repeatable && item.unlocked) || !Number.isFinite(price) || price < 0 || user.coins < price) return;
    setUser((prev) => ({ ...prev, coins: prev.coins - price }));
    if (!repeatable) {
      setShop((prev) => prev.map((entry) => (entry.id === itemId ? { ...entry, unlocked: true, updatedAt: stampAfter(entry.updatedAt) } : entry)));
    }
    appendCoinLedger({ id: repeatable ? `purchase-${itemId}-${Date.now()}` : `purchase-${itemId}`, type: 'purchase', coinDelta: -price, referenceId: itemId });
    logActivity('purchase', item.name || itemId, `-${price} puan`);
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
    setWorld((prev) => prev.map((item) => item.id === placedId ? { ...item, deletedAt: new Date().toISOString(), updatedAt: stampAfter(item.updatedAt) } : item));
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
    setBonuses((prev) => prev.map((b) => (b.id === bonusId ? { ...b, claimed: true, updatedAt: stampAfter(b.updatedAt) } : b)));
    setUser((prev) => ({ ...prev, coins: prev.coins + bonus.coins }));
    appendCoinLedger({ id: `bonus-reward-${bonusId}`, type: 'bonus_reward', coinDelta: bonus.coins, referenceId: bonusId });
  };

  // Öğren sekmesinde her doğru cevapta çağrılır; her 10 doğruda 1 puan verir.
  // Hareket kimliği gün + o günkü puan sırasıdır: iki cihaz aynı anda 10.
  // doğruya ulaşsa bile puan bir kez sayılır.
  const handleLearnCorrect = () => {
    const todayKey = getLocalDateKey();
    const isToday = user.learnDateKey === todayKey;
    const answers = (isToday ? user.learnAnswersToday ?? 0 : 0) + 1;
    const coinsToday = isToday ? user.learnCoinsToday ?? 0 : 0;
    const earnsCoin = answers % LEARN_ANSWERS_PER_COIN === 0;
    setUser((prev) => ({
      ...prev,
      coins: prev.coins + (earnsCoin ? 1 : 0),
      learnDateKey: todayKey,
      learnAnswersToday: answers,
      learnCoinsToday: coinsToday + (earnsCoin ? 1 : 0),
    }));
    if (earnsCoin) {
      appendCoinLedger({ id: `learn-reward-${todayKey}-${coinsToday + 1}`, type: 'learn_reward', coinDelta: 1 });
    }
  };
  const learnAnswersToday = user.learnDateKey === getLocalDateKey() ? user.learnAnswersToday ?? 0 : 0;

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
    dirtyRef.current = true;
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
    dirtyRef.current = true;

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
    dirtyRef.current = true;
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
    dirtyRef.current = true;
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
    // Kaldırmak yerine işaretle: diğer cihazlar da silindiğini öğrensin.
    const deletedAt = new Date().toISOString();
    setVoiceMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deletedAt, audioUrl: undefined, isNew: false } : m)));
  };

  const openVoiceModal = (initialTab: 'inbox' | 'record' = 'inbox', role: 'child' | 'parent' = 'child') => {
    setVoiceModalInitialTab(initialTab);
    setVoiceSenderRole(role);
    setIsJournalMode(false);
    setIsVoiceModalOpen(true);
  };

  const openJournal = (initialTab: 'inbox' | 'record' = 'inbox') => {
    setVoiceModalInitialTab(initialTab);
    setVoiceSenderRole('child');
    setIsJournalMode(true);
    setIsVoiceModalOpen(true);
  };

  const handleJournalSaved = () => {
    const journalTask = tasks.find((task) => task.id === 'task-8');
    if (journalTask?.status === 'todo') handleMarkTaskDone('task-8');
  };

  // Silinmiş olarak işaretlenen görevler eşitleme için listede kalır ama hiçbir ekranda görünmez.
  // Rutin görevlerin resmi her zaman bu sürümün şablonundan gelir: eşitlemeyle
  // eski bir resim adresi gelse bile ekranda güncel çizim görünür (kayda yazılmaz).
  const liveTasks = tasks
    .filter((task) => !task.deletedAt)
    .map((task) => {
      const templateImage = routineTaskTemplates.get(task.id)?.imageUrl;
      return templateImage && templateImage !== task.imageUrl ? { ...task, imageUrl: templateImage } : task;
    });
  const dailyProgress = buildDailyProgress(liveTasks, activityLog);
  const calculatedStreak = calculateCurrentStreak(dailyProgress);
  const weeklyStats = weeklyCompletion(dailyProgress);

  useEffect(() => {
    if (user.currentStreak !== calculatedStreak) {
      setUser((prev) => prev.currentStreak === calculatedStreak ? prev : { ...prev, currentStreak: calculatedStreak });
    }
  }, [calculatedStreak, user.currentStreak]);

  const completedCount = liveTasks.filter((t) => t.status === 'completed').length;
  const pendingCount = liveTasks.filter((t) => t.status === 'pending_approval').length;
  const liveVoiceMessages = voiceMessages.filter((m) => !m.deletedAt);
  // Son iki haftada alınan gerçek ödüller: ebeveyn panelinde "verilecek" diye görünür.
  const realRewardById = new Map(mergeShopItemsWithCatalog(shop).filter((item) => item.type === 'real_reward').map((item) => [item.id, item]));
  const recentRewards = coinLedger
    .filter((entry) => entry.type === 'purchase' && entry.referenceId && realRewardById.has(entry.referenceId)
      && Date.now() - Date.parse(entry.createdAt) < 14 * 24 * 60 * 60 * 1000)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
    .map((entry) => ({ id: entry.id, name: realRewardById.get(entry.referenceId!)!.name, icon: realRewardById.get(entry.referenceId!)!.icon, createdAt: entry.createdAt }));
  const unreadVoiceCount = liveVoiceMessages.filter((m) => m.isNew && m.sender !== 'child').length;
  const unclaimedBonus = bonuses.find((b) => !b.claimed) || null;

  if (isCloudConfigured && !authChecked) {
    return <main className="min-h-screen bg-[#EAF5F7]" aria-busy="true" />;
  }

  // Cihaz yalnızca izinli bir yetişkin hesabıyla açıkken ve aileye bağlıyken
  // oyunu gösterir. Eski anonim "çocuk olarak devam" cihazları bir kez giriş ister.
  if (isCloudConfigured && !(sessionReady && familyCode)) {
    return (
      <AuthGate
        getLocalFamilyData={currentFamilyData}
        onReady={(code, familyData) => {
          saveFamilyCode(code);
          setFamilyCode(code);
          const uid = getCurrentUid();
          localStorage.setItem(VERIFIED_UID_KEY, uid);
          // Davetle katılan kişi izin listesinde değil; adı aile kaydından gelir.
          const invitedName = familyData.adultNames?.[uid];
          if (invitedName) setAdultUser((current) => current ?? { uid, name: invitedName });
          setIsInviteAdmin(Boolean(familyData.adminUids?.includes(uid)));
          setAccessUntil(familyData.memberExpiry?.[uid] || null);
          const syncedLedger = familyData.coinLedger || [];
          setUser({ ...INITIAL_USER, ...familyData.user, coins: calculateLedgerBalance(syncedLedger, familyData.user.coins) });
          setParentConfig(familyData.parentConfig || INITIAL_PARENT);
          setTasks(familyData.tasks || INITIAL_TASKS);
          setShop(unlockPaidItems(mergeShopItemsWithCatalog(familyData.shop || INITIAL_SHOP), syncedLedger));
          setWorld(familyData.world || INITIAL_WORLD);
          setBonuses(familyData.bonuses || INITIAL_BONUSES);
          setVoiceMessages(familyData.voiceMessages || INITIAL_VOICE_MESSAGES);
          setVideos(familyData.videos || INITIAL_VIDEOS);
          setActivityLog(familyData.activityLog || []);
          setCoinLedger(syncedLedger);
          setActiveChildDevice(familyData.activeChildDevice ?? null);
          setVerifiedUid(uid);
        }}
      />
    );
  }

  return (
    <ChildShell
      user={user}
      activeTab={activeTab}
      onChangeTab={handleChangeTab}
      doneTodayCount={completedCount + pendingCount}
      unreadVoiceCount={unreadVoiceCount}
      onOpenVoice={() => openVoiceModal('inbox')}
      onOpenParent={() => setIsParentModalOpen(true)}
      coinBump={user.coins}
    >
      <div className="relative">
        {/* Main Content Body */}
          {activeTab === 'tasks' && (
            <TasksHome
              key={tabResetKey}
              tasks={liveTasks}
              onMarkTaskDone={handleMarkTaskDone}
              onOpenJournal={() => openJournal('record')}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
              caregiver={activeChildDevice?.setByName || adultUser?.name || null}
            />
          )}

          {activeTab === 'learn' && (
            <LearnView
              key={tabResetKey}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
              syllableGameLevels={user.syllableGameLevels}
              onCorrectAnswer={handleLearnCorrect}
              answersTowardNextCoin={learnAnswersToday % LEARN_ANSWERS_PER_COIN}
              answersPerCoin={LEARN_ANSWERS_PER_COIN}
            />
          )}

          {activeTab === 'world' && (
            <TrainWorldView
              key={tabResetKey}
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
              key={tabResetKey}
              shopItems={shop}
              user={user}
              onBuyItem={handleBuyItem}
              onSetActiveTrain={handleSetActiveTrain}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
            />
          )}

          {activeTab === 'videos' && (
            <VideosView
              key={tabResetKey}
              videos={videos}
              parentConfig={parentConfig}
              onVideoStarted={handleVideoStarted}
            />
          )}

        {/* Parent Engine Room Modal */}
        <ParentModal
          isOpen={isParentModalOpen}
          onClose={() => setIsParentModalOpen(false)}
          tasks={liveTasks}
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
          onOpenVoiceModal={() => openVoiceModal('inbox', 'parent')}
          videos={videos}
          onAddVideo={handleAddVideo}
          onDeleteVideo={handleDeleteVideo}
          cloudConfigured={cloudEnabled && isCloudConfigured}
          cloudStatus={cloudStatus}
          familyCode={familyCode}
          onCreateFamily={handleCreateFamily}
          onJoinFamily={handleJoinFamily}
          onCreateInvite={familyCode && isInviteAdmin ? (name, days) => createJoinInvite(familyCode, name, days) : undefined}
          activityLog={activityLog}
          voiceMessages={liveVoiceMessages}
          recentRewards={recentRewards}
          deviceControls={{
            adultName: adultUser?.name,
            accessUntil,
            onToggleSound: handleToggleSound,
            onManualSync: () => void handleManualSync(),
            isSyncing: isManualSyncing,
            onSwitchAccount: adultUser ? () => void handleSwitchAccount() : undefined,
            isActiveDevice: activeChildDevice?.deviceId === deviceIdRef.current,
            activeDeviceLabel: activeChildDevice?.label || activeChildDevice?.setByName,
            onSetActiveDevice: (checked) => void handleSetActiveChildDevice(checked),
          }}
          weeklyStats={weeklyStats}
          onApproveVideo={handleApproveVideo}
          onBlockVideo={handleBlockVideo}
        />

        {/* Voice Messages Modal */}
        <VoiceMessagesModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          messages={liveVoiceMessages}
          onSendMessage={handleSendVoiceMessage}
          senderRole={voiceSenderRole}
          senderName={voiceSenderRole === 'parent' ? (adultUser?.name || 'Baba') : (user.name || 'Rüzgar')}
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

      </div>
    </ChildShell>
  );
}
