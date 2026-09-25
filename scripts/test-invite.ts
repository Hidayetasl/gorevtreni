/**
 * Tek kullanımlık davet kurallarının testleri (Firestore emülatörüne karşı).
 * Önce emülatörü başlatın: npm run emulators — sonra: npm run test:invite
 */
import { strict as assert } from 'node:assert';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { arrayUnion, connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';

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

async function join(db: Firestore, uid: string, t: string, name: string) {
  const batch = writeBatch(db);
  batch.update(invite(db, t), { usedBy: uid, usedAt: Date.now() });
  batch.update(family(db), { memberUids: arrayUnion(uid), [`adultNames.${uid}`]: name, joinInvite: t, updatedAt: Date.now() });
  await batch.commit();
}

async function main() {
  const baba = await asUser('baba');
  const dede = await asUser('dede');
  const yabanci = await asUser('yabanci');

  await setDoc(family(baba.db), { ownerUid: baba.uid, memberUids: [baba.uid], inviteEnabled: false, user: { coins: 10 }, updatedAt: Date.now() });
  const newInvite = (t: string, extra: Record<string, unknown> = {}) => setDoc(invite(baba.db, t), {
    familyCode: FAMILY, name: 'Dede', createdBy: baba.uid, createdAt: Date.now(), expiresAt: Date.now() + 7 * day, usedBy: null, usedAt: null, ...extra,
  });

  await test('aile üyesi davet oluşturabilir', () => newInvite(token('ok')));

  await test('aileden olmayan davet oluşturamaz', () => denied(setDoc(invite(yabanci.db, token('kotu')), {
    familyCode: FAMILY, name: 'Hırsız', createdBy: yabanci.uid, createdAt: Date.now(), expiresAt: Date.now() + day, usedBy: null, usedAt: null,
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

  console.log(`\n${passed} davet testi geçti`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => Promise.all(apps.map((app) => deleteApp(app))).then(() => process.exit()));
