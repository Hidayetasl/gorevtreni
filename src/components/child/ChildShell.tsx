import React from 'react';
import { BookOpen, Lock, Map, Mic, ShoppingBag, TrainFront, Tv } from 'lucide-react';
import '../../design/child.css';
import familyPhoto from '../../assets/images/rb-family.jpg';
import type { TabType, UserProfile } from '../../types';

interface ChildShellProps {
  user: UserProfile;
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  doneTodayCount: number;
  unreadVoiceCount: number;
  onOpenVoice: () => void;
  onOpenParent: () => void;
  coinBump?: number;
  children: React.ReactNode;
}

const NAV: Array<{ tab: TabType; label: string; Icon: typeof TrainFront }> = [
  { tab: 'tasks', label: 'Görevler', Icon: TrainFront },
  { tab: 'learn', label: 'Öğren', Icon: BookOpen },
  { tab: 'world', label: 'Dünya', Icon: Map },
  { tab: 'shop', label: 'Mağaza', Icon: ShoppingBag },
  { tab: 'videos', label: 'İzle', Icon: Tv },
];

/**
 * Çocuk modunun iskeleti: üstte Rüzgar, puan, sesli mesajlar ve ebeveyn kilidi;
 * telefonda altta, tablet/masaüstünde solda dört+bir sekmeli menü.
 * Yetişkin işleri (eşitleme, ses, hesap) ebeveyn paneline taşındı.
 */
export const ChildShell: React.FC<ChildShellProps> = ({
  user,
  activeTab,
  onChangeTab,
  doneTodayCount,
  unreadVoiceCount,
  onOpenVoice,
  onOpenParent,
  coinBump = 0,
  children,
}) => (
  <div className="gt">
    <header className="gt-top">
      <span className="gt-avatar"><img src={familyPhoto} alt="" /></span>
      <span className="gt-who">
        <span className="gt-name">{user.name || 'Rüzgar'}</span>
        <small>{doneTodayCount > 0 ? `Bugün ${doneTodayCount} görev bitti` : 'Yolculuğa hazır!'}</small>
      </span>
      <span key={coinBump} className={`gt-coin ${coinBump ? 'bump' : ''}`} aria-label={`${user.coins} puan`}>
        <span className="gt-coin-dot" aria-hidden="true" />
        <span><b>{user.coins}</b><small>PUAN</small></span>
      </span>
      <button type="button" className="gt-ib mor" onClick={onOpenVoice} aria-label={`Sesli mesajlar${unreadVoiceCount ? `, ${unreadVoiceCount} yeni` : ''}`}>
        <Mic aria-hidden="true" />
        {unreadVoiceCount > 0 && <span className="gt-badge">{unreadVoiceCount}</span>}
      </button>
      <button type="button" className="gt-ib kilit" onClick={onOpenParent} aria-label="Ebeveyn panelini aç" title="Ebeveyn">
        <Lock aria-hidden="true" />
      </button>
    </header>

    <main className="gt-main">{children}</main>

    <nav className="gt-nav" aria-label="Menü">
      {NAV.map(({ tab, label, Icon }) => (
        <button
          key={tab}
          type="button"
          className={`gt-nv ${activeTab === tab ? 'on' : ''}`}
          aria-current={activeTab === tab ? 'page' : undefined}
          onClick={() => onChangeTab(tab)}
        >
          <span className="ic"><Icon aria-hidden="true" /></span>
          {label}
        </button>
      ))}
    </nav>
  </div>
);
