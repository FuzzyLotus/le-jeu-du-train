import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { APP_VERSION, LAST_SYNC } from '../version';
import { ArrowLeft, Trash2, ShieldAlert, AlertTriangle, MessageSquare, CheckCircle2, XCircle, Clock, Loader2, Send, MessageCircle, Terminal, UserPlus, Zap, Trophy, Database, Users, Settings as SettingsIcon, Save, Megaphone, BarChart3, Shield, Download, Upload, Edit, Ban, RefreshCw, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, type SystemSetting } from '../db/database';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { Button } from '../components/Button';
import clsx from 'clsx';
import type { FeedbackStatus, FeedbackReply, User, Trip } from '../types/models';
import { ACHIEVEMENTS } from '../services/AchievementEngine';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AuthService } from '../services/AuthService';

export function AdminScreen() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, logout } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  
  const [userToDelete, setUserToDelete] = useState<{id: number, username: string} | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'moderation' | 'feedback' | 'console' | 'config' | 'resets'>('analytics');
  const [replyText, setReplyText] = useState<{[key: number]: string}>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [nukeConfirm, setNukeConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [resolvingRequest, setResolvingRequest] = useState<number | null>(null);
  const [newPasswordForRequest, setNewPasswordForRequest] = useState('');

  // Config State
  const [config, setConfig] = useState({
    maintenanceMode: false,
    allowSignups: true,
    globalMultiplier: 1,
    announcement: '',
    announcementType: 'info' as 'info' | 'warning' | 'alert'
  });

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await db.settings.toArray();
      const newConfig = { ...config };
      settings.forEach(s => {
        if (s.key in newConfig) {
          // @ts-ignore
          newConfig[s.key] = s.value;
        }
      });
      setConfig(newConfig);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'resets') {
      loadResetRequests();
    }
  }, [activeTab]);

  const loadResetRequests = async () => {
    if (!currentUser?.id) return;
    try {
      const requests = await AuthService.getResetRequests(currentUser.id);
      setResetRequests(requests);
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Impossible de charger les demandes de réinitialisation', type: 'error' });
    }
  };

  const handleResolveReset = async (requestId: number) => {
    if (!currentUser?.id) return;
    if (!newPasswordForRequest || newPasswordForRequest.length < 8) {
      addToast({ title: 'Erreur', message: 'Le mot de passe doit contenir au moins 8 caractères', type: 'error' });
      return;
    }
    
    try {
      await AuthService.resolveResetRequest(currentUser.id, requestId, newPasswordForRequest);
      addToast({ title: 'Succès', message: 'Mot de passe réinitialisé', type: 'success' });
      setResolvingRequest(null);
      setNewPasswordForRequest('');
      loadResetRequests();
    } catch (e: any) {
      console.error(e);
      addToast({ title: 'Erreur', message: e.message || 'Échec de la réinitialisation', type: 'error' });
    }
  };

  const handleSaveConfig = async () => {
    try {
      await db.transaction('rw', db.settings, async () => {
        await db.settings.put({ key: 'maintenanceMode', value: config.maintenanceMode });
        await db.settings.put({ key: 'allowSignups', value: config.allowSignups });
        await db.settings.put({ key: 'globalMultiplier', value: Number(config.globalMultiplier) });
        await db.settings.put({ key: 'announcement', value: config.announcement });
        await db.settings.put({ key: 'announcementType', value: config.announcementType });
      });
      addToast({ title: 'Sauvegardé', message: 'Configuration mise à jour.', type: 'success' });
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Échec sauvegarde config.', type: 'error' });
    }
  };

  // Only allow admins
  if (!currentUser || !currentUser.isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-failure mb-4" />
        <h1 className="font-display text-2xl mb-2">Accès Refusé</h1>
        <p className="text-white/50 mb-8">Vous n'avez pas les droits d'administration.</p>
        <Button onClick={() => navigate('/')}>Retour à l'accueil</Button>
      </div>
    );
  }

  const users = useLiveQuery(() => db.users.toArray());
  const trips = useLiveQuery(() => db.trips.reverse().limit(100).toArray()); // Last 100 trips for moderation
  const allTrips = useLiveQuery(() => db.trips.toArray()); // All trips for analytics
  const feedback = useLiveQuery(() => db.feedback.reverse().sortBy('createdAt'));
  const myAchievements = useLiveQuery(
    () => currentUser?.id ? db.achievements.where('userId').equals(currentUser.id).toArray() : [],
    [currentUser?.id]
  );

  // Analytics Data Preparation
  const analyticsData = allTrips ? (() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayTrips = allTrips.filter(t => new Date(t.date).toISOString().split('T')[0] === date);
      return {
        date: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' }),
        trips: dayTrips.length,
        distance: dayTrips.reduce((acc, t) => acc + t.distanceKm, 0)
      };
    });
  })() : [];

  const handleUpdateUser = async () => {
    if (!userToEdit || !userToEdit.id) return;
    try {
      await db.users.update(userToEdit.id, userToEdit);
      addToast({ title: 'Succès', message: 'Utilisateur mis à jour', type: 'success' });
      setUserToEdit(null);
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Échec mise à jour', type: 'error' });
    }
  };

  const handleDeleteTrip = async (id: number) => {
    try {
      await db.trips.delete(id);
      addToast({ title: 'Succès', message: 'Trajet supprimé', type: 'success' });
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Échec suppression', type: 'error' });
    }
  };

  const handleExportDB = async () => {
    try {
      const exportData = {
        users: await db.users.toArray(),
        trips: await db.trips.toArray(),
        achievements: await db.achievements.toArray(),
        feedback: await db.feedback.toArray(),
        friendRequests: await db.friendRequests.toArray(),
        settings: await db.settings.toArray(),
        version: 1,
        exportedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jeudutrain_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addToast({ title: 'Succès', message: 'Sauvegarde téléchargée', type: 'success' });
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Échec export', type: 'error' });
    }
  };

  const handleImportDB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.users || !data.trips) throw new Error('Format invalide');

        await db.transaction('rw', [db.users, db.trips, db.achievements, db.feedback, db.friendRequests, db.settings], async () => {
          await db.users.clear();
          await db.trips.clear();
          await db.achievements.clear();
          await db.feedback.clear();
          await db.friendRequests.clear();
          await db.settings.clear();

          await db.users.bulkAdd(data.users);
          await db.trips.bulkAdd(data.trips);
          await db.achievements.bulkAdd(data.achievements);
          await db.feedback.bulkAdd(data.feedback);
          if (data.friendRequests) await db.friendRequests.bulkAdd(data.friendRequests);
          if (data.settings) await db.settings.bulkAdd(data.settings);
        });

        addToast({ title: 'Succès', message: 'Base de données restaurée', type: 'success' });
        setTimeout(() => window.location.reload(), 1500);
      } catch (e) {
        console.error(e);
        addToast({ title: 'Erreur', message: 'Fichier invalide ou corrompu', type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      // Delete user
      await db.users.delete(userToDelete.id);
      // Delete associated trips and achievements
      await db.trips.where('userId').equals(userToDelete.id).delete();
      await db.achievements.where('userId').equals(userToDelete.id).delete();
      await db.feedback.where('userId').equals(userToDelete.id).delete();
      
      addToast({ title: 'Succès', message: `L'utilisateur ${userToDelete.username} a été supprimé.`, type: 'success' });
    } catch (error) {
      console.error(error);
      addToast({ title: 'Erreur', message: 'Impossible de supprimer l\'utilisateur.', type: 'error' });
    } finally {
      setUserToDelete(null);
    }
  };

  const handleUpdateStatus = async (id: number, status: FeedbackStatus) => {
    try {
      await db.feedback.update(id, { status, updatedAt: Date.now() });
      addToast({ title: 'Succès', message: 'Statut mis à jour.', type: 'success' });
    } catch (error) {
      console.error(error);
      addToast({ title: 'Erreur', message: 'Impossible de mettre à jour le statut.', type: 'error' });
    }
  };

  const handleReply = async (feedbackId: number) => {
    if (!currentUser?.id || !replyText[feedbackId]?.trim()) return;

    try {
      const item = await db.feedback.get(feedbackId);
      if (!item) return;

      const newReply: FeedbackReply = {
        senderId: currentUser.id,
        isAdmin: true,
        message: replyText[feedbackId].trim(),
        createdAt: Date.now()
      };

      const updatedReplies = [...(item.replies || []), newReply];
      
      await db.feedback.update(feedbackId, { 
        replies: updatedReplies,
        updatedAt: Date.now()
      });

      setReplyText(prev => ({ ...prev, [feedbackId]: '' }));
      addToast({ title: 'Envoyé!', message: 'Réponse ajoutée.', type: 'success' });
    } catch (error) {
      console.error(error);
      addToast({ title: 'Erreur', message: "Impossible d'envoyer la réponse.", type: 'error' });
    }
  };

  // Console Features
  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    addToast({ title: 'Identité Changée', message: `Vous êtes maintenant ${user.displayName}`, type: 'success' });
    navigate('/');
  };

  const handleGenerateDummyUsers = async () => {
    try {
      const dummyUsers: User[] = [
        {
          username: 'alice_w',
          displayName: 'Alice Wonderland',
          passwordHash: 'dummy',
          points: 150,
          totalEarned: 150,
          tripCount: 12,
          streak: 5,
          hasLost: false,
          longestTripKm: 45.2,
          totalDistanceKm: 320.5,
          maxCrossingsInTrip: 3,
          createdAt: Date.now(),
          preferences: {
            isPublicProfile: true,
            showTripsOnLeaderboard: true,
            allowFriendRequests: true,
            showStats: true,
            showTripHistory: true
          }
        },
        {
          username: 'bob_builder',
          displayName: 'Bob The Builder',
          passwordHash: 'dummy',
          points: 85,
          totalEarned: 90,
          tripCount: 8,
          streak: 2,
          hasLost: true,
          longestTripKm: 12.5,
          totalDistanceKm: 85.0,
          maxCrossingsInTrip: 2,
          createdAt: Date.now(),
          preferences: {
            isPublicProfile: true,
            showTripsOnLeaderboard: true,
            allowFriendRequests: true,
            showStats: true,
            showTripHistory: false // Private history
          }
        }
      ];

      for (const user of dummyUsers) {
        const existing = await db.users.where('username').equals(user.username).first();
        if (!existing) {
          await db.users.add(user);
        }
      }
      addToast({ title: 'Succès', message: 'Alice & Bob créés', type: 'success' });
    } catch (error) {
      console.error(error);
      addToast({ title: 'Erreur', message: 'Échec création dummy users', type: 'error' });
    }
  };

  const handleBotAction = async (action: 'send_request' | 'accept_request', botName: string) => {
    if (!currentUser?.id) return;
    const bot = await db.users.where('username').equals(botName).first();
    if (!bot || !bot.id) {
      addToast({ title: 'Erreur', message: `${botName} introuvable. Générez les d'abord.`, type: 'error' });
      return;
    }

    try {
      if (action === 'send_request') {
        // Bot sends request to current user
        const existing = await db.friendRequests.where('[senderId+receiverId]').equals([bot.id, currentUser.id]).first();
        if (existing) {
          addToast({ title: 'Info', message: 'Demande déjà existante', type: 'info' });
          return;
        }
        await db.friendRequests.add({
          senderId: bot.id,
          receiverId: currentUser.id,
          status: 'pending',
          createdAt: Date.now()
        });
        addToast({ title: 'Succès', message: `${bot.displayName} vous a envoyé une demande!`, type: 'success' });
      } else if (action === 'accept_request') {
        // Bot accepts request from current user
        const request = await db.friendRequests.where('[senderId+receiverId]').equals([currentUser.id, bot.id]).first();
        if (!request) {
          addToast({ title: 'Erreur', message: `Aucune demande de votre part vers ${bot.displayName}`, type: 'error' });
          return;
        }
        if (request.id) {
            await db.friendRequests.update(request.id, { status: 'accepted' });
            addToast({ title: 'Succès', message: `${bot.displayName} a accepté votre demande!`, type: 'success' });
        }
      }
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Action échouée', type: 'error' });
    }
  };

  const handleGenerateTrips = async () => {
    if (!currentUser?.id) return;
    try {
      const trips: Trip[] = [];
      let totalPoints = 0;
      let totalKm = 0;

      for (let i = 0; i < 10; i++) {
        const distance = Math.floor(Math.random() * 50) + 5;
        const crossings = Math.floor(Math.random() * 5) + 1;
        const points = crossings; // Assuming success
        
        trips.push({
          userId: currentUser.id,
          routeName: `Trajet Simulé #${i+1}`,
          distanceKm: distance,
          crossingsCount: crossings,
          success: true,
          date: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000) // Random time in last 30 days
        });

        totalPoints += points;
        totalKm += distance;
      }

      await db.trips.bulkAdd(trips);

      // Update user stats
      const updatedUser = { ...currentUser };
      updatedUser.points += totalPoints;
      updatedUser.totalEarned += totalPoints;
      updatedUser.tripCount += 10;
      updatedUser.totalDistanceKm = (updatedUser.totalDistanceKm || 0) + totalKm;
      
      await db.users.update(currentUser.id, updatedUser);
      setCurrentUser(updatedUser);
      
      addToast({ title: 'Succès', message: '10 trajets générés!', type: 'success' });
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Échec génération trajets', type: 'error' });
    }
  };

  const handleUnlockAchievement = async (achievementId: string, title: string) => {
    if (!currentUser?.id) return;
    try {
      const existing = await db.achievements.where({ userId: currentUser.id, achievementId }).first();
      if (existing) {
        addToast({ title: 'Info', message: 'Déjà débloqué', type: 'info' });
        return;
      }

      await db.achievements.add({
        userId: currentUser.id,
        achievementId,
        unlockedAt: Date.now()
      });
      addToast({ title: 'Succès', message: `${title} débloqué!`, type: 'success' });
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Échec déblocage', type: 'error' });
    }
  };

  const handleNukeDb = async () => {
    try {
      await db.transaction('rw', [db.users, db.trips, db.achievements, db.feedback, db.friendRequests], async () => {
        await db.users.clear();
        await db.trips.clear();
        await db.achievements.clear();
        await db.feedback.clear();
        await db.friendRequests.clear();
      });
      logout();
      navigate('/login');
      addToast({ title: 'NUKE', message: 'Base de données effacée.', type: 'success' });
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Échec du nettoyage', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto relative pb-24">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8 mt-4">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-display text-white">Administration</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-[10px] text-failure uppercase tracking-widest font-black bg-failure/10 px-1.5 py-0.5 rounded border border-failure/20">Zone Dangereuse</p>
            <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-mono uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
              v{APP_VERSION}
            </div>
          </div>
        </div>
      </header>

      {/* Sync Status Banner */}
      <div className="mb-6 bg-surface border border-white/5 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">État de Synchronisation</p>
            <p className="text-[10px] text-white/40">Dernière mise à jour : {new Date(LAST_SYNC).toLocaleString('fr-FR')}</p>
          </div>
        </div>
        <a 
          href="https://github.com/DalexViau/le-jeu-du-train" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full hover:bg-green-500/20 transition-colors cursor-pointer"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">GitHub : Main</span>
        </a>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-2 mb-6 bg-surface border border-white/5 p-2 rounded-2xl">
        <button
          onClick={() => setActiveTab('analytics')}
          className={clsx(
            "flex flex-col items-center justify-center py-3 px-2 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5",
            activeTab === 'analytics' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <BarChart3 className="w-5 h-5" />
          Stats
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={clsx(
            "flex flex-col items-center justify-center py-3 px-2 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5",
            activeTab === 'users' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <Users className="w-5 h-5" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('moderation')}
          className={clsx(
            "flex flex-col items-center justify-center py-3 px-2 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5",
            activeTab === 'moderation' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <Shield className="w-5 h-5" />
          Mod
        </button>
        <button
          onClick={() => setActiveTab('resets')}
          className={clsx(
            "flex flex-col items-center justify-center py-3 px-2 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5",
            activeTab === 'resets' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <KeyRound className="w-5 h-5" />
          Resets
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={clsx(
            "flex flex-col items-center justify-center py-3 px-2 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5",
            activeTab === 'feedback' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <MessageSquare className="w-5 h-5" />
          Avis
        </button>
        <button
          onClick={() => setActiveTab('console')}
          className={clsx(
            "flex flex-col items-center justify-center py-3 px-2 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5",
            activeTab === 'console' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <Terminal className="w-5 h-5" />
          Dev
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={clsx(
            "flex flex-col items-center justify-center py-3 px-2 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5",
            activeTab === 'config' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <SettingsIcon className="w-5 h-5" />
          Cfg
        </button>
      </div>

      {activeTab === 'analytics' && (
        <div className="flex flex-col gap-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-white/5 rounded-2xl p-4">
              <span className="text-white/50 text-xs font-bold uppercase tracking-wider">Utilisateurs</span>
              <p className="text-2xl font-display text-white mt-1">{users?.length || 0}</p>
            </div>
            <div className="bg-surface border border-white/5 rounded-2xl p-4">
              <span className="text-white/50 text-xs font-bold uppercase tracking-wider">Trajets Total</span>
              <p className="text-2xl font-display text-white mt-1">{allTrips?.length || 0}</p>
            </div>
            <div className="bg-surface border border-white/5 rounded-2xl p-4">
              <span className="text-white/50 text-xs font-bold uppercase tracking-wider">Distance Totale</span>
              <p className="text-2xl font-display text-white mt-1">
                {Math.round(allTrips?.reduce((acc, t) => acc + t.distanceKm, 0) || 0)} km
              </p>
            </div>
            <div className="bg-surface border border-white/5 rounded-2xl p-4">
              <span className="text-white/50 text-xs font-bold uppercase tracking-wider">Avis</span>
              <p className="text-2xl font-display text-white mt-1">{feedback?.length || 0}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="bg-surface border border-white/5 rounded-3xl p-6">
            <h2 className="font-bold text-lg mb-4">Activité (7 derniers jours)</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="trips" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Trajets" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-surface border border-white/5 rounded-3xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4">Gestion des utilisateurs</h2>
          <p className="text-sm text-white/50 mb-6">
            Attention : la suppression d'un utilisateur est définitive et efface tout son historique.
          </p>

          <div className="flex flex-col gap-3">
            {users?.map((user) => (
              <div key={user.id} className="flex items-center justify-between bg-black/20 rounded-2xl p-4 border border-white/5">
                <div className="flex flex-col overflow-hidden">
                  <span className="font-bold text-white truncate flex items-center gap-2">
                    {user.displayName}
                    {user.isAdmin && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">Admin</span>}
                  </span>
                  <span className="text-xs text-white/40 truncate">@{user.username} • {user.points} pts</span>
                </div>
                
                {user.id !== currentUser.id && (
                  <div className="flex gap-2 ml-3 shrink-0">
                    <button
                      onClick={() => setUserToEdit(user)}
                      className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                      title="Éditer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => user.id !== undefined && setUserToDelete({ id: user.id, username: user.username })}
                      className="w-10 h-10 rounded-full bg-failure/10 text-failure flex items-center justify-center hover:bg-failure/20 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {users?.length === 0 && (
              <div className="text-center text-white/50 py-8">
                Aucun utilisateur trouvé.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'moderation' && (
        <div className="bg-surface border border-white/5 rounded-3xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Modération des Trajets
          </h2>
          <p className="text-sm text-white/50 mb-6">
            Les 100 derniers trajets. Surveillez les anomalies (vitesse, fréquence).
          </p>

          <div className="space-y-3">
            {trips?.map(trip => {
              const user = users?.find(u => u.id === trip.userId);
              const isSuspicious = trip.distanceKm > 100 || trip.crossingsCount > 20;

              return (
                <div key={trip.id} className={clsx(
                  "p-4 rounded-2xl border flex items-center justify-between",
                  isSuspicious ? "bg-red-500/5 border-red-500/20" : "bg-black/20 border-white/5"
                )}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{user?.displayName || 'Inconnu'}</span>
                      <span className="text-xs text-white/40">
                        {new Date(trip.date).toLocaleDateString()}
                      </span>
                      {isSuspicious && (
                        <span className="bg-red-500/20 text-red-500 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Suspicious
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      {trip.routeName} • {trip.distanceKm} km • {trip.crossingsCount} passages
                    </div>
                  </div>

                  <button
                    onClick={() => trip.id && handleDeleteTrip(trip.id)}
                    className="w-8 h-8 rounded-full bg-white/5 text-white/40 hover:bg-failure/10 hover:text-failure flex items-center justify-center transition-colors"
                    title="Supprimer le trajet"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            
            {trips?.length === 0 && (
              <div className="text-center text-white/50 py-8">
                Aucun trajet récent.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'resets' && (
        <div className="bg-surface border border-white/5 rounded-3xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Demandes de Réinitialisation
          </h2>
          <p className="text-sm text-white/50 mb-6">
            Gérez les demandes de réinitialisation de mot de passe.
          </p>

          <div className="flex flex-col gap-3">
            {resetRequests.map((request) => (
              <div key={request.id} className="flex flex-col bg-black/20 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-sm">
                      @{request.username}
                    </span>
                    <span className="text-xs text-white/50">
                      Demandé le {new Date(request.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <span className={clsx(
                    "text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold",
                    request.status === 'pending' ? "bg-yellow-500/20 text-yellow-500" : "bg-green-500/20 text-green-500"
                  )}>
                    {request.status === 'pending' ? 'En attente' : 'Résolu'}
                  </span>
                </div>
                
                <div className="bg-white/5 rounded-xl p-3 mb-3">
                  <p className="text-xs text-white/70 mb-1"><span className="font-bold">Méthode fournie :</span> {request.contact_method}</p>
                  <p className="text-xs text-white/70 mb-1"><span className="font-bold">Email enregistré :</span> {request.email || 'Aucun'}</p>
                  <p className="text-xs text-white/70"><span className="font-bold">Téléphone enregistré :</span> {request.phone || 'Aucun'}</p>
                </div>

                {request.status === 'pending' && (
                  <>
                    {resolvingRequest === request.id ? (
                      <div className="flex flex-col gap-2 mt-2">
                        <input
                          type="password"
                          placeholder="Nouveau mot de passe"
                          value={newPasswordForRequest}
                          onChange={(e) => setNewPasswordForRequest(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                        />
                        <div className="flex gap-2">
                          <Button variant="secondary" className="flex-1 text-xs py-2" onClick={() => {
                            setResolvingRequest(null);
                            setNewPasswordForRequest('');
                          }}>
                            Annuler
                          </Button>
                          <Button className="flex-1 text-xs py-2" onClick={() => handleResolveReset(request.id)}>
                            Confirmer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="secondary" className="w-full text-xs py-2 mt-2" onClick={() => setResolvingRequest(request.id)}>
                        Réinitialiser le mot de passe
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}

            {resetRequests.length === 0 && (
              <div className="text-center text-white/50 py-8">
                Aucune demande en attente.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="flex flex-col gap-4">
          {feedback?.map((item) => (
            <div key={item.id} className="bg-surface border border-white/5 rounded-3xl p-6">
              <div 
                className="flex items-start justify-between mb-3 cursor-pointer"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id!)}
              >
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold",
                    item.type === 'bug' ? "bg-failure/20 text-failure" : "bg-primary/20 text-primary"
                  )}>
                    {item.type === 'bug' ? 'Bug' : 'Suggestion'}
                  </span>
                  <span className="text-xs text-white/30">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className={clsx(
                  "flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full border",
                  item.status === 'pending' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                  item.status === 'in_progress' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                  item.status === 'resolved' && "bg-green-500/10 text-green-500 border-green-500/20",
                  item.status === 'rejected' && "bg-red-500/10 text-red-500 border-red-500/20",
                )}>
                  {item.status === 'pending' && 'En attente'}
                  {item.status === 'in_progress' && 'En cours'}
                  {item.status === 'resolved' && 'Résolu'}
                  {item.status === 'rejected' && 'Rejeté'}
                </div>
              </div>

              <p className="text-white/80 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{item.message}</p>

              {/* Replies Section */}
              {item.replies && item.replies.length > 0 && (
                <div className="mt-4 mb-4 pl-4 border-l-2 border-white/10 space-y-3">
                  {item.replies.map((reply, idx) => (
                    <div key={idx} className={clsx("text-sm", reply.isAdmin ? "text-primary/90" : "text-white/70")}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-xs uppercase tracking-wider">
                          {reply.isAdmin ? 'Support' : 'Utilisateur'}
                        </span>
                        <span className="text-[10px] text-white/30">
                          {new Date(reply.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Input */}
              {expandedId === item.id && (
                <div className="mt-4 pt-4 border-t border-white/5 mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyText[item.id!] || ''}
                      onChange={(e) => setReplyText(prev => ({ ...prev, [item.id!]: e.target.value }))}
                      placeholder="Répondre..."
                      className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (item.id) handleReply(item.id);
                        }
                      }}
                    />
                    <button
                      onClick={() => item.id && handleReply(item.id)}
                      disabled={!replyText[item.id!]?.trim()}
                      className="p-2 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Expand/Collapse Hint */}
              {(!expandedId || expandedId !== item.id) && (
                <div 
                  className="mt-2 mb-4 text-center"
                  onClick={() => setExpandedId(item.id!)}
                >
                  <button className="text-[10px] text-white/30 uppercase tracking-wider hover:text-white/50 flex items-center justify-center gap-1 w-full">
                    <MessageCircle className="w-3 h-3" />
                    {item.replies?.length ? `${item.replies.length} réponse(s)` : 'Répondre'}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                <button 
                  onClick={() => item.id && handleUpdateStatus(item.id, 'pending')}
                  className={clsx("p-2 rounded-full hover:bg-white/10 transition-colors", item.status === 'pending' ? "text-yellow-500 bg-yellow-500/10" : "text-white/30")}
                  title="En attente"
                >
                  <Clock className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => item.id && handleUpdateStatus(item.id, 'in_progress')}
                  className={clsx("p-2 rounded-full hover:bg-white/10 transition-colors", item.status === 'in_progress' ? "text-blue-500 bg-blue-500/10" : "text-white/30")}
                  title="En cours"
                >
                  <Loader2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => item.id && handleUpdateStatus(item.id, 'resolved')}
                  className={clsx("p-2 rounded-full hover:bg-white/10 transition-colors", item.status === 'resolved' ? "text-green-500 bg-green-500/10" : "text-white/30")}
                  title="Résolu"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => item.id && handleUpdateStatus(item.id, 'rejected')}
                  className={clsx("p-2 rounded-full hover:bg-white/10 transition-colors", item.status === 'rejected' ? "text-red-500 bg-red-500/10" : "text-white/30")}
                  title="Rejeté"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {feedback?.length === 0 && (
            <div className="text-center text-white/50 py-8 bg-surface border border-white/5 rounded-3xl">
              Aucun retour pour le moment.
            </div>
          )}
        </div>
      )}

      {activeTab === 'console' && (
        <div className="flex flex-col gap-6">
          
          {/* User Switcher */}
          <div className="bg-surface border border-white/5 rounded-3xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Changer d'utilisateur
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {users?.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleSwitchUser(u)}
                  disabled={u.id === currentUser.id}
                  className={clsx(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors text-left",
                    u.id === currentUser.id 
                      ? "bg-primary/20 border-primary/50 text-primary cursor-default" 
                      : "bg-white/5 border-white/5 text-white hover:bg-white/10"
                  )}
                >
                  <span className="font-bold text-sm">{u.displayName}</span>
                  {u.id === currentUser.id && <span className="text-[10px] uppercase font-bold">Actuel</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Bot Actions */}
          <div className="bg-surface border border-white/5 rounded-3xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              Actions Bot
            </h2>
            <div className="flex flex-col gap-3">
              <Button onClick={handleGenerateDummyUsers} variant="secondary" className="mb-2">
                Générer Alice & Bob
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handleBotAction('send_request', 'alice_w')} className="text-xs">
                  Alice demande
                </Button>
                <Button onClick={() => handleBotAction('accept_request', 'alice_w')} className="text-xs">
                  Alice accepte
                </Button>
                <Button onClick={() => handleBotAction('send_request', 'bob_builder')} className="text-xs">
                  Bob demande
                </Button>
                <Button onClick={() => handleBotAction('accept_request', 'bob_builder')} className="text-xs">
                  Bob accepte
                </Button>
              </div>
            </div>
          </div>

          {/* Trip Generator */}
          <div className="bg-surface border border-white/5 rounded-3xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Générateur de Trajets
            </h2>
            <p className="text-sm text-white/50 mb-4">Ajoute 10 trajets aléatoires à l'utilisateur actuel.</p>
            <Button onClick={handleGenerateTrips} fullWidth>
              Générer 10 Trajets
            </Button>
          </div>

          {/* Achievement Unlocker */}
          <div className="bg-surface border border-white/5 rounded-3xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-400" />
              Débloquer Succès
            </h2>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
              {ACHIEVEMENTS.map(ach => {
                const isUnlocked = myAchievements?.some(a => a.achievementId === ach.id);
                return (
                  <button
                    key={ach.id}
                    onClick={() => handleUnlockAchievement(ach.id, ach.title)}
                    disabled={isUnlocked}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-xl border transition-colors text-left text-xs",
                      isUnlocked 
                        ? "bg-green-500/10 border-green-500/30 text-green-500 opacity-50" 
                        : "bg-white/5 border-white/5 text-white hover:bg-white/10"
                    )}
                  >
                    <span className="font-bold truncate mr-2">{ach.title}</span>
                    {isUnlocked ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <span className="text-[10px] opacity-50">Débloquer</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nuke DB */}
          <div className="bg-surface border border-failure/30 rounded-3xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-failure">
              <Database className="w-5 h-5" />
              Zone de Danger
            </h2>
            {!nukeConfirm ? (
              <Button variant="danger" fullWidth onClick={() => setNukeConfirm(true)}>
                NUKE DATABASE (Reset)
              </Button>
            ) : (
              <div className="space-y-2 animate-pulse">
                <p className="text-failure font-bold text-center">ÊTES-VOUS SÛR ?</p>
                <div className="flex gap-2">
                  <Button variant="secondary" fullWidth onClick={() => setNukeConfirm(false)}>Annuler</Button>
                  <Button variant="danger" fullWidth onClick={handleNukeDb}>OUI, TOUT EFFACER</Button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === 'config' && (
        <div className="flex flex-col gap-6">
          
          {/* Global Settings */}
          <div className="bg-surface border border-white/5 rounded-3xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-primary" />
              Paramètres Globaux
            </h2>
            
            <div className="space-y-4">
              {/* Maintenance Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-sm font-bold">Mode Maintenance</span>
                  <span className="text-xs text-white/50">Bloque l'accès à l'app (sauf admins)</span>
                </div>
                <button 
                  onClick={() => setConfig(prev => ({ ...prev, maintenanceMode: !prev.maintenanceMode }))}
                  className={clsx(
                    "w-12 h-6 rounded-full relative transition-colors",
                    config.maintenanceMode ? "bg-primary" : "bg-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: config.maintenanceMode ? 24 : 2 }}
                    className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>

              {/* Allow Signups */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-sm font-bold">Inscriptions Ouvertes</span>
                  <span className="text-xs text-white/50">Autoriser les nouveaux utilisateurs</span>
                </div>
                <button 
                  onClick={() => setConfig(prev => ({ ...prev, allowSignups: !prev.allowSignups }))}
                  className={clsx(
                    "w-12 h-6 rounded-full relative transition-colors",
                    config.allowSignups ? "bg-primary" : "bg-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: config.allowSignups ? 24 : 2 }}
                    className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>

              {/* Global Multiplier */}
              <div>
                <label className="block text-sm font-bold mb-1">Multiplicateur de Points (Global)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0.1"
                  value={config.globalMultiplier}
                  onChange={(e) => setConfig(prev => ({ ...prev, globalMultiplier: parseFloat(e.target.value) }))}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-white/50 mt-1">x1.0 = Normal. x2.0 = Double XP.</p>
              </div>
            </div>
          </div>

          {/* Announcement Banner */}
          <div className="bg-surface border border-white/5 rounded-3xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-yellow-400" />
              Annonce Publique
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Message</label>
                <textarea 
                  value={config.announcement}
                  onChange={(e) => setConfig(prev => ({ ...prev, announcement: e.target.value }))}
                  placeholder="Message affiché sur l'écran d'accueil..."
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Type d'annonce</label>
                <div className="flex gap-2">
                  {(['info', 'warning', 'alert'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setConfig(prev => ({ ...prev, announcementType: type }))}
                      className={clsx(
                        "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all",
                        config.announcementType === type 
                          ? type === 'info' ? "bg-blue-500/20 border-blue-500 text-blue-500"
                          : type === 'warning' ? "bg-yellow-500/20 border-yellow-500 text-yellow-500"
                          : "bg-red-500/20 border-red-500 text-red-500"
                          : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleSaveConfig} fullWidth className="sticky bottom-6 shadow-xl">
            <Save className="w-4 h-4 mr-2" />
            Sauvegarder la Configuration
          </Button>

          {/* Backup & Restore */}
          <div className="bg-surface border border-white/5 rounded-3xl p-6 mt-4">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              Sauvegarde & Restauration
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={handleExportDB}>
                <Download className="w-4 h-4 mr-2" />
                Exporter JSON
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  ref={fileInputRef}
                  onChange={handleImportDB}
                  className="hidden"
                />
                <Button variant="secondary" fullWidth onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importer JSON
                </Button>
              </div>
            </div>
            <p className="text-xs text-white/40 mt-3 text-center">
              L'importation écrasera toutes les données actuelles.
            </p>
          </div>

        </div>
      )}

      {/* Edit User Modal */}
      <AnimatePresence>
        {userToEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h2 className="text-xl font-display text-white mb-1">Éditer Utilisateur</h2>
              <p className="text-sm text-white/50 mb-6">Modifier les stats de {userToEdit.displayName}</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-white/50 mb-1 block">Points</label>
                  <input
                    type="number"
                    value={userToEdit.points}
                    onChange={(e) => setUserToEdit({ ...userToEdit, points: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-white/50 mb-1 block">Série (Streak)</label>
                  <input
                    type="number"
                    value={userToEdit.streak}
                    onChange={(e) => setUserToEdit({ ...userToEdit, streak: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-white/50 mb-1 block">Total Gagné</label>
                  <input
                    type="number"
                    value={userToEdit.totalEarned}
                    onChange={(e) => setUserToEdit({ ...userToEdit, totalEarned: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-4 py-3">
                  <span className="text-sm font-bold text-white">Droits Admin</span>
                  <button
                    onClick={() => setUserToEdit({ ...userToEdit, isAdmin: !userToEdit.isAdmin })}
                    className={clsx(
                      "w-12 h-6 rounded-full transition-colors relative",
                      userToEdit.isAdmin ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div className={clsx(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      userToEdit.isAdmin ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button variant="secondary" fullWidth onClick={() => setUserToEdit(null)}>Annuler</Button>
                <Button fullWidth onClick={handleUpdateUser}>Sauvegarder</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setUserToDelete(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-failure/20 flex items-center justify-center mb-4 mx-auto">
                <AlertTriangle className="w-6 h-6 text-failure" />
              </div>
              
              <h3 className="font-display text-xl text-center mb-2">Supprimer l'utilisateur ?</h3>
              <p className="text-white/60 text-center text-sm mb-6">
                Êtes-vous sûr de vouloir supprimer <strong>{userToDelete.username}</strong> ? <br/>
                Cette action est irréversible et effacera tout son historique.
              </p>

              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={() => setUserToDelete(null)}>
                  Annuler
                </Button>
                <Button variant="danger" fullWidth onClick={handleDelete}>
                  Supprimer
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
