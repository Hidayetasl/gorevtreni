import React from 'react';
import { ArrowRight, BookOpen, ListChecks, MessageCircle, NotebookPen, TrainFront } from 'lucide-react';
import { TabType } from '../types';

interface HomeLaunchpadProps {
  onOpenTab: (tab: TabType) => void;
  onOpenMessages: () => void;
  onOpenJournal: () => void;
  unreadVoiceCount: number;
}

type LaunchCard = {
  title: string;
  description: string;
  icon: string;
  background: string;
  borderColor: string;
  actionLabel: string;
  iconComponent: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  badge?: string;
};

export const HomeLaunchpad: React.FC<HomeLaunchpadProps> = ({
  onOpenTab,
  onOpenMessages,
  onOpenJournal,
  unreadVoiceCount,
}) => {
  const cards: LaunchCard[] = [
    {
      title: 'Bugünün Görevleri',
      description: 'İlk durağını seç ve yıldız kazan.',
      icon: '⭐',
      background: 'linear-gradient(135deg, #1e536d 0%, #102e3d 100%)',
      borderColor: 'rgba(125, 211, 252, 0.68)',
      actionLabel: 'Görevler',
      iconComponent: ListChecks,
      onClick: () => onOpenTab('tasks'),
    },
    {
      title: 'Tren Dünyam',
      description: 'Trenini sür, rayları ve yapıları yerleştir.',
      icon: '🚂',
      background: 'linear-gradient(135deg, #1e536d 0%, #102e3d 100%)',
      borderColor: 'rgba(125, 211, 252, 0.34)',
      actionLabel: 'Dünyama Git',
      iconComponent: TrainFront,
      onClick: () => onOpenTab('world'),
    },
    {
      title: 'Harf Treni',
      description: 'Harfleri dinle, kelimeleri bul, heceleri birleştir.',
      icon: '🔤',
      background: 'linear-gradient(135deg, #1e536d 0%, #102e3d 100%)',
      borderColor: 'rgba(125, 211, 252, 0.34)',
      actionLabel: 'Öğren',
      iconComponent: BookOpen,
      onClick: () => onOpenTab('learn'),
    },
    {
      title: 'Mesajlarım',
      description: unreadVoiceCount > 0 ? 'Seni bekleyen yeni bir mesaj var!' : 'Babama ses bırak veya gelen mesajı dinle.',
      icon: '🎙️',
      background: 'linear-gradient(135deg, #1e536d 0%, #102e3d 100%)',
      borderColor: 'rgba(125, 211, 252, 0.34)',
      actionLabel: 'Mesajlara Git',
      iconComponent: MessageCircle,
      onClick: onOpenMessages,
      badge: unreadVoiceCount > 0 ? `${unreadVoiceCount} yeni` : undefined,
    },
    {
      title: 'Günlüğüm',
      description: 'Bugününü anlat, anını tarihli olarak sakla.',
      icon: '📔',
      background: 'linear-gradient(135deg, #1e536d 0%, #102e3d 100%)',
      borderColor: 'rgba(125, 211, 252, 0.34)',
      actionLabel: 'Günlük Aç',
      iconComponent: NotebookPen,
      onClick: onOpenJournal,
    },
  ];

  return (
    <section className="mb-4 space-y-2.5" aria-labelledby="explore-title">
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-sky-300"><span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.9)]" /> İSTASYONLARIM</div>
          <h2 id="explore-title" className="mt-0.5 font-game text-base font-black tracking-tight text-white sm:text-lg">Nereye gitmek istersin?</h2>
        </div>
        <span className="text-[10px] sm:text-xs font-bold text-slate-300">Bir karta dokun</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-2">
        {cards.map((card) => {
          const Icon = card.iconComponent;
          return (
            <button
              key={card.title}
              type="button"
              onClick={card.onClick}
              className="group flex min-h-[72px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-white shadow-[0_10px_24px_rgba(2,12,20,0.22)] transition-transform active:scale-[0.98] hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-4 focus-visible:outline-yellow-300 sm:min-h-[76px] sm:px-2.5"
              style={{ background: card.background, borderColor: card.borderColor }}
              aria-label={`${card.title}: ${card.actionLabel}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/15 text-xl leading-none ring-1 ring-white/20 sm:h-10 sm:w-10" aria-hidden="true">{card.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-game text-[11px] font-black leading-tight sm:text-xs">
                  <span className="truncate">{card.title}</span>
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden="true" />
                </span>
                <span className="mt-0.5 block truncate text-[8px] font-semibold leading-snug text-white/75 sm:text-[9px]">{card.description}</span>
                <span className="mt-0.5 block truncate text-[8px] font-black uppercase tracking-[0.08em] text-white/80">{card.badge || card.actionLabel}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-2" aria-label="Diğer istasyonlar">
        <button
          type="button"
          onClick={() => onOpenTab('shop')}
          className="flex min-h-11 items-center justify-between rounded-xl border border-sky-300/30 bg-[#122f3e] px-3 text-left text-white shadow-[0_8px_20px_rgba(2,12,20,0.2)] active:scale-[0.98] focus-visible:outline focus-visible:outline-4 focus-visible:outline-yellow-300"
        >
          <span className="flex min-w-0 items-center gap-1.5"><span className="text-lg" aria-hidden="true">🛍️</span><span className="truncate font-game text-xs font-black sm:text-sm">Mağazaya Git</span></span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onOpenTab('videos')}
          className="flex min-h-11 items-center justify-between rounded-xl border border-sky-300/30 bg-[#122f3e] px-3 text-left text-white shadow-[0_8px_20px_rgba(2,12,20,0.2)] active:scale-[0.98] focus-visible:outline focus-visible:outline-4 focus-visible:outline-yellow-300"
        >
          <span className="flex min-w-0 items-center gap-1.5"><span className="text-lg" aria-hidden="true">📺</span><span className="truncate font-game text-xs font-black sm:text-sm">İzlet İstasyonu</span></span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};
