import React, { useState } from 'react';
// Tasarım: Pastel Tren Rotası — beyaz istasyon kartları, sıcak kahve metin, krem puan alanı ve ray turuncusu eylem.
import { RoutineTask } from '../types';
import { playPopSound, speakText } from '../utils/audio';
import confetti from 'canvas-confetti';
import { CheckCircle2, Clock, Star } from 'lucide-react';

interface TaskCardProps {
  task: RoutineTask;
  onMarkDone: (taskId: string) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  onStartJournal?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onMarkDone,
  soundEnabled,
  speechEnabled,
  onStartJournal,
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const isJournalTask = task.id === 'task-8';
  const isActiveTask = task.status === 'todo';

  const handleClickDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.status !== 'todo' || isPressing) return;
    setIsPressing(true);
    playPopSound(soundEnabled);

    // Trigger colorful confetti celebration!
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#4ADE80', '#60A5FA', '#FBBF24', '#F472B6'],
    });

    speakText('Aferin Rüzgar! Şimdi babanın onayını bekliyoruz.', speechEnabled);

    setTimeout(() => {
      onMarkDone(task.id);
      setIsPressing(false);
    }, 400);
  };

  return (
    <div
      className={`task-card-shell relative rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 transition-all duration-200 flex flex-col justify-between border-2 sm:border-3 shadow-sm hover:shadow-md ${
        task.isExtra
          ? 'bg-white border-green-300'
          : task.status === 'completed'
          ? 'bg-white border-green-300'
          : task.status === 'pending_approval'
          ? 'bg-white border-orange-300'
          : 'bg-white border-blue-200 hover:border-blue-300'
      } ${isActiveTask ? 'border-orange-300' : ''}`}
	    >
	      

	      {/* Task Image / Visual Header */}
      <div className="task-card-image relative w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full overflow-hidden mb-1 border-2 border-[#F6B73C] ring-2 ring-[#FFF7D6] bg-[#FFFDF7] flex items-center justify-center p-0.5 shadow-md">
        {task.imageUrl ? (
          <img
            src={task.imageUrl}
            alt={task.title}
            className="h-full w-full object-cover rounded-full transform hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="text-4xl sm:text-5xl game-icon">{task.icon}</div>
        )}

        {/* Ek Görev Badge if parent added */}
        {task.isExtra && (
          <div className="task-extra-badge absolute top-1.5 left-1.5 bg-green-600 text-white font-game text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-md border border-green-300 flex items-center gap-1 animate-pulse">
            <span>✨ EK GÖREV</span>
          </div>
        )}

        {/* Emoji Badge on corner if image exists */}
        {task.imageUrl && !task.isExtra && (
          <div className="absolute bottom-0.5 left-0.5 bg-[#4E342E]/90 text-sm sm:text-base px-1.5 py-0.5 rounded-full shadow-md border border-white/60 game-icon">
            {task.icon}
          </div>
        )}

      </div>

      {/* Task Info */}
      <div className="my-0.5 flex-1">
        <h3 className="task-card-title font-game text-[#4E342E] text-sm sm:text-base font-black leading-snug line-clamp-2">
          {task.title}
        </h3>
        <p className="task-card-description text-xs sm:text-sm text-[#5D514D] font-semibold mt-0.5 line-clamp-2 leading-snug">
          {task.description}
        </p>
        <div className="task-reward-row mt-1 bg-[#FFF8E1] border border-[#FDE68A] rounded-lg px-2 py-1 flex items-center justify-between gap-1 shadow-sm">
          <span className="text-[11px] sm:text-xs font-bold text-[#6D4C41]">Kazanılacak</span>
          <span className="font-game text-base sm:text-xl font-black text-[#C77600] whitespace-nowrap leading-none">
            +{task.rewardCoins} 🪙
          </span>
        </div>
      </div>

      {/* Bottom Action / Status Area */}
      <div className="mt-1.5 pt-1 border-t border-gray-100">
		        {task.status === 'todo' && (
              <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleClickDone}
                    disabled={isPressing}
                  className={`task-card-action ${isPressing ? 'is-pressing' : ''} w-full min-h-11 py-1.5 px-2.5 rounded-xl font-game text-xs sm:text-sm font-black uppercase tracking-wide transition-all duration-150 shadow-md focus-visible:ring-4 focus-visible:ring-orange-200/80 active:translate-y-0.5 active:border-b-0 flex items-center justify-center gap-2 ${
		              isPressing
? 'bg-orange-300 text-green-950 border-orange-700 scale-95'
			                : 'bg-gradient-to-b from-orange-400 via-orange-500 to-red-600 text-white border-b-4 border-red-800 hover:brightness-110'
		            }`}
		          >
                <CheckCircle2 className="h-4 w-4" />
		            {isPressing ? 'SÜPER! 🌟' : 'GÖREVİ TAMAMLADIM 👍'}
		          </button>
              {isJournalTask && onStartJournal && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartJournal();
                  }}
                  className="task-card-journal w-full min-h-10 rounded-xl border border-[#E7B4A8] bg-[#C9483D] px-3 py-1.5 font-game text-xs font-black text-white shadow-sm"
                >
                  GÜNÜMÜ ANLAT
                </button>
              )}
              </div>
		        )}

        {task.status === 'pending_approval' && (
          <div className="space-y-1">
              <div className="bg-orange-50 text-orange-900 rounded-lg px-2 py-1 text-xs sm:text-sm font-bold flex items-center justify-center gap-1 border border-orange-300">
              <Clock className="w-3 h-3 animate-spin text-orange-600" />
              <span>⏳ Onay Bekliyor</span>
            </div>

          </div>
        )}

        {task.status === 'completed' && (
            <div className="bg-green-100 text-green-800 rounded-lg px-2 py-1 text-xs sm:text-sm font-bold flex items-center justify-center gap-1 border border-green-300">
            <Star className="w-3 h-3 text-orange-500 fill-orange-300" />
            <span>Tamamlandı 🌟</span>
          </div>
        )}
      </div>
    </div>
  );
};
