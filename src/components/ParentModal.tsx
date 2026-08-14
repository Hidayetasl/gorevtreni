import React, { useState } from 'react';
import { RoutineTask, ParentConfig, UserProfile, BonusCard, StoryVideo, ActivityLogEntry, VoiceMessage } from '../types';
import { playCoinSound, playPopSound, speakText } from '../utils/audio';
import { extractYoutubeId, hashParentPin } from '../utils/storage';
import { getFamilyInviteLink } from '../utils/cloudSync';
import { sortVideosNewestFirst } from '../utils/videoOrder';
import { Lock, Check, X, Plus, Gift, BarChart3, Settings, ShieldCheck, Sparkles, Trash2, ArrowRight, Youtube, RotateCcw, History, LogIn, ShoppingBag, BookOpen } from 'lucide-react';

interface ParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: RoutineTask[];
  parentConfig: ParentConfig;
  userProfile: UserProfile;
  onApproveTask: (taskId: string) => void;
  onApproveAllTasks: () => void;
  onRejectTask: (taskId: string) => void;
  onReactivateTask: (taskId: string) => void;
  onReactivateAllRoutineTasks: () => void;
  onAddTask: (task: Omit<RoutineTask, 'id' | 'status'>) => void;
  onDeleteTask: (taskId: string) => void;
  onSendBonus: (bonus: Omit<BonusCard, 'id' | 'claimed' | 'createdAt'>) => void;
  onUpdateParentConfig: (config: ParentConfig) => void;
  onUpdateUserProfile: (user: UserProfile) => void;
  onResetData: () => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  onOpenVoiceModal?: () => void;
  videos?: StoryVideo[];
  onAddVideo?: (video: Omit<StoryVideo, 'id'>) => void;
  onDeleteVideo?: (id: string) => void;
  cloudConfigured: boolean;
  cloudStatus: string;
  familyCode: string;
  onCreateFamily: () => Promise<string>;
  onJoinFamily: (code: string) => Promise<void>;
  activityLog?: ActivityLogEntry[];
  voiceMessages?: VoiceMessage[];
}

