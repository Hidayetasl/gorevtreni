/**
 * Eşitleme birleştirme kurallarının testleri: iki cihaz (ya da cihaz + bulut)
 * farklı kopyalar taşıdığında sonucun doğru olduğunu doğrular.
 * Çalıştırma: npm run test:sync
 */
import { strict as assert } from 'node:assert';
import type { CoinLedgerEntry, RoutineTask, ShopItem, VoiceMessage } from '../src/types';
import {
  combineVoiceMessages,
  mergeById,
  mergeCoinLedger,
  mergeKeptLocal,
  mergeShopUnlocks,
  mergeVoiceMessages,
  stableStringify,
  stampAfter,
  unlockPaidItems,
} from '../src/utils/syncMerge';

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

const item = (id: string, unlocked: boolean, extra: Partial<ShopItem> = {}): ShopItem => ({
  id, name: id, category: 'scenery', price: 10, icon: '⭐', description: '', unlocked, type: 'decoration', ...extra,
});
const msg = (id: string, extra: Partial<VoiceMessage> = {}): VoiceMessage => ({
  id, sender: 'parent', senderName: 'Baba', transcript: '', durationSeconds: 3, createdAt: '2026-09-24T10:00:00.000Z', isNew: true, ...extra,
});
const task = (id: string, extra: Partial<RoutineTask> = {}): RoutineTask => ({
  id, title: id, description: '', icon: '⭐', rewardCoins: 2, timeOfDay: 'morning', status: 'todo', ...extra,
});
const ledger = (id: string, coinDelta: number, extra: Partial<CoinLedgerEntry> = {}): CoinLedgerEntry => ({
  id, type: 'purchase', coinDelta, createdAt: '2026-09-24T10:00:00.000Z', ...extra,
});

// --- Mağaza: satın alma geri alınmaz ---
test('eski cihazın kopyası satın alınmış ürünü yeniden kilitleyemez', () => {
  const cloud = [item('cow', true, { updatedAt: '2026-09-24T13:49:00.000Z' })];
  const staleDevice = [item('cow', false)];
  assert.equal(mergeShopUnlocks(cloud, staleDevice)[0].unlocked, true);
  assert.equal(mergeShopUnlocks(staleDevice, cloud)[0].unlocked, true);
});

test('mağaza birleştirmesi daha yeni zaman damgasını korur', () => {
  const merged = mergeShopUnlocks([item('a', true, { updatedAt: '2026-09-24T10:00:00.000Z' })], [item('a', true, { updatedAt: '2026-09-24T11:00:00.000Z' })]);
  assert.equal(merged[0].updatedAt, '2026-09-24T11:00:00.000Z');
});

test('parası ödenmiş ama kilitli kalmış ürün defterden geri açılır', () => {
  const shop = [item('cow', false), item('tree', false)];
  const repaired = unlockPaidItems(shop, [ledger('purchase-cow', -10, { referenceId: 'cow' })]);
  assert.equal(repaired.find((i) => i.id === 'cow')?.unlocked, true);
  assert.equal(repaired.find((i) => i.id === 'tree')?.unlocked, false);
});

test('onarım: referenceId olmayan eski defter kaydı da tanınır', () => {
  assert.equal(unlockPaidItems([item('cow', false)], [ledger('purchase-cow', -10)])[0].unlocked, true);
});

test('onarım: değişiklik yoksa aynı dizi döner (gereksiz yazma olmaz)', () => {
  const shop = [item('cow', true)];
  assert.equal(unlockPaidItems(shop, [ledger('purchase-cow', -10, { referenceId: 'cow' })]), shop);
});

test('gerçek ödüller defterde olsa da kilitlenmez/açılmaz (tekrar alınabilir)', () => {
  const reward = item('icecream', false, { type: 'real_reward', category: 'rewards' });
  const out = unlockPaidItems([reward], [ledger('purchase-icecream-1', -24, { referenceId: 'icecream' })]);
  assert.equal(out[0].unlocked, false);
});

// --- Puan defteri ---
test('aynı defter kaydı iki kopyada olsa bile bir kez sayılır', () => {
  const merged = mergeCoinLedger([ledger('purchase-cow', -10)], [ledger('purchase-cow', -10), ledger('task-1', 2, { type: 'task_reward' })]);
  assert.equal(merged.length, 2);
});

