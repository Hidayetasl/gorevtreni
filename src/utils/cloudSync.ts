import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { arrayUnion, connectFirestoreEmulator, disableNetwork, enableNetwork, doc, getDoc, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { ActivityLogEntry, ActiveChildDevice, AdultName, BonusCard, CoinLedgerEntry, ParentConfig, PlacedWorldItem, RoutineTask, ShopItem, StoryVideo, UserProfile, VoiceMessage } from '../types';
import { mergeVideosById } from './videoOrder';

const FAMILY_CODE_KEY = 'ruzgar_family_code_v1';
const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || (
  typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''
);
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'] as const;

// Yerel geliştirmede Firebase emülatörleri kullanılır; canlı projeye hiçbir
// istek gitmez. "demo-" ile başlayan proje kimliği emülatör dışına çıkamaz.
export const usesEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

const firebaseConfig = usesEmulators
  ? {
      apiKey: 'demo-key',
      authDomain: 'demo-gorevtreni.firebaseapp.com',
      projectId: 'demo-gorevtreni',
      storageBucket: 'demo-gorevtreni.appspot.com',
      appId: '1:000000000000:web:demo',
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };

// Emülatörde izinli yetişkin hesapları sabit test e-postalarıdır.
const testEmail = (name: string) => (usesEmulators ? `${name}@test.com` : '');

export type FamilyData = {
  user: UserProfile;
  parentConfig: ParentConfig;
  tasks: RoutineTask[];
  shop: ShopItem[];
  world: PlacedWorldItem[];
  bonuses: BonusCard[];
  voiceMessages: VoiceMessage[];
  videos: StoryVideo[];
  activityLog?: ActivityLogEntry[];
  coinLedger?: CoinLedgerEntry[];
  ownerUid?: string;
  memberUids?: string[];
  inviteEnabled?: boolean;
  /** `undefined` korunur, `null` ise kullanıcı tarafından temizlenir. */
  activeChildDevice?: ActiveChildDevice | null;
};

const adultAccountConfig: Array<{ name: AdultName; email: string; uid: string }> = [
  {
    name: 'Baba',
    email: (import.meta.env.VITE_FIREBASE_BABA_EMAIL || testEmail('baba')).trim().toLowerCase(),
    uid: (import.meta.env.VITE_FIREBASE_BABA_UID || '').trim(),
  },
  {
    name: 'Anne',
    email: (import.meta.env.VITE_FIREBASE_ANNE_EMAIL || testEmail('anne')).trim().toLowerCase(),
    uid: (import.meta.env.VITE_FIREBASE_ANNE_UID || '').trim(),
  },
  {
    name: 'Anneanne',
    email: (import.meta.env.VITE_FIREBASE_ANNEANNE_EMAIL || testEmail('anneanne')).trim().toLowerCase(),
    uid: (import.meta.env.VITE_FIREBASE_ANNEANNE_UID || '').trim(),
  },
];

export const isCloudConfigured = requiredKeys.every((key) => Boolean(firebaseConfig[key]?.trim()));

function firebaseAuth() {
  if (!isCloudConfigured) throw new Error('Firebase yapılandırması eksik.');
  services ??= createServices();
  return services.auth;
}

/** Auth hesabını sabit UID/e-posta eşleştirmesiyle doğrular. */
export function getAdultName(user: User | null): AdultName | null {
  if (!user) return null;
  const hasExplicitMapping = adultAccountConfig.some((account) => account.uid || account.email);
  const configuredMatch = adultAccountConfig.find((account) => (
    (account.uid && account.uid === user.uid)
    || (account.email && account.email === (user.email || '').trim().toLowerCase())
  ));
  if (configuredMatch) return configuredMatch.name;
  if (hasExplicitMapping) return null;

  // İlk kurulumda UID env değerleri henüz eklenmemişse Firebase Console'daki
  // displayName alanları geçici/uyumlu bir fallback olarak kullanılabilir.
  const displayName = user.displayName?.trim();
  return displayName === 'Baba' || displayName === 'Anne' || displayName === 'Anneanne'
    ? displayName
    : null;
}

export function subscribeToAuth(
  onUser: (user: User | null) => void,
  onError?: (error: Error) => void,
) {
  const auth = firebaseAuth();
  return onAuthStateChanged(auth, onUser, onError);
}

export async function signInAdult(email: string, password: string) {
  const auth = firebaseAuth();
  const credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
  const adultName = getAdultName(credentials.user);
  if (!adultName) {
    await signOut(auth);
    throw new Error('Bu Firebase hesabı izinli yetişkin hesaplarından biri değil.');
  }
  return credentials.user;
}

/** Şu an giriş yapmış hesabın kimliği (yoksa boş). */
export function getCurrentUid() {
  return isCloudConfigured ? firebaseAuth().currentUser?.uid || '' : '';
}

export async function signOutAdult() {
  await signOut(firebaseAuth());
}

export async function resetAdultPassword(email: string) {
  await sendPasswordResetEmail(firebaseAuth(), email.trim());
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'E-posta adresi geçerli görünmüyor.',
  'auth/missing-password': 'Şifre yazın.',
  'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  'auth/invalid-login-credentials': 'E-posta veya şifre hatalı.',
  'auth/wrong-password': 'E-posta veya şifre hatalı.',
  'auth/user-not-found': 'E-posta veya şifre hatalı.',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.',
  'auth/network-request-failed': 'İnternet bağlantısı yok. Bağlantıyı kontrol edip tekrar deneyin.',
};

/** Firebase hata kodlarını ebeveynin anlayacağı Türkçe cümlelere çevirir. */
export function describeAuthError(error: unknown) {
  const code = (error as { code?: string })?.code || '';
  if (AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  if (code === 'permission-denied') return 'Bu aileye erişim izni yok. Aileden yeni bir davet bağlantısı isteyin.';
  return error instanceof Error ? error.message : 'Bir sorun oluştu. Tekrar deneyin.';
}

let services: ReturnType<typeof createServices> | null = null;
function createServices() {
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const auth = getAuth(app);
  const storage = getStorage(app);
  if (usesEmulators) {
    const host = window.location.hostname;
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectStorageEmulator(storage, host, 9199);
    // Yalnızca yerel testte (canlı derlemede hiç oluşmaz): bir cihazın gerçek bir
    // kesinti yaşamasını taklit eder. Canlı dinleme kapanır, tüm ağ istekleri
    // (Firestore yazma çağrıları dahil) reddedilir ve tarayıcı çevrimdışı görünür.
    let offline = false;
    const realFetch = window.fetch.bind(window);
    window.fetch = (...args: Parameters<typeof fetch>) => (offline ? Promise.reject(new TypeError('Failed to fetch')) : realFetch(...args));
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !offline });
    (window as unknown as { __gtTest?: object }).__gtTest = {
      offline: async () => { offline = true; await disableNetwork(db); window.dispatchEvent(new Event('offline')); },
      online: async () => { offline = false; await enableNetwork(db); window.dispatchEvent(new Event('online')); },
    };
  }
  return { auth, db, storage };
}

