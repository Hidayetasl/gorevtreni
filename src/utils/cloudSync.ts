import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { BonusCard, ParentConfig, PlacedWorldItem, RoutineTask, ShopItem, StoryVideo, UserProfile, VoiceMessage } from '../types';

const FAMILY_CODE_KEY = 'ruzgar_family_code_v1';
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
  return localStorage.getItem(FAMILY_CODE_KEY) || '';
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
    const storageRef = ref(storage, `families/${code}/voice/${message.id}.webm`);
    await uploadString(storageRef, message.audioUrl, 'data_url');
    return { ...message, audioUrl: await getDownloadURL(storageRef) };
  }));
}

export async function uploadFamilyData(code: string, data: FamilyData) {
  const normalized = saveFamilyCode(code);
  await getServices();
  const voiceMessages = await moveAudioToStorage(normalized, data.voiceMessages);
  await setDoc(familyRef(normalized), { ...data, voiceMessages, updatedAt: Date.now(), schemaVersion: 1 }, { merge: false });
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
