import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updatePassword, type User } from 'firebase/auth';
import { arrayUnion, connectFirestoreEmulator, disableNetwork, enableNetwork, doc, getDoc, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, runTransaction, setDoc, updateDoc, writeBatch, deleteField } from 'firebase/firestore';
import { connectStorageEmulator, deleteObject, getMetadata, getStorage, listAll, ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { ActivityLogEntry, ActiveChildDevice, AdultName, BonusCard, CoinLedgerEntry, ParentConfig, PlacedWorldItem, RoutineTask, ShopItem, StoryVideo, UserProfile, VoiceMessage } from '../types';
import { mergeActivityLog, mergeById, mergeCoinLedger, mergeShopUnlocks, mergeVideos, mergeVoiceMessages } from './syncMerge';
// Uygulama bu birleştirme kurallarını cloudSync üzerinden de kullanır.
export { mergeById, mergeCoinLedger, mergeShopUnlocks, unlockPaidItems } from './syncMerge';

const FAMILY_CODE_KEY = 'ruzgar_family_code_v1';
/** Davetle katılan yetişkinlerin adı (uid → ad); bu cihaz bir sonraki açılışta tanısın diye. */
const ADULT_NAMES_KEY = 'ruzgar_adult_names_v1';
/** Tek kullanımlık davet linkinin geçerlilik süresi. */
export const JOIN_INVITE_DAYS = 7;
/** Süreli erişimi biten cihaz, giriş ekranında bunu söylesin diye. */
export const ACCESS_ENDED_KEY = 'ruzgar_access_ended_v1';
/** Sesli mesaj alanı: Firebase'in ücretsiz depolama sınırı ve uyarı eşiği. */
export const VOICE_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
export const VOICE_STORAGE_WARN_RATIO = 0.8;
/** Süreli davette en uzun erişim (gün). */
export const MAX_ACCESS_DAYS = 365;
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
      // GitHub gizli değerlerinin sonunda kalan satır sonu (\n) giriş adresini bozar.
      apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
      authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
      projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
      storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
      appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
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
  /** Davetle katılan yetişkinlerin adı (uid → ad). */
  adultNames?: Record<string, string>;
  /** Davet oluşturabilen hesaplar (yalnızca aile yöneticisi). */
  adminUids?: string[];
  /** Süreli davetle katılanların erişim bitişi (uid → ms). */
  memberExpiry?: Record<string, number>;
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

function readAdultNames(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(ADULT_NAMES_KEY) || '{}') || {}; } catch { return {}; }
}

/** Davetle katılan yetişkinin adını bu cihazda hatırlar. */
export function rememberAdultName(uid: string, name: string) {
  try { localStorage.setItem(ADULT_NAMES_KEY, JSON.stringify({ ...readAdultNames(), [uid]: name })); } catch { /* yoksay */ }
}

/** Süresi biten davetli bu cihazda artık tanınmaz; yeniden katılmak için yeni davet gerekir. */
export function forgetAdultName(uid: string) {
  const names = readAdultNames();
  delete names[uid];
  try { localStorage.setItem(ADULT_NAMES_KEY, JSON.stringify(names)); } catch { /* yoksay */ }
}

