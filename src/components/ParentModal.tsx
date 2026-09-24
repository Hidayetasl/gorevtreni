import React, { useEffect, useRef, useState } from 'react';
import { RoutineTask, ParentConfig, UserProfile, BonusCard, StoryVideo, ActivityLogEntry, VoiceMessage } from '../types';
import { playCoinSound, playPopSound, speakText } from '../utils/audio';
import { extractYoutubeId, hashParentPin, isWeakParentPin, needsNewParentPin } from '../utils/storage';

/** PIN girildikten sonra panel bu süre boyunca yeniden PIN sormadan açılır. */
const PARENT_UNLOCK_MS = 5 * 60 * 1000;
import { getFamilyInviteLink } from '../utils/cloudSync';
import { sortVideosNewestFirst } from '../utils/videoOrder';
import { ArrowLeft, Check, ChevronRight, Gift, History, ListChecks, Lock, Mic, Plus, RefreshCw, RotateCcw, Settings, Trash2, Tv, TrendingUp, Volume2, VolumeX, X } from 'lucide-react';
import '../design/parent.css';

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
  onApproveVideo?: (id: string) => void;
  onBlockVideo?: (id: string) => void;
  cloudConfigured: boolean;
  cloudStatus: string;
  familyCode: string;
  onCreateFamily: () => Promise<string>;
  onJoinFamily: (code: string) => Promise<void>;
  activityLog?: ActivityLogEntry[];
  voiceMessages?: VoiceMessage[];
  weeklyStats?: Array<{ label: string; dateKey: string; rate: number | null }>;
  /** Eski üst çubuktan taşınan yetişkin işleri (çocuk ekranında artık görünmez). */
  deviceControls?: {
    adultName?: string;
    onToggleSound: () => void;
    onManualSync: () => void;
    isSyncing: boolean;
    onSwitchAccount?: () => void;
    isActiveDevice: boolean;
    activeDeviceLabel?: string;
    onSetActiveDevice: (checked: boolean) => void;
  };
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
  onApproveVideo,
  onBlockVideo,
  cloudConfigured,
  cloudStatus,
  familyCode,
  onCreateFamily,
  onJoinFamily,
  activityLog = [],
  voiceMessages = [],
  weeklyStats = [],
  deviceControls,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const unlockedAtRef = useRef(0);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinMessage, setPinMessage] = useState('PIN 4 rakam olmalı.');
  const [inviteMessage, setInviteMessage] = useState('');
  // null = panelin ana sayfası (kimin yanında + onaylar + bölüm kartları).
  type Section = 'tasks' | 'bonus' | 'videos' | 'stats' | 'activity' | 'settings';
  const [section, setSection] = useState<Section | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [taskMessage, setTaskMessage] = useState('');

  // Video Form State
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoCategory, setVideoCategory] = useState('Çizgi Film');
  const [videoDesc, setVideoDesc] = useState('');
  const [videoError, setVideoError] = useState('');
  const [videoSuccess, setVideoSuccess] = useState(false);
  const orderedVideos = sortVideosNewestFirst(videos);
  const journalEntries = voiceMessages.filter((message) => message.kind === 'journal');
  const receivedVoiceMessages = voiceMessages.filter((message) => message.kind !== 'journal' && message.sender === 'child');
  const sentVoiceMessages = voiceMessages.filter((message) => message.kind !== 'journal' && message.sender === 'parent');
  const latestJournal = [...journalEntries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

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

  const [editingPinAgain, setEditingPinAgain] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  // Panel kapanıp tekrar açıldığında, son PIN girişinin üzerinden 5 dakika
  // geçtiyse yeniden kilitlenir; açık unutulan panel Rüzgar'a kalmaz.
  useEffect(() => {
    if (isOpen && Date.now() - unlockedAtRef.current > PARENT_UNLOCK_MS) {
      setIsAuthenticated(false);
      setPinInput('');
    }
    // Panel her açılışta ana sayfadan başlar; yarım kalan onaylar kapanır.
    if (isOpen) {
      setSection(null);
      setConfirmDeleteId(null);
      setConfirmReset(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const unlock = () => {
    unlockedAtRef.current = Date.now();
    setIsAuthenticated(true);
  };

  const handlePinKeyPress = (num: string) => {
    playPopSound(soundEnabled);
    if (pinInput.length < 4) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      setPinError(false);
      setPinMessage('PIN 4 rakam olmalı.');

      if (newPin.length === 4) {
        // PIN yalnızca giriş ekranında, hesap şifresiyle giriş yapmış yetişkin
        // tarafından belirlenir. Panelde "ilk yazılan PIN kaydedilir" yolu yoktur.
        if (parentConfig.pinHash && hashParentPin(newPin) === parentConfig.pinHash) {
          setPinInput('');
          unlock();
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

    setTaskMessage(`“${newTaskTitle.trim()}” eklendi.`);
    setNewTaskTitle('');
    setNewTaskDesc('');
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
    if (nextPin) {
      if (!/^\d{4}$/.test(nextPin) || nextPin !== editingPinAgain) {
        setSettingsMessage('Yeni PIN iki alanda da aynı 4 rakam olmalı.');
        return;
      }
      if (isWeakParentPin(nextPin) || needsNewParentPin(hashParentPin(nextPin))) {
        setSettingsMessage('Bu PIN kolay tahmin edilir. Başka 4 rakam seçin.');
        return;
      }
      onUpdateParentConfig({ ...parentConfig, pinHash: hashParentPin(nextPin) });
      setEditingPin('');
      setEditingPinAgain('');
    }
    setSettingsMessage(nextPin ? 'Ayarlar ve yeni PIN kaydedildi. PIN ailedeki tüm cihazlarda geçerli.' : 'Ayarlar kaydedildi.');
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

  const TIME_LABEL: Record<string, string> = { morning: 'Sabah', afternoon: 'Öğle', evening: 'Akşam' };
  const liveTasks = tasks.filter((t) => !t.deletedAt);
  const SECTIONS: Array<{ id: Section; label: string; detail: string; Icon: typeof Plus; tone: string }> = [
    { id: 'tasks', label: 'Görevler', detail: 'Ekle, sil, yeniden aç', Icon: ListChecks, tone: 'yesil' },
    { id: 'bonus', label: 'Bonus gönder', detail: 'Sürpriz puan kartı', Icon: Gift, tone: 'mor' },
    { id: 'videos', label: 'Videolar', detail: `${videos.filter((v) => v.moderationStatus !== 'approved').length} onay bekliyor`, Icon: Tv, tone: 'mavi' },
    { id: 'stats', label: 'İstatistik', detail: 'Hafta ve seri', Icon: TrendingUp, tone: 'turkuaz' },
    { id: 'activity', label: 'Geçmiş', detail: 'Ne zaman ne yapıldı', Icon: History, tone: 'turuncu' },
    { id: 'settings', label: 'Ayarlar', detail: 'PIN, aile, cihaz', Icon: Settings, tone: 'gri' },
  ];
  const currentSection = SECTIONS.find((item) => item.id === section);

  const openSection = (next: Section | null) => {
    playPopSound(soundEnabled);
    setSection(next);
    setConfirmDeleteId(null);
    setConfirmReset(false);
    setTaskMessage('');
  };

  return (
    <div className="pp-wrap" role="dialog" aria-modal="true" aria-label="Ebeveyn paneli">
      <div className="pp">
        {/* Üst çubuk */}
        <header className="pp-top">
          {isAuthenticated && section ? (
            <button type="button" className="pp-back" onClick={() => openSection(null)} aria-label="Panel ana sayfasına dön">
              <ArrowLeft aria-hidden="true" strokeWidth={3} />
            </button>
          ) : (
            <span className="pp-badge" aria-hidden="true"><Lock /></span>
          )}
          <div className="pp-title">
            <h2>{isAuthenticated && currentSection ? currentSection.label : 'Ebeveyn paneli'}</h2>
            <small>{isAuthenticated ? (deviceControls?.adultName ? `${deviceControls.adultName} · açık` : 'Açık') : 'PIN ile açılır'}</small>
          </div>
          <button type="button" className="pp-close" onClick={onClose} aria-label="Ebeveyn panelini kapat">
            <X aria-hidden="true" />
          </button>
        </header>

        {!isAuthenticated ? (
          /* PIN kapısı */
          <div className="pp-body pp-pin">
            <p className="pp-lead">{parentConfig.pinHash ? 'Aile PIN’ini girin' : 'Aile PIN’i henüz yüklenmedi'}</p>
            <p className="pp-muted">{parentConfig.pinHash ? 'Ailedeki tüm cihazlarda aynı PIN geçerlidir.' : 'İnternet bağlantısını kontrol edin. PIN buluttan gelince panel açılır.'}</p>
            <div className={`pp-dots ${pinError ? 'err' : ''}`} aria-hidden="true">
              {[0, 1, 2, 3].map((idx) => <i key={idx} className={pinInput.length > idx ? 'on' : ''} />)}
            </div>
            <p className={`pp-pinmsg ${pinError ? 'err' : ''}`} role="status">{pinMessage}</p>
            <div className="pp-keys">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button key={num} type="button" onClick={() => handlePinKeyPress(num)}>{num}</button>
              ))}
              <button type="button" className="soft" onClick={() => { setPinInput(''); setPinError(false); setPinMessage('PIN 4 rakam olmalı.'); }}>Sil</button>
              <button type="button" onClick={() => handlePinKeyPress('0')}>0</button>
              <span />
            </div>
          </div>
        ) : section === null ? (
          /* Ana sayfa */
          <div className="pp-body">
            {deviceControls && (
              <section className={`pp-card pp-who ${deviceControls.isActiveDevice ? 'here' : ''}`}>
                <div className="pp-row">
                  <div>
                    <p className="pp-label">RÜZGAR ŞU ANDA KİMİN YANINDA?</p>
                    <p className="pp-big">{deviceControls.isActiveDevice ? `${deviceControls.adultName || 'Bu telefon'}’ın yanında` : deviceControls.activeDeviceLabel ? `${deviceControls.activeDeviceLabel}` : 'Henüz seçilmedi'}</p>
                  </div>
                  <span className="pp-whoicon" aria-hidden="true">{deviceControls.isActiveDevice ? '🧒' : '📱'}</span>
                </div>
                <label className="pp-switch">
                  <input type="checkbox" checked={deviceControls.isActiveDevice} onChange={(event) => deviceControls.onSetActiveDevice(event.target.checked)} />
                  <span className="track" aria-hidden="true"><span className="knob" /></span>
                  <span>Rüzgar şu an bu telefonda</span>
                </label>
              </section>
            )}

            <section className="pp-card">
              <div className="pp-row">
                <p className="pp-label">ONAY BEKLEYEN GÖREVLER</p>
                <span className={`pp-count ${pendingTasks.length ? 'on' : ''}`}>{pendingTasks.length}</span>
              </div>
              {pendingTasks.length === 0 ? (
                <p className="pp-muted">Şu an onay bekleyen görev yok. Rüzgar “Bitti!” dediğinde burada görünür.</p>
              ) : (
                <>
                  <ul className="pp-list">
                    {pendingTasks.map((t) => (
                      <li key={t.id} className="pp-item">
                        <span className="pp-ic" aria-hidden="true">{t.imageUrl ? <img src={t.imageUrl} alt="" /> : t.icon}</span>
                        <span className="pp-itext"><b>{t.title}</b><small>+{t.rewardCoins} puan · {TIME_LABEL[t.timeOfDay] || ''}</small></span>
                        <button type="button" className="pp-btn soft" onClick={() => onRejectTask(t.id)} aria-label={`${t.title}: tekrar yapsın`}>
                          <RotateCcw aria-hidden="true" />
                        </button>
                        <button type="button" className="pp-btn ok" onClick={() => { onApproveTask(t.id); playCoinSound(soundEnabled); }}>
                          <Check aria-hidden="true" strokeWidth={3} />Onayla
                        </button>
                      </li>
                    ))}
                  </ul>
                  {pendingTasks.length > 1 && (
                    <button type="button" className="pp-wide ok" onClick={() => { onApproveAllTasks(); playCoinSound(soundEnabled); speakText('Tüm bekleyen görevler onaylandı!', speechEnabled); }}>
                      <Check aria-hidden="true" strokeWidth={3} />Hepsini onayla (+{pendingTasks.reduce((sum, t) => sum + t.rewardCoins, 0)} puan)
                    </button>
                  )}
                  <p className="pp-muted small">↺ “Tekrar yapsın” görevi Rüzgar’a geri gönderir, puan verilmez.</p>
                </>
              )}
            </section>

            <div className="pp-grid">
              {onOpenVoiceModal && (
                <button type="button" className="pp-tile mor" onClick={() => { onClose(); onOpenVoiceModal(); }}>
                  <span className="ti" aria-hidden="true"><Mic /></span>
                  <span className="tt"><b>Sesli mesaj</b><small>Rüzgar’a gönder</small></span>
                </button>
              )}
              {SECTIONS.map(({ id, label, detail, Icon, tone }) => (
                <button key={id} type="button" className={`pp-tile ${tone}`} onClick={() => openSection(id)}>
                  <span className="ti" aria-hidden="true"><Icon /></span>
                  <span className="tt"><b>{label}</b><small>{detail}</small></span>
                </button>
              ))}
            </div>
            <p className="pp-muted small pp-status">{cloudStatus}</p>
          </div>
        ) : (
          <div className="pp-body">
            {/* GÖREVLER */}
            {section === 'tasks' && (
              <>
                <form onSubmit={handleCreateTask} className="pp-card pp-form">
                  <p className="pp-label">YENİ GÖREV</p>
                  <label>Görev adı
                    <input type="text" required value={newTaskTitle} onChange={(e) => { setNewTaskTitle(e.target.value); setTaskMessage(''); }} placeholder="Örn: Ayakkabılarımı dizdim" />
                  </label>
                  <label>Kısa açıklama (isteğe bağlı)
                    <input type="text" value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} placeholder="Örn: Kapının önüne yan yana" />
                  </label>
                  <div className="pp-cols">
                    <label>Simge
                      <select value={newTaskIcon} onChange={(e) => setNewTaskIcon(e.target.value)}>
                        {['🌟', '🪥', '🧸', '🥦', '🧼', '📚', '🌙', '👟', '🎨', '🛏️', '🍎', '🚴', '🐶', '💧', '🧩'].map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                      </select>
                    </label>
                    <label>Puan
                      <input type="number" min={1} max={10} value={newTaskCoins} onChange={(e) => setNewTaskCoins(Number(e.target.value))} />
                    </label>
                    <label>Zaman
                      <select value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value as 'morning' | 'afternoon' | 'evening')}>
                        <option value="morning">Sabah</option>
                        <option value="afternoon">Öğle</option>
                        <option value="evening">Akşam</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="pp-wide ok"><Plus aria-hidden="true" />Görevi ekle</button>
                  {taskMessage && <p className="pp-note ok" role="status">✓ {taskMessage}</p>}
                </form>

                <section className="pp-card">
                  <div className="pp-row">
                    <p className="pp-label">TÜM GÖREVLER ({liveTasks.length})</p>
                    {completedRoutineTasks.length > 0 && (
                      <button type="button" className="pp-link" onClick={() => { onReactivateAllRoutineTasks(); playPopSound(soundEnabled); }}>
                        <RotateCcw aria-hidden="true" />Bitenleri yeniden aç
                      </button>
                    )}
                  </div>
                  <ul className="pp-list">
                    {liveTasks.map((t) => (
                      <li key={t.id} className="pp-item">
                        <span className="pp-ic" aria-hidden="true">{t.imageUrl ? <img src={t.imageUrl} alt="" /> : t.icon}</span>
                        <span className="pp-itext">
                          <b>{t.title}</b>
                          <small>
                            {TIME_LABEL[t.timeOfDay] || ''} · +{t.rewardCoins} puan · {t.status === 'completed' ? '✓ bitti' : t.status === 'pending_approval' ? '⏳ onayda' : 'yapılacak'}{t.isExtra ? ' · ekstra' : ''}
                          </small>
                        </span>
                        {confirmDeleteId === t.id ? (
                          <span className="pp-confirm">
                            <button type="button" className="pp-btn soft" onClick={() => setConfirmDeleteId(null)}>Vazgeç</button>
                            <button type="button" className="pp-btn danger" onClick={() => { onDeleteTask(t.id); setConfirmDeleteId(null); playPopSound(soundEnabled); }}>Sil</button>
                          </span>
                        ) : (
                          <>
                            {t.status === 'completed' && !t.isExtra && (
                              <button type="button" className="pp-btn soft" onClick={() => { onReactivateTask(t.id); playPopSound(soundEnabled); }} aria-label={`${t.title}: yeniden aç`}>
                                <RotateCcw aria-hidden="true" />
                              </button>
                            )}
                            <button type="button" className="pp-btn soft" onClick={() => setConfirmDeleteId(t.id)} aria-label={`${t.title}: sil`}>
                              <Trash2 aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="pp-muted small">Silinen görev ailedeki bütün cihazlardan kalkar.</p>
                </section>
              </>
            )}

            {/* BONUS */}
            {section === 'bonus' && (
              <form onSubmit={handleCreateBonus} className="pp-card pp-form">
                <p className="pp-muted">Rüzgar’ın ekranında bir hediye kartı açılır; kartı açınca puan onun olur.</p>
                <label>Başlık
                  <input type="text" required value={bonusTitle} onChange={(e) => setBonusTitle(e.target.value)} />
                </label>
                <label>Sevgi notun
                  <textarea rows={2} value={bonusMessage} onChange={(e) => setBonusMessage(e.target.value)} />
                </label>
                <div className="pp-cols two">
                  <label>Puan
                    <input type="number" min={1} max={20} value={bonusCoins} onChange={(e) => setBonusCoins(Number(e.target.value))} />
                  </label>
                  <label>Simge
                    <select value={bonusIcon} onChange={(e) => setBonusIcon(e.target.value)}>
                      {['🎁', '⭐', '🏆', '🎉', '💖', '🥇'].map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                    </select>
                  </label>
                </div>
                <button type="submit" className="pp-wide mor"><Gift aria-hidden="true" />Hediye kartını gönder</button>
              </form>
            )}

            {/* VİDEOLAR */}
            {section === 'videos' && (
              <>
                <form onSubmit={handleCreateVideo} className="pp-card pp-form">
                  <p className="pp-label">VİDEO EKLE</p>
                  <p className="pp-muted">Eklenen video önce onay kuyruğuna girer; siz “Çocukta göster” deyince YouTube’dan doğrulanıp İzle ekranına çıkar.</p>
                  <label>YouTube bağlantısı
                    <input type="text" required value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
                  </label>
                  <label>Başlık
                    <input type="text" required value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="Örn: Diş fırçalama şarkısı" />
                  </label>
                  <div className="pp-cols two">
                    <label>Kategori
                      <select value={videoCategory} onChange={(e) => setVideoCategory(e.target.value)}>
                        {['Çizgi Film', 'Diş Fırçalama', 'Uyku Masalı', 'Düzen & Temizlik', 'Eğitici Oyun', 'Şarkılar & Müzik'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label>Açıklama
                      <input type="text" value={videoDesc} onChange={(e) => setVideoDesc(e.target.value)} placeholder="İsteğe bağlı" />
                    </label>
                  </div>
                  {videoError && <p className="pp-note warn" role="alert">{videoError}</p>}
                  {videoSuccess && <p className="pp-note ok" role="status">✓ Video kuyruğa eklendi. Aşağıdan “Çocukta göster” ile onaylayın.</p>}
                  <button type="submit" className="pp-wide mavi"><Plus aria-hidden="true" />Onay kuyruğuna ekle</button>
                </form>

                {orderedVideos.length > 0 && (
                  <section className="pp-card">
                    <p className="pp-label">VİDEOLAR ({orderedVideos.length})</p>
                    <ul className="pp-list">
                      {orderedVideos.map((vid) => {
                        const status = vid.moderationStatus || 'pending';
                        return (
                          <li key={vid.id} className="pp-item pp-vitem">
                            <img className="pp-thumb" src={vid.thumbnailUrl} alt="" />
                            <span className="pp-itext">
                              <b>{vid.title}</b>
                              <small className={`st ${status}`}>{status === 'approved' ? '✓ Çocukta gösteriliyor' : status === 'blocked' ? 'Gizlendi' : '⏳ Onay bekliyor'}</small>
                              {vid.failureReason && <small className="st warn">{vid.failureReason}</small>}
                            </span>
                            <span className="pp-vbtns">
                              {status !== 'approved' && onApproveVideo && <button type="button" className="pp-btn ok" onClick={() => onApproveVideo(vid.id)}>Çocukta göster</button>}
                              {status !== 'blocked' && onBlockVideo && <button type="button" className="pp-btn soft" onClick={() => onBlockVideo(vid.id)}>Gizle</button>}
                              {onDeleteVideo && (
                                confirmDeleteId === vid.id
                                  ? <button type="button" className="pp-btn danger" onClick={() => { onDeleteVideo(vid.id); setConfirmDeleteId(null); }}>Kalıcı sil</button>
                                  : <button type="button" className="pp-btn soft" onClick={() => setConfirmDeleteId(vid.id)} aria-label={`${vid.title}: sil`}><Trash2 aria-hidden="true" /></button>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </>
            )}

            {/* İSTATİSTİK */}
            {section === 'stats' && (
              <>
                <div className="pp-stats">
                  <div className="pp-stat"><small>Toplam biten görev</small><b>{userProfile.totalCompletedTasks}</b></div>
                  <div className="pp-stat"><small>Gün serisi</small><b>🔥 {userProfile.currentStreak}</b></div>
                  <div className="pp-stat"><small>Puan</small><b>{userProfile.coins}</b></div>
                </div>
                <section className="pp-card">
                  <p className="pp-label">BU HAFTA RUTİNLER</p>
                  <div className="pp-week">
                    {weeklyStats.map((day) => {
                      const labels: Record<string, string> = { Paz: 'Pazar', Pzt: 'Pazartesi', Sal: 'Salı', Çar: 'Çarşamba', Per: 'Perşembe', Cum: 'Cuma', Cmt: 'Cumartesi' };
                      const hasData = day.rate !== null;
                      const rate = day.rate ?? 0;
                      return (
                        <div key={day.dateKey} className="pp-day">
                          <span>{labels[day.label] || day.label}</span>
                          <span className="bar" aria-label={hasData ? `%${rate} tamamlandı` : 'Henüz veri yok'}><i style={{ width: `${rate}%` }} /></span>
                          <b>{hasData ? `%${rate}` : '—'}</b>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="pp-card">
                  <p className="pp-label">GÜNLÜK VE SESLİ MESAJLAR</p>
                  <div className="pp-stats in">
                    <div className="pp-stat"><small>Günlük</small><b>{journalEntries.length}</b></div>
                    <div className="pp-stat"><small>Rüzgar’dan</small><b>{receivedVoiceMessages.length}</b></div>
                    <div className="pp-stat"><small>Ona giden</small><b>{sentVoiceMessages.length}</b></div>
                  </div>
                  <p className="pp-muted">{latestJournal ? `Son günlük: ${latestJournal.title || 'Bugünüm'} · ${new Date(latestJournal.createdAt).toLocaleDateString('tr-TR')}` : 'Henüz günlük kaydı yok.'}</p>
                </section>
              </>
            )}

            {/* GEÇMİŞ */}
            {section === 'activity' && (
              <section className="pp-card">
                <p className="pp-muted">Uygulama açılışları, onaylanan görevler, alışverişler ve günlükler; en yeni en üstte.</p>
                {activityFeed.length === 0 ? (
                  <p className="pp-muted">Henüz kayıtlı bir etkinlik yok.</p>
                ) : (
                  <ul className="pp-list">
                    {activityFeed.slice(0, 150).map((item) => (
                      <li key={item.id} className="pp-item pp-feed">
                        <span className="pp-ic" aria-hidden="true">{item.icon}</span>
                        <span className="pp-itext">
                          <b>{item.title}</b>
                          {(item.detail || item.durationMs) && <small>{[item.detail, formatActivityDuration(item.durationMs)].filter(Boolean).join(' · ')}</small>}
                        </span>
                        <time className="pp-time">{formatActivityTime(item.timestamp)}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* AYARLAR */}
            {section === 'settings' && (
              <>
                {deviceControls && (
                  <section className="pp-card">
                    <p className="pp-label">BU CİHAZ{deviceControls.adultName ? ` · ${deviceControls.adultName.toLocaleUpperCase('tr-TR')}` : ''}</p>
                    <div className="pp-cols two">
                      <button type="button" className="pp-wide soft" onClick={deviceControls.onToggleSound}>
                        {soundEnabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}{soundEnabled ? 'Ses açık' : 'Ses kapalı'}
                      </button>
                      <button type="button" className="pp-wide soft" onClick={deviceControls.onManualSync} disabled={deviceControls.isSyncing}>
                        <RefreshCw aria-hidden="true" />{deviceControls.isSyncing ? 'Eşitleniyor…' : 'Şimdi eşitle'}
                      </button>
                    </div>
                    <p className="pp-muted small">{cloudStatus}</p>
                    {deviceControls.onSwitchAccount && (
                      <button type="button" className="pp-wide soft" onClick={deviceControls.onSwitchAccount}>Bu cihazda çıkış yap / hesap değiştir</button>
                    )}
                  </section>
                )}

                <section className="pp-card pp-form">
                  <p className="pp-label">ÇOCUK VE PIN</p>
                  <label>Çocuğun adı
                    <input type="text" value={editingChildName} onChange={(e) => setEditingChildName(e.target.value)} />
                  </label>
                  <label>Yeni aile PIN’i (4 rakam)
                    <input type="password" autoComplete="new-password" maxLength={4} value={editingPin} inputMode="numeric" pattern="[0-9]*" placeholder="Değiştirmek için yazın"
                      onChange={(e) => { setEditingPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setSettingsMessage(''); }} />
                  </label>
                  {editingPin && (
                    <label>Yeni PIN tekrar
                      <input type="password" autoComplete="new-password" maxLength={4} value={editingPinAgain} inputMode="numeric" pattern="[0-9]*" placeholder="Aynı 4 rakam"
                        onChange={(e) => { setEditingPinAgain(e.target.value.replace(/\D/g, '').slice(0, 4)); setSettingsMessage(''); }} />
                    </label>
                  )}
                  <button type="button" className="pp-wide dark" onClick={handleSaveSettings}>Kaydet</button>
                  {settingsMessage && <p role="status" className="pp-note">{settingsMessage}</p>}
                </section>

                <section className="pp-card">
                  <p className="pp-label">HECE OYUNU SEVİYELERİ</p>
                  <p className="pp-muted">Açık seviyeler arasında Rüzgar ilerledikçe otomatik geçilir. En az biri açık kalır.</p>
                  <div className="pp-chips">
                    {[{ level: 1, note: '2 heceli' }, { level: 2, note: '3 heceli' }, { level: 3, note: '4 heceli' }].map((item) => (
                      <button key={item.level} type="button" className={activeSyllableLevels.includes(item.level) ? 'on' : ''} aria-pressed={activeSyllableLevels.includes(item.level)} onClick={() => handleToggleSyllableLevel(item.level)}>
                        <b>Seviye {item.level}</b><small>{item.note}</small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="pp-card">
                  <p className="pp-label">AİLE EŞİTLEMESİ</p>
                  {!cloudConfigured ? (
                    <p className="pp-muted">Bulut bağlantısı yapılandırılmadı.</p>
                  ) : familyCode ? (
                    <>
                      <p className="pp-muted">Aile kodu (diğer yetişkinlerin telefonu için):</p>
                      <div className="pp-code">{familyCode}</div>
                      <button
                        type="button"
                        className="pp-wide mavi"
                        onClick={async () => {
                          const inviteLink = getFamilyInviteLink(familyCode);
                          try {
                            await navigator.clipboard.writeText(inviteLink);
                            setInviteMessage('Davet bağlantısı kopyalandı. WhatsApp ile gönderebilirsiniz.');
                          } catch {
                            setInviteMessage(`Davet bağlantısı: ${inviteLink}`);
                          }
                        }}
                      >Davet bağlantısını kopyala</button>
                      {inviteMessage && <p role="status" className="pp-note">{inviteMessage}</p>}
                      <details className="pp-more">
                        <summary>Bu cihazı başka bir aileye bağla</summary>
                        <p className="pp-muted">Diğer ailenin kodunu yazın. Bu cihazın eşitlemesi o aileye geçer.</p>
                        <div className="pp-inline">
                          <input value={joiningCode} onChange={(e) => setJoiningCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))} placeholder="Aile kodu" />
                          <button type="button" className="pp-btn ok" onClick={handleJoin} disabled={joiningCode.length < 8}>Bağlan</button>
                        </div>
                      </details>
                    </>
                  ) : (
                    <>
                      <button type="button" className="pp-wide mavi" onClick={async () => setSyncMessage(`Aile kodu hazır: ${await onCreateFamily()}`)}>Aileyi bu telefonla başlat</button>
                      <div className="pp-inline">
                        <input value={joiningCode} onChange={(e) => setJoiningCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))} placeholder="Diğer telefonun aile kodu" />
                        <button type="button" className="pp-btn ok" onClick={handleJoin} disabled={joiningCode.length < 8}>Bağlan</button>
                      </div>
                    </>
                  )}
                  {syncMessage && <p role="status" className="pp-note">{syncMessage}</p>}
                </section>

                <section className="pp-card pp-dangerzone">
                  <p className="pp-label">İLK GÜNE DÖN</p>
                  <p className="pp-muted">Puanı başlangıç değerine (6) indirir, görevleri ilk hâline döndürür. Satın almalar ve Dünya yerleşimleri kalır.</p>
                  {confirmReset ? (
                    <div className="pp-cols two">
                      <button type="button" className="pp-wide soft" onClick={() => setConfirmReset(false)}>Vazgeç</button>
                      <button type="button" className="pp-wide danger" onClick={() => { setConfirmReset(false); onResetData(); }}>Evet, sıfırla</button>
                    </div>
                  ) : (
                    <button type="button" className="pp-wide soft danger-text" onClick={() => setConfirmReset(true)}><Trash2 aria-hidden="true" />Puanları ve görevleri sıfırla…</button>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
