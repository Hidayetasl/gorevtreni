import React from 'react';
import { TabType } from '../types';
import { ClipboardList, Globe, ShoppingBag, Tv, Lock } from 'lucide-react';

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
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t-4 border-sky-400 px-2 py-1.5 sm:px-3 sm:py-2 shadow-2xl">
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
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'tasks'
                ? 'bg-sky-500 text-white shadow-md border-b-4 border-sky-700'
                : 'bg-slate-100 border border-slate-300 text-slate-700 shadow-sm'
            }`}
          >
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[9px] sm:text-[11px] font-game uppercase tracking-wide mt-0.5 sm:mt-1">
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
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'world'
                ? 'bg-emerald-500 text-white shadow-md border-b-4 border-emerald-700'
                : 'bg-slate-100 border border-slate-300 text-slate-700 shadow-sm'
            }`}
          >
            <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[9px] sm:text-[11px] font-game uppercase tracking-wide mt-0.5 sm:mt-1">
            Dünyam
          </span>
        </button>

        {/* Center elevated button: Mağaza */}
        <div className="relative -top-3.5 sm:-top-5">
          <button
            onClick={() => onChangeTab('shop')}
            className={`w-[52px] h-[52px] sm:w-16 sm:h-16 rounded-full border-[3px] sm:border-4 border-white shadow-xl flex flex-col items-center justify-center text-white transition-all duration-200 active:scale-90 ${
              activeTab === 'shop'
                ? 'bg-gradient-to-b from-amber-400 to-yellow-500 ring-4 ring-amber-300 scale-110 border-b-4 border-amber-700'
                : 'bg-gradient-to-b from-red-500 to-rose-600 border-b-4 border-red-800 hover:brightness-110'
            }`}
          >
            <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-sm" />
            <span className="text-[8px] sm:text-[9px] font-game uppercase tracking-tighter">
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
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'videos'
                ? 'bg-indigo-500 text-white shadow-md border-b-4 border-indigo-700'
                : 'bg-slate-100 border border-slate-300 text-slate-700 shadow-sm'
            }`}
          >
            <Tv className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[9px] sm:text-[11px] font-game uppercase tracking-wide mt-0.5 sm:mt-1">
            İzlet
          </span>
        </button>

        {/* Tab 4: Ebeveyn */}
        <button
          onClick={onOpenParentModal}
          className="flex flex-col items-center justify-center text-rose-500 hover:text-rose-700 transition-all duration-200 active:scale-95 relative"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-game w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-[9px] sm:text-[11px] font-game uppercase tracking-wide mt-0.5 sm:mt-1">
            Ebeveyn
          </span>
        </button>
      </div>
    </nav>
  );
};
