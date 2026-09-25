/**
 * Tek kullanımlık davet kurallarının testleri (Firestore emülatörüne karşı).
 * Önce emülatörü başlatın: npm run emulators — sonra: npm run test:invite
 */
import { strict as assert } from 'node:assert';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { arrayUnion, connectFirestoreEmulator, deleteField, doc, getDoc, getFirestore, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';

const PROJECT = 'demo-gorevtreni';
const RUN = Date.now().toString(36);
const FAMILY = `TEST${RUN.toUpperCase()}`.replace(/[^A-Z0-9]/g, '');
const apps: FirebaseApp[] = [];

async function asUser(name: string) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` }, `${name}-${RUN}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const idToken = JSON.stringify({ sub: `${name}-${RUN}`, email: `${name}-${RUN}@example.com`, email_verified: true });
  const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return { db, uid: user.uid };
}

const token = (label: string) => `${label}${RUN}xxxxxxxxxxxxxxxxxxxxxxxx`.replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
const invite = (db: Firestore, t: string) => doc(db, 'familyJoinInvites', t);
const family = (db: Firestore) => doc(db, 'families', FAMILY);
const day = 24 * 60 * 60 * 1000;

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
}
async function denied(promise: Promise<unknown>) {
  try { await promise; } catch (error) {
    assert.equal((error as { code?: string }).code, 'permission-denied');
    return;
  }
  assert.fail('izin verilmemeliydi');
}

// Uygulamanın acceptJoinInvite'ı ile aynı toplu yazma.
async function join(db: Firestore, uid: string, t: string, name: string, accessDays = 0) {
  const batch = writeBatch(db);
  batch.update(invite(db, t), { usedBy: uid, usedAt: Date.now() });
  batch.update(family(db), {
    memberUids: arrayUnion(uid), [`adultNames.${uid}`]: name, joinInvite: t, updatedAt: Date.now(),
    [`memberExpiry.${uid}`]: accessDays ? Date.now() + accessDays * day : deleteField(),
  });
  await batch.commit();
}

// Emülatörde kuralları atlayan yönetici yazması (yalnızca test kurulumu için).
async function adminPatch(fields: Record<string, unknown>) {
  const mask = Object.keys(fields).map((key) => `updateMask.fieldPaths=${key}`).join('&');
  const toValue = (value: unknown): unknown => typeof value === 'number' ? { integerValue: String(value) }
    : typeof value === 'string' ? { stringValue: value }
    : { mapValue: { fields: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toValue(v)])) } };
  const response = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/families/${FAMILY}?${mask}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) }),
  });
  assert.ok(response.ok, await response.text());
}

