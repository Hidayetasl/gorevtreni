import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { BonusCard, ParentConfig, PlacedWorldItem, RoutineTask, ShopItem, StoryVideo, UserProfile, VoiceMessage } from '../types';

const FAMILY_CODE_KEY = 'ruzgar_family_code_v1';
// Tek oyun, tek ortak aile odası: davet kodu veya hesap kurulumu gerekmez.
const SIMPLE_FAMILY_CODE = 'RUZGARORTAK2026';
// Davet başka cihazda açılacağı için yerel geliştirme adresi (localhost) asla
// paylaşılmaz. Bu uygulamanın herkesçe erişilen tek giriş noktası budur.
const PUBLIC_APP_URL = 'https://hidayetasl.github.io/ruzgar-rutin-oyunu/';
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'] as const;

const firebaseConfig = {
  // Firebase web configuration is public client metadata. Access is protected by
  // the Firestore/Storage rules and the random family code, never by this API key.
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyACur9bQng3tiiQ-ieoOKadcDJhuqaPncg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ruzgar-rutin-oyunu-2026.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ruzgar-rutin-oyunu-2026',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ruzgar-rutin-oyunu-2026.firebasestorage.app',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:590256889024:web:d8b6aa531c7f1d078d6125',
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
};

export const isCloudConfigured = requiredKeys.every((key) => Boolean(firebaseConfig[key]));

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
  if (!services.auth.currentUser) await signInAnonymously(services.auth);
  return services;
}

export function getFamilyCode() {
  // Eski denemelerdeki ayrı aile kodları cihazları bölüyordu. Bu sade sürümde
  // uygulamayı açan bütün aile cihazları aynı ortak odayı kullanır.
  localStorage.setItem(FAMILY_CODE_KEY, SIMPLE_FAMILY_CODE);
  return SIMPLE_FAMILY_CODE;
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

async function moveAudioToStorage(code: string, messages: VoiceMessage[]) {
  const { storage } = await getServices();
  return Promise.all(messages.map(async (message) => {
    if (!message.audioUrl?.startsWith('data:audio/')) return message;
    try {
      const storageRef = ref(storage, `families/${code}/voice/${message.id}.webm`);
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
  const videos = new Map<string, StoryVideo>();
  for (const video of remote) videos.set(video.id, video);
  for (const video of local) videos.set(video.id, { ...videos.get(video.id), ...video });
  return [...videos.values()];
}

export async function uploadFamilyData(code: string, data: FamilyData) {
  const normalized = saveFamilyCode(code);
  await getServices();
  // Önce buluttaki sesli notları alıp yeni yerel notlarla birleştiriyoruz.
  // Bu, anne ve babanın aynı anda yolladığı notların kaybolmasını engeller.
  const existing = await getDoc(familyRef(normalized));
  const remoteMessages = existing.exists()
    ? ((existing.data().voiceMessages || []) as VoiceMessage[])
    : [];
  const remoteVideos = existing.exists()
    ? ((existing.data().videos || []) as StoryVideo[])
    : [];
  const voiceMessages = await moveAudioToStorage(
    normalized,
    mergeVoiceMessages(remoteMessages, data.voiceMessages),
  );
  const videos = mergeVideos(remoteVideos, data.videos);
  await setDoc(familyRef(normalized), { ...data, voiceMessages, videos, updatedAt: Date.now(), schemaVersion: 1 }, { merge: false });
}

export async function familyExists(code: string) {
  await getServices();
  return (await getDoc(familyRef(code))).exists();
}

export async function subscribeToFamily(code: string, onData: (data: FamilyData) => void, onError: (message: string) => void) {
  await getServices();
  return onSnapshot(familyRef(code), { includeMetadataChanges: true }, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data() as FamilyData;
    if (data.user && data.tasks && data.shop) onData(data);
  }, (error) => onError(error.message));
}
