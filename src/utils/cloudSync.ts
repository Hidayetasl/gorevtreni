import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { arrayUnion, doc, getDoc, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { ActivityLogEntry, ActiveChildDevice, AdultName, BonusCard, CoinLedgerEntry, ParentConfig, PlacedWorldItem, RoutineTask, ShopItem, StoryVideo, UserProfile, VoiceMessage } from '../types';
import { mergeVideosById } from './videoOrder';

const FAMILY_CODE_KEY = 'ruzgar_family_code_v1';
const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || (
  typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''
);
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'] as const;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

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
    email: (import.meta.env.VITE_FIREBASE_BABA_EMAIL || '').trim().toLowerCase(),
    uid: (import.meta.env.VITE_FIREBASE_BABA_UID || '').trim(),
  },
  {
    name: 'Anne',
    email: (import.meta.env.VITE_FIREBASE_ANNE_EMAIL || '').trim().toLowerCase(),
    uid: (import.meta.env.VITE_FIREBASE_ANNE_UID || '').trim(),
  },
  {
    name: 'Anneanne',
    email: (import.meta.env.VITE_FIREBASE_ANNEANNE_EMAIL || '').trim().toLowerCase(),
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

export async function signOutAdult() {
  await signOut(firebaseAuth());
}

export async function ensureAnonymousAuth() {
  const auth = firebaseAuth();
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser;
}

let services: ReturnType<typeof createServices> | null = null;
function createServices() {
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return { auth: getAuth(app), db, storage: getStorage(app) };
}

async function getServices() {
  if (!isCloudConfigured) throw new Error('Firebase yapılandırması eksik.');
  services ??= createServices();
  await ensureAnonymousAuth();
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

function mergeCoinLedger(remote: CoinLedgerEntry[] = [], local: CoinLedgerEntry[] = []) {
  const entries = new Map<string, CoinLedgerEntry>();
  for (const entry of [...remote, ...local]) entries.set(entry.id, entry);
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
    const { pinHash: _localPinHash, ...sharedParentConfig } = data.parentConfig;
    const payload = removeUndefinedFields({
      ...data,
      parentConfig: sharedParentConfig,
      tasks: mergeById((remoteData.tasks || []) as RoutineTask[], data.tasks),
      shop: mergeById((remoteData.shop || []) as ShopItem[], data.shop),
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
  const familySnapshot = await getDoc(familyRef(normalized));
  if (!familySnapshot.exists()) throw new Error('Bu aile kaydı bulunamadı.');
  const existingMembers = familySnapshot.data().memberUids;
  // Zaten üye olan cihazlarda tekrar yazma yapma; Firestore kuralı yalnızca
  // yeni bir UID eklendiğinde bu güncellemeye izin verir.
  if (Array.isArray(existingMembers) && existingMembers.includes(uid)) return true;
  await updateDoc(familyRef(normalized), { memberUids: arrayUnion(uid), updatedAt: Date.now() });
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