test('defterde aynı kimlikte buluttaki kayıt kazanır', () => {
  const merged = mergeCoinLedger([ledger('x', -10)], [ledger('x', -99)]);
  assert.equal(merged[0].coinDelta, -10);
});

test('tekrar alınan gerçek ödülün her alışı ayrı sayılır', () => {
  const merged = mergeCoinLedger([ledger('purchase-icecream-1', -24)], [ledger('purchase-icecream-2', -24)]);
  assert.equal(merged.reduce((sum, e) => sum + e.coinDelta, 0), -48);
});

// --- Görevler: silme ve saat kayması ---
test('silinen görev diğer cihazın eski kopyasıyla geri gelmez', () => {
  const cloud = [task('t1', { deletedAt: '2026-09-24T16:50:00.000Z', updatedAt: '2026-09-24T16:50:00.001Z' })];
  const oldPhone = [task('t1', { updatedAt: '2026-09-24T09:00:00.000Z' })];
  const merged = mergeById(cloud, oldPhone, true);
  assert.ok(merged[0].deletedAt);
  assert.equal(mergeById(cloud, oldPhone).length, 0);
});

test('saati geri kalmış cihazın yeni onayı yine de daha yeni damgalanır', () => {
  const previous = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // başka cihaz 2 saat ileride
  assert.ok(Date.parse(stampAfter(previous)) > Date.parse(previous));
});

// --- Sesli mesajlar: silme ---
test('bu cihazda silinen mesaj buluttan geri gelmez', () => {
  const cloud = [msg('m1', { audioUrl: 'http://x/a.wav' })];
  const local = [msg('m1', { deletedAt: '2026-09-24T17:00:00.000Z' })];
  const combined = combineVoiceMessages(cloud, local);
  assert.ok(combined[0].deletedAt);
  assert.equal(combined[0].audioUrl, undefined);
});

test('başka cihazda silinen mesaj bu cihazda da silinir', () => {
  const combined = combineVoiceMessages([msg('m1', { deletedAt: '2026-09-24T17:00:00.000Z' })], [msg('m1')]);
  assert.ok(combined[0].deletedAt);
});

test('buluta yazarken silme işareti korunur, ses adresi geri gelmez', () => {
  const merged = mergeVoiceMessages([msg('m1', { audioUrl: 'http://x/a.wav' })], [msg('m1', { deletedAt: '2026-09-24T17:00:00.000Z' })]);
  assert.ok(merged[0].deletedAt);
  assert.equal(merged[0].audioUrl, undefined);
});

test('buluta henüz gitmemiş yerel mesaj kaybolmaz', () => {
  const combined = combineVoiceMessages([msg('m1')], [msg('m1'), msg('m2')]);
  assert.deepEqual(combined.map((m) => m.id).sort(), ['m1', 'm2']);
});

test('buluttaki yüklenmiş ses adresi yerel data: adresiyle ezilmez', () => {
  const merged = mergeVoiceMessages([msg('m1', { audioUrl: 'http://x/a.wav' })], [msg('m1', { audioUrl: 'data:audio/wav;base64,AAA' })]);
  assert.equal(merged[0].audioUrl, 'http://x/a.wav');
});

// --- Sonsuz yazma döngüsü koruması ---
test('alan sırası farklı ama içerik aynı kopyalar "farklı" sayılmaz', () => {
  assert.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
  assert.equal(stableStringify({ a: 1, c: undefined }), stableStringify({ a: 1 }));
  assert.equal(mergeKeptLocal([{ id: 'x', a: 1, b: 2 }], [{ id: 'x', b: 2, a: 1 }]), false);
});

test('gerçek yerel değişiklik "gönderilecek" olarak algılanır', () => {
  assert.equal(mergeKeptLocal([{ id: 'x', a: 1 }], [{ id: 'x', a: 2 }]), true);
  assert.equal(mergeKeptLocal([{ id: 'x' }], [{ id: 'x' }, { id: 'y' }]), true);
});

console.log(`\n${passed} eşitleme testi geçti`);
