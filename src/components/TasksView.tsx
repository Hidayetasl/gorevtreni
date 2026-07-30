import React, { useState } from 'react';
import { RoutineTask, TimeOfDay } from '../types';
import { TaskCard } from './TaskCard';
import { Sun, Sunset, Moon, Sparkles, Trophy } from 'lucide-react';

interface TasksViewProps {
  tasks: RoutineTask[];
  onMarkTaskDone: (taskId: string) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  onOpenVoiceModal?: (initialTab?: 'inbox' | 'record') => void;
  unreadVoiceCount?: number;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onMarkTaskDone,
  soundEnabled,
  speechEnabled,
  onOpenVoiceModal,
  unreadVoiceCount = 0,
}) => {
  const [selectedTime, setSelectedTime] = useState<TimeOfDay | 'all' | 'extra'>('all');

  const extraTasks = tasks.filter((t) => t.isExtra);
  const todoExtraCount = extraTasks.filter((t) => t.status !== 'completed').length;

  const filteredTasks = tasks.filter((t) => {
    if (selectedTime === 'all') return true;
    if (selectedTime === 'extra') return t.isExtra;
    return t.timeOfDay === selectedTime;
  });

  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending_approval').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-3 pb-24">
      {/* View Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <div className="text-[11px] font-black text-sky-400 uppercase tracking-widest">
            RUTİN GÖREVLERİM
          </div>
          <h2 className="font-game text-2xl sm:text-3xl font-black text-white">
            Görev Treni
          </h2>
        </div>

        {/* Routine progress stats & Voice Message button */}
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {onOpenVoiceModal && (
            <>
              <button
                onClick={() => onOpenVoiceModal('inbox')}
                className={`border-2 text-white px-3 py-2 rounded-2xl shadow-lg flex items-center gap-1.5 text-xs font-bold font-game transition-all active:scale-95 relative ${
                  unreadVoiceCount > 0
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-200 animate-pulse'
                    : 'bg-gradient-to-r from-rose-600 to-pink-600 border-rose-300'
                }`}
              >
                <span>📥 Gelenler</span>
                {unreadVoiceCount > 0 && <span className="bg-white text-rose-600 text-[10px] font-black px-1.5 py-0.2 rounded-full">{unreadVoiceCount}</span>}
              </button>
              <button
                onClick={() => onOpenVoiceModal('record')}
                className="bg-gradient-to-r from-sky-500 to-blue-600 hover:brightness-110 border-2 border-sky-300 text-white px-3 py-2 rounded-2xl shadow-lg flex items-center gap-1 text-xs font-bold font-game transition-all active:scale-95"
              >
                <span>🎙️ Gönder</span>
              </button>
            </>
          )}

          <div className="bg-[#091720] border-2 border-emerald-500/80 px-3 py-1.5 rounded-full shadow-inner flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-xs sm:text-sm font-game">
              Tamamlanan: {completedCount}/{tasks.length}
            </span>
            <Trophy className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Parent Assigned Extra Tasks Banner */}
      {todoExtraCount > 0 && (
        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white p-3.5 rounded-2xl shadow-lg border border-purple-400 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">✨</span>
            <div>
              <div className="font-game text-xs sm:text-sm font-extrabold text-purple-100">
                EBEVEYNİNDEN YENİ EK GÖREV!
              </div>
              <div className="text-[11px] sm:text-xs text-purple-200 font-bold">
                Ebeveynin senin için <span className="text-yellow-300 font-game">{todoExtraCount}</span> adet özel ek görev tanımladı. Yapıp ekstra para kazanabilirsin!
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelectedTime('extra')}
            className="bg-yellow-400 text-purple-950 px-3 py-1.5 rounded-xl font-game text-xs font-black shadow-md border border-yellow-300 hover:bg-yellow-300 flex-shrink-0"
          >
            Görevleri Gör ✨
          </button>
        </div>
      )}

      {/* Time Filter Bar */}
      <div className="max-w-full flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedTime('all')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            selectedTime === 'all'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <span>Tüm Görevler ({tasks.length})</span>
        </button>

        {extraTasks.length > 0 && (
          <button
            onClick={() => setSelectedTime('extra')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
              selectedTime === 'extra'
                ? 'bg-purple-600 text-white border-purple-400 shadow-md ring-2 ring-purple-300'
                : 'bg-purple-950/80 text-purple-200 border-purple-600/60 hover:bg-purple-900'
            }`}
          >
            <span>✨ Ek Görevler ({extraTasks.length})</span>
          </button>
        )}

        <button
          onClick={() => setSelectedTime('morning')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            selectedTime === 'morning'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <Sun className="w-4 h-4 text-amber-400" />
          <span>🌅 Sabah</span>
        </button>

        <button
          onClick={() => setSelectedTime('afternoon')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            selectedTime === 'afternoon'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <Sunset className="w-4 h-4 text-orange-400" />
          <span>☀️ Öğle</span>
        </button>

        <button
          onClick={() => setSelectedTime('evening')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            selectedTime === 'evening'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <Moon className="w-4 h-4 text-indigo-300" />
          <span>🌙 Akşam</span>
        </button>
      </div>

      {/* Task Status Summary Bar (Compact & Small) */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 py-0.5">
        <div className="bg-[#091720]/90 border border-sky-500/40 rounded-xl px-2.5 py-1.5 flex items-center justify-between shadow-xs">
          <span className="text-[11px] sm:text-xs font-bold text-sky-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            Yapılacak
          </span>
          <span className="font-game text-xs sm:text-sm font-black text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded-md border border-sky-600/50">
            {todoCount}
          </span>
        </div>

        <div className="bg-[#091720]/90 border border-amber-500/40 rounded-xl px-2.5 py-1.5 flex items-center justify-between shadow-xs">
          <span className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Onay Bekleyen
          </span>
          <span className="font-game text-xs sm:text-sm font-black text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-600/50">
            {pendingCount}
          </span>
        </div>

        <div className="bg-[#091720]/90 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 flex items-center justify-between shadow-xs">
          <span className="text-[11px] sm:text-xs font-bold text-emerald-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Tamamlanan
          </span>
          <span className="font-game text-xs sm:text-sm font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-600/50">
            {completedCount}
          </span>
        </div>
      </div>

      {/* Task Cards Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white/90 rounded-3xl p-6 text-center border-4 border-dashed border-sky-200 shadow-sm space-y-2">
          <div className="text-4xl">🎉</div>
          <h3 className="font-game text-gray-700 text-base font-bold">
            Bu kategoride görev kalmadı!
          </h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Rüzgar harika bir iş çıkardın! Diğer zaman dilimindeki görevlerine bakabilirsin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onMarkDone={onMarkTaskDone}
              soundEnabled={soundEnabled}
              speechEnabled={speechEnabled}
            />
          ))}
        </div>
      )}

      {/* All Tasks Completed Banner */}
      {completedCount > 0 && completedCount === tasks.length && (
        <div className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 border-4 border-amber-500 rounded-3xl p-6 text-center text-amber-950 shadow-xl space-y-2 animate-bounce">
          <Trophy className="w-12 h-12 mx-auto text-amber-700 animate-spin" />
          <h2 className="font-game text-2xl font-extrabold">
            TEBRİKLER RÜZGAR! 🏆
          </h2>
          <p className="text-sm font-bold">
            Bugünkü tüm rutin görevlerini tamamladın! Şimdi Tren Dünyana gidip ray inşa edebilir veya Mağazadan yeni oyuncaklar alabilirsin!
          </p>
        </div>
      )}
    </div>
  );
};
