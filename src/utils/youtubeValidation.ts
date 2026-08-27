export interface YoutubeValidationResult {
  ok: boolean;
  embeddable: boolean;
  title?: string;
  channelId?: string;
  channelTitle?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private' | 'unknown';
  madeForKids?: boolean;
  failureReason?: string;
}

const validationTimeoutMs = 8000;

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), validationTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...init.headers } });
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Doğrulama modeli:
 * 1) İsteğe bağlı VITE_YOUTUBE_VALIDATION_URL sunucu uç noktası, Google API anahtarını
 *    istemciye göndermeden Data API sonucunu döndürür.
 * 2) Uç nokta yoksa anahtarsız oEmbed, silinmiş/erişilemeyen videoları filtreler;
 *    ebeveyn yine de içeriği kontrol edip onaylar.
 *
 * Çocuk ekranına hiçbir içerik ebeveyn onayı ve `embeddable` kontrolü olmadan çıkmaz.
 */
export async function validateYoutubeVideo(youtubeId: string): Promise<YoutubeValidationResult> {
  const validationUrl = import.meta.env.VITE_YOUTUBE_VALIDATION_URL as string | undefined;
  try {
    if (validationUrl) {
      const params = new URLSearchParams({ id: youtubeId });
      const response = await fetchWithTimeout(`${validationUrl.replace(/\/$/, '')}?${params.toString()}`);
      if (!response.ok) return { ok: false, embeddable: false, failureReason: `Video doğrulama servisi HTTP ${response.status}` };
      const result = await response.json() as Partial<YoutubeValidationResult>;
      if (!result.ok || result.embeddable === false) {
        return { ok: false, embeddable: false, failureReason: result.failureReason || 'Video gömülü oynatmaya uygun değil.' };
      }
      return { ...result, ok: true, embeddable: true };
    }

    const response = await fetchWithTimeout(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}&format=json`);
    if (!response.ok) return { ok: false, embeddable: false, failureReason: 'YouTube videosu bulunamadı veya oEmbed erişimi kapalı.' };
    const metadata = await response.json() as { title?: string; author_name?: string };
    return {
      ok: true,
      embeddable: true,
      title: metadata.title,
      channelTitle: metadata.author_name,
      privacyStatus: 'unknown',
    };
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'YouTube doğrulaması zaman aşımına uğradı.'
      : 'YouTube doğrulaması yapılamadı. İnternet bağlantısını kontrol edin.';
    return { ok: false, embeddable: false, failureReason: message };
  }
}
