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
import type { Feedback, FeedbackStatus, FeedbackReply, User, Trip } from '../types/models';
import { ACHIEVEMENTS } from '../services/AchievementEngine';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AuthService } from '../services/AuthService';

export function AdminScreen() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, logout } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  
  const [userToDelete, setUserToDelete] = useState<{id: number, username: string} | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'monitoring' | 'users' | 'feedback' | 'system'>('monitoring');
  const [activeSubTab, setActiveSubTab] = useState<string>('');
  const [replyText, setReplyText] = useState<{[key: number]: string}>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [nukeConfirm, setNukeConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [resolvingRequest, setResolvingRequest] = useState<number | null>(null);
  const [newPasswordForRequest, setNewPasswordForRequest] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Config State
  const [config, setConfig] = useState({
    maintenanceMode: false,
    allowSignups: true,
    globalMultiplier: 1,
    announcement: '',
    announcementType: 'info' as 'info' | 'warning' | 'alert',
    enableSimulator: false
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
    if (activeTab === 'monitoring') setActiveSubTab('analytics');
    if (activeTab === 'users') {
      setActiveSubTab('list');
      loadResetRequests();
    }
    if (activeTab === 'system') setActiveSubTab('config');
  }, [activeTab]);

  useEffect(() => {
    if (activeSubTab === 'resets') {
      loadResetRequests();
    }
  }, [activeSubTab]);

  const loadResetRequests = async () => {
    if (!currentUser?.id) return;
    try {
      const requests = await AuthService.getResetRequests();
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
      await AuthService.resolveResetRequest(requestId, newPasswordForRequest);
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
        await db.settings.put({ key: 'enableSimulator', value: config.enableSimulator });
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

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [friendRequests, setFriendRequests] = useState<Array<{ sender_id: number; receiver_id: number; status: string; sender_username: string; receiver_username: string }>>([]);

  useEffect(() => {
    if (activeTab === 'users' || activeTab === 'monitoring') {
      loadUsers();
    }
    if (activeTab === 'monitoring' && currentUser?.id) {
      loadFriendRequests();
    }
    if (activeTab === 'feedback') {
      loadFeedback();
    }
  }, [activeTab, currentUser?.id]);

  const loadFeedback = async () => {
    try {
      setLoadingFeedback(true);
      const response = await fetch('/api/admin/feedback', { headers: AuthService.getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setFeedback(data);
      } else {
        const data = await response.json().catch(() => ({}));
        addToast({ title: 'Erreur', message: data.error || 'Impossible de charger les retours.', type: 'error' });
        setFeedback([]);
      }
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Impossible de charger les retours.', type: 'error' });
      setFeedback([]);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/admin/users', { headers: AuthService.getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadFriendRequests = async () => {
    if (!currentUser?.id) return;
    try {
      const response = await fetch('/api/friends', { headers: AuthService.getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data);
      }
    } catch (e) {
      console.error(e);
    }
  };
  const trips = useLiveQuery(() => db.trips.reverse().limit(100).toArray()); // Last 100 trips for moderation
  const allTrips = useLiveQuery(() => db.trips.toArray()); // All trips for analytics
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
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
    // This requires a new endpoint to update other users, skipping for now or implementing if needed
    addToast({ title: 'Info', message: 'Édition via API non implémentée', type: 'info' });
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
      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: AuthService.getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete');
      
      addToast({ title: 'Succès', message: `L'utilisateur ${userToDelete.username} a été supprimé.`, type: 'success' });
      loadUsers();
    } catch (error) {
      console.error(error);
      addToast({ title: 'Erreur', message: 'Impossible de supprimer l\'utilisateur.', type: 'error' });
    } finally {
      setUserToDelete(null);
    }
  };

  const handleUpdateStatus = async (id: number, status: FeedbackStatus) => {
    try {
      const response = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { ...AuthService.getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update');
      }
      const updated = await response.json();
      setFeedback(prev => prev.map(f => f.id === id ? { ...f, ...updated } : f));
      addToast({ title: 'Succès', message: 'Statut mis à jour.', type: 'success' });
    } catch (error: any) {
      console.error(error);
      addToast({ title: 'Erreur', message: error.message || 'Impossible de mettre à jour le statut.', type: 'error' });
    }
  };

  const handleReply = async (feedbackId: number) => {
    if (!currentUser?.id || !replyText[feedbackId]?.trim()) return;

    try {
      const response = await fetch(`/api/admin/feedback/${feedbackId}/reply`, {
        method: 'POST',
        headers: { ...AuthService.getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText[feedbackId].trim() })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to reply');
      }
      const updated = await response.json();
      setFeedback(prev => prev.map(f => f.id === feedbackId ? { ...f, ...updated } : f));
      setReplyText(prev => ({ ...prev, [feedbackId]: '' }));
      addToast({ title: 'Envoyé!', message: 'Réponse ajoutée.', type: 'success' });
    } catch (error: any) {
      console.error(error);
      addToast({ title: 'Erreur', message: error.message || "Impossible d'envoyer la réponse.", type: 'error' });
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
      const response = await fetch('/api/admin/dummy-users', {
        method: 'POST',
        headers: AuthService.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate dummy users');
      }

      addToast({ title: 'Succès', message: 'Alice & Bob créés', type: 'success' });
      loadUsers();
      loadFriendRequests();
    } catch (error) {
      console.error(error);
      addToast({ title: 'Erreur', message: 'Échec création dummy users', type: 'error' });
    }
  };

  const handleBotAction = async (action: 'send_request' | 'accept_request' | 'remove_friend', botName: string) => {
    if (!currentUser?.id) return;

    try {
      const response = await fetch('/api/admin/bot-action', {
        method: 'POST',
        headers: { ...AuthService.getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, botName })
      });

      const data = await response.json();

      if (!response.ok) {
        addToast({ title: 'Erreur', message: data.error || 'Action échouée', type: 'error' });
        return;
      }

      addToast({ title: 'Succès', message: data.message, type: 'success' });
      loadFriendRequests();
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Action échouée', type: 'error' });
    }
  };

  type BotFriendStatus = 'none' | 'pending_sent' | 'friends';
  const getBotFriendStatus = (botUsername: string): BotFriendStatus => {
    if (!currentUser?.id || !users?.length) return 'none';
    const bot = users.find(u => u.username === botUsername);
    if (!bot) return 'none';
    const row = friendRequests.find(
      fr => (fr.sender_id === currentUser!.id && fr.receiver_id === bot.id) || (fr.sender_id === bot.id && fr.receiver_id === currentUser!.id)
    );
    if (!row) return 'none';
    if (row.status === 'accepted') return 'friends';
    if (row.sender_id === currentUser!.id && row.receiver_id === bot.id) return 'pending_sent';
    return 'none';
  };

  const handleGenerateTrips = async () => {
    if (!currentUser?.id) return;
    try {
      const response = await fetch('/api/admin/generate-trips', {
        method: 'POST',
        headers: AuthService.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to generate trips');
      }

      const data = await response.json();
      setCurrentUser(data.user);
      
      addToast({ title: 'Succès', message: '10 trajets générés!', type: 'success' });
    } catch (e) {
      console.error(e);
      addToast({ title: 'Erreur', message: 'Échec génération trajets', type: 'error' });
    }
  };

  const handleToggleAchievement = async (achievementId: string, title: string) => {
    if (!currentUser?.id) return;
    try {
      const existing = await db.achievements.where({ userId: currentUser.id, achievementId }).first();
      if (existing) {
        await db.achievements.delete(existing.id);
        addToast({ title: 'Succès', message: `${title} réinitialisé`, type: 'success' });
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
      addToast({ title: 'Erreur', message: 'Échec action succès', type: 'error' });
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
          href="https://github.com/FuzzyLotus/le-jeu-du-train/" 
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
          onClick={() => setActiveTab('monitoring')}
          className={clsx(
            "flex flex-col items-center justify-center py-4 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5 min-h-[72px]",
            activeTab === 'monitoring' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <BarChart3 className="w-6 h-6" />
          Suivi
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={clsx(
            "flex flex-col items-center justify-center py-4 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5 min-h-[72px]",
            activeTab === 'users' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <Users className="w-6 h-6" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={clsx(
            "flex flex-col items-center justify-center py-4 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5 min-h-[72px]",
            activeTab === 'feedback' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <MessageSquare className="w-6 h-6" />
          Avis
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={clsx(
            "flex flex-col items-center justify-center py-4 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider gap-1.5 min-h-[72px]",
            activeTab === 'system' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <SettingsIcon className="w-6 h-6" />
          Système
        </button>
      </div>

      {/* Sub-tabs */}
      {activeTab === 'monitoring' && (
        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => setActiveSubTab('analytics')}
            className={clsx("flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all min-h-[56px]", activeSubTab === 'analytics' ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-white/40")}
          >
            Statistiques
          </button>
          <button 
            onClick={() => setActiveSubTab('moderation')}
            className={clsx("flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all min-h-[56px]", activeSubTab === 'moderation' ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-white/40")}
          >
            Modération
          </button>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => setActiveSubTab('list')}
            className={clsx("flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all min-h-[56px]", activeSubTab === 'list' ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-white/40")}
          >
            Liste
          </button>
          <button 
            onClick={() => setActiveSubTab('resets')}
            className={clsx("flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all min-h-[56px]", activeSubTab === 'resets' ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-white/40")}
          >
            Réinitialisations
          </button>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => setActiveSubTab('config')}
            className={clsx("flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all min-h-[56px]", activeSubTab === 'config' ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-white/40")}
          >
            Configuration
          </button>
          <button 
            onClick={() => setActiveSubTab('console')}
            className={clsx("flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all min-h-[56px]", activeSubTab === 'console' ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-white/40")}
          >
            Console Dev
          </button>
        </div>
      )}

      {activeTab === 'monitoring' && activeSubTab === 'analytics' && (
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

      {activeTab === 'users' && activeSubTab === 'list' && (
        <div className="bg-surface border border-white/5 rounded-3xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4">Gestion des utilisateurs</h2>
          <p className="text-sm text-white/50 mb-6">
            Attention : la suppression d'un utilisateur est définitive et efface tout son historique.
          </p>

          <div className="flex flex-col gap-3">
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 transition-colors"
              />
              {userSearch && (
                <button 
                  onClick={() => setUserSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>

            {users?.filter(u => 
              u.displayName.toLowerCase().includes(userSearch.toLowerCase()) || 
              u.username.toLowerCase().includes(userSearch.toLowerCase())
            ).map((user) => (
              <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/20 rounded-2xl p-4 border border-white/5 gap-4">
                <div className="flex flex-col overflow-hidden">
                  <span className="font-bold text-white truncate flex items-center gap-2 text-lg">
                    {user.displayName}
                    {user.isAdmin && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Admin</span>}
                  </span>
                  <span className="text-sm text-white/40 truncate font-mono">@{user.username}</span>
                  <div className="flex gap-3 mt-1 text-xs text-white/50">
                    <span>🏆 {user.points} pts</span>
                    <span>🔥 {user.streak} série</span>
                    <span>🚗 {user.tripCount} trajets</span>
                  </div>
                </div>
                
                {user.id !== currentUser.id && (
                  <div className="flex gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => setUserToEdit(user)}
                      className="h-10 px-4 rounded-xl bg-white/5 text-white border border-white/10 flex items-center justify-center gap-2 hover:bg-white/10 transition-colors active:scale-95 text-xs font-bold uppercase tracking-wider"
                    >
                      <Edit className="w-4 h-4" />
                      Éditer
                    </button>
                    <button
                      onClick={() => user.id !== undefined && setUserToDelete({ id: user.id, username: user.username })}
                      className="h-10 px-4 rounded-xl bg-failure/10 text-failure border border-failure/20 flex items-center justify-center gap-2 hover:bg-failure/20 transition-colors active:scale-95 text-xs font-bold uppercase tracking-wider"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
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

      {activeTab === 'monitoring' && activeSubTab === 'moderation' && (
        <div className="bg-surface border border-white/5 rounded-3xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Modération
          </h2>
          <p className="text-xs text-white/50 mb-6">
            Les 100 derniers trajets. Surveillez les anomalies.
          </p>

          <div className="space-y-2">
            {trips?.map(trip => {
              const user = users?.find(u => u.id === trip.userId);
              const isSuspicious = trip.distanceKm > 100 || trip.crossingsCount > 20;

              return (
                <div key={trip.id} className={clsx(
                  "p-3 rounded-xl border flex items-center justify-between gap-3",
                  isSuspicious ? "bg-red-500/5 border-red-500/20" : "bg-black/20 border-white/5"
                )}>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-white truncate">{user?.displayName || 'Inconnu'}</span>
                      <span className="text-[10px] text-white/40">
                        {new Date(trip.date).toLocaleDateString()}
                      </span>
                      {isSuspicious && (
                        <span className="bg-red-500/20 text-red-500 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Suspect
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/60 mt-0.5 truncate">
                      {trip.distanceKm}km • {trip.crossingsCount} passages
                    </div>
                  </div>

                  <button
                    onClick={() => trip.id && handleDeleteTrip(trip.id)}
                    className="w-12 h-12 rounded-full bg-white/5 text-white/40 hover:bg-failure/10 hover:text-failure flex items-center justify-center transition-colors shrink-0 active:scale-95"
                    title="Supprimer"
                  >
                    <Ban className="w-6 h-6" />
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

      {activeTab === 'users' && activeSubTab === 'resets' && (
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
          {loadingFeedback ? (
            <div className="flex items-center justify-center py-12 text-white/50">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
          feedback?.map((item) => (
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
                  className={clsx("w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors active:scale-95", item.status === 'pending' ? "text-yellow-500 bg-yellow-500/10" : "text-white/30")}
                  title="En attente"
                >
                  <Clock className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => item.id && handleUpdateStatus(item.id, 'in_progress')}
                  className={clsx("w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors active:scale-95", item.status === 'in_progress' ? "text-blue-500 bg-blue-500/10" : "text-white/30")}
                  title="En cours"
                >
                  <Loader2 className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => item.id && handleUpdateStatus(item.id, 'resolved')}
                  className={clsx("w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors active:scale-95", item.status === 'resolved' ? "text-green-500 bg-green-500/10" : "text-white/30")}
                  title="Résolu"
                >
                  <CheckCircle2 className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => item.id && handleUpdateStatus(item.id, 'rejected')}
                  className={clsx("w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors active:scale-95", item.status === 'rejected' ? "text-red-500 bg-red-500/10" : "text-white/30")}
                  title="Rejeté"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
          )))}

          {!loadingFeedback && feedback?.length === 0 && (
            <div className="text-center text-white/50 py-8 bg-surface border border-white/5 rounded-3xl">
              Aucun retour pour le moment.
            </div>
          )}
        </div>
      )}

      {activeTab === 'system' && activeSubTab === 'console' && (
        <div className="flex flex-col gap-4">
          
          <div className="grid grid-cols-1 gap-4">
            {/* User Switcher */}
            <div className="bg-surface border border-white/5 rounded-3xl p-5">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2 text-white/70">
                <Users className="w-4 h-4" />
                Changer d'identité
              </h2>
              <div className="flex flex-wrap gap-2">
                {users?.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleSwitchUser(u)}
                    disabled={u.id === currentUser.id}
                    className={clsx(
                      "px-6 py-4 rounded-xl border text-xs font-bold transition-all min-h-[56px]",
                      u.id === currentUser.id 
                        ? "bg-primary/20 border-primary text-primary" 
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {u.displayName}
                  </button>
                ))}
              </div>
            </div>

            {/* Experimental Features */}
            <div className="bg-surface border border-white/5 rounded-3xl p-5">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2 text-white/70">
                <Terminal className="w-4 h-4" />
                Fonctionnalités Dev
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-sm font-bold">Simulateur GPS</span>
                  <span className="text-xs text-white/50">Affiche le bouton "Simuler" en trajet</span>
                </div>
                <button 
                  onClick={async () => {
                    const newVal = !config.enableSimulator;
                    setConfig(prev => ({ ...prev, enableSimulator: newVal }));
                    await db.settings.put({ key: 'enableSimulator', value: newVal });
                    addToast({ title: 'Succès', message: 'Simulateur ' + (newVal ? 'activé' : 'désactivé'), type: 'success' });
                  }}
                  className={clsx(
                    "w-12 h-6 rounded-full relative transition-colors",
                    config.enableSimulator ? "bg-primary" : "bg-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: config.enableSimulator ? 24 : 2 }}
                    className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>
            </div>

            {/* Quick Actions + Alice & Bob */}
            <div className="bg-surface border border-white/5 rounded-3xl p-5">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2 text-white/70">
                <Zap className="w-4 h-4" />
                Actions Rapides
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Button onClick={handleGenerateDummyUsers} variant="secondary" className="text-xs py-4 h-auto min-h-[56px]">
                  Créer Alice & Bob
                </Button>
                <Button onClick={handleGenerateTrips} variant="secondary" className="text-xs py-4 h-auto min-h-[56px]">
                  +10 Trajets (Moi)
                </Button>
              </div>
              <div className="space-y-4 pt-2 border-t border-white/5">
                {(['alice_w', 'bob_builder'] as const).map(botName => {
                  const status = getBotFriendStatus(botName);
                  const label = botName === 'alice_w' ? 'Alice' : 'Bob';
                  const demanderActive = status === 'none';
                  const secondAction: 'accept' | 'remove' = status === 'friends' ? 'remove' : 'accept';
                  const secondActive = status === 'pending_sent' || status === 'friends';
                  const demanderHighlighted = status === 'pending_sent' || status === 'friends';
                  return (
                    <div key={botName} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/50 font-bold">{label}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => demanderActive && handleBotAction('send_request', botName)}
                          disabled={!demanderActive}
                          className={clsx(
                            'w-24 py-3 rounded-xl text-xs font-bold uppercase transition-colors min-h-[48px]',
                            demanderHighlighted
                              ? 'bg-green-500/20 border border-green-500/40 text-green-400 cursor-not-allowed'
                              : demanderActive
                                ? 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                                : 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'
                          )}
                        >
                          Demander
                        </button>
                        <button
                          onClick={() => secondActive && (secondAction === 'remove' ? handleBotAction('remove_friend', botName) : handleBotAction('accept_request', botName))}
                          disabled={!secondActive}
                          className={clsx(
                            'w-24 py-3 rounded-xl text-xs font-bold uppercase transition-colors min-h-[48px]',
                            !secondActive
                              ? 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'
                              : secondAction === 'remove'
                                ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                                : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                          )}
                        >
                          {secondAction === 'remove' ? 'Retirer' : 'Accepter'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Achievement Unlocker */}
            <div className="bg-surface border border-white/5 rounded-3xl p-5">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2 text-white/70">
                <Trophy className="w-4 h-4" />
                Déblocage Succès
              </h2>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {ACHIEVEMENTS.map(ach => {
                  const isUnlocked = myAchievements?.some(a => a.achievementId === ach.id);
                  return (
                    <button
                      key={ach.id}
                      onClick={() => handleToggleAchievement(ach.id, ach.title)}
                      className={clsx(
                        "flex items-center justify-between p-4 rounded-xl border transition-all text-left text-xs min-h-[56px]",
                        isUnlocked 
                          ? "bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20" 
                          : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                      )}
                    >
                      <span className="font-bold truncate">{ach.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nuke DB */}
            <div className="bg-surface border border-failure/20 rounded-3xl p-5">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2 text-failure/70">
                <Database className="w-4 h-4" />
                Destruction
              </h2>
              {!nukeConfirm ? (
                <button 
                  onClick={() => setNukeConfirm(true)}
                  className="w-full py-2 bg-failure/10 border border-failure/20 text-failure text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-failure/20 transition-all"
                >
                  Nuke Database
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setNukeConfirm(false)} className="flex-1 py-2 bg-white/5 text-white text-[10px] font-bold uppercase rounded-xl">Non</button>
                  <button onClick={handleNukeDb} className="flex-1 py-2 bg-failure text-white text-[10px] font-bold uppercase rounded-xl">Oui, Nuke</button>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'system' && activeSubTab === 'config' && (
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
