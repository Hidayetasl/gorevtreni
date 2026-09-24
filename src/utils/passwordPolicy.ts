/**
 * Yetişkin hesap şifresi kuralları. Hesaplar aile verisine (sesli mesajlar,
 * günlükler) erişim sağladığı için kolay tahmin edilen şifreler kabul edilmez.
 * Firebase'in kendi alt sınırı 6 karakterdir; burada daha sıkı davranılır.
 */
const COMMON_PASSWORDS = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '111111', '000000', '123123',
  'password', 'password1', 'qwerty', 'qwerty123', 'abc123', 'sifre', 'sifre123', 'parola',
  'parola123', 'ruzgar', 'ruzgar123', 'rüzgar', 'rüzgar123', 'gorevtreni', 'test1234',
]);

/** Girişte kullanılan şifre değiştirilmesi gereken kadar zayıf mı? */
export function isWeakAccountPassword(password: string, email = ''): boolean {
  const value = password.trim();
  const lower = value.toLocaleLowerCase('tr-TR');
  const emailName = email.split('@')[0]?.toLocaleLowerCase('tr-TR') || '';
  return value.length < 8
    || /^\d+$/.test(value)
    || /^(.)\1+$/.test(value)
    || COMMON_PASSWORDS.has(lower)
    || (emailName.length >= 3 && lower.includes(emailName));
}

/** Yeni şifre için sorun varsa kullanıcıya gösterilecek açıklama, yoksa boş. */
export function newPasswordProblem(password: string, again: string, email = '', oldPassword = ''): string {
  if (password.length < 8) return 'Yeni şifre en az 8 karakter olmalı.';
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'Yeni şifrede en az bir harf ve bir rakam olmalı.';
  if (isWeakAccountPassword(password, email)) return 'Bu şifre kolay tahmin edilir. Başka bir şifre seçin.';
  if (oldPassword && password === oldPassword) return 'Yeni şifre eskisiyle aynı olamaz.';
  if (password !== again) return 'İki şifre birbirinin aynı değil.';
  return '';
}
