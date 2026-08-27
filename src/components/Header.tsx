import React, { useEffect, useState } from 'react';
// Tasarım: Pastel Tren Rotası — gökyüzü mavisi başlık, altın profil çerçevesi ve sıcak kahverengi marka metni.
import { UserProfile, TabType } from '../types';
import { Volume2, VolumeX, Settings, Sparkles, Star, Train, Store, Play, RefreshCw, BookOpen, LogIn, LogOut, UserRound } from 'lucide-react';
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
  adultName?: string;
  onOpenAdultLogin?: () => void;
  onSwitchAccount?: () => void;
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
  adultName,
  onOpenAdultLogin,
  onSwitchAccount,
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
    { id: 'tasks' as TabType, label: 'Görev', Icon: Star },
    { id: 'world' as TabType, label: 'Dünya', Icon: Train },
    { id: 'learn' as TabType, label: 'Öğren', Icon: BookOpen },
    { id: 'shop' as TabType, label: 'Mağaza', Icon: Store },
    { id: 'videos' as TabType, label: 'İzlet', Icon: Play },
  ];

  return (
    <header className="app-header relative z-30 bg-[#E1F5FE] border-b border-sky-200 shadow-sm rounded-b-3xl text-[#4E342E]">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-2.5 pb-2">
        {onManualSync && cloudStatus && (
          <div
            className={`cloud-status-strip ${
              cloudStatus.startsWith('Eşitleme hatası')
                ? 'cloud-status-strip--error'
                : cloudStatus.startsWith('Çevrimdışı')
                  ? 'cloud-status-strip--offline'
                  : 'cloud-status-strip--ok'
            }`}
            role="status"
            aria-live="polite"
            title={cloudStatus}
          >
            <span className="cloud-status-dot" aria-hidden="true" />
            <span className="cloud-status-label">
              {cloudStatus.startsWith('Eşitleme hatası')
                ? 'Bulut eşleşme sorunu'
                : cloudStatus.startsWith('Çevrimdışı')
                  ? 'Çevrimdışı'
                  : 'Bulut eşleşti'}
            </span>
            <span className="cloud-status-detail">
              {cloudStatus.startsWith('Eşitleme hatası') ? 'Ayarları kontrol edin' : cloudStatus}
            </span>
          </div>
        )}

        {/* Top Header Row */}
        <div className="app-header-top-row flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3">
          {/* Child Profile & Title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-white border-2 border-[#F6B73C] ring-2 ring-[#FFF7D6] shadow-sm overflow-hidden">
                <img src={familyPhoto} alt="Rüzgar ve babası" className="h-full w-full object-cover object-[50%_30%]" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black border border-orange-200 shadow-xs">
                6 Yaş
              </div>
            </div>

            <div>
              <div className="text-[11px] font-extrabold tracking-widest text-sky-400 uppercase">
                RÜZGAR'IN
              </div>
              <h1 className="font-game text-xl sm:text-3xl font-black text-[#4E342E] tracking-tight leading-none">
                Görev Treni
              </h1>
              <p className="mt-1 text-[10px] sm:text-xs font-bold text-slate-500 capitalize">
                📅 {dateLabel} · 🕒 {timeLabel}
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="app-header-actions flex items-center justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
            {hasUnclaimedBonus && (
              <button
                onClick={onOpenBonusModal}
                className="animate-bounce bg-gradient-to-r from-orange-600 to-red-600 text-white font-game px-3 py-1.5 rounded-full border border-orange-200 shadow-lg flex items-center gap-1.5 text-xs font-bold"
              >
                <Sparkles className="w-3.5 h-3.5 text-white animate-spin" />
                <span className="hidden sm:inline">Hediye Var! 🎁</span>
              </button>
            )}

            {/* Voice Messages Button */}
            {onOpenVoiceModal && (
              <button
                onClick={onOpenVoiceModal}
                className={`app-header-action app-header-action--message ${unreadVoiceCount > 0 ? 'app-header-action--message-unread' : ''} bg-gradient-to-r from-blue-500 to-blue-700 hover:brightness-110 border border-blue-200 text-white h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-md relative font-game text-xs font-bold`}
                title="Sesli Mesaj Kutusu"
              >
                <span className="text-base" aria-hidden="true">🎙️</span>
                <span className="app-header-action-label">Mesaj</span>
                {unreadVoiceCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full border border-white/80 animate-pulse">
                    {unreadVoiceCount}
                  </span>
                )}
              </button>
            )}

            {onManualSync && (
              <button
                onClick={onManualSync}
                disabled={isSyncing}
                className="app-header-action app-header-action--technical bg-[#183644] hover:bg-[#204558] disabled:opacity-60 border border-slate-600 text-sky-200 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm"
                title={cloudStatus || 'Şimdi bulutla eşitle'}
                aria-label="Şimdi bulutla eşitle"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}

            {adultName ? (
              <button type="button" onClick={onSwitchAccount} title="Hesap değiştir" className="flex max-w-[108px] items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2 py-2 text-[10px] font-black text-emerald-800 transition-all active:scale-95 sm:max-w-none sm:gap-1.5 sm:px-2.5 sm:text-xs">
                <UserRound className="h-4 w-4" />
                <span className="truncate">{adultName}</span>
                {onSwitchAccount && <LogOut className="h-3.5 w-3.5" />}
              </button>
            ) : onOpenAdultLogin ? (
              <button type="button" onClick={onOpenAdultLogin} title="Yetişkin girişi" aria-label="Yetişkin girişi" className="app-header-action bg-sky-600 hover:bg-sky-700 border border-sky-200 text-white h-9 sm:h-10 px-2.5 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm font-game text-xs font-bold">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Yetişkin girişi</span>
              </button>
            ) : null}

            {/* Currency Pill */}
            <div className="app-header-coin bg-[#102c23] border-2 border-orange-400/80 px-3 py-1.5 rounded-full shadow-inner flex items-center gap-1.5">
              <span className="text-base sm:text-lg">🪙</span>
              <span className="font-game text-orange-300 text-sm sm:text-base font-extrabold">
                {user.coins}
              </span>
            </div>

            {/* Sound Toggle Button */}
            <button
              onClick={onToggleSound}
              aria-label={user.soundEnabled ? 'Sesi kapat' : 'Sesi aç'}
              className={`app-header-action app-header-action--sound w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border transition-all active:scale-95 shadow-sm ${
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
              aria-label="Ebeveyn panelini aç"
              className="app-header-action app-header-action--parent bg-[#183644] hover:bg-[#204558] border border-slate-600 text-slate-200 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm relative"
              title="Ebeveyn Paneli (Ayar)"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-slate-900 animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>


        {/* Top Horizontal Pill Navigation Bar */}
        <nav className="v4-header-nav grid-cols-5 gap-1.5 pt-1 sm:gap-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                title={tab.label}
                aria-label={tab.label}
                className={`app-primary-nav-button py-2 sm:py-2.5 px-2 sm:px-5 rounded-2xl font-game font-black text-xs sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-200 active:scale-95 border ${
                  isActive
                    ? 'bg-[#FF8A65] hover:bg-[#FF7F50] text-white border-orange-300 shadow-lg shadow-orange-300/30'
                    : 'bg-white/75 hover:bg-white text-[#6D4C41] border-[#D7CCC8]'
                }`}
              >
                <tab.Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.4} aria-hidden="true" />
                <span className="app-primary-nav-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