/**
 * Aile verisine yalnızca izinli yetişkin hesabıyla giriş yapılmış cihazlar
 * erişir. Anonim oturum kullanılmaz; çocuk, yetişkinin açtığı cihazda oynar.
 */
async function getServices() {
  if (!isCloudConfigured) throw new Error('Firebase yapılandırması eksik.');
  services ??= createServices();
  await services.auth.authStateReady();
  const user = services.auth.currentUser;
  if (!user || user.isAnonymous) throw new Error('Oturum kapalı. Lütfen yetişkin hesabıyla tekrar giriş yapın.');
  return services;
}

export function getFamilyCode() {
  return localStorage.getItem(FAMILY_CODE_KEY) || '';
}

/** WhatsApp ile gönderilebilen davet bağlantısından aile kodunu okur. */
export function getInviteFamilyCode() {
  if (typeof window === 'undefined') return '';
  const code = new URLSearchParams(window.location.search).get('aile') || '';
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Aynı uygulama adresinde, aile kodunu otomatik taşıyan güvenli davet bağlantısı. */
export function getFamilyInviteLink(code: string) {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return '';
  if (!PUBLIC_APP_URL) return '';
  const url = new URL(PUBLIC_APP_URL);
  url.searchParams.set('aile', normalized);
  return url.toString();
}

export function createFamilyCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  localStorage.setItem(FAMILY_CODE_KEY, code);
  return code;
}

export function saveFamilyCode(code: string) {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < 8) throw new Error('Aile kodu en az 8 karakter olmalı.');
  localStorage.setItem(FAMILY_CODE_KEY, normalized);
  return normalized;
}

function familyRef(code: string) {
  return doc(services!.db, 'families', code);
}

function familyInviteRef(code: string) {
  return doc(services!.db, 'familyInvites', code);
}

function adultProfileRef(uid: string) {
  return doc(services!.db, 'users', uid);
}

/** Hesabın bağlı olduğu aile kodu; yeni bir cihazda kod yazmadan aileyi bulmak için. */
export async function getAdultFamilyCode() {
  const { auth } = await getServices();
  const snapshot = await getDoc(adultProfileRef(auth.currentUser!.uid));
  return snapshot.exists() ? String(snapshot.data().familyCode || '') : '';
}

