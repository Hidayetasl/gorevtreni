/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { TabType, RoutineTask, ShopItem, PlacedWorldItem, UserProfile, ParentConfig, BonusCard, VoiceMessage, StoryVideo } from './types';
import {
  getStoredTasks,
  saveStoredTasks,
  getStoredShop,
  saveStoredShop,
  getStoredWorld,
  saveStoredWorld,
  getStoredUser,
  saveStoredUser,
  getStoredParent,
  saveStoredParent,
  getStoredBonuses,
  saveStoredBonuses,
  getStoredVoiceMessages,
  saveStoredVoiceMessages,
  getStoredVideos,
  saveStoredVideos,
  INITIAL_TASKS,
  INITIAL_SHOP,
  INITIAL_WORLD,
  INITIAL_USER,
  INITIAL_PARENT,
  INITIAL_BONUSES,
  INITIAL_VOICE_MESSAGES,
  INITIAL_VIDEOS,
  START_LEVEL_VERSION,
} from './utils/storage';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { TasksView } from './components/TasksView';
import { TrainWorldView } from './components/TrainWorldView';
import { ShopView } from './components/ShopView';
import { VideosView } from './components/VideosView';
import { ParentModal } from './components/ParentModal';
import { BonusModal } from './components/BonusModal';
import { RewardClaimModal } from './components/RewardClaimModal';
import { VoiceMessagesModal } from './components/VoiceMessagesModal';
import { createFamilyCode, familyExists, getFamilyCode, isCloudConfigured, saveFamilyCode, subscribeToFamily, uploadFamilyData } from './utils/cloudSync';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');

  // Persistent States
  const [user, setUser] = useState<UserProfile>(() => getStoredUser());
  const [parentConfig, setParentConfig] = useState<ParentConfig>(() => getStoredParent());
  const [tasks, setTasks] = useState<RoutineTask[]>(() => getStoredTasks());
  const [shop, setShop] = useState<ShopItem[]>(() => getStoredShop());
  const [world, setWorld] = useState<PlacedWorldItem[]>(() => getStoredWorld());
  const [bonuses, setBonuses] = useState<BonusCard[]>(() => getStoredBonuses());
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>(() => getStoredVoiceMessages());
  const [videos, setVideos] = useState<StoryVideo[]>(() => getStoredVideos());
  const [familyCode, setFamilyCode] = useState(() => getFamilyCode());
  const [cloudStatus, setCloudStatus] = useState(isCloudConfigured ? 'Bağlantı hazırlanıyor…' : 'Firebase yapılandırması bekleniyor');
  const remoteUpdateRef = useRef(false);
  const syncReadyRef = useRef(false);
  const videosRef = useRef(videos);
  const voiceMessagesRef = useRef(voiceMessages);

  // Modal States
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceModalInitialTab, setVoiceModalInitialTab] = useState<'inbox' | 'record'>('inbox');
  const [isJournalMode, setIsJournalMode] = useState(false);
  const [purchasedItemModal, setPurchasedItemModal] = useState<ShopItem | null>(null);

  // Sync to LocalStorage
  useEffect(() => saveStoredUser(user), [user]);
  useEffect(() => saveStoredParent(parentConfig), [parentConfig]);
  useEffect(() => saveStoredTasks(tasks), [tasks]);
  useEffect(() => saveStoredShop(shop), [shop]);
  useEffect(() => saveStoredWorld(world), [world]);
  useEffect(() => saveStoredBonuses(bonuses), [bonuses]);
  useEffect(() => saveStoredVoiceMessages(voiceMessages), [voiceMessages]);
  useEffect(() => { voiceMessagesRef.current = voiceMessages; }, [voiceMessages]);
  useEffect(() => saveStoredVideos(videos), [videos]);
  useEffect(() => { videosRef.current = videos; }, [videos]);

  const currentFamilyData = (): import('./utils/cloudSync').FamilyData => ({ user, parentConfig, tasks, shop, world, bonuses, voiceMessages, videos });

  useEffect(() => {
    if (!isCloudConfigured || !familyCode) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setCloudStatus('Aile verisine bağlanıyor…');
    (async () => {
      try {
        if (!(await familyExists(familyCode))) await uploadFamilyData(familyCode, currentFamilyData());
        if (cancelled) return;
        unsubscribe = await subscribeToFamily(familyCode, (remote) => {
          remoteUpdateRef.current = true;
          const needsStartLevel = remote.user.progressVersion !== START_LEVEL_VERSION;
          const startLevelUser: UserProfile = needsStartLevel
            ? {
                ...remote.user,
                coins: 6,
                totalCompletedTasks: 0,
                currentStreak: 0,
                progressVersion: START_LEVEL_VERSION,
              }
            : remote.user;

          setUser(startLevelUser); setParentConfig(remote.parentConfig);
          setTasks(needsStartLevel ? INITIAL_TASKS.map((task) => ({ ...task })) : remote.tasks);
          setShop(remote.shop); setWorld(remote.world); setBonuses(remote.bonuses);
          const remoteMessages = remote.voiceMessages || [];
          const localMessages = voiceMessagesRef.current;
          const combinedMessages = [...remoteMessages];
          for (const message of localMessages) {
            if (!combinedMessages.some((remoteMessage) => remoteMessage.id === message.id)) combinedMessages.push(message);
          }
          setVoiceMessages(combinedMessages);
          const remoteVideos = remote.videos || [];
          const localVideos = videosRef.current;
          const combinedVideos = [...remoteVideos];
          for (const video of localVideos) {
            if (!combinedVideos.some((remoteVideo) => remoteVideo.id === video.id)) combinedVideos.push(video);
          }
          setVideos(combinedVideos);
          setCloudStatus('Eşitlendi ✓');
          window.setTimeout(() => { remoteUpdateRef.current = false; }, 600);
          syncReadyRef.current = true;
          if (needsStartLevel) {
            uploadFamilyData(familyCode, {
              ...remote,
              user: startLevelUser,
              tasks: INITIAL_TASKS.map((task) => ({ ...task })),
            }).catch(() => setCloudStatus('Çevrimdışı: başlangıç seviyesi bu cihazda bekliyor'));
          }
          if (combinedVideos.length > remoteVideos.length || combinedMessages.length > remoteMessages.length) {
            // Bu cihazda olup henüz buluta gitmemiş videoyu koru. Sadece video
            // veya sesli not listesi eklenir; buluttan gelen diğer güncel veriler
            // aynen kalır.
            uploadFamilyData(familyCode, { ...remote, videos: combinedVideos, voiceMessages: combinedMessages })
              .catch(() => setCloudStatus('Çevrimdışı: yerel not veya video bu cihazda güvenle bekliyor'));
          }
        }, (message) => setCloudStatus(`Eşitleme hatası: ${message}`));
      } catch (error) {
        setCloudStatus(error instanceof Error ? `Eşitleme hatası: ${error.message}` : 'Eşitleme hatası oluştu.');
      }
    })();
    return () => { cancelled = true; unsubscribe?.(); syncReadyRef.current = false; };
  // family code changes intentionally recreate the subscription.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyCode]);

  useEffect(() => {
    if (!isCloudConfigured || !familyCode || !syncReadyRef.current || remoteUpdateRef.current) return;
    const timer = window.setTimeout(() => {
      uploadFamilyData(familyCode, currentFamilyData())
        .then(() => setCloudStatus('Eşitlendi ✓'))
        .catch(() => setCloudStatus('Çevrimdışı: değişiklikler bu cihazda güvenle bekliyor'));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [user, parentConfig, tasks, shop, world, bonuses, voiceMessages, videos, familyCode]);

  const handleCreateFamily = async () => {
    const code = createFamilyCode();
    setFamilyCode(code);
    setCloudStatus('Aile oluşturuluyor…');
    try {
      await uploadFamilyData(code, currentFamilyData());
      syncReadyRef.current = true;
      setCloudStatus('Eşitlendi ✓');
    } catch (error) { setCloudStatus(error instanceof Error ? `Eşitleme hatası: ${error.message}` : 'Eşitleme başlatılamadı.'); }
    return code;
  };

  const handleJoinFamily = async (code: string) => {
    const normalized = saveFamilyCode(code);
    if (!(await familyExists(normalized))) throw new Error('Bu aile koduyla kayıt bulunamadı.');
    setFamilyCode(normalized);
    setCloudStatus('Aile verisi yükleniyor…');
  };

  // Task Completion / Approval Logic
  const handleMarkTaskDone = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'pending_approval', completedAt: new Date().toISOString() } : t))
    );
  };

  const handleApproveTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === 'completed') return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'completed', approvedAt: new Date().toISOString() } : t))
    );

    setUser((prev) => ({
      ...prev,
      coins: prev.coins + task.rewardCoins,
      totalCompletedTasks: prev.totalCompletedTasks + 1,
    }));
  };

  const handleApproveAllTasks = () => {
    const pending = tasks.filter((t) => t.status === 'pending_approval');
    if (pending.length === 0) return;

    const totalReward = pending.reduce((sum, t) => sum + t.rewardCoins, 0);

    setTasks((prev) =>
      prev.map((t) => (t.status === 'pending_approval' ? { ...t, status: 'completed', approvedAt: new Date().toISOString() } : t))
    );

    setUser((prev) => ({
      ...prev,
      coins: prev.coins + totalReward,
      totalCompletedTasks: prev.totalCompletedTasks + pending.length,
    }));
  };

  const handleRejectTask = (taskId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'todo' } : t)));
  };

  const handleAddTask = (newTaskData: Omit<RoutineTask, 'id' | 'status'>) => {
    const newTask: RoutineTask = {
      ...newTaskData,
      id: `task-${Date.now()}`,
      status: 'todo',
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Shop & Inventory Handlers
  const handleBuyItem = (itemId: string, price: number) => {
    setUser((prev) => ({ ...prev, coins: Math.max(0, prev.coins - price) }));
    setShop((prev) => prev.map((item) => (item.id === itemId ? { ...item, unlocked: true } : item)));
  };

  const handleSetActiveTrain = (icon: string) => {
    setUser((prev) => ({ ...prev, activeTrainIcon: icon }));
  };

  // World Canvas Handlers
  const handlePlaceItem = (itemData: Omit<PlacedWorldItem, 'id'>) => {
    const newItem: PlacedWorldItem = {
      ...itemData,
      id: `world-${Date.now()}`,
    };
    setWorld((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (placedId: string) => {
    setWorld((prev) => prev.filter((item) => item.id !== placedId));
  };

  // Bonus Handlers
  const handleSendBonus = (bonusData: Omit<BonusCard, 'id' | 'claimed' | 'createdAt'>) => {
    const newBonus: BonusCard = {
      ...bonusData,
      id: `bonus-${Date.now()}`,
      createdAt: new Date().toISOString(),
      claimed: false,
    };
    setBonuses((prev) => [newBonus, ...prev]);
  };

  const handleClaimBonus = (bonusId: string, bonusCoins: number) => {
    setBonuses((prev) => prev.map((b) => (b.id === bonusId ? { ...b, claimed: true } : b)));
    setUser((prev) => ({ ...prev, coins: prev.coins + bonusCoins }));
  };

  const handleToggleSound = () => {
    setUser((prev) => ({
      ...prev,
      soundEnabled: !prev.soundEnabled,
      speechEnabled: !prev.speechEnabled,
    }));
  };

  const handleResetData = () => {
    setUser((current) => ({
      ...current,
      coins: 6,
      totalCompletedTasks: 0,
      currentStreak: 0,
      progressVersion: START_LEVEL_VERSION,
    }));
    setTasks(INITIAL_TASKS.map((task) => ({ ...task })));
    setIsParentModalOpen(false);
  };

  const handleAddVideo = (newVid: Omit<StoryVideo, 'id'>) => {
    const video: StoryVideo = {
      ...newVid,
      id: `v-${Date.now()}`,
    };
    setVideos((prev) => [video, ...prev]);
  };

  const handleDeleteVideo = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSendVoiceMessage = (msgData: Omit<VoiceMessage, 'id' | 'createdAt' | 'isNew'>) => {
    const newMsg: VoiceMessage = {
      ...msgData,
      id: `vm-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isNew: true,
    };
    setVoiceMessages((prev) => [newMsg, ...prev]);
  };

  const handleMarkReadVoiceMessage = (id: string) => {
    setVoiceMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isNew: false } : m)));
  };

  const handleDeleteVoiceMessage = (id: string) => {
    setVoiceMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const openVoiceModal = (initialTab: 'inbox' | 'record' = 'inbox') => {
    setVoiceModalInitialTab(initialTab);
    setIsJournalMode(false);
    setIsVoiceModalOpen(true);
  };

  const openJournal = (initialTab: 'inbox' | 'record' = 'inbox') => {
    setVoiceModalInitialTab(initialTab);
    setIsJournalMode(true);
    setIsVoiceModalOpen(true);
  };

  const handleJournalSaved = () => {
    const journalTask = tasks.find((task) => task.id === 'task-8');
    if (journalTask?.status === 'todo') handleMarkTaskDone('task-8');
  };

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending_approval').length;
  const unreadVoiceCount = voiceMessages.filter((m) => m.isNew).length;
  const unclaimedBonus = bonuses.find((b) => !b.claimed) || null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0e2531] via-[#112f3e] to-[#2f7533] text-slate-100 relative selection:bg-sky-200">
      {/* Background Animated Sky & Clouds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Floating Sun */}
        <div className="absolute top-4 right-6 w-16 h-16 sm:w-20 sm:h-20 bg-amber-300 rounded-full shadow-[0_0_40px_rgba(251,191,36,0.8)] animate-sun-spin flex items-center justify-center text-3xl opacity-90">
          ☀️
        </div>

        {/* Floating Sky Clouds */}
        <div className="absolute top-10 left-[-80px] text-4xl opacity-70 animate-cloud-slow">☁️</div>
        <div className="absolute top-24 left-1/4 text-5xl opacity-50 animate-cloud-fast">☁️</div>
        <div className="absolute top-16 right-1/3 text-3xl opacity-60 animate-cloud-slow">☁️</div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 max-w-5xl mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <Header
          user={user}
          activeTab={activeTab}
          onChangeTab={(tab) => setActiveTab(tab)}
          onToggleSound={handleToggleSound}
          onOpenParentModal={() => setIsParentModalOpen(true)}
          completedTasksCount={completedCount}
          totalTasksCount={tasks.length}
          hasUnclaimedBonus={!!unclaimedBonus}
          onOpenBonusModal={() => {}}
          pendingCount={pendingCount}
          onOpenVoiceModal={() => openVoiceModal('inbox')}
          unreadVoiceCount={unreadVoiceCount}
        />

        {/* Main Content Body */}
        <main className="flex-1 p-3 sm:p-5">
          {activeTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              onMarkTaskDone={handleMarkTaskDone}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
              onOpenVoiceModal={openVoiceModal}
              onOpenJournal={openJournal}
              unreadVoiceCount={unreadVoiceCount}
            />
          )}

          {activeTab === 'world' && (
            <TrainWorldView
              worldItems={world}
              inventory={shop}
              user={user}
              onPlaceItem={handlePlaceItem}
              onRemoveItem={handleRemoveItem}
              onSetActiveTrain={handleSetActiveTrain}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
            />
          )}

          {activeTab === 'shop' && (
            <ShopView
              shopItems={shop}
              user={user}
              onBuyItem={handleBuyItem}
              onSetActiveTrain={handleSetActiveTrain}
              soundEnabled={user.soundEnabled}
              speechEnabled={user.speechEnabled}
              onOpenGiftModal={(item) => setPurchasedItemModal(item)}
            />
          )}

          {activeTab === 'videos' && (
            <VideosView
              videos={videos}
              parentConfig={parentConfig}
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <Navigation
          activeTab={activeTab}
          onChangeTab={(tab) => setActiveTab(tab)}
          onOpenParentModal={() => setIsParentModalOpen(true)}
          pendingCount={pendingCount}
        />

        {/* Parent Engine Room Modal */}
        <ParentModal
          isOpen={isParentModalOpen}
          onClose={() => setIsParentModalOpen(false)}
          tasks={tasks}
          parentConfig={parentConfig}
          userProfile={user}
          onApproveTask={handleApproveTask}
          onApproveAllTasks={handleApproveAllTasks}
          onRejectTask={handleRejectTask}
          onAddTask={handleAddTask}
          onDeleteTask={handleDeleteTask}
          onSendBonus={handleSendBonus}
          onUpdateParentConfig={setParentConfig}
          onUpdateUserProfile={setUser}
          onResetData={handleResetData}
          soundEnabled={user.soundEnabled}
          speechEnabled={user.speechEnabled}
          onOpenVoiceModal={() => openVoiceModal('record')}
          videos={videos}
          onAddVideo={handleAddVideo}
          onDeleteVideo={handleDeleteVideo}
          cloudConfigured={isCloudConfigured}
          cloudStatus={cloudStatus}
          familyCode={familyCode}
          onCreateFamily={handleCreateFamily}
          onJoinFamily={handleJoinFamily}
        />

        {/* Voice Messages Modal */}
        <VoiceMessagesModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          messages={voiceMessages}
          onSendMessage={handleSendVoiceMessage}
          onMarkRead={handleMarkReadVoiceMessage}
          onDeleteMessage={handleDeleteVoiceMessage}
          soundEnabled={user.soundEnabled}
          speechEnabled={user.speechEnabled}
          initialTab={voiceModalInitialTab}
          journalMode={isJournalMode}
          onJournalSaved={handleJournalSaved}
        />

        {/* Unclaimed Bonus Card Modal */}
        {unclaimedBonus && (
          <BonusModal
            bonus={unclaimedBonus}
            onClaim={handleClaimBonus}
            soundEnabled={user.soundEnabled}
            speechEnabled={user.speechEnabled}
          />
        )}

        {/* Purchased Item Gift Modal */}
        {purchasedItemModal && (
          <RewardClaimModal
            item={purchasedItemModal}
            onClose={() => setPurchasedItemModal(null)}
            speechEnabled={user.speechEnabled}
          />
        )}
      </div>
    </div>
  );
}
