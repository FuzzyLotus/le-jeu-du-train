import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User as UserIcon, MapPin, BarChart3, Calendar, UserPlus, Check, X, Shield, Clock, Settings, Trophy, History, Lock, CheckCircle2 } from 'lucide-react';
import { AuthService } from '../services/AuthService';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { db } from '../db/database';
import { ACHIEVEMENTS } from '../services/AchievementEngine';
import type { User, Trip, FriendRequest } from '../types/models';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

export function PublicProfileScreen({ isMe = false }: { isMe?: boolean }) {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const addToast = useToastStore((state) => state.addToast);

  const [user, setUser] = useState<User | null>(null);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [achievements, setAchievements] = useState<Set<string>>(new Set());
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends' | 'self'>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'achievements'>('stats');
  const [selectedAchievement, setSelectedAchievement] = useState<typeof ACHIEVEMENTS[0] | null>(null);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'bg-slate-500';
      case 'Uncommon': return 'bg-emerald-500';
      case 'Rare': return 'bg-blue-500';
      case 'Very Rare': return 'bg-purple-500';
      case 'Legendary': return 'bg-yellow-500';
      case 'Secret': return 'bg-rose-500';
      default: return 'bg-slate-500';
    }
  };

  const getRarityLabel = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'Commun';
      case 'Uncommon': return 'Peu commun';
      case 'Rare': return 'Rare';
      case 'Very Rare': return 'Très rare';
      case 'Legendary': return 'Légendaire';
      case 'Secret': return 'Secret';
      default: return rarity;
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      console.log('loadProfile called', { isAuthLoading, currentUserId: currentUser?.id });
      if (isAuthLoading) {
        return;
      }
      if (!currentUser?.id) {
        setIsLoading(false);
        navigate('/login');
        return;
      }
      
      setIsLoading(true);
      const targetUserId = isMe ? currentUser.id : (userId ? parseInt(userId) : null);
      if (!targetUserId || isNaN(targetUserId)) {
        setIsLoading(false);
        addToast({ title: 'Erreur', message: 'Utilisateur invalide.', type: 'error' });
        navigate('/leaderboard');
        return;
      }

      if (targetUserId === currentUser.id) {
        // Load own profile from API to get accurate recent trips
        try {
          const response = await fetch(`/api/users/me`, {
            headers: AuthService.getAuthHeaders()
          });
          if (response.ok) {
            const data = await response.json();
            console.log('data received', data);  // inspect
            // Accept both wrapped ({ user, achievements, recentTrips }) and direct user object
            setUser(data?.user ?? data);
            setFriendStatus('self');
            setRecentTrips(data.recentTrips ?? data.recentTrips ?? []);
            setAchievements(new Set(data.achievements ?? []));
          } else {
            console.log('response not ok', response.status);  // add this
            addToast({ title: 'Erreur', message: 'Impossible de charger le profil.', type: 'error' });
            navigate('/');
          }
        } catch (e) {
          addToast({ title: 'Erreur', message: 'Impossible de charger le profil.', type: 'error' });
          navigate('/');
        } finally {
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/users/${targetUserId}`, {
          headers: AuthService.getAuthHeaders()
        });

        if (!response.ok) {
          if (response.status === 403) {
             addToast({ title: 'Privé', message: 'Ce profil est privé.', type: 'info' });
          } else {
             addToast({ title: 'Erreur', message: 'Utilisateur introuvable.', type: 'error' });
          }
          navigate('/leaderboard');
          return;
        }

        const data = await response.json();
        setUser(data?.user ?? data);
        setFriendStatus(data.friendStatus ?? data.friendStatus ?? 'none');
        setRecentTrips(data.recentTrips ?? []);
        setAchievements(new Set(data.achievements ?? []));

      } catch (error) {
        addToast({ title: 'Erreur', message: 'Impossible de charger le profil.', type: 'error' });
        navigate('/leaderboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [userId, isMe, currentUser?.id, isAuthLoading]);

  const handleSendRequest = async () => {
    if (!currentUser?.id || !user?.id) return;
    
    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({ targetUserId: user.id })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Impossible d\'envoyer la demande.');
      }

      setFriendStatus('pending_sent');
      addToast({ title: 'Succès', message: 'Demande envoyée !', type: 'success' });
    } catch (error: any) {
      console.error(error);
      addToast({ title: 'Erreur', message: error.message, type: 'error' });
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser?.id || !user?.id) return;
    
    try {
      // We need the requestId to accept. The backend API requires requestId.
      // But we only have targetUserId here. Let's fetch friends list to find the request ID.
      const friendsRes = await fetch('/api/friends', { headers: AuthService.getAuthHeaders() });
      if (!friendsRes.ok) throw new Error('Failed to fetch requests');
      const requests = await friendsRes.json();
      
      const request = requests.find((r: any) => r.sender_id === user.id && r.receiver_id === currentUser.id && r.status === 'pending');
      
      if (request?.id) {
        const acceptRes = await fetch('/api/friends/accept', {
          method: 'POST',
          headers: AuthService.getAuthHeaders(),
          body: JSON.stringify({ requestId: request.id })
        });
        
        if (!acceptRes.ok) throw new Error('Failed to accept');

        setFriendStatus('friends');
        addToast({ title: 'Succès', message: 'Vous êtes maintenant amis !', type: 'success' });
      }
    } catch (error) {
      console.error(error);
      addToast({ title: 'Erreur', message: 'Action impossible.', type: 'error' });
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const showStats = user.preferences?.showStats !== false;
  const showFullTripDetails = user.preferences?.showFullTripDetails === true;
  const isOwnProfile = currentUser?.id === user.id;

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto relative pb-24">
      <header className="flex items-center gap-4 mb-8 mt-4">
        {!isMe && (
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-xl font-display text-white flex-1">Profil</h1>
        
        {isOwnProfile && (
          <div className="flex gap-2">
            {currentUser.isAdmin && (
              <button 
                onClick={() => navigate('/admin')}
                className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                title="Administration"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={() => navigate('/settings')}
              className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
              title="Paramètres"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-6">
        
        {/* Profile Header */}
        <section className="bg-surface border border-white/5 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 border-2 border-white/10 flex items-center justify-center mb-4 text-4xl">
            {/* Simple avatar placeholder */}
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-1">{user.displayName}</h2>
          <p className="text-white/50 text-sm mb-6">@{user.username}</p>

          {/* Action Button */}
          {friendStatus !== 'self' && (
            <div className="w-full">
              {friendStatus === 'none' && user.preferences?.allowFriendRequests !== false && (
                <button 
                  onClick={handleSendRequest}
                  className="w-full py-2 bg-primary text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Ajouter en ami
                </button>
              )}
              {friendStatus === 'pending_sent' && (
                <div className="w-full py-2 bg-white/10 text-white/50 font-bold rounded-xl flex items-center justify-center gap-2 cursor-default">
                  <Clock className="w-4 h-4" />
                  Demande envoyée
                </div>
              )}
              {friendStatus === 'pending_received' && (
                <button 
                  onClick={handleAcceptRequest}
                  className="w-full py-2 bg-success text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-success/90 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Accepter la demande
                </button>
              )}
              {friendStatus === 'friends' && (
                <div className="w-full py-2 bg-success/20 text-success font-bold rounded-xl flex items-center justify-center gap-2 border border-success/20">
                  <Check className="w-4 h-4" />
                  Amis
                </div>
              )}
              {friendStatus === 'none' && user.preferences?.allowFriendRequests === false && (
                <div className="text-xs text-white/30 italic">
                  Cet utilisateur n'accepte pas les demandes.
                </div>
              )}
            </div>
          )}
        </section>

        {/* Tabs */}
        <div className="flex p-1 bg-surface border border-white/10 rounded-xl">
          <button 
            onClick={() => setActiveTab('stats')}
            className={clsx("flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2", activeTab === 'stats' ? "bg-white/10 text-white" : "text-white/40")}
          >
            <BarChart3 className="w-4 h-4" />
            Stats
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={clsx("flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2", activeTab === 'history' ? "bg-white/10 text-white" : "text-white/40")}
          >
            <History className="w-4 h-4" />
            Historique
          </button>
          <button 
            onClick={() => setActiveTab('achievements')}
            className={clsx("flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2", activeTab === 'achievements' ? "bg-white/10 text-white" : "text-white/40")}
          >
            <Trophy className="w-4 h-4" />
            Succès
          </button>
        </div>

        {/* Content */}
        <div className="min-h-[300px]">
          {activeTab === 'stats' && (
            showStats ? (
              <motion.section 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-3"
              >
                <div className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <BarChart3 className="w-6 h-6 text-yellow-400 mb-2" />
                  <span className="text-2xl font-display text-white">{user.points}</span>
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Points</span>
                </div>
                <div className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <Trophy className="w-6 h-6 text-primary mb-2" />
                  <span className="text-2xl font-display text-white">{user.highestScore || 0}</span>
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Record</span>
                </div>
                <div className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <MapPin className="w-6 h-6 text-purple-400 mb-2" />
                  <span className="text-2xl font-display text-white">{user.tripCount}</span>
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Trajets</span>
                </div>
                <div className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <Calendar className="w-6 h-6 text-blue-400 mb-2" />
                  <span className="text-2xl font-display text-white">{user.streak}</span>
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Jours Streak</span>
                </div>
                <div className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <Shield className="w-6 h-6 text-green-400 mb-2" />
                  <span className="text-2xl font-display text-white">{Math.round(user.totalDistanceKm)}</span>
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Km Total</span>
                </div>
              </motion.section>
            ) : (
              <div className="bg-surface border border-white/5 rounded-2xl p-6 text-center text-white/40 italic text-sm">
                Les statistiques de cet utilisateur sont privées.
              </div>
            )
          )}

          {activeTab === 'history' && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {user.preferences?.showTripHistory === false ? (
                 <div className="bg-surface border border-white/5 rounded-2xl p-6 text-center text-white/40 italic text-sm">
                   L'historique des trajets est privé.
                 </div>
              ) : recentTrips.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {recentTrips.map(trip => (
                    <div key={trip.id} className="bg-surface border border-white/5 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex flex-col min-w-0 mr-4">
                        <span className="text-white font-bold text-sm truncate">
                          {showFullTripDetails ? trip.routeName : "Trajet masqué"}
                        </span>
                        <span className="text-white/40 text-xs">
                          {new Date(trip.date).toLocaleDateString()} • {trip.distanceKm.toFixed(1)} km
                        </span>
                      </div>
                      <div className={clsx("px-2 py-1 rounded text-[10px] font-bold uppercase", trip.success ? "bg-success/20 text-success" : "bg-failure/20 text-failure")}>
                        {trip.success ? "Réussi" : "Échoué"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-white/30 text-sm py-4">
                  Aucun trajet récent.
                </div>
              )}
            </motion.section>
          )}

          {activeTab === 'achievements' && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-3 gap-2"
            >
               {ACHIEVEMENTS.map((ach) => {
                const isUnlocked = achievements.has(ach.id);
                const isSecret = ach.rarity === 'Secret';
                
                // Split by space, assuming the last part is the emoji/icon
                const parts = ach.title.split(' ');
                const icon = parts.length > 1 ? parts[parts.length - 1] : '🏆';
                
                const displayIcon = (isSecret && !isUnlocked) ? '❓' : icon;
                
                return (
                  <button 
                    key={ach.id}
                    onClick={() => setSelectedAchievement(ach)}
                    className={clsx(
                      "aspect-square flex flex-col items-center justify-center p-2 rounded-2xl border transition-all text-center relative overflow-hidden",
                      isUnlocked 
                        ? "bg-primary/10 border-primary/30 shadow-[0_0_10px_rgba(255,193,7,0.1)] opacity-100 hover:bg-primary/20" 
                        : "bg-surface border-white/5 opacity-40 grayscale hover:opacity-60"
                    )}
                  >
                    <div className={clsx("absolute top-1 left-1 w-1.5 h-1.5 rounded-full", getRarityColor(ach.rarity))} />
                    
                    {isUnlocked && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle2 className="w-3 h-3 text-primary" />
                      </div>
                    )}
                    
                    <span className="text-2xl mb-1 drop-shadow-md">{displayIcon}</span>
                  </button>
                );
              })}
            </motion.section>
          )}
        </div>

        {/* Achievement Modal */}
        <AnimatePresence>
          {selectedAchievement && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedAchievement(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-surface border border-white/10 rounded-3xl p-8 w-full max-w-sm relative z-10 shadow-2xl"
              >
                <button 
                  onClick={() => setSelectedAchievement(null)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col items-center text-center">
                  <div className={clsx(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-6 text-5xl shadow-[0_0_30px_rgba(0,0,0,0.3)]",
                    achievements.has(selectedAchievement.id) ? "bg-primary/20" : "bg-white/5 grayscale"
                  )}>
                    {selectedAchievement.rarity === 'Secret' && !achievements.has(selectedAchievement.id)
                      ? '❓'
                      : (selectedAchievement.title.split(' ').pop() || '🏆')}
                  </div>

                  <h2 className="font-display text-2xl text-white mb-2">
                    {selectedAchievement.rarity === 'Secret' && !achievements.has(selectedAchievement.id)
                      ? 'Succès Secret'
                      : selectedAchievement.title.split(' ').slice(0, -1).join(' ')}
                  </h2>

                  <div className="flex items-center gap-2 mb-6">
                    <div className={clsx(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white",
                      getRarityColor(selectedAchievement.rarity)
                    )}>
                      {getRarityLabel(selectedAchievement.rarity)}
                    </div>
                    
                    <div className={clsx(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      achievements.has(selectedAchievement.id) 
                        ? "bg-primary/20 text-primary" 
                        : "bg-white/10 text-white/50"
                    )}>
                      {achievements.has(selectedAchievement.id) ? "Déverrouillé" : "Verrouillé"}
                    </div>
                  </div>

                  <p className="text-white/70 leading-relaxed">
                    {selectedAchievement.rarity === 'Secret' && !achievements.has(selectedAchievement.id)
                      ? "Déverrouille ce succès pour découvrir son secret."
                      : (selectedAchievement as any).description || "Pas de description disponible."}
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
