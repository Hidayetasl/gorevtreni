/**
 * Sesli mesaj deposu kurallarının testleri (Storage + Firestore emülatörü).
 * Önce emülatörü başlatın: npm run emulators — sonra: npm run test:storage
 */
import { strict as assert } from 'node:assert';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';
import { connectStorageEmulator, deleteObject, getMetadata, getStorage, listAll, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

const PROJECT = 'demo-gorevtreni';
const RUN = Date.now().toString(36);
const FAMILY = `SES${RUN.toUpperCase()}`.replace(/[^A-Z0-9]/g, '');
const apps: FirebaseApp[] = [];

async function asUser(name: string) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com`, storageBucket: `${PROJECT}.appspot.com` }, `${name}-${RUN}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  const idToken = JSON.stringify({ sub: `${name}-${RUN}`, email: `${name}-${RUN}@example.com`, email_verified: true });
  const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return { db, storage, uid: user.uid };
}

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
}
async function denied(promise: Promise<unknown>) {
  try { await promise; } catch (error) {
    assert.match(String((error as { code?: string }).code), /unauthorized|permission-denied/);
    return;
  }
  assert.fail('izin verilmemeliydi');
}

const folder = (storage: FirebaseStorage) => ref(storage, `families/${FAMILY}/voice`);
const file = (storage: FirebaseStorage, name: string) => ref(storage, `families/${FAMILY}/voice/${name}`);
const audio = (kb: number) => new Uint8Array(kb * 1024);

async function usage(storage: FirebaseStorage) {
  const list = await listAll(folder(storage));
  const sizes = await Promise.all(list.items.map((item) => getMetadata(item).then((meta) => meta.size)));
  return { files: list.items.length, bytes: sizes.reduce((sum, size) => sum + size, 0) };
}

async function main() {
  const baba = await asUser('baba');
  const yabanci = await asUser('yabanci');
  await setDoc(doc(baba.db, 'families', FAMILY), { ownerUid: baba.uid, memberUids: [baba.uid], adminUids: [baba.uid], updatedAt: Date.now() });

  await uploadBytes(file(baba.storage, 'm1.m4a'), audio(100), { contentType: 'audio/mp4' });
  await uploadBytes(file(baba.storage, 'm2.webm'), audio(50), { contentType: 'audio/webm' });

  await test('aile üyesi ses alanını ölçebilir (listele + boyut)', async () => {
    const result = await usage(baba.storage);
    assert.equal(result.files, 2);
    assert.equal(result.bytes, 150 * 1024);
  });

  await test('aileden olmayan ses klasörünü listeleyemez', () => denied(listAll(folder(yabanci.storage))));

  await test('silinen mesajın dosyası depodan kalkar, alan küçülür', async () => {
    await deleteObject(file(baba.storage, 'm2.webm'));
    const result = await usage(baba.storage);
    assert.equal(result.files, 1);
    assert.equal(result.bytes, 100 * 1024);
  });

  await test('ses dışı dosya yüklenemez', () => denied(uploadBytes(file(baba.storage, 'x.txt'), audio(1), { contentType: 'text/plain' })));

  console.log(`\n${passed} depo testi geçti`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => Promise.all(apps.map((app) => deleteApp(app))).then(() => process.exit()));