async function main() {
  const baba = await asUser('baba');
  const dede = await asUser('dede');
  const yabanci = await asUser('yabanci');

  await setDoc(family(baba.db), { ownerUid: baba.uid, memberUids: [baba.uid], adminUids: [baba.uid], inviteEnabled: false, user: { coins: 10 }, updatedAt: Date.now() });
  // Canlıdaki gibi: aile sahibi eski anonim cihaz; Baba yalnızca üye + yönetici.
  await adminPatch({ ownerUid: 'eski-anonim-cihaz' });
  const newInvite = (t: string, extra: Record<string, unknown> = {}) => setDoc(invite(baba.db, t), {
    familyCode: FAMILY, name: 'Dede', createdBy: baba.uid, createdAt: Date.now(), expiresAt: Date.now() + 7 * day, accessDays: 0, usedBy: null, usedAt: null, ...extra,
  });

  await test('aile yöneticisi davet oluşturabilir', () => newInvite(token('ok')));

  await test('aileden olmayan davet oluşturamaz', () => denied(setDoc(invite(yabanci.db, token('kotu')), {
    familyCode: FAMILY, name: 'Hırsız', createdBy: yabanci.uid, createdAt: Date.now(), expiresAt: Date.now() + day, accessDays: 0, usedBy: null, usedAt: null,
  })));

  await test('davet 8 günden uzun olamaz', () => denied(newInvite(token('uzun'), { expiresAt: Date.now() + 30 * day })));

  await test('davetsiz kimse aileyi okuyamaz', () => denied(getDoc(family(dede.db))));

  await test('davetle katılım: davet kullanıldı + kişi adıyla aileye eklenir', async () => {
    await join(dede.db, dede.uid, token('ok'), 'Dede');
    const data = (await getDoc(family(dede.db))).data()!;
    assert.ok(data.memberUids.includes(dede.uid));
    assert.equal(data.adultNames[dede.uid], 'Dede');
  });

  await test('kullanılmış davet ikinci kez kullanılamaz', () => denied(join(yabanci.db, yabanci.uid, token('ok'), 'Dede')));

  await test('davet kullanıldı işaretlenmeden aileye girilemez', () => denied(updateDoc(family(yabanci.db), {
    memberUids: arrayUnion(yabanci.uid), [`adultNames.${yabanci.uid}`]: 'Dede', joinInvite: token('ok'), updatedAt: Date.now(),
  })));

  await newInvite(token('ad'));
  await test('davetteki addan başka ad yazılamaz', () => denied(join(yabanci.db, yabanci.uid, token('ad'), 'Baba')));

  await newInvite(token('eski'), { expiresAt: Date.now() - 1000 });
  await test('süresi dolmuş davet kullanılamaz', () => denied(join(yabanci.db, yabanci.uid, token('eski'), 'Dede')));

  await newInvite(token('coklu'));
  await test('davetle katılan başkasının adını değiştiremez', async () => {
    const batch = writeBatch(yabanci.db);
    batch.update(invite(yabanci.db, token('coklu')), { usedBy: yabanci.uid, usedAt: Date.now() });
    batch.update(family(yabanci.db), { memberUids: arrayUnion(yabanci.uid), [`adultNames.${yabanci.uid}`]: 'Dede', [`adultNames.${baba.uid}`]: 'Yabancı', joinInvite: token('coklu'), updatedAt: Date.now() });
    await denied(batch.commit());
  });

  await test('aynı davet doğru adla çalışır (ret sebebi yalnızca ad)', () => join(yabanci.db, yabanci.uid, token('ad'), 'Dede'));

  await test('yeni üye aile verisini güncelleyebilir (eşitleme)', () => updateDoc(family(dede.db), { 'user.coins': 11, updatedAt: Date.now() }));

  await test('eşitlemedeki tam yazma (merge:false) yönetici/süre alanlarını koruyarak geçer', async () => {
    const remote = (await getDoc(family(baba.db))).data()!;
    const { joinInvite: _dropped, ...rest } = remote;
    await setDoc(family(baba.db), { ...rest, user: { coins: 12 }, updatedAt: Date.now() }, { merge: false });
  });

  // --- Yalnızca yönetici davet eder ---
  await test('aile üyesi (yönetici değil) davet oluşturamaz', () => denied(setDoc(invite(dede.db, token('uye')), {
    familyCode: FAMILY, name: 'Teyze', createdBy: dede.uid, createdAt: Date.now(), expiresAt: Date.now() + day, accessDays: 0, usedBy: null, usedAt: null,
  })));
  await test('üye kendini yönetici yapamaz', () => denied(updateDoc(family(dede.db), { adminUids: arrayUnion(dede.uid), updatedAt: Date.now() })));

  // --- Süreli erişim ---
  const teyze = await asUser('teyze');
  await newInvite(token('sureli'), { name: 'Teyze', accessDays: 4 });
  await test('4 günlük davetle katılım: erişim bitişi 4 gün sonra', async () => {
    await join(teyze.db, teyze.uid, token('sureli'), 'Teyze', 4);
    const data = (await getDoc(family(teyze.db))).data()!;
    const left = data.memberExpiry[teyze.uid] - Date.now();
    assert.ok(left > 4 * day - 60000 && left <= 4 * day);
  });
  await test('süreli üye kendi süresini uzatamaz', () => denied(updateDoc(family(teyze.db), { [`memberExpiry.${teyze.uid}`]: Date.now() + 365 * day, updatedAt: Date.now() })));
  await newInvite(token('hile'), { name: 'Teyze', accessDays: 2 });
  await test('davette 2 gün yazıyorsa 30 gün yazılamaz', () => denied(join(teyze.db, teyze.uid, token('hile'), 'Teyze', 30)));
  await test('davet 365 günden uzun erişim veremez', () => denied(newInvite(token('yil'), { accessDays: 400 })));

  await adminPatch({ [`memberExpiry`]: { [teyze.uid]: Date.now() - 1000 } });
  await test('süresi biten üye aileyi okuyamaz', () => denied(getDoc(family(teyze.db))));
  await test('süresi biten üye aileye yazamaz', () => denied(updateDoc(family(teyze.db), { 'user.coins': 99, updatedAt: Date.now() })));
  await test('süresi biten üye yönetici değilse davet üretemez', () => denied(setDoc(invite(teyze.db, token('kendine')), {
    familyCode: FAMILY, name: 'Teyze', createdBy: teyze.uid, createdAt: Date.now(), expiresAt: Date.now() + day, accessDays: 0, usedBy: null, usedAt: null,
  })));
  await newInvite(token('yeniden'), { name: 'Teyze', accessDays: 0 });
  await test('yeni süresiz davetle erişim yeniden açılır, süre kalkar', async () => {
    await join(teyze.db, teyze.uid, token('yeniden'), 'Teyze', 0);
    const data = (await getDoc(family(teyze.db))).data()!;
    assert.equal(data.memberExpiry?.[teyze.uid], undefined);
  });

  console.log(`\n${passed} davet testi geçti`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => Promise.all(apps.map((app) => deleteApp(app))).then(() => process.exit()));