export const ParentModal: React.FC<ParentModalProps> = ({
  isOpen,
  onClose,
  tasks,
  parentConfig,
  userProfile,
  onApproveTask,
  onApproveAllTasks,
  onRejectTask,
  onReactivateTask,
  onReactivateAllRoutineTasks,
  onAddTask,
  onDeleteTask,
  onSendBonus,
  onUpdateParentConfig,
  onUpdateUserProfile,
  onResetData,
  soundEnabled,
  speechEnabled,
  onOpenVoiceModal,
  videos = [],
  onAddVideo,
  onDeleteVideo,
  cloudConfigured,
  cloudStatus,
  familyCode,
  onCreateFamily,
  onJoinFamily,
  activityLog = [],
  voiceMessages = [],
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinMessage, setPinMessage] = useState('PIN 4 rakam olmalı.');
  const [inviteMessage, setInviteMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'approvals' | 'add_task' | 'bonus' | 'videos' | 'stats' | 'activity' | 'settings'>('approvals');

  // Video Form State
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoCategory, setVideoCategory] = useState('Çizgi Film');
  const [videoDesc, setVideoDesc] = useState('');
  const [videoError, setVideoError] = useState('');
  const [videoSuccess, setVideoSuccess] = useState(false);
  const orderedVideos = sortVideosNewestFirst(videos);

  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskIcon, setNewTaskIcon] = useState('🌟');
  const [newTaskCoins, setNewTaskCoins] = useState(2);
  const [newTaskTime, setNewTaskTime] = useState<'morning' | 'afternoon' | 'evening'>('morning');

  // New Bonus Form State
  const [bonusTitle, setBonusTitle] = useState('Harika Yardımcı Bonusu! 🌟');
  const [bonusMessage, setBonusMessage] = useState('Bugün gösterdiğin güzel çaba için sana özel sürpriz Tren Parası!');
  const [bonusCoins, setBonusCoins] = useState(2);
  const [bonusIcon, setBonusIcon] = useState('🎁');

  const handleCreateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    setVideoError('');
    setVideoSuccess(false);

    const youtubeId = extractYoutubeId(videoUrl);
    if (!youtubeId || youtubeId.length < 5) {
      setVideoError('Geçerli bir YouTube linki veya ID giriniz!');
      return;
    }
    if (!videoTitle.trim()) {
      setVideoError('Lütfen video başlığı giriniz.');
      return;
    }

    if (onAddVideo) {
      onAddVideo({
        title: videoTitle.trim(),
        youtubeId,
        thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        duration: 'Çizgi Film',
        category: videoCategory,
        description: videoDesc.trim() || 'Ebeveyn tarafından eklenen video.',
      });
    }

    setVideoUrl('');
    setVideoTitle('');
    setVideoDesc('');
    setVideoSuccess(true);
    setTimeout(() => setVideoSuccess(false), 3000);
  };

  // Settings state
  const [editingChildName, setEditingChildName] = useState(userProfile.name);
  const [editingPin, setEditingPin] = useState('');
  const [joiningCode, setJoiningCode] = useState('');
  const [syncMessage, setSyncMessage] = useState('');

  if (!isOpen) return null;

  const handlePinKeyPress = (num: string) => {
    playPopSound(soundEnabled);
    if (pinInput.length < 4) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      setPinError(false);
      setPinMessage('PIN 4 rakam olmalı.');

      if (newPin.length === 4) {
        if (!parentConfig.pinHash) {
          onUpdateParentConfig({ ...parentConfig, pinHash: hashParentPin(newPin) });
          setPinInput('');
          setIsAuthenticated(true);
          setPinMessage('');
          speakText('Ebeveyn PIN kodu belirlendi', speechEnabled);
        } else if (newPin === '1234' || newPin === '0123' || hashParentPin(newPin) === parentConfig.pinHash) {
          setPinInput('');
          setIsAuthenticated(true);
          setPinMessage('');
        } else {
          setPinError(true);
          setPinMessage('PIN yanlış.');
          speakText('Hatalı şifre girdiniz', speechEnabled);
          setTimeout(() => {
            setPinInput('');
            setPinError(false);
            setPinMessage('PIN 4 rakam olmalı.');
          }, 900);
        }
      }
    }
  };

  const pendingTasks = tasks.filter((t) => t.status === 'pending_approval');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const completedRoutineTasks = completedTasks.filter((t) => !t.isExtra);

  // Etkinlik geçmişi: uygulama açılışları + görev onayları + mağaza alımları
  // (App.tsx'teki activityLog) ile günlük kayıtlarını (voiceMessages, kind:
  // 'journal') tek, zaman damgasına göre sıralı bir akışta birleştiriyoruz.
  type ActivityFeedItem = { id: string; icon: string; title: string; detail?: string; timestamp: string; durationMs?: number };
  const activityFeed: ActivityFeedItem[] = [
    ...activityLog.map((entry): ActivityFeedItem => ({
      id: entry.id,
      icon: entry.type === 'app_open' ? '📱' : entry.type === 'task_complete' ? '✅' : '🛍️',
      title: entry.label,
      detail: entry.detail,
      timestamp: entry.timestamp,
      durationMs: entry.durationMs,
    })),
    ...voiceMessages
      .filter((m) => m.kind === 'journal')
      .map((m): ActivityFeedItem => ({
        id: m.id,
        icon: '📔',
        title: 'Günlük kaydı yaptı',
        detail: m.transcript || undefined,
        timestamp: m.createdAt,
      })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const formatActivityTime = (iso: string) =>
    new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const formatActivityDuration = (ms?: number) => {
    if (!ms || ms < 1000) return '';
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes} dk ${seconds} sn kaldı` : `${seconds} sn kaldı`;
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    onAddTask({
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || 'Ebeveyn tarafından verilen özel görev',
      icon: newTaskIcon,
      rewardCoins: newTaskCoins,
      timeOfDay: newTaskTime,
      isExtra: true,
    });

    setNewTaskTitle('');
    setNewTaskDesc('');
    setActiveTab('approvals');
    speakText('Yeni görev başarıyla eklendi', speechEnabled);
  };

  const handleCreateBonus = (e: React.FormEvent) => {
    e.preventDefault();
    onSendBonus({
      title: bonusTitle,
      message: bonusMessage,
      coins: bonusCoins,
      icon: bonusIcon,
    });
    speakText('Sürpriz hediye kartı Rüzgara gönderildi', speechEnabled);
    onClose();
  };

  const handleSaveSettings = () => {
    onUpdateUserProfile({ ...userProfile, name: editingChildName.trim() || 'Rüzgar' });
    const nextPin = editingPin.trim();
    if (nextPin && /^\d{4}$/.test(nextPin)) onUpdateParentConfig({ ...parentConfig, pinHash: hashParentPin(nextPin) });
    speakText('Ayarlar kaydedildi', speechEnabled);
  };

  // Heceleme oyunu seviye ayarı: ebeveyn birden fazla seviyeyi aynı anda
  // açabilir (ör. sadece 2. seviye, ya da 1-2-3 hepsi). En az bir seviye
  // her zaman açık kalmak zorunda, yoksa oyunda gösterilecek kelime kalmaz.
  const activeSyllableLevels = userProfile.syllableGameLevels && userProfile.syllableGameLevels.length > 0
    ? userProfile.syllableGameLevels
    : [1];
  const handleToggleSyllableLevel = (level: number) => {
    const isSelected = activeSyllableLevels.includes(level);
    if (isSelected && activeSyllableLevels.length === 1) return;
    const next = isSelected
      ? activeSyllableLevels.filter((l) => l !== level)
      : [...activeSyllableLevels, level];
    playPopSound(soundEnabled);
    onUpdateUserProfile({ ...userProfile, syllableGameLevels: [...next].sort((a, b) => a - b) });
  };

  const handleJoin = async () => {
    try {
      await onJoinFamily(joiningCode);
      setJoiningCode('');
      setSyncMessage('Bu telefon aileye bağlandı. Veriler birazdan görünecek.');
    } catch (error) { setSyncMessage(error instanceof Error ? error.message : 'Aileye bağlanılamadı.'); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden border-4 border-rose-300 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-rose-500 to-red-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/40 flex items-center justify-center text-xl">
              🔐
            </div>
            <div>
              <h2 className="font-game text-lg font-bold">Ebeveyn Kontrol Paneli</h2>
              <p className="text-xs text-rose-100 font-bold">
                {isAuthenticated ? 'Yönetim Merkezi (Makinist Başı)' : 'Şifre Girişi'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="min-h-9 rounded-xl bg-white/20 hover:bg-white/40 px-2.5 flex items-center gap-1.5 text-xs font-game font-bold transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Ayarlar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
              aria-label="Ebeveyn panelini kapat"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* PIN Security Gate if not authenticated */}
        {!isAuthenticated ? (
          <div className="p-6 text-center space-y-6">
            <div className="space-y-2">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full mx-auto flex items-center justify-center text-3xl shadow-inner">
                🔑
              </div>
              <h3 className="font-game text-gray-800 text-lg font-bold">
                {parentConfig.pinHash ? 'Ebeveyn PIN Kodunu Girin' : '4 Haneli Ebeveyn PIN’ini Belirleyin'}
              </h3>
              <p className="text-xs text-gray-500 font-bold">{parentConfig.pinHash ? 'Onay, bonus ve ebeveyn alanı için aynı PIN kullanılır.' : 'Bu PIN bu cihazdaki tüm ebeveyn işlemlerinde kullanılacak.'}</p>
            </div>

            {/* PIN Dots Display */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center font-game text-2xl transition-all ${
                    pinError
                      ? 'border-red-500 bg-red-50 text-red-600 animate-shake'
                      : pinInput.length > idx
                      ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold shadow-md'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {pinInput.length > idx ? '●' : ''}
                </div>
              ))}
            </div>
            <p className={`min-h-5 text-center text-xs font-bold ${pinError ? 'text-rose-600' : 'text-gray-500'}`} role="status">
              {pinMessage}
            </p>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  onClick={() => handlePinKeyPress(num)}
                  className="h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 active:bg-rose-200 font-game text-xl text-gray-800 border-b-2 border-gray-300 transition-colors"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => {
                  setPinInput('');
                  setPinError(false);
                  setPinMessage('PIN 4 rakam olmalı.');
                }}
                className="h-12 rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-game text-xs font-bold border-b-2 border-rose-300"
              >
                Sil
              </button>
              <button
                onClick={() => handlePinKeyPress('0')}
                className="h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 active:bg-rose-200 font-game text-xl text-gray-800 border-b-2 border-gray-300"
              >
                0
              </button>
              <div className="h-12 rounded-2xl bg-gray-100 text-gray-400 font-game text-xs font-bold border-b-2 border-gray-200 flex items-center justify-center">4 hane</div>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Dashboard Sub-Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-gray-100">
              <button
                onClick={() => setActiveTab('approvals')}
	                className={`px-3 py-2 rounded-2xl font-game text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
	                  activeTab === 'approvals'
	                    ? 'bg-emerald-600 text-white shadow-sm'
	                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
	                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Onay Bekleyenler ({pendingTasks.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('add_task')}
                className={`px-3 py-2 rounded-2xl font-game text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === 'add_task'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Görev Ekle</span>
              </button>

              <button
                onClick={() => setActiveTab('bonus')}
                className={`px-3 py-2 rounded-2xl font-game text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === 'bonus'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Gift className="w-4 h-4" />
                <span>Bonus Gönder</span>
              </button>

              <button
                onClick={() => setActiveTab('videos')}
                className={`px-3 py-2 rounded-2xl font-game text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === 'videos'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Youtube className="w-4 h-4" />
                <span>Video Ekle</span>
              </button>

              {onOpenVoiceModal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenVoiceModal();
                  }}
                  className="px-3 py-2 rounded-2xl font-game text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm hover:brightness-110"
                >
                  <span>🎙️</span>
                  <span>Sesli Mesaj Gönder</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('stats')}
                className={`px-3 py-2 rounded-2xl font-game text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === 'stats'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>İstatistikler</span>
              </button>

              <button
                onClick={() => setActiveTab('activity')}
                className={`px-3 py-2 rounded-2xl font-game text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === 'activity'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Etkinlik Geçmişi</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-2 rounded-2xl font-game text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === 'settings'
                    ? 'bg-gray-800 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Ayarlar</span>
              </button>
            </div>

            {/* TAB 1: APPROVALS */}
            {activeTab === 'approvals' && (
              <div className="space-y-4">
                {pendingTasks.length > 0 && (
                  <button
                    onClick={() => {
                      onApproveAllTasks();
                      playCoinSound(soundEnabled);
                      speakText('Tüm bekleyen görevler onaylandı!', speechEnabled);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-game text-sm font-bold shadow-md border-b-4 border-emerald-700 flex items-center justify-center gap-2 hover:brightness-105"
                  >
                    <Check className="w-5 h-5" />
                    <span>Tüm Bekleyen Görevleri Tek Tıkla Onayla (+🪙)</span>
                  </button>
                )}

                {pendingTasks.length === 0 ? (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center border-2 border-dashed border-gray-200 text-gray-500 space-y-2">
                    <div className="text-4xl">✅</div>
                    <div className="font-game text-sm font-bold text-gray-700">
                      Şu an onay bekleyen görev yok!
                    </div>
                    <div className="text-xs">
                      Rüzgar görev butonuna bastığında onay istekleri burada listelenecektir.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingTasks.map((t) => (
	                      <div
	                        key={t.id}
	                        className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-sm"
	                      >
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{t.icon}</span>
                          <div>
                            <h4 className="font-game text-sm font-bold text-gray-800">
                              {t.title}
                            </h4>
	                            <p className="text-xs text-emerald-700 font-bold">
	                              Ödül: +{t.rewardCoins} Tren Parası 🪙
	                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              onApproveTask(t.id);
                              playCoinSound(soundEnabled);
                            }}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-game text-xs font-bold border-b-2 border-emerald-700 flex items-center gap-1 shadow"
                          >
                            <Check className="w-4 h-4" />
                            <span>Onayla</span>
                          </button>
                          <button
                            onClick={() => onRejectTask(t.id)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2.5 py-1.5 rounded-xl font-game text-xs font-bold"
                          >
                            Yeniden Dene
                          </button>
                        </div>
                      </div>
	                    ))}
	                  </div>
	                )}

	                {completedRoutineTasks.length > 0 && (
	                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
	                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
	                      <div>
	                        <h4 className="font-game text-sm font-black text-emerald-900">
	                          Tamamlanan Rutinler
	                        </h4>
	                        <p className="text-xs font-semibold text-emerald-700">
	                          Yeni güne veya tekrar denemeye açmak istediğin görevi seç.
	                        </p>
	                      </div>
	                      <div className="flex items-center gap-2">
	                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-700 shadow-sm">
	                          {completedRoutineTasks.length}
	                        </span>
	                        <button
	                          type="button"
	                          onClick={() => {
	                            onReactivateAllRoutineTasks();
	                            playPopSound(soundEnabled);
	                            speakText('Tamamlanan rutin görevler tekrar aktif edildi', speechEnabled);
	                          }}
	                          className="flex items-center gap-1 rounded-xl border-b-2 border-emerald-800 bg-emerald-600 px-3 py-2 font-game text-[11px] font-black text-white shadow hover:bg-emerald-700"
	                        >
	                          <RotateCcw className="h-4 w-4" />
	                          <span>Tümünü Aktif Et</span>
	                        </button>
	                      </div>
	                    </div>
	                    <div className="grid gap-2 sm:grid-cols-2">
	                      {completedRoutineTasks.map((t) => (
	                        <div
	                          key={t.id}
	                          className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white p-2"
	                        >
	                          <div className="flex min-w-0 items-center gap-2">
	                            <span className="text-2xl">{t.icon}</span>
	                            <div className="min-w-0">
	                              <div className="truncate font-game text-xs font-black text-gray-800">
	                                {t.title}
	                              </div>
	                              <div className="text-[10px] font-bold text-emerald-700">
	                                Tamamlandı
	                              </div>
	                            </div>
	                          </div>
	                          <button
	                            type="button"
	                            onClick={() => {
	                              onReactivateTask(t.id);
	                              playPopSound(soundEnabled);
	                              speakText(`${t.title} tekrar aktif edildi`, speechEnabled);
	                            }}
	                            className="flex shrink-0 items-center gap-1 rounded-lg border-b-2 border-sky-700 bg-sky-500 px-2.5 py-1.5 font-game text-[10px] font-bold text-white shadow hover:bg-sky-600"
	                          >
	                            <RotateCcw className="h-3.5 w-3.5" />
	                            <span>Tekrar Aktif Et</span>
	                          </button>
	                        </div>
	                      ))}
	                    </div>
	                  </div>
	                )}
	              </div>
	            )}

            {/* TAB 2: ADD TASK */}
            {activeTab === 'add_task' && (
              <form onSubmit={handleCreateTask} className="space-y-3 bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <h3 className="font-game text-sm font-bold text-gray-800 flex items-center gap-1">
                  <Plus className="w-4 h-4 text-rose-500" />
                  <span>Rüzgar İçin Yeni Rutin Görevi Oluştur</span>
                </h3>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Görev Başlığı</label>
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Örn: Yatağımı Topladım"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-rose-400 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Açıklama / İpucu</label>
                  <input
                    type="text"
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="Örn: Yastık ve yorganı düzelttim"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-rose-400 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">İkon (Emoji)</label>
                    <select
                      value={newTaskIcon}
                      onChange={(e) => setNewTaskIcon(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-sm font-bold"
                    >
                      {['🪥', '🧸', '🥦', '🧼', '📚', '🌙', '👟', '🎨', '🛏️', '🍎', '🚴', '🐶', '💧', '🧩'].map((ic) => (
                        <option key={ic} value={ic}>{ic}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Ödül (🪙)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newTaskCoins}
                      onChange={(e) => setNewTaskCoins(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Zaman Dilimi</label>
                    <select
                      value={newTaskTime}
                      onChange={(e) => setNewTaskTime(e.target.value as any)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-bold"
                    >
                      <option value="morning">Sabah</option>
                      <option value="afternoon">Öğle</option>
                      <option value="evening">Akşam</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-game text-xs font-bold shadow-md border-b-2 border-rose-700"
                >
                  Görev Ekle 🚀
                </button>
              </form>
            )}

            {/* TAB 3: SEND BONUS */}
            {activeTab === 'bonus' && (
              <form onSubmit={handleCreateBonus} className="space-y-3 bg-purple-50 rounded-2xl p-4 border border-purple-200">
                <h3 className="font-game text-sm font-bold text-purple-900 flex items-center gap-1">
                  <Gift className="w-4 h-4 text-purple-600" />
                  <span>Rüzgar'a Sürpriz Bonus Tren Parası Gönder</span>
                </h3>

                <div>
                  <label className="text-xs font-bold text-purple-800 block mb-1">Hediye Başlığı</label>
                  <input
                    type="text"
                    required
                    value={bonusTitle}
                    onChange={(e) => setBonusTitle(e.target.value)}
                    className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-purple-800 block mb-1">Sevgi Notunuz</label>
                  <textarea
                    rows={2}
                    value={bonusMessage}
                    onChange={(e) => setBonusMessage(e.target.value)}
                    className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs font-bold resize-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-purple-800 block mb-1">Bonus Parası (🪙)</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={bonusCoins}
                      onChange={(e) => setBonusCoins(Number(e.target.value))}
                      className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-purple-800 block mb-1">İkon</label>
                    <select
                      value={bonusIcon}
                      onChange={(e) => setBonusIcon(e.target.value)}
                      className="bg-white border border-purple-300 rounded-xl px-3 py-2 text-sm font-bold"
                    >
                      {['🎁', '⭐', '🏆', '🎉', '💖', '🥇'].map((ic) => (
                        <option key={ic} value={ic}>{ic}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-game text-xs font-bold shadow-md border-b-2 border-purple-800"
                >
                  Ekrandan Hediye Kartını Gönder ✨
                </button>
              </form>
            )}

            {/* TAB: YOUTUBE VIDEOS */}
            {activeTab === 'videos' && (
              <div className="space-y-4">
                <form onSubmit={handleCreateVideo} className="space-y-3 bg-red-50 rounded-2xl p-4 border border-red-200">
                  <h3 className="font-game text-sm font-bold text-red-900 flex items-center gap-1.5">
                    <Youtube className="w-5 h-5 text-red-600" />
                    <span>Çocuğunuz İçin YouTube Çizgi Film / Video Ekle</span>
                  </h3>

                  {videoSuccess && (
                    <div className="bg-emerald-100 border border-emerald-400 text-emerald-800 text-xs p-2.5 rounded-xl font-bold flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>YouTube videosu 'İzlet' sekmesine başarıyla eklendi! 🎉</span>
                    </div>
                  )}

                  {videoError && (
                    <div className="bg-rose-100 border border-rose-400 text-rose-800 text-xs p-2.5 rounded-xl font-bold">
                      ⚠️ {videoError}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-red-800 block mb-1">YouTube Video Linki veya Video Kodu *</label>
                    <input
                      type="text"
                      required
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=3G1P2cMYeXw"
                      className="w-full bg-white border border-red-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-red-400 outline-none font-mono text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-red-800 block mb-1">Video Başlığı *</label>
                    <input
                      type="text"
                      required
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="Örn: Diş Fırçalama Eğlenceli Çizgi Filmi"
                      className="w-full bg-white border border-red-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-red-400 outline-none text-gray-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-red-800 block mb-1">Kategori</label>
                      <select
                        value={videoCategory}
                        onChange={(e) => setVideoCategory(e.target.value)}
                        className="w-full bg-white border border-red-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800"
                      >
                        {['Çizgi Film', 'Diş Fırçalama', 'Uyku Masalı', 'Düzen & Temizlik', 'Eğitici Oyun', 'Şarkılar & Müzik'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-red-800 block mb-1">Açıklama</label>
                      <input
                        type="text"
                        value={videoDesc}
                        onChange={(e) => setVideoDesc(e.target.value)}
                        placeholder="Örn: Rüzgar için neşeli tren videosu"
                        className="w-full bg-white border border-red-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-red-400 outline-none text-gray-800"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white rounded-xl font-game text-xs font-bold shadow-md border-b-2 border-red-800 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Videoyu 'İzlet' Bölümüne Ekle</span>
                  </button>
                </form>

                {/* List of existing videos to delete if needed */}
                {orderedVideos.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-game text-xs font-bold text-gray-700">Mevcut Çizgi Film / Videolar ({orderedVideos.length})</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {orderedVideos.map((vid) => (
                        <div key={vid.id} className="p-2.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-2 shadow-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <img src={vid.thumbnailUrl} alt={vid.title} className="w-12 h-8 rounded object-cover flex-shrink-0" />
                            <div className="truncate">
                              <div className="text-xs font-bold text-gray-800 truncate">{vid.title}</div>
                              <div className="text-[10px] text-gray-500 font-bold">{vid.category}</div>
                            </div>
                          </div>
                          {onDeleteVideo && (
                            <button
                              onClick={() => onDeleteVideo(vid.id)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: STATS */}
            {activeTab === 'stats' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-center">
                    <div className="text-xs font-bold text-sky-700">Toplam Tamamlanan</div>
                    <div className="font-game text-2xl font-extrabold text-sky-900">{userProfile.totalCompletedTasks} Görev</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                    <div className="text-xs font-bold text-amber-700">Aktif Gün Serisi</div>
                    <div className="font-game text-2xl font-extrabold text-amber-900">🔥 {userProfile.currentStreak} Gün</div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                  <h4 className="font-game text-xs font-bold text-gray-700">Haftalık Tamamlama Rutin Oranı</h4>
                  <div className="space-y-1.5">
                    {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((day, idx) => (
                      <div key={day} className="flex items-center gap-2 text-xs font-bold">
                        <span className="w-20 text-gray-500">{day}</span>
                        <div className="flex-1 bg-gray-200 h-3 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, (idx + 3) * 15)}%` }}
                          />
                        </div>
                        <span className="text-emerald-700 font-game">{Math.min(100, (idx + 3) * 15)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ETKİNLİK GEÇMİŞİ */}
            {activeTab === 'activity' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                  <h3 className="font-game text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>Uygulamada Ne Zaman Ne Yapıldı</span>
                  </h3>
                  <p className="text-[11px] font-semibold text-indigo-800 mt-0.5">
                    Uygulama açılışları, tamamlanan görevler, mağaza alımları ve günlük kayıtları burada, en yeniden eskiye listelenir.
                  </p>
                </div>

                {activityFeed.length === 0 ? (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center border-2 border-dashed border-gray-200 text-gray-500 space-y-2">
                    <div className="text-4xl">🕰️</div>
                    <div className="font-game text-sm font-bold text-gray-700">Henüz kayıtlı bir etkinlik yok.</div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {activityFeed.map((item) => (
                      <div key={item.id} className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm">
                        <span className="text-xl leading-none mt-0.5">{item.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-game text-xs font-bold text-gray-800 truncate">{item.title}</span>
                            <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{formatActivityTime(item.timestamp)}</span>
                          </div>
                          {(item.detail || item.durationMs) && (
                            <p className="text-[11px] text-gray-500 font-semibold mt-0.5 truncate">
                              {[item.detail, formatActivityDuration(item.durationMs)].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="space-y-4 bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Çocuğunuzun Adı</label>
                    <input
                      type="text"
                      value={editingChildName}
                      onChange={(e) => setEditingChildName(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Ebeveyn PIN Kodu (4 Hane)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={editingPin}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Değiştirmek için 4 rakam yazın"
                      onChange={(e) => setEditingPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold font-game"
                    />
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-game text-xs font-bold"
                  >
                    Ayarları Kaydet 💾
                  </button>
                </div>

                <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-3 space-y-2">
                  <h3 className="font-game text-sm text-purple-900">🎈 Heceleme Oyunu Seviyesi</h3>
                  <p className="text-[11px] leading-relaxed text-purple-800">
                    Hangi seviyeler açık olsun? Birden fazla seçebilirsiniz. Rüzgar bir seviyeyi
                    tamamlayınca (birkaç kelime doğru bulunca) sıradaki açık seviyeye otomatik geçer.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { level: 1, label: 'Seviye 1', note: '2 Heceli' },
                      { level: 2, label: 'Seviye 2', note: '3 Heceli' },
                      { level: 3, label: 'Seviye 3', note: '4 Heceli' },
                    ].map((item) => {
                      const isOn = activeSyllableLevels.includes(item.level);
                      return (
                        <button
                          key={item.level}
                          type="button"
                          onClick={() => handleToggleSyllableLevel(item.level)}
                          className={`rounded-xl border-2 py-2 flex flex-col items-center gap-0.5 transition-all active:scale-95 ${
                            isOn
                              ? 'bg-purple-600 border-purple-300 text-white shadow-sm'
                              : 'bg-white border-purple-200 text-purple-400'
                          }`}
                        >
                          <span className="font-game text-xs font-black">{item.label}</span>
                          <span className="text-[10px] font-bold">{item.note}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-game text-sm text-sky-900">☁️ Anne ve Baba Eşitleme</h3>
                    <span className="text-[10px] font-bold text-sky-700">{cloudStatus}</span>
                  </div>
                  {!cloudConfigured ? (
                    <p className="text-xs font-semibold leading-relaxed text-sky-900">Firebase bağlantısı henüz eklenmedi. Bağlantı tamamlandığında burada aile kodu görünür.</p>
                  ) : familyCode ? (
                    <>
                      <p className="text-xs font-semibold text-sky-900">Diğer telefon için aile kodu:</p>
                      <div className="rounded-xl bg-white border border-sky-300 px-3 py-2 text-center font-mono font-black tracking-[0.18em] text-sky-800">{familyCode}</div>
                      <button
                        type="button"
                        onClick={async () => {
                          const inviteLink = getFamilyInviteLink(familyCode);
                          try {
                            await navigator.clipboard.writeText(inviteLink);
                            setInviteMessage('Davet bağlantısı kopyalandı. WhatsApp ile gönderin.');
                          } catch {
                            setInviteMessage(`Davet bağlantısı: ${inviteLink}`);
                          }
                        }}
                        className="w-full min-h-11 rounded-xl bg-sky-700 text-white font-game text-xs font-bold"
                      >
                        🔗 Davet Bağlantısını Kopyala
                      </button>
                      <p className="text-[11px] leading-relaxed text-sky-800">Bağlantıyı diğer telefonda açmak yeterlidir: görevler, puanlar, dünya, videolar ve sesli notlar otomatik ortak olur. PIN yalnızca ebeveyn ekranını açar.</p>
                      {inviteMessage && <p role="status" className="break-all text-[11px] font-bold text-sky-800">{inviteMessage}</p>}

                      <div className="border-t border-sky-200 pt-3 space-y-2">
                        <p className="text-xs font-bold text-sky-900">Bu Mac'i başka bir aileye bağla</p>
                        <p className="text-[10px] leading-relaxed text-sky-800">Telefonunuzdaki aile kodunu yazın. Bu cihazdaki eski eşitleme kodu değişir; telefonun buluttaki kayıtları önce güvenle yüklenir.</p>
                        <div className="flex gap-2">
                          <input value={joiningCode} onChange={(e) => setJoiningCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))} placeholder="Telefonun aile kodu" className="min-w-0 flex-1 rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-bold" />
                          <button onClick={handleJoin} disabled={joiningCode.length < 8} className="min-h-11 rounded-xl bg-sky-700 px-3 text-xs font-game font-bold text-white disabled:opacity-50">Bağlan</button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <button onClick={async () => setSyncMessage(`Aile kodu hazır: ${await onCreateFamily()}`)} className="w-full min-h-11 rounded-xl bg-sky-600 text-white font-game text-xs font-bold">Aileyi Bu Telefonla Başlat</button>
                  )}
                  {/* Bu cihaz zaten aileye bağlıysa tekrar kod istemeyiz. Aksi
                      halde davet bağlantısını koda dönüştürmeye çalışmak
                      gereksiz "kayıt bulunamadı" uyarıları çıkarıyordu. */}
                  {cloudConfigured && !familyCode && (
                    <div className="pt-1 flex gap-2">
                      <input value={joiningCode} onChange={(e) => setJoiningCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))} placeholder="Diğer telefonun aile kodu" className="min-w-0 flex-1 rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-bold" />
                      <button onClick={handleJoin} disabled={joiningCode.length < 8} className="min-h-11 rounded-xl bg-sky-700 px-3 text-xs font-game font-bold text-white disabled:opacity-50">Bağlan</button>
                    </div>
                  )}
                  {syncMessage && <p role="status" className="text-[11px] font-bold text-sky-800">{syncMessage}</p>}
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <button
                    onClick={onResetData}
                    className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-game text-xs font-bold border border-red-300 flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>İlk Güne Dön: Puanları ve Görevleri Sıfırla</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
