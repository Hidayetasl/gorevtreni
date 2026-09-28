# AGENTS.md

## Proje
Rüzgar'ın Görev Treni / Sincap Köyü Yaşam Sistemi.

## Çalışma Kuralları
- Önce ilgili mevcut kodu incele; kapsam dışına çıkma.
- Çalışan sistemi gereksiz yere yeniden yazma.
- Basit çözüm yeterliyken yeni framework veya ağır bağımlılık ekleme.
- Town/oyun mantığını ayrı domain katmanında tut.
- `TrainWorldView.tsx` ve `App.tsx` dosyalarını daha monolitik hale getirme.
- Firebase, Firestore Rules, Cloud Functions, auth veya sync yapısını açıkça istenmeden değiştirme.
- `.env`, API key veya secret değerlerini gösterme ya da commit etme.
- Deploy, git push, merge veya production branch değişikliği açıkça istenmeden yapma.
- Büyük değişiklikten önce etkilenecek dosyaları ve temel riski belirt.
- Değişiklik sonrası mümkünse TypeScript/build/test durumunu doğrula.
- Çalışan davranışı tahmin ederek değiştirme; önce ilgili implementasyonu oku.
- Çocuk deneyiminde ekran süresini uzatan, suçluluk yaratan veya kompulsif oyun mekanikleri ekleme.
- Kasaba görevleri kısa, tek seferlik ve doğal bitişli olmalı.
- Ürün ve oyun kuralları için `docs/Gorev_Treni_Kurallar_ve_Gelistirme_v1.docx` belgesini referans al.
- Çelişki varsa en güncel açık kullanıcı talimatı önceliklidir.
- İş bitince yalnızca: değişen dosyalar, test/build sonucu ve varsa riskleri kısa bildir.

## İlk Geliştirme Hedefi
İlk dikey prototip:

Sabah diş + yatak
→ ebeveyn onayı
→ “Sincap Köyü güne başladı”
→ Fırın
→ “Bread hangisi?”
→ ekmek
→ Sıpa
→ görev tamamlandı.

İlk prototip doğrulanmadan kapsamı genişletme.
