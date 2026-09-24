# Yeni sürümü canlıya alma — kontrol listesi

Canlı: GitHub Pages (`main` veya `v4` dalına her gönderim otomatik yayınlar,
`.github/workflows/deploy-pages.yml`). Veriler Firebase'de aynı yerde kalır;
yeni sürüm aynı aile kaydını okur (bkz. "Veri" bölümü).

> Bu dosyaya aile kodu, e-posta, şifre veya UID yazma: depo herkese açık olabilir.

## Neden sıra önemli

- **Eski sürüm** yetişkinleri ve Rüzgar'ı *anonim* (hesapsız) girişle, aile koduyla bağlar.
- **Yeni sürüm** yalnızca e-posta/şifreli yetişkin hesabını kabul eder; güvenlik kuralları
  (`firestore.rules`, `storage.rules`) anonim girişi reddeder.
- Bu yüzden yeni kurallar **yeni uygulamayla aynı anda** yayınlanmalı. Kurallar önce
  giderse canlıdaki eski uygulama kilitlenir. Uygulama önce giderse sorun yok ama
  kurallar gecikmemeli (eski, gevşek kurallar açık kalır).

## 1. Hazırlık (yayından önce, sırası fark etmez)

- [ ] Firebase Console → Authentication → Sign-in method → **Email/Password: açık**
- [ ] Authentication → Users: **Baba, Anne, Anneanne** hesapları oluşturuldu; her birinin UID'si not alındı
- [ ] **Anonymous girişe dokunma** (eski sürüm yayına kadar onu kullanıyor)
- [ ] GitHub → Settings → Secrets and variables → Actions:
  - [ ] `VITE_FIREBASE_BABA_EMAIL`, `VITE_FIREBASE_BABA_UID`
  - [ ] `VITE_FIREBASE_ANNE_EMAIL`, `VITE_FIREBASE_ANNE_UID`
  - [ ] `VITE_FIREBASE_ANNEANNE_EMAIL`, `VITE_FIREBASE_ANNEANNE_UID`
  - [ ] Mevcut Firebase ayarları duruyor: `VITE_FIREBASE_API_KEY`, `..._AUTH_DOMAIN`, `..._PROJECT_ID`, `..._STORAGE_BUCKET`, `..._APP_ID`
- [ ] Yerelde son kontrol: `npm run lint && npm run test:progress && npm run test:sync && npm run test:password && npm run build`
- [ ] (İsteğe bağlı) Canlı verinin salt okunur kopyasıyla yerel deneme

## 2. Yayın (aynı oturumda, arka arkaya)

1. [ ] Ana dala birleştir ve gönder (`claude-yenileme` → `main`) → GitHub Actions yayınlar (~2 dk)
2. [ ] Actions çalışması yeşil bitti; site açılıyor
3. [ ] Hemen ardından kuralları yayınla: `firebase deploy --only firestore:rules,storage --project <proje>`
   - Fonksiyonlar (`functions/`) değişmediyse onları yayınlama; günlük rapor olduğu gibi çalışmaya devam eder.

## 3. Yayından hemen sonra (her yetişkin cihazında bir kez)

1. [ ] Siteyi aç (ana ekrandaki uygulama 1–2 açılışta kendiliğinden yenilenir; olmazsa tarayıcıda sayfayı yenile)
2. [ ] E-posta + şifreyle giriş (Firebase'de verilen geçici şifre zayıfsa uygulama hemen **yeni şifre** ister: en az 8 karakter, harf + rakam)
3. [ ] "Aileye bağlan" ekranında **mevcut aile kodunu** yaz (yeni aile oluşturma!)
4. [ ] Aile PIN'i istenirse yeni ve kolay tahmin edilmeyen 4 rakam belirle (tüm cihazlarda ortak)
5. [ ] Kontrol: puan, görevler, Dünya/kasaba yerleşimi, mağaza satın almaları, sesli mesajlar, günlükler
6. [ ] Ebeveyn panelinde "Rüzgar şu anda kimin yanında?" anahtarını o anki telefonda aç
7. [ ] Telefonda mikrofon: Mesajlar → Ses gönder → kaydet/dinle/gönder (https'te çalışır)

## 4. Sorun çıkarsa geri dönüş

- Uygulama: `main`'i bir önceki yayın commit'ine geri al ve gönder (Actions eski sürümü yayınlar).
- Kurallar: eski kural dosyalarını (önceki sürümün `firestore.rules`, `storage.rules`) yeniden yayınla.
- Veri silinmez: iki sürüm aynı aile kaydını kullanır. Yeni sürümün eklediği alanlar
  (ör. silinmiş mesaj/görev işareti `deletedAt`) eski sürümde yok sayılır.

## 5. Birkaç gün sonra (her şey yoluna girince)

- [ ] Tüm cihazlar yeni sürümde ve e-postayla girmiş durumda
- [ ] Firebase → Authentication → **Anonymous girişi kapat**
- [ ] (İsteğe bağlı) Eski denemelerden kalan boş aile kayıtlarını Firestore'dan sil

## Veri: neler taşınır

Yeni sürüm, canlıdaki aile kaydını olduğu gibi okur: puan defteri (bakiye defterden
hesaplanır, eski kayıtlar için açılış bakiyesi korunur), görevler, mağaza satın almaları,
Dünya/kasaba yerleşimleri, sesli mesajlar ve günlükler (ses dosyaları Storage'da kalır),
videolar, etkinlik geçmişi. Eski sürümdeki eşitleme hatası yüzünden "parası ödenmiş ama
kilitli" kalmış ürünler, açılışta puan defterinden tanınıp otomatik geri açılır.