/** İzinli listedeki ad ya da daha önce davetle bu cihazda katılmış yetişkinin adı. */
export function getKnownAdultName(user: User | null): AdultName | null {
  if (!user || user.isAnonymous) return null;
  return getAdultName(user) || readAdultNames()[user.uid] || null;
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

/**
 * Google hesabıyla giriş. İzin listesi e-postaya göre aynı (Baba/Anne/Anneanne).
 * Açılır pencere engellenirse yönlendirmeyle devam edilir; o durumda null döner
 * ve sonuç sayfa geri yüklenince completeGoogleRedirect ile alınır.
 */
export async function signInAdultWithGoogle(): Promise<User | null> {
  const auth = firebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let user: User;
  try {
    user = (await signInWithPopup(auth, provider)).user;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
  // Davet linkiyle gelen kişi izin listesinde olmayabilir; aileye erişimi
  // davetin kendisi (güvenlik kuralları) belirler. Daha önce davetle katılmış
  // kişi yeni bir telefonda da aile kaydındaki adıyla tanınır.
  if (!getKnownAdultName(user) && !getJoinInviteToken() && !(await recallInvitedAdult(user.uid))) {
    await signOut(auth);
    throw new Error(`${user.email || 'Bu Google hesabı'} bu aileye bağlı değil. Aileden bir davet linki isteyin.`);
  }
  return user;
}

/** Yönlendirmeli Google girişi döndüğünde hatayı yakalar (başarı onAuthStateChanged ile gelir). */
export async function completeGoogleRedirect() {
  const result = await getRedirectResult(firebaseAuth());
  if (result?.user && !getKnownAdultName(result.user) && !getJoinInviteToken() && !(await recallInvitedAdult(result.user.uid))) {
    await signOut(firebaseAuth());
    throw new Error(`${result.user.email || 'Bu Google hesabı'} bu aileye bağlı değil. Aileden bir davet linki isteyin.`);
  }
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

/** Giriş yapmış yetişkinin şifresini değiştirir (girişten hemen sonra çağrılmalı). */
export async function changeAdultPassword(newPassword: string) {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error('Oturum bulunamadı. Yeniden giriş yapın.');
  await updatePassword(user, newPassword);
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'E-posta adresi geçerli görünmüyor.',
  'auth/missing-password': 'Şifre yazın.',
  'auth/requires-recent-login': 'Güvenlik için yeniden giriş yapmanız gerekiyor.',
  'auth/popup-closed-by-user': 'Google penceresi kapatıldı. Tekrar deneyin.',
  'auth/cancelled-popup-request': 'Google penceresi kapatıldı. Tekrar deneyin.',
  'auth/unauthorized-domain': 'Bu adres Firebase’de yetkili değil (Authorized domains).',
  'auth/operation-not-allowed': 'Bu giriş yöntemi Firebase’de henüz açık değil.',
  'auth/account-exists-with-different-credential': 'Bu e-posta başka bir giriş yöntemiyle kayıtlı. E-posta ve şifreyle deneyin.',
  'auth/weak-password': 'Bu şifre çok zayıf. En az 8 karakter, harf ve rakam kullanın.',
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

function joinInviteRef(token: string) {
  return doc(services!.db, 'familyJoinInvites', token);
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

/** Ailenin ses klasöründeki gerçek dosyaların toplam boyutu (silinmişlerden kalanlar dahil). */
export async function getVoiceStorageUsage(code: string) {
  const { storage } = await getServices();
  const list = await listAll(ref(storage, `families/${code}/voice`));
  const sizes = await Promise.all(list.items.map((item) => getMetadata(item).then((meta) => meta.size).catch(() => 0)));
  return { bytes: sizes.reduce((sum, size) => sum + size, 0), files: list.items.length };
}

/** Silinen mesajın ses dosyasını depodan da kaldırır (yer açılsın). Hata olursa sessizce geçer. */
export async function deleteVoiceFile(url?: string) {
  if (!url || url.startsWith('data:')) return;
  try {
    const { storage } = await getServices();
    await deleteObject(ref(storage, url));
  } catch { /* dosya zaten yoksa ya da çevrimdışıysa mesaj yine silinmiş sayılır */ }
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
    if (message.deletedAt || !message.audioUrl?.startsWith('data:audio/')) return message;
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
      // Davetle katılanların adları başka cihazın yazmasıyla silinmesin.
      adultNames: { ...((remoteData.adultNames as Record<string, string> | undefined) || {}), ...(data.adultNames || {}) },
      // Yönetici ve erişim süreleri yalnızca buluttan gelir; cihazlar değiştiremez.
      // Yeni kurulan ailede kuran kişi yönetici olur.
      adminUids: snapshot.exists() ? remoteData.adminUids : [uid],
      memberExpiry: remoteData.memberExpiry,
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

/** Davetle katılmış yetişkinin adını hesabının ailesinden bulur ve bu cihazda hatırlar. */
async function recallInvitedAdult(uid: string) {
  try {
    const services = await getServices();
    const profile = await getDoc(doc(services.db, 'users', uid));
    const code = profile.exists() ? String(profile.data().familyCode || '') : '';
    if (!code) return '';
    const family = await getDoc(doc(services.db, 'families', code));
    const name = family.exists() ? String((family.data().adultNames || {})[uid] || '') : '';
    if (name) rememberAdultName(uid, name);
    return name;
  } catch {
    return '';
  }
}

/** ?davet=... ile açılan tek kullanımlık davet. */
export function getJoinInviteToken() {
  if (typeof window === 'undefined') return '';
  return (new URLSearchParams(window.location.search).get('davet') || '').replace(/[^A-Za-z0-9]/g, '');
}

/**
 * Aile üyesi, belirli bir kişi için tek kullanımlık davet linki üretir
 * (7 gün geçerli). Link açılıp Google ile girilince o kişi aileye katılır.
 */
export async function createJoinInvite(code: string, name: string, accessDays = 0) {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanName = name.trim().slice(0, 24);
  if (!normalized || !cleanName) throw new Error('Davet için kişinin adı gerekli.');
  const days = Math.round(accessDays);
  if (!Number.isFinite(days) || days < 0 || days > MAX_ACCESS_DAYS) throw new Error(`Süre 1 ile ${MAX_ACCESS_DAYS} gün arasında olmalı (ya da süresiz).`);
  const services = await getServices();
  const uid = services.auth.currentUser?.uid;
  if (!uid) throw new Error('Firebase kullanıcı oturumu bulunamadı.');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => alphabet[byte % alphabet.length]).join('');
  const now = Date.now();
  await setDoc(joinInviteRef(token), {
    familyCode: normalized,
    name: cleanName,
    createdBy: uid,
    createdAt: now,
    expiresAt: now + JOIN_INVITE_DAYS * 24 * 60 * 60 * 1000,
    accessDays: days,
    usedBy: null,
    usedAt: null,
  });
  const url = new URL(PUBLIC_APP_URL || window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('davet', token);
  return url.toString();
}

/**
 * Tek kullanımlık daveti kabul eder: davet "kullanıldı" işaretlenir ve kişi
 * adıyla aileye eklenir — ikisi aynı anda (güvenlik kuralı ikisini birlikte ister).
 */
export async function acceptJoinInvite(token: string) {
  const services = await getServices();
  const uid = services.auth.currentUser?.uid;
  if (!uid) throw new Error('Firebase kullanıcı oturumu bulunamadı.');
  const snapshot = await getDoc(joinInviteRef(token));
  if (!snapshot.exists()) throw new Error('Bu davet linki geçersiz. Aileden yeni bir link isteyin.');
  const invite = snapshot.data() as { familyCode: string; name: string; expiresAt: number; accessDays?: number; usedBy: string | null };
  if (invite.usedBy && invite.usedBy !== uid) throw new Error('Bu davet linki daha önce kullanılmış. Aileden yeni bir link isteyin.');
  if (!invite.usedBy && invite.expiresAt < Date.now()) throw new Error('Bu davet linkinin süresi dolmuş. Aileden yeni bir link isteyin.');
  const code = saveFamilyCode(invite.familyCode);
  if (!invite.usedBy) {
    const batch = writeBatch(services.db);
    batch.update(joinInviteRef(token), { usedBy: uid, usedAt: Date.now() });
    batch.update(familyRef(code), {
      memberUids: arrayUnion(uid),
      [`adultNames.${uid}`]: invite.name,
      // Süreli davet: erişim katılınca başlar; süresizse eski bir süre kaldırılır.
      [`memberExpiry.${uid}`]: invite.accessDays ? Date.now() + invite.accessDays * 24 * 60 * 60 * 1000 : deleteField(),
      joinInvite: token,
      updatedAt: Date.now(),
    });
    await batch.commit();
  }
  rememberAdultName(uid, invite.name);
  await rememberAdultFamily(code);
  return { code, name: invite.name };
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
