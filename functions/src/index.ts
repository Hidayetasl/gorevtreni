import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

// --- Yapılandırma -----------------------------------------------------
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const FAMILY_CODE = defineString('FAMILY_CODE');
const REPORT_TO_EMAIL = defineString('REPORT_TO_EMAIL');
const REPORT_FROM_EMAIL = defineString('REPORT_FROM_EMAIL', {
  default: 'Rüzgar Görev Treni <onboarding@resend.dev>',
});

const TIME_ZONE = 'Europe/Istanbul';

interface RoutineTask {
  id: string;
  title: string;
  rewardCoins: number;
  status: 'todo' | 'pending_approval' | 'completed';
  completedAt?: string;
  approvedAt?: string;
}

interface CoinLedgerEntry {
  id: string;
  type: 'initial' | 'task_reward' | 'bonus_reward' | 'purchase' | 'reset';
  coinDelta: number;
  balanceAfter?: number;
  createdAt: string;
}

interface ActivityLogEntry {
  id: string;
  type: string;
  label: string;
  detail?: string;
  timestamp: string;
  durationMs?: number;
}

interface FamilyData {
  user?: { name?: string; coins?: number };
  tasks?: RoutineTask[];
  coinLedger?: CoinLedgerEntry[];
  activityLog?: ActivityLogEntry[];
}

function istanbulDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(iso));
}

function istanbulTime(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return '<1 dk';
  if (totalMinutes < 60) return `${totalMinutes} dk`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} sa ${minutes} dk` : `${hours} sa`;
}

const COIN_TYPE_LABELS: Record<CoinLedgerEntry['type'], string> = {
  initial: 'Başlangıç',
  task_reward: 'Görev ödülü',
  bonus_reward: 'Bonus ödülü',
  purchase: 'Mağaza alışverişi',
  reset: 'Sıfırlama',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

function buildReportHtml(family: FamilyData, todayKey: string, todayLabel: string): { html: string; isEmpty: boolean } {
  const tasksToday = (family.tasks || []).filter(
    (t) => t.status === 'completed' && istanbulDateKey(t.approvedAt || t.completedAt || '') === todayKey,
  );
  const coinEntriesToday = (family.coinLedger || []).filter((e) => istanbulDateKey(e.createdAt) === todayKey);
  const sessionsToday = (family.activityLog || []).filter(
    (e) => e.type === 'app_open' && istanbulDateKey(e.timestamp) === todayKey,
  );

  const netCoinChange = coinEntriesToday.reduce((sum, e) => sum + (e.coinDelta || 0), 0);
  const totalSessionMs = sessionsToday.reduce((sum, e) => sum + (e.durationMs || 0), 0);
  const isEmpty = tasksToday.length === 0 && coinEntriesToday.length === 0 && sessionsToday.length === 0;

  const taskRows = tasksToday
    .slice()
    .sort((a, b) => (a.approvedAt || a.completedAt || '').localeCompare(b.approvedAt || b.completedAt || ''))
    .map(
      (t) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(t.title)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap;">${istanbulTime(t.approvedAt || t.completedAt || '')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">+${t.rewardCoins} 🪙</td>
      </tr>`,
    )
    .join('');

  const coinRows = coinEntriesToday
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(
      (e) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;">${COIN_TYPE_LABELS[e.type] || e.type}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap;">${istanbulTime(e.createdAt)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;color:${e.coinDelta >= 0 ? '#15803d' : '#b91c1c'};">${e.coinDelta >= 0 ? '+' : ''}${e.coinDelta} 🪙</td>
      </tr>`,
    )
    .join('');

  const sessionRows = sessionsToday
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map(
      (e) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap;">${istanbulTime(e.timestamp)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(e.detail || 'Bilinmeyen cihaz')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${formatDuration(e.durationMs)}</td>
      </tr>`,
    )
    .join('');

  const section = (title: string, headers: string[], rows: string, emptyText: string) => `
    <h2 style="font-size:15px;margin:22px 0 8px;color:#1f2937;">${title}</h2>
    ${
      rows
        ? `<table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
            <thead><tr>${headers.map((h) => `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #d1d5db;color:#6b7280;font-size:11px;text-transform:uppercase;">${h}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
          </table>`
        : `<p style="font-size:13px;color:#9ca3af;margin:0;">${emptyText}</p>`
    }`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <div style="text-align:center;margin-bottom:8px;">
      <span style="font-size:28px;">🚂</span>
    </div>
    <h1 style="font-size:18px;text-align:center;color:#111827;margin:0 0 4px;">Rüzgar'ın Görev Treni — Gün Sonu Raporu</h1>
    <p style="text-align:center;color:#6b7280;font-size:13px;margin:0 0 20px;">${todayLabel}</p>

    <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px;">
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 16px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#0369a1;">${tasksToday.length}</div>
        <div style="font-size:11px;color:#0369a1;">Tamamlanan görev</div>
      </div>
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:10px 16px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#a16207;">${netCoinChange >= 0 ? '+' : ''}${netCoinChange}</div>
        <div style="font-size:11px;color:#a16207;">Net puan değişimi</div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 16px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#15803d;">${sessionsToday.length}</div>
        <div style="font-size:11px;color:#15803d;">Oturum (${formatDuration(totalSessionMs)})</div>
      </div>
    </div>

    ${section('✅ Tamamlanan görevler', ['Görev', 'Saat', 'Ödül'], taskRows, 'Bugün onaylanmış bir görev yok.')}
    ${section('🪙 Puan hareketleri', ['Tür', 'Saat', 'Değişim'], coinRows, 'Bugün puan hareketi yok.')}
    ${section('📱 Giriş / oturum saatleri', ['Saat', 'Cihaz', 'Süre'], sessionRows, 'Bugün uygulama açılmamış.')}

    <p style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:center;">Bu e-posta Rüzgar'ın Görev Treni tarafından her gün otomatik gönderilir.</p>
  </div>`;

  return { html, isEmpty };
}

async function sendReportEmail(html: string, todayLabel: string): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: REPORT_FROM_EMAIL.value(),
      to: [REPORT_TO_EMAIL.value()],
      subject: `Rüzgar'ın Görev Treni — Gün Sonu Raporu (${todayLabel})`,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API hatası (${response.status}): ${body}`);
  }
}

export const dailyActivityReport = onSchedule(
  {
    schedule: '0 22 * * *',
    timeZone: TIME_ZONE,
    secrets: [RESEND_API_KEY],
  },
  async () => {
    const familyCode = FAMILY_CODE.value();
    if (!familyCode) {
      logger.error('FAMILY_CODE tanımlı değil — functions/.env dosyasını kontrol edin.');
      return;
    }

    const db = getFirestore();
    const snapshot = await db.collection('families').doc(familyCode).get();
    if (!snapshot.exists) {
      logger.error(`families/${familyCode} bulunamadı.`);
      return;
    }

    const family = snapshot.data() as FamilyData;
    const now = new Date();
    const todayKey = istanbulDateKey(now.toISOString());
    const todayLabel = new Intl.DateTimeFormat('tr-TR', {
      timeZone: TIME_ZONE,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);

    const { html, isEmpty } = buildReportHtml(family, todayKey, todayLabel);

    if (isEmpty) {
      logger.info('Bugün hiç etkinlik yok, yine de rapor gönderiliyor (boş gün bilgisi ile).');
    }

    await sendReportEmail(html, todayLabel);
    logger.info(`Gün sonu raporu gönderildi: ${REPORT_TO_EMAIL.value()}`);
  },
);