async function rememberAdultFamily(code: string) {
  const { auth } = await getServices();
  await setDoc(adultProfileRef(auth.currentUser!.uid), { familyCode: code, updatedAt: Date.now() }, { merge: true });
}

/** Aile PIN'i tüm cihazlarda ortaktır; yalnızca giriş yapmış yetişkin değiştirir. */
export async function setFamilyPinHash(code: string, pinHash: string) {
  await getServices();
  await updateDoc(familyRef(code), { 'parentConfig.pinHash': pinHash, updatedAt: Date.now() });
}

/** İlk yetişkin, bu cihazdaki oyun verisiyle yeni bir aile kaydı açar. */
export async function createFamily(data: FamilyData) {
  const code = createFamilyCode();
  await uploadFamilyData(code, data);
  await rememberAdultFamily(code);
  return code;
}

async function moveAudioToStorage(code: string, messages: VoiceMessage[]) {
  const { storage } = await getServices();
  return Promise.all(messages.map(async (message) => {
    if (!message.audioUrl?.startsWith('data:audio/')) return message;
    try {
      // Keep the recording's original format. Safari normally creates MP4/AAC,
      // while Chrome/Android normally creates WebM/Opus. Giving an iPhone MP4
      // bytes a .webm name/content type is a common reason for silent playback.
      const mimeType = message.audioUrl.match(/^data:(audio\/[^;,]+)/i)?.[1]?.toLowerCase() || 'audio/webm';
      const extension = mimeType.includes('mp4') || mimeType.includes('aac')
        ? 'm4a'
        : mimeType.includes('wav')
          ? 'wav'
        : mimeType.includes('ogg')
          ? 'ogg'
          : mimeType.includes('mpeg')
            ? 'mp3'
            : 'webm';
      const storageRef = ref(storage, `families/${code}/voice/${message.id}.${extension}`);
      await uploadString(storageRef, message.audioUrl, 'data_url');
      return { ...message, audioUrl: await getDownloadURL(storageRef) };
    } catch (error) {
      // A ses dosyası yüklenemese bile metaverisini Firestore'a göndermek çok
      // önemli: aksi durumda tek bir kayıt tüm aile eşitlemesini durduruyordu.
      // data: URL'i Firestore belgesine yazılamaz (belge boyutu sınırını aşar).
      console.warn('Ses dosyası yüklenemedi; sesli not metaverisi eşitleniyor.', error);
      return { ...message, audioUrl: undefined };
    }
  }));
}

/**
 * Uygulamanın diğer verileri tek aile belgesinde duruyor. İki telefon aynı
 * anda eşitlerken eski bir kopyanın yeni sesli notları silmesini önlemek için
 * sesli not listesini kimliğine göre birleştiriyoruz.
 */
