/** Yetişkin hesap şifresi kurallarının testleri. Çalıştırma: npm run test:password */
import { strict as assert } from 'node:assert';
import { isWeakAccountPassword, newPasswordProblem } from '../src/utils/passwordPolicy';

// Zayıf sayılan ve ilk girişte değiştirilmesi istenen şifreler
for (const weak of ['123456', '12345678', '1111111111', 'aaaaaaaa', 'password', 'Qwerty', 'test1234', 'ruzgar123', 'kisa1']) {
  assert.equal(isWeakAccountPassword(weak), true, `${weak} zayıf sayılmalı`);
}
assert.equal(isWeakAccountPassword('hidayet2026', 'hidayet@ornek.com'), true, 'e-posta adını içeren şifre zayıf');
// Güçlü sayılanlar
for (const strong of ['Tren2026Sincap', 'mavi7balon', 'Kuzu3yaprak']) {
  assert.equal(isWeakAccountPassword(strong, 'baba@ornek.com'), false, `${strong} güçlü sayılmalı`);
}
// Yeni şifre kontrolü
assert.match(newPasswordProblem('kisa1', 'kisa1'), /8 karakter/);
assert.match(newPasswordProblem('sadeceharf', 'sadeceharf'), /harf ve bir rakam/);
assert.match(newPasswordProblem('12345678', '12345678'), /harf ve bir rakam/);
assert.match(newPasswordProblem('password1', 'password1'), /kolay tahmin/);
assert.match(newPasswordProblem('mavi7balon', 'mavi7balonn'), /aynı değil/);
assert.match(newPasswordProblem('mavi7balon', 'mavi7balon', '', 'mavi7balon'), /eskisiyle aynı/);
assert.equal(newPasswordProblem('mavi7balon', 'mavi7balon', 'baba@ornek.com', '123456'), '');
assert.equal(newPasswordProblem('Çiçek9ağaç', 'Çiçek9ağaç'), '', 'Türkçe harfler kabul edilir');
console.log('password tests passed');
