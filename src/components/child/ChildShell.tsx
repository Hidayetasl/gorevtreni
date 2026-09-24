import React from 'react';
import { Lock, Mic } from 'lucide-react';
import '../../design/child.css';
import familyPhoto from '../../assets/images/rb-family.jpg';
import navGorevler from '../../assets/images/nav-gorevler.webp';
import navOgren from '../../assets/images/nav-ogren.webp';
import navDunya from '../../assets/images/nav-dunya.webp';
import navMagaza from '../../assets/images/nav-magaza.webp';
import navIzle from '../../assets/images/nav-izle.webp';
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

const NAV: Array<{ tab: TabType; label: string; icon: string }> = [
  { tab: 'tasks', label: 'Görevler', icon: navGorevler },
  { tab: 'learn', label: 'Öğren', icon: navOgren },
  { tab: 'world', label: 'Dünya', icon: navDunya },
  { tab: 'shop', label: 'Mağaza', icon: navMagaza },
  { tab: 'videos', label: 'İzle', icon: navIzle },
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
      {NAV.map(({ tab, label, icon }) => (
        <button
          key={tab}
          type="button"
          className={`gt-nv ${activeTab === tab ? 'on' : ''}`}
          aria-current={activeTab === tab ? 'page' : undefined}
          onClick={() => onChangeTab(tab)}
        >
          <span className="ic"><img src={icon} alt="" draggable={false} /></span>
          {label}
        </button>
      ))}
    </nav>
  </div>
);
