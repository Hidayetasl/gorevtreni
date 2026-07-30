import React, { useState } from 'react';
import { RoutineTask } from '../types';
import { playPopSound, speakText } from '../utils/audio';
import confetti from 'canvas-confetti';
import { Clock, Star } from 'lucide-react';

interface TaskCardProps {
  task: RoutineTask;
  onMarkDone: (taskId: string) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onMarkDone,
  soundEnabled,
  speechEnabled,
}) => {
  const [isPressing, setIsPressing] = useState(false);

  const handleClickDone = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      className={`relative rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 transition-all duration-200 flex flex-col justify-between border-2 sm:border-3 shadow-sm hover:shadow-md ${
        task.isExtra
          ? 'ring-2 ring-purple-400/80 bg-gradient-to-b from-purple-50/60 to-white border-purple-300'
          : task.status === 'completed'
          ? 'bg-emerald-50/90 border-emerald-300'
          : task.status === 'pending_approval'
          ? 'bg-amber-50/90 border-amber-300 animate-pulse'
          : 'bg-white border-sky-200 hover:border-sky-300'
      }`}
    >
      {/* Task Image / Visual Header */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden mb-1.5 border-3 border-sky-500 ring-2 ring-white bg-gradient-to-b from-sky-50 to-blue-50/60 flex items-center justify-center p-0.5 shadow-lg">
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
          <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-game text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-md border border-purple-300 flex items-center gap-1 animate-pulse">
            <span>✨ EK GÖREV</span>
          </div>
        )}

        {/* Emoji Badge on corner if image exists */}
        {task.imageUrl && !task.isExtra && (
          <div className="absolute bottom-0.5 left-0.5 bg-slate-950/80 text-sm sm:text-base px-1.5 py-0.5 rounded-full shadow-md border border-white/60 game-icon">
            {task.icon}
          </div>
        )}

      </div>

      {/* Task Info */}
      <div className="my-1 flex-1">
        <h3 className="font-game text-slate-950 text-xs sm:text-sm font-black leading-snug line-clamp-2">
          {task.title}
        </h3>
        <p className="text-[10px] sm:text-xs text-slate-700 font-semibold mt-0.5 line-clamp-1 leading-tight">
          {task.description}
        </p>
        <div className="mt-1.5 bg-gradient-to-r from-amber-950 via-amber-900 to-yellow-950 border-2 border-amber-400 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-1 shadow-md">
          <span className="text-[10px] sm:text-xs font-bold text-amber-100">Kazanılacak</span>
          <span className="font-game text-lg sm:text-2xl font-black text-amber-300 drop-shadow-[0_2px_0_rgba(120,53,15,0.9)] whitespace-nowrap leading-none">
            +{task.rewardCoins} 🪙
          </span>
        </div>
      </div>

      {/* Bottom Action / Status Area */}
      <div className="mt-1.5 pt-1 border-t border-gray-100">
        {task.status === 'todo' && (
          <button
            onClick={handleClickDone}
            disabled={isPressing}
            className={`w-full py-1.5 px-3 rounded-xl font-game text-xs sm:text-sm font-bold text-white uppercase tracking-wider transition-all duration-150 shadow border-b-3 active:translate-y-0.5 active:border-b-0 ${
              isPressing
                ? 'bg-yellow-500 border-yellow-700 scale-95'
                : 'bg-gradient-to-b from-emerald-500 to-green-600 border-green-800 hover:brightness-105'
            }`}
          >
            {isPressing ? 'SÜPER! 🌟' : 'YAPTIM! 👍'}
          </button>
        )}

        {task.status === 'pending_approval' && (
          <div className="space-y-1">
            <div className="bg-amber-100 text-amber-800 rounded-lg px-2 py-1 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 border border-amber-200">
              <Clock className="w-3 h-3 animate-spin text-amber-600" />
              <span>⏳ Onay Bekliyor</span>
            </div>

          </div>
        )}

        {task.status === 'completed' && (
          <div className="bg-emerald-100 text-emerald-800 rounded-lg px-2 py-1 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 border border-emerald-300">
            <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
            <span>Tamamlandı 🌟</span>
          </div>
        )}
      </div>
    </div>
  );
};
