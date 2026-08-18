import React, { useEffect, useState } from 'react';
import { UserProfile, TabType } from '../types';
import { Volume2, VolumeX, Settings, Sparkles, Star, Train, Store, Play, RefreshCw, BookOpen } from 'lucide-react';
import familyPhoto from '../assets/images/rb-family.jpg';

interface HeaderProps {
  user: UserProfile;
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onToggleSound: () => void;
  onOpenParentModal: () => void;
  completedTasksCount: number;
  totalTasksCount: number;
  hasUnclaimedBonus?: boolean;
  onOpenBonusModal?: () => void;
  pendingCount?: number;
  onOpenVoiceModal?: () => void;
  unreadVoiceCount?: number;
  cloudStatus?: string;
  onManualSync?: () => void;
  isSyncing?: boolean;
  deviceRoleLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onChangeTab,
  onToggleSound,
  onOpenParentModal,
  completedTasksCount,
  totalTasksCount,
  hasUnclaimedBonus,
  onOpenBonusModal,
  pendingCount = 0,
  onOpenVoiceModal,
  unreadVoiceCount = 0,
  cloudStatus,
  onManualSync,
  isSyncing = false,
  deviceRoleLabel,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const dateLabel = now.toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const timeLabel = now.toLocaleTimeString('tr-TR', {
    hour: '2-digit', minute: '2-digit',
  });

  const tabs = [
    { id: 'tasks' as TabType, label: 'Görev', icon: '⭐', LucideIcon: Star },
    { id: 'world' as TabType, label: 'Dünya', icon: '🚂', LucideIcon: Train },
    { id: 'learn' as TabType, label: 'Öğren', icon: '🔤', LucideIcon: BookOpen },
    { id: 'shop' as TabType, label: 'Mağaza', icon: '🏪', LucideIcon: Store },
    { id: 'videos' as TabType, label: 'İzlet', icon: '►', LucideIcon: Play },
  ];

  return (
    <header className="relative z-30 bg-[#0e2531] border-b-2 border-slate-800/80 shadow-xl rounded-b-3xl text-white">
      <div className="max-w-6xl mx-auto px-4 pt-3 pb-3">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3">
          {/* Child Profile & Title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-sky-900 border-2 border-sky-300 shadow-md overflow-hidden">
                <img src={familyPhoto} alt="Rüzgar ve babası" className="h-full w-full object-cover object-[50%_30%]" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-400 text-yellow-950 text-[10px] px-1.5 py-0.2 rounded-full font-black border border-amber-200 shadow-xs">
                6 Yaş
              </div>
            </div>

            <div>
              <div className="text-[11px] font-extrabold tracking-widest text-sky-400 uppercase">
                RÜZGAR'IN
              </div>
              <h1 className="font-game text-xl sm:text-3xl font-black text-white tracking-tight leading-none drop-shadow-sm">
                Görev Treni
              </h1>
              <p className="mt-1 text-[10px] sm:text-xs font-bold text-sky-200 capitalize">
                📅 {dateLabel} · 🕒 {timeLabel}
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
            {hasUnclaimedBonus && (
              <button
                onClick={onOpenBonusModal}
                className="animate-bounce bg-gradient-to-r from-purple-500 to-pink-500 text-white font-game px-3 py-1.5 rounded-full border border-purple-300 shadow-lg flex items-center gap-1.5 text-xs font-bold"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin" />
                <span className="hidden sm:inline">Hediye Var! 🎁</span>
              </button>
            )}

            {/* Voice Messages Button */}
            {onOpenVoiceModal && (
              <button
                onClick={onOpenVoiceModal}
                className="bg-gradient-to-r from-rose-600 to-pink-600 hover:brightness-110 border border-rose-300 text-white h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-md relative font-game text-xs font-bold"
                title="Sesli Mesaj Kutusu"
              >
                <span className="text-base">🎙️</span>
                <span>Mesaj</span>
                {unreadVoiceCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full border border-slate-900 animate-pulse">
                    {unreadVoiceCount}
                  </span>
                )}
              </button>
            )}

            {onManualSync && (
              <button
                onClick={onManualSync}
                disabled={isSyncing}
                className="bg-[#183644] hover:bg-[#204558] disabled:opacity-60 border border-slate-600 text-sky-200 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm"
                title={cloudStatus || 'Şimdi bulutla eşitle'}
                aria-label="Şimdi bulutla eşitle"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Currency Pill */}
            <div className="bg-[#091720] border-2 border-amber-500/80 px-3 py-1.5 rounded-full shadow-inner flex items-center gap-1.5">
              <span className="text-base sm:text-lg">🪙</span>
              <span className="font-game text-amber-400 text-sm sm:text-base font-extrabold">
                {user.coins}
              </span>
            </div>

            {/* Sound Toggle Button */}
            <button
              onClick={onToggleSound}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border transition-all active:scale-95 shadow-sm ${
                user.soundEnabled
                  ? 'bg-[#183644] border-slate-600 text-sky-300 hover:bg-[#204558]'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Ses Aç/Kapat"
            >
              {user.soundEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            {/* Parent Settings Button */}
            <button
              onClick={onOpenParentModal}
              className="bg-[#183644] hover:bg-[#204558] border border-slate-600 text-slate-200 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm relative"
              title="Ebeveyn Paneli (Ayar)"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-slate-900 animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {(onManualSync && cloudStatus) || deviceRoleLabel ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {onManualSync && cloudStatus && (
              <div
                role="status"
                aria-live="polite"
                className={`flex items-center gap-1.5 text-[10px] sm:text-xs font-bold rounded-lg px-2.5 py-1.5 w-fit border ${
                  cloudStatus.startsWith('Eşitleme hatası')
                    ? 'bg-rose-950/50 border-rose-500/60 text-rose-200'
                    : cloudStatus.startsWith('Çevrimdışı')
                      ? 'bg-amber-950/50 border-amber-500/60 text-amber-100'
                      : 'bg-sky-950/60 border-sky-600/60 text-sky-200'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Bulut: {cloudStatus}</span>
              </div>
            )}
            {deviceRoleLabel && (
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold rounded-lg px-2.5 py-1.5 w-fit border bg-slate-800/60 border-slate-600/60 text-slate-200">
                <span>{deviceRoleLabel}</span>
              </div>
            )}
          </div>
        ) : null}

        {/* Top Horizontal Pill Navigation Bar */}
        <nav className="grid grid-cols-5 gap-1.5 sm:gap-3 pt-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id)}
                className={`py-2 sm:py-2.5 px-2 sm:px-5 rounded-2xl font-game font-black text-xs sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-200 active:scale-95 border ${
                  isActive
                    ? 'bg-[#2263df] hover:bg-[#1d58c8] text-white border-blue-400/50 shadow-lg shadow-blue-600/30'
                    : 'bg-[#173340] hover:bg-[#1f4253] text-slate-200 border-slate-700/50'
                }`}
              >
                <span className="text-sm sm:text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