function mergeVoiceMessages(remote: VoiceMessage[], local: VoiceMessage[]) {
  const messages = new Map<string, VoiceMessage>();
  for (const message of remote) messages.set(message.id, message);
  for (const message of local) {
    const existing = messages.get(message.id);
    // Storage'a daha önce çıkmış indirme adresini, yerel data: URL ile geri
    // ezme. Böylece diğer telefonlar gerçek ses dosyasını dinleyebilir.
    const remoteAudio = existing?.audioUrl?.startsWith('http') ? existing.audioUrl : undefined;
    messages.set(message.id, { ...existing, ...message, audioUrl: remoteAudio ?? message.audioUrl ?? existing?.audioUrl });
  }
  return [...messages.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Video ekleme işlemi de iki cihazdan gelebilir. Eski bir telefonun boş/önceki
// listesi, Mac'te yeni eklenen videoyu artık silemez.
function mergeVideos(remote: StoryVideo[], local: StoryVideo[]) {
  return mergeVideosById(remote, local);
}

export function mergeById<T extends { id: string; updatedAt?: string; deletedAt?: string }>(remote: T[] = [], local: T[] = [], includeDeleted = false) {
  const entries = new Map<string, T>();
  const timestamp = (value?: string) => {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  };
  for (const entry of remote) entries.set(entry.id, entry);
  for (const entry of local) {
    const existing = entries.get(entry.id);
    if (!existing || timestamp(entry.updatedAt) >= timestamp(existing.updatedAt)) entries.set(entry.id, entry);
  }
  return [...entries.values()].filter((entry) => includeDeleted || !entry.deletedAt);
}

/**
 * Mağaza ürünleri: satın alma geri alınmaz. Bir ürün bulutta ya da bu cihazda
 * "alındı" ise alınmış sayılır; eski bir cihazın kopyası (ya da zaman damgası
 * kaybolmuş bir kayıt) satın alınmış bir ürünü asla yeniden kilitleyemez.
 */
export function mergeShopUnlocks(remote: ShopItem[] = [], local: ShopItem[] = []): ShopItem[] {
  const localById = new Map(local.map((item) => [item.id, item]));
  const result = remote.map((item) => {
    const mine = localById.get(item.id);
    if (!mine) return item;
    localById.delete(item.id);
    const unlocked = Boolean(item.unlocked || mine.unlocked);
    const updatedAt = [item.updatedAt, mine.updatedAt].filter(Boolean).sort().pop();
    return { ...item, unlocked, ...(updatedAt ? { updatedAt } : {}) };
  });
  return [...result, ...localById.values()];
}

/**
 * Puan defterinde parası ödenmiş (`purchase-<ürün>`) ama kilitli görünen ürünleri
 * açar. Eski sürümdeki eşitleme hatası yüzünden kaybolmuş satın almalar, canlı
 * veriye geçildiğinde böylece kendiliğinden geri gelir. Değişiklik yoksa aynı
 * diziyi döndürür.
 */
export function unlockPaidItems(shop: ShopItem[], ledger: CoinLedgerEntry[] = []): ShopItem[] {
  const paid = new Set(
    ledger
      .filter((entry) => entry.type === 'purchase' && entry.coinDelta < 0)
      .map((entry) => entry.referenceId || entry.id.replace(/^purchase-/, '')),
  );
  if (!shop.some((item) => !item.unlocked && paid.has(item.id))) return shop;
  return shop.map((item) => (!item.unlocked && paid.has(item.id) ? { ...item, unlocked: true } : item));
}

/**
 * Puan hareketleri değişmez kayıtlardır. Aynı kimlikte iki kayıt varsa buluttaki
 * kazanır; böylece bir cihazın kendi "başlangıç bakiyesi" kopyası ailenin
 * bakiyesini asla ezemez. Yalnızca bulutta olmayan yeni hareketler eklenir.
 */
export function mergeCoinLedger(remote: CoinLedgerEntry[] = [], local: CoinLedgerEntry[] = []) {
  const entries = new Map<string, CoinLedgerEntry>();
  for (const entry of local) entries.set(entry.id, entry);
  for (const entry of remote) entries.set(entry.id, entry);
  return [...entries.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Etkinlik geçmişi (uygulama açılışı, görev onayı, satın alma) kimliğe göre
// birleştirilir; hiçbir cihaz diğerinin kaydını manuel/otomatik eşitlemede silemez.
function mergeActivityLog(remote: ActivityLogEntry[] = [], local: ActivityLogEntry[] = []) {
  const entries = new Map<string, ActivityLogEntry>();
  for (const entry of remote) entries.set(entry.id, entry);
  for (const entry of local) entries.set(entry.id, entry);
  return [...entries.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 300);
}

function removeUndefinedFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const cleaned = removeUndefinedFields(item);
      return cleaned === undefined ? null : cleaned;
    });
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefinedFields(entryValue)]),
    );
  }

  return value;
}

