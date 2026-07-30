<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/fffb3f5c-d6ad-4bac-b0fb-b753b3f526b9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Anne–Baba ortak kullanım (Firebase)

1. Firebase Console'da bir web uygulaması oluşturun; **Anonymous Authentication**,
   **Cloud Firestore** ve sesli notlar için **Cloud Storage**'ı etkinleştirin.
2. Firebase web ayarlarını `.env.local` dosyasına, `.env.example` içindeki
   `VITE_FIREBASE_*` alanlarıyla aynı adlarda ekleyin.
3. `firestore.rules` ve `storage.rules` dosyalarındaki kuralları Firebase Console'da yayımlayın.
4. İlk telefonda Ebeveyn → Ayarlar → “Aileyi Bu Telefonla Başlat”a dokunun.
   İkinci telefonda aynı ekrana aile kodunu girin.

Firebase bağlantısı yokken uygulama yerel verilerle çalışmaya devam eder. Bağlantı
geldiğinde Firestore'un kalıcı tarayıcı önbelleği bekleyen değişiklikleri eşitler.

## GitHub Pages

Bu depo `main` dalına gönderildiğinde `.github/workflows/deploy-pages.yml` üretimi
`/ruzgar-rutin-oyunu/` alt yoluna göre derler. Firebase değerlerini GitHub repository
Secrets bölümünde `VITE_FIREBASE_*` adlarıyla ekleyin.
