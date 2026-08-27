import React, { useState } from 'react';
// Tasarım: Pastel Tren Rotası — zaman filtreleri bilet tonlarıyla ayrışır; seçili durak canlıdır.
import { RoutineTask, TimeOfDay } from '../types';
import { TaskCard } from './TaskCard';
import { Sun, Sunset, Moon, Sparkles, Trophy, Mic, BookOpen } from 'lucide-react';

interface TasksViewProps {
  tasks: RoutineTask[];
  onMarkTaskDone: (taskId: string) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  onOpenVoiceModal?: (initialTab?: 'inbox' | 'record') => void;
  onOpenJournal?: (initialTab?: 'inbox' | 'record') => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onMarkTaskDone,
  soundEnabled,
  speechEnabled,
  onOpenVoiceModal,
  onOpenJournal,
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
    <div className="tasks-view space-y-2 pb-24">
      {/* View Header */}
      <div className="tasks-view-header flex items-center justify-between gap-2 px-1">
        <div className="tasks-view-kicker">
          <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.14em]">
            RUTİN GÖREVLERİM
          </div>
        </div>

        {/* Secondary actions only; the Header already owns the message inbox. */}
        <div className="tasks-quick-actions flex flex-wrap items-center justify-end gap-1.5">
          {onOpenVoiceModal && (
            <button
              onClick={() => onOpenVoiceModal('record')}
              className="tasks-action-button bg-blue-600 text-white px-3 py-2 rounded-2xl shadow-lg flex items-center gap-1 text-sm font-bold font-game transition-all active:scale-95"
              aria-label="Sesli mesaj gönder"
              title="Sesli mesaj gönder"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              <span className="tasks-action-label">Gönder</span>
            </button>
          )}
          {onOpenJournal && (
            <button
              onClick={() => onOpenJournal('inbox')}
              className="tasks-action-button bg-blue-600 text-white px-3 py-2 rounded-2xl shadow-lg text-sm font-bold font-game transition-all active:scale-95"
              aria-label="Günlüğümü aç"
              title="Günlüğümü aç"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span className="tasks-action-label">Günlük</span>
            </button>
          )}

          <div className="tasks-progress-pill bg-[#091720] border-2 border-emerald-500/80 px-3 py-1.5 rounded-full shadow-inner flex items-center gap-2">
            <span className="text-white font-bold text-xs sm:text-sm font-game">
              Tamamlanan: {completedCount}/{tasks.length}
            </span>
            <Trophy className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>

      {/* Parent Assigned Extra Tasks Banner */}
      {todoExtraCount > 0 && (
        <div className="bg-gradient-to-r from-green-700 via-green-600 to-green-700 text-white p-3 rounded-2xl shadow-lg border border-green-300/70 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">✨</span>
            <div>
              <div className="font-game text-xs sm:text-sm font-extrabold text-white">
                EBEVEYNİNDEN YENİ EK GÖREV!
              </div>
              <div className="text-[11px] sm:text-xs text-green-50 font-bold">
                Ebeveynin senin için <span className="text-orange-200 font-game">{todoExtraCount}</span> adet özel ek görev tanımladı. Yapıp ekstra para kazanabilirsin!
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelectedTime('extra')}
            className="bg-orange-500 text-white px-3 py-1.5 rounded-xl font-game text-xs font-black shadow-md border border-orange-200 hover:bg-orange-400 flex-shrink-0"
          >
            Görevleri Gör ✨
          </button>
        </div>
      )}

      {/* Time Filter Bar */}
      <div className="tasks-filter-bar max-w-full flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedTime('all')}
          aria-pressed={selectedTime === 'all'}
          data-filter="all"
          className={`tasks-filter-button flex items-center gap-1.5 px-4 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            selectedTime === 'all'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-orange-300" />
          <span>Tüm Görevler ({tasks.length})</span>
        </button>

        {extraTasks.length > 0 && (
          <button
            onClick={() => setSelectedTime('extra')}
            aria-pressed={selectedTime === 'extra'}
            data-filter="extra"
            className={`tasks-filter-button flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
              selectedTime === 'extra'
                ? 'bg-green-600 text-white border-green-300 shadow-md'
                : 'bg-green-950/80 text-green-100 border-green-600/60 hover:bg-green-900'
            }`}
          >
            <span>✨ Ek Görevler ({extraTasks.length})</span>
          </button>
        )}

        <button
          onClick={() => setSelectedTime('morning')}
          aria-pressed={selectedTime === 'morning'}
          data-filter="morning"
          className={`tasks-filter-button flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            selectedTime === 'morning'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <Sun className="w-4 h-4 text-orange-300" />
          <span>🌅 Sabah</span>
        </button>

        <button
          onClick={() => setSelectedTime('afternoon')}
          aria-pressed={selectedTime === 'afternoon'}
          data-filter="afternoon"
          className={`tasks-filter-button flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
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
          aria-pressed={selectedTime === 'evening'}
          data-filter="evening"
          className={`tasks-filter-button flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-game text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
            selectedTime === 'evening'
              ? 'bg-[#2263df] text-white border-blue-400 shadow-md'
              : 'bg-[#16303d] text-slate-300 border-slate-700/60 hover:bg-[#1e4252]'
          }`}
        >
          <Moon className="w-4 h-4 text-blue-200" />
          <span>🌙 Akşam</span>
        </button>
      </div>

      {/* Task Status Summary Bar (Compact & Small) */}
      <div className="tasks-status-summary grid grid-cols-3 gap-1.5 sm:gap-3 py-0.5">
        <div className="bg-[#091720]/90 border border-sky-500/40 rounded-xl px-2.5 py-1.5 flex items-center justify-between shadow-xs">
          <span className="text-[11px] sm:text-xs font-bold text-sky-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            Yapılacak
          </span>
          <span className="font-game text-xs sm:text-sm font-black text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded-md border border-sky-600/50">
            {todoCount}
          </span>
        </div>

        <div className="bg-[#091720]/90 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 flex items-center justify-between shadow-xs">
          <span className="text-[11px] sm:text-xs font-bold text-emerald-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Onay Bekleyen
          </span>
          <span className="font-game text-xs sm:text-sm font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-600/50">
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
              onStartJournal={task.id === 'task-8' ? () => onOpenJournal?.('record') : undefined}
            />
          ))}
        </div>
      )}

      {/* All Tasks Completed Banner */}
      {completedCount > 0 && completedCount === tasks.length && (
        <div className="bg-gradient-to-r from-orange-400 via-orange-300 to-green-400 border-2 border-orange-500 rounded-2xl p-4 text-center text-green-950 shadow-xl space-y-1.5 animate-bounce">
          <Trophy className="w-10 h-10 mx-auto text-green-800 animate-spin" />
          <h2 className="font-game text-xl font-extrabold">
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
