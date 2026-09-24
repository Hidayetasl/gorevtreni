/**
 * Eşitlemenin saf birleştirme kuralları (Firebase'e bağlı değil). Her cihaz
 * buluttaki kopya ile kendi kopyasını bu kurallarla birleştirir; testleri
 * scripts/test-sync.ts içinde.
 */
import type { ActivityLogEntry, CoinLedgerEntry, ShopItem, StoryVideo, VoiceMessage } from '../types';
import { mergeVideosById } from './videoOrder';

/**
 * Bir kaydın yeni sürümü, üzerine kurulduğu sürümden her zaman daha yeni
 * damgalanır. Saati geri kalmış bir cihazın yaptığı onay/işaretleme,
 * birleştirmede "eski" sayılıp kaybolmaz.
 */
export function stampAfter(previous?: string) {
  const prev = Date.parse(previous || '');
  return new Date(Math.max(Date.now(), Number.isFinite(prev) ? prev + 1 : 0)).toISOString();
}

/** Alan sırasından ve boş (undefined/null) alanlardan bağımsız içerik karşılaştırması. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined && (value as Record<string, unknown>)[key] !== null)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Buluttaki ve bu cihazdaki sesli mesajları birleştirir. Bulutta olmayan yerel
 * mesajlar eklenir; bir tarafta silinmiş (deletedAt) mesaj silinmiş kalır ki
 * silinen mesaj bir sonraki eşitlemede geri gelmesin.
 */
export function combineVoiceMessages(remote: VoiceMessage[], local: VoiceMessage[]) {
  const localById = new Map(local.map((message) => [message.id, message]));
  const combined = remote.map((message) => {
    const mine = localById.get(message.id);
    const deletedAt = message.deletedAt || mine?.deletedAt;
    return deletedAt && !message.deletedAt ? { ...message, deletedAt, audioUrl: undefined, isNew: false } : message;
  });
  for (const message of local) {
    if (!remote.some((remoteMessage) => remoteMessage.id === message.id)) combined.push(message);
  }
  return combined;
}

/**
 * Birleştirme sonucunda buluttakinden içerik olarak farklı (yerelden gelen) bir
 * kayıt kaldı mı? Kimlik değil içerik karşılaştırılır; aksi halde aynı veriyi
 * taşıyan iki kopya "farklı" sayılıp cihazlar birbirine sonsuz kez yazıyordu.
 */
export function mergeKeptLocal<T extends { id: string }>(remote: T[] = [], merged: T[] = []) {
  if (remote.length !== merged.length) return true;
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  return merged.some((item) => {
    const remoteItem = remoteById.get(item.id);
    return remoteItem !== item && stableStringify(remoteItem) !== stableStringify(item);
  });
}


/**
 * Uygulamanın diğer verileri tek aile belgesinde duruyor. İki telefon aynı
 * anda eşitlerken eski bir kopyanın yeni sesli notları silmesini önlemek için
 * sesli not listesini kimliğine göre birleştiriyoruz.
 */
export function mergeVoiceMessages(remote: VoiceMessage[], local: VoiceMessage[]) {
  const messages = new Map<string, VoiceMessage>();
  for (const message of remote) messages.set(message.id, message);
  for (const message of local) {
    const existing = messages.get(message.id);
    // Storage'a daha önce çıkmış indirme adresini, yerel data: URL ile geri
    // ezme. Böylece diğer telefonlar gerçek ses dosyasını dinleyebilir.
    const remoteAudio = existing?.audioUrl?.startsWith('http') ? existing.audioUrl : undefined;
    // Silme her iki taraftan da kalıcıdır: bir cihaz silmişse mesaj geri gelmez.
    const deletedAt = message.deletedAt || existing?.deletedAt;
    messages.set(message.id, deletedAt
      ? { ...existing, ...message, deletedAt, audioUrl: undefined, isNew: false }
      : { ...existing, ...message, audioUrl: remoteAudio ?? message.audioUrl ?? existing?.audioUrl });
  }
  return [...messages.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Video ekleme işlemi de iki cihazdan gelebilir. Eski bir telefonun boş/önceki
// listesi, Mac'te yeni eklenen videoyu artık silemez.
export function mergeVideos(remote: StoryVideo[], local: StoryVideo[]) {
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
  // Gerçek ödüller tekrar alınabilir; onların kilidi hiç açılmaz.
  const shouldUnlock = (item: ShopItem) => !item.unlocked && item.type !== 'real_reward' && paid.has(item.id);
  if (!shop.some(shouldUnlock)) return shop;
  return shop.map((item) => (shouldUnlock(item) ? { ...item, unlocked: true } : item));
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
export function mergeActivityLog(remote: ActivityLogEntry[] = [], local: ActivityLogEntry[] = []) {
  const entries = new Map<string, ActivityLogEntry>();
  for (const entry of remote) entries.set(entry.id, entry);
  for (const entry of local) entries.set(entry.id, entry);
  return [...entries.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 300);
}

