import React, { useState } from 'react';
import { TabType } from '../types';
import { ChevronDown, ChevronUp, ClipboardList, Globe, ShoppingBag, Tv, Lock } from 'lucide-react';

interface NavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onOpenParentModal: () => void;
  pendingCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  onOpenParentModal,
  pendingCount,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <nav className="fixed bottom-2 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="pointer-events-auto flex min-h-10 items-center gap-1.5 rounded-full border-2 border-sky-300 bg-white/95 px-4 py-1.5 font-game text-[11px] font-black text-sky-700 shadow-xl backdrop-blur-md active:scale-95"
          aria-label="Menüyü aç"
        >
          <ChevronUp className="h-4 w-4" />
          Menü
        </button>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t-2 border-sky-400 px-2 py-1 sm:px-3 sm:py-1.5 shadow-2xl">
      <button
        type="button"
        onClick={() => setIsCollapsed(true)}
        className="absolute -top-5 right-3 z-50 flex h-8 min-w-12 items-center justify-center rounded-full border-2 border-sky-300 bg-white/95 text-sky-700 shadow-lg backdrop-blur-md active:scale-95"
        aria-label="Menüyü kapat"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <div className="max-w-xl mx-auto flex items-end justify-around relative">
        {/* Tab 1: Görevler */}
        <button
          onClick={() => onChangeTab('tasks')}
          className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-95 ${
            activeTab === 'tasks'
              ? 'text-sky-600 scale-105 font-bold'
              : 'text-slate-600 hover:text-sky-700 font-bold'
          }`}
        >
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'tasks'
                ? 'bg-sky-500 text-white shadow-md border-b-4 border-sky-700'
                : 'bg-slate-100 border border-slate-300 text-slate-700 shadow-sm'
            }`}
          >
            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="text-[8px] sm:text-[10px] font-game uppercase tracking-wide mt-0.5">
            Görevler
          </span>
        </button>

        {/* Tab 2: Dünyam */}
        <button
          onClick={() => onChangeTab('world')}
          className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-95 ${
            activeTab === 'world'
              ? 'text-emerald-600 scale-105 font-bold'
              : 'text-slate-600 hover:text-emerald-700 font-bold'
          }`}
        >
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'world'
                ? 'bg-emerald-500 text-white shadow-md border-b-4 border-emerald-700'
                : 'bg-slate-100 border border-slate-300 text-slate-700 shadow-sm'
            }`}
          >
            <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="text-[8px] sm:text-[10px] font-game uppercase tracking-wide mt-0.5">
            Dünyam
          </span>
        </button>

        {/* Center elevated button: Mağaza */}
        <div className="relative -top-2.5 sm:-top-3.5">
          <button
            onClick={() => onChangeTab('shop')}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-[3px] border-white shadow-xl flex flex-col items-center justify-center text-white transition-all duration-200 active:scale-90 ${
              activeTab === 'shop'
                ? 'bg-gradient-to-b from-amber-400 to-yellow-500 ring-4 ring-amber-300 scale-110 border-b-4 border-amber-700'
                : 'bg-gradient-to-b from-red-500 to-rose-600 border-b-4 border-red-800 hover:brightness-110'
            }`}
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-sm" />
            <span className="text-[7px] sm:text-[8px] font-game uppercase tracking-tighter">
              Mağaza
            </span>
          </button>
        </div>

        {/* Tab 3: İzlet */}
        <button
          onClick={() => onChangeTab('videos')}
          className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-95 ${
            activeTab === 'videos'
              ? 'text-indigo-600 scale-105 font-bold'
              : 'text-slate-600 hover:text-indigo-700 font-bold'
          }`}
        >
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'videos'
                ? 'bg-indigo-500 text-white shadow-md border-b-4 border-indigo-700'
                : 'bg-slate-100 border border-slate-300 text-slate-700 shadow-sm'
            }`}
          >
            <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="text-[8px] sm:text-[10px] font-game uppercase tracking-wide mt-0.5">
            İzlet
          </span>
        </button>

        {/* Tab 4: Ebeveyn */}
        <button
          onClick={onOpenParentModal}
          className="flex flex-col items-center justify-center text-rose-500 hover:text-rose-700 transition-all duration-200 active:scale-95 relative"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-game h-[18px] w-[18px] rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-[8px] sm:text-[10px] font-game uppercase tracking-wide mt-0.5">
            Ebeveyn
          </span>
        </button>
      </div>
    </nav>
  );
};