export async function uploadFamilyData(code: string, data: FamilyData) {
  const normalized = saveFamilyCode(code);
  const services = await getServices();
  const uid = services.auth.currentUser?.uid;
  if (!uid) throw new Error('Firebase kullanıcı oturumu bulunamadı.');

  // Sesleri transaction dışında Storage'a taşırız; Firestore transaction yalnızca
  // küçük metadata ve aile belgesi üzerinde çalışır.
  const localMessages = await moveAudioToStorage(normalized, data.voiceMessages);
  let ownerUid = uid;
  let createdAt = Date.now();

  await runTransaction(services.db, async (transaction) => {
    const reference = familyRef(normalized);
    const snapshot = await transaction.get(reference);
    const remoteData = snapshot.exists() ? snapshot.data() as Partial<FamilyData> & { createdAt?: number } : {};
    ownerUid = remoteData.ownerUid || uid;
    createdAt = remoteData.createdAt || createdAt;
    const memberUids = [...new Set([...(Array.isArray(remoteData.memberUids) ? remoteData.memberUids : []), uid])];
    // Aile PIN'i ortak tutulur. PIN'i olmayan (eski/yeni) bir cihazın yazması
    // buluttaki PIN'i asla silmez; PIN yalnızca açıkça değiştirilince güncellenir.
    const remotePinHash = (remoteData.parentConfig as ParentConfig | undefined)?.pinHash;
    const payload = removeUndefinedFields({
      ...data,
      parentConfig: { ...data.parentConfig, pinHash: data.parentConfig.pinHash || remotePinHash },
      // Silinen görevlerin "silindi" işareti de saklanır; yoksa başka bir cihaz görevi geri getirir.
      tasks: mergeById((remoteData.tasks || []) as RoutineTask[], data.tasks, true),
      shop: mergeShopUnlocks((remoteData.shop || []) as ShopItem[], data.shop),
      bonuses: mergeById((remoteData.bonuses || []) as BonusCard[], data.bonuses),
      world: mergeById((remoteData.world || []) as PlacedWorldItem[], data.world, true),
      voiceMessages: mergeVoiceMessages((remoteData.voiceMessages || []) as VoiceMessage[], localMessages),
      videos: mergeVideos((remoteData.videos || []) as StoryVideo[], data.videos),
      activityLog: mergeActivityLog((remoteData.activityLog || []) as ActivityLogEntry[], data.activityLog),
      coinLedger: mergeCoinLedger((remoteData.coinLedger || []) as CoinLedgerEntry[], data.coinLedger),
      // Eski/ilgili bir upload aktif cihaz alanı taşımıyorsa uzak değeri koru;
      // checkbox temizleme işlemi ise açıkça `null` gönderir.
      activeChildDevice: data.activeChildDevice === undefined
        ? (remoteData.activeChildDevice || null)
        : data.activeChildDevice,
      ownerUid,
      memberUids,
      inviteEnabled: true,
      updatedAt: Date.now(),
      schemaVersion: 3,
    });
    transaction.set(reference, payload, { merge: false });
  });

  // Davet kaydını yalnızca aile sahibi yazabilir (kural gereği). Eskiden her
  // üye bunu denediği için sahibi olmayan cihazların her yüklemesi, aile
  // verisi yazıldığı halde "başarısız" sayılıyor ve durum "Çevrimdışı" kalıyordu.
  if (ownerUid !== uid) return;
  await setDoc(familyInviteRef(normalized), removeUndefinedFields({
    familyCode: normalized,
    ownerUid,
    inviteEnabled: true,
    createdAt,
    updatedAt: Date.now(),
  }), { merge: true });
}

export async function acceptFamilyInvite(code: string) {
  const normalized = saveFamilyCode(code);
  const services = await getServices();
  const uid = services.auth.currentUser?.uid;
  if (!uid) throw new Error('Firebase kullanıcı oturumu bulunamadı.');
  const invite = await getDoc(familyInviteRef(normalized));
  if (!invite.exists() || invite.data().inviteEnabled !== true) throw new Error('Davet bağlantısı geçersiz veya kapatılmış.');
  // Üye olmayan hesap aile kaydını okuyamaz (kural gereği). Bu yüzden önce
  // okumayı deneriz: okunabiliyorsa zaten üyedir; okunamıyorsa kendini ekler.
  // Eskiden okuma katılımdan önce yapıldığı için yeni cihazlar hiç katılamıyordu.
  let alreadyMember = false;
  try {
    const familySnapshot = await getDoc(familyRef(normalized));
    if (!familySnapshot.exists()) throw new Error('Bu aile kaydı bulunamadı.');
    const existingMembers = familySnapshot.data().memberUids;
    alreadyMember = familySnapshot.data().ownerUid === uid || (Array.isArray(existingMembers) && existingMembers.includes(uid));
  } catch (error) {
    if ((error as { code?: string })?.code !== 'permission-denied') throw error;
  }
  if (!alreadyMember) await updateDoc(familyRef(normalized), { memberUids: arrayUnion(uid), updatedAt: Date.now() });
  await rememberAdultFamily(normalized);
  return true;
}

export async function familyExists(code: string) {
  const normalized = saveFamilyCode(code);
  await getServices();
  return (await getDoc(familyInviteRef(normalized))).exists();
}

export async function getFamilyData(code: string) {
  const normalized = saveFamilyCode(code);
  await getServices();
  const snapshot = await getDoc(familyRef(normalized));
  return snapshot.exists() ? (snapshot.data() as FamilyData) : null;
}

export async function subscribeToFamily(
  code: string,
  onData: (data: FamilyData, metadata: { fromCache: boolean; hasPendingWrites: boolean }) => void,
  onError: (message: string) => void,
) {
  await getServices();
  return onSnapshot(familyRef(code), { includeMetadataChanges: true }, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data() as FamilyData;
    if (data.user && data.tasks && data.shop) {
      onData(data, {
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      });
    }
  }, (error) => onError(error.message));
}
