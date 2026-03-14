import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Map, BarChart3, Trophy, History, CarFront, Zap, Minus, Plus, ShieldAlert, MessageSquare, Settings, Users, AlertTriangle, Info, AlertOctagon, Menu, Navigation, Activity } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { db } from '../db/database';
import { AchievementEngine } from '../services/AchievementEngine';
import { GameService } from '../services/GameService';
import { ScoreCard } from '../components/ScoreCard';
import { Button } from '../components/Button';
import { TripPlanner } from '../components/TripPlanner';
import { LiveTracker } from '../components/LiveTracker';
import { useUnreadFeedbackCount } from '../hooks/useUnreadFeedbackCount';
import { useAdminUnreadFeedbackCount } from '../hooks/useAdminUnreadFeedbackCount';
import clsx from 'clsx';

type ActiveOption = 'none' | 'free' | 'quick' | 'gps' | 'live';

export function HomeScreen() {
  const navigate = useNavigate();
  const { currentUser, logout, setCurrentUser } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  
  const [activeOption, setActiveOption] = useState<ActiveOption>('none');
  const [freeCrossings, setFreeCrossings] = useState(1);
  const [freeTrips, setFreeTrips] = useState(1);
  const [announcement, setAnnouncement] = useState<{message: string, type: 'info'|'warning'|'alert'} | null>(null);
  const [globalMultiplier, setGlobalMultiplier] = useState(1);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const location = useLocation();
  const unreadFeedbackCount = useUnreadFeedbackCount(currentUser?.id, location.pathname === '/');
  const adminUnreadFeedbackCount = useAdminUnreadFeedbackCount(currentUser?.id ?? undefined, !!(currentUser?.isAdmin && location.pathname === '/'));

  useEffect(() => {
    const loadSettings = async () => {
      const msg = await db.settings.get('announcement');
      const type = await db.settings.get('announcementType');
      const mult = await db.settings.get('globalMultiplier');

      if (msg && msg.value) {
        setAnnouncement({ 
          message: msg.value, 
          type: (type?.value as any) || 'info' 
        });
      }
      if (mult && mult.value) {
        setGlobalMultiplier(Number(mult.value));
      }
    };
    loadSettings();
  }, []);

  if (!currentUser) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFC107', '#FFD54F', '#FFA000']
    });
  };

  const handleQuickAdd = async (success: boolean) => {
    if (!currentUser.id) return;
    
    // Trigger feedback immediately
    if (success) {
      triggerConfetti();
      addToast({ title: `+${1 * globalMultiplier} point(s)! 🎉`, type: 'success' });
    } else {
      addToast({ title: 'Points remis à zéro! 💥', type: 'error' });
    }

    try {
      const updatedUser = await GameService.submitScore(0, 1, !success, 1);
      
      setCurrentUser(updatedUser);
      await AchievementEngine.check(updatedUser);
      setActiveOption('none');
    } catch (error: any) {
      addToast({ title: 'Erreur', message: error.message, type: 'error' });
    }
  };

  const handleFreeTrip = async (success: boolean) => {
    if (!currentUser.id || freeCrossings <= 0 || freeTrips <= 0) return;
    
    // Trigger feedback immediately
    if (success) {
      triggerConfetti();
      addToast({ title: `Trajet libre: +${freeCrossings * globalMultiplier} points 🎉`, type: 'success' });
    } else {
      addToast({ title: 'Points remis à zéro! 💥', type: 'error' });
    }

    try {
      const updatedUser = await GameService.submitScore(0, freeCrossings, !success, freeTrips);

      setCurrentUser(updatedUser);
      await AchievementEngine.check(updatedUser);
      setActiveOption('none');
      setFreeCrossings(1);
      setFreeTrips(1);
    } catch (error: any) {
      addToast({ title: 'Erreur', message: error.message, type: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto relative pb-24">
      {/* Announcement Banner */}
      {announcement && (
        <div className={clsx(
          "mb-4 p-4 rounded-2xl border flex items-start gap-3",
          announcement.type === 'info' ? "bg-blue-500/10 border-blue-500/20 text-blue-200" :
          announcement.type === 'warning' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-200" :
          "bg-red-500/10 border-red-500/20 text-red-200"
        )}>
          {announcement.type === 'info' && <Info className="w-5 h-5 shrink-0" />}
          {announcement.type === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0" />}
          {announcement.type === 'alert' && <AlertOctagon className="w-5 h-5 shrink-0" />}
          <div className="text-sm font-medium leading-relaxed">
            {announcement.message}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between mb-8 mt-4">
        <div>
          <p className="text-white/50 text-sm font-bold uppercase tracking-wider">Salut,</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display text-white">{currentUser.displayName}</h1>
            {currentUser.isAdmin && (
              <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Admin</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentUser.isAdmin && (
            <button 
              onClick={() => navigate('/admin')}
              className="relative w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
              title="Administration"
            >
              <ShieldAlert className="w-5 h-5" />
              {adminUnreadFeedbackCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-black text-[10px] font-bold">
                  {adminUnreadFeedbackCount > 99 ? '99+' : adminUnreadFeedbackCount}
                </span>
              )}
            </button>
          )}
          <button 
            onClick={() => navigate('/friends')}
            className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            title="Amis"
          >
            <Users className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowMenuModal(true)}
            className="relative w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
            {unreadFeedbackCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-black text-[10px] font-bold">
                {unreadFeedbackCount > 99 ? '99+' : unreadFeedbackCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Score */}
      <ScoreCard points={currentUser.points} highestScore={currentUser.highestScore} className="mb-8" />

      {/* Zone 1: Live Trip */}
      <button 
        onClick={() => setActiveOption('live')}
        className="w-full bg-primary text-black font-bold text-xl py-8 rounded-3xl mb-4 shadow-[0_0_40px_rgba(255,193,7,0.3)] hover:scale-[1.02] transition-transform active:scale-95 flex flex-col items-center justify-center gap-2 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7" />
          <span>DÉMARRER LE TRAJET</span>
        </div>
        <span className="text-black/60 text-xs font-medium normal-case">Conduis, on compte en arrière-plan.</span>
      </button>

      {/* Zone 2: Plan a Route */}
      <button 
        onClick={() => setActiveOption('gps')} 
        className="w-full bg-surface border border-white/10 rounded-2xl p-5 flex items-center gap-4 hover:bg-white/5 transition-all active:scale-[0.98] text-left mb-8 group"
      >
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
          <Map className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">Calculer un itinéraire</h3>
          <p className="text-xs text-white/50 mt-0.5 leading-relaxed">Estimer les passages avant de partir, ou retrouver ceux d'un trajet déjà effectué.</p>
        </div>
      </button>

      {/* Zone 3: Recovery Actions */}
      <div className="mb-8">
        <button 
          onClick={() => setActiveOption('free')}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-white/70"
        >
          <span>Oublié de lancer l'app ? Ajouter manuellement</span>
          <CarFront className="w-4 h-4" />
        </button>
      </div>

      {/* Manual entry popup */}
      <AnimatePresence>
        {activeOption === 'free' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setActiveOption('none')}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h2 className="text-xl font-display text-white text-center mb-8">Ajouter manuellement</h2>
              <div className="flex items-center justify-between bg-black/20 rounded-xl p-3 mb-5">
                <span className="text-sm text-white/70 font-medium">Passages totaux</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setFreeCrossings(Math.max(1, freeCrossings - 1))} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 shrink-0 transition-colors touch-manipulation"><Minus className="w-5 h-5" /></button>
                  <input type="number" min="1" max="1000" value={freeCrossings || ''} onChange={(e) => { const v = parseInt(e.target.value); setFreeCrossings(v ? Math.min(1000, v) : 0); }} onBlur={() => { if (freeCrossings < 1) setFreeCrossings(1); if (freeCrossings > 1000) setFreeCrossings(1000); }} className="w-16 bg-transparent text-center font-display text-2xl text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded-md" />
                  <button onClick={() => setFreeCrossings(Math.min(1000, freeCrossings + 1))} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 shrink-0 transition-colors touch-manipulation"><Plus className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex items-center justify-between bg-black/20 rounded-xl p-3 mb-6">
                <span className="text-sm text-white/70 font-medium">Trajets totaux</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setFreeTrips(Math.max(1, freeTrips - 1))} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 shrink-0 transition-colors touch-manipulation"><Minus className="w-5 h-5" /></button>
                  <input type="number" min="1" max="99" value={freeTrips || ''} onChange={(e) => setFreeTrips(parseInt(e.target.value) || 0)} onBlur={() => freeTrips < 1 && setFreeTrips(1)} className="w-16 bg-transparent text-center font-display text-2xl text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded-md" />
                  <button onClick={() => setFreeTrips(freeTrips + 1)} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 shrink-0 transition-colors touch-manipulation"><Plus className="w-5 h-5" /></button>
                </div>
              </div>
              <p className="text-center text-base font-medium mb-5 text-white/70">As-tu levé les jambes à <strong className="text-white">tous</strong> les passages ?</p>
              <div className="flex gap-3 mb-3">
                <Button variant="danger" fullWidth onClick={() => handleFreeTrip(false)} className="h-14 text-base touch-manipulation">😬 Non</Button>
                <Button variant="primary" fullWidth onClick={() => handleFreeTrip(true)} className="h-14 text-base touch-manipulation">🦵 Oui!</Button>
              </div>
              <Button fullWidth variant="secondary" onClick={() => setActiveOption('none')} className="h-14 text-base text-white/70 border-white/20 touch-manipulation">
                Annuler
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRulesModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h2 className="text-2xl font-display text-white mb-4">Règles du Jeu</h2>
              
              <div className="space-y-4 text-sm text-white/70 mb-6">
                <p>
                  <strong className="text-white">Le but est simple :</strong> Lève les jambes quand tu passes sur une voie ferrée ! Si tu oublies, tu perds tous tes points.
                </p>
                
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <h3 className="font-bold text-primary mb-1 flex items-center gap-2">
                    <Map className="w-4 h-4" /> Trajet Planifié (GPS)
                  </h3>
                  <p className="text-xs">
                    Calcule automatiquement tes passages. <strong>Seuls ces trajets</strong> comptent pour les records de distance et de "passages maximum en un seul trajet".
                  </p>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <h3 className="font-bold text-blue-400 mb-1 flex items-center gap-2">
                    <CarFront className="w-4 h-4" /> Trajet Libre / Rapide
                  </h3>
                  <p className="text-xs">
                    Ajoute manuellement tes passages si tu n'as pas utilisé le GPS. 
                    <br/><br/>
                    <span className="text-blue-400">💡 Astuce :</span> Si tu ajoutes plusieurs passages d'un coup, précise le nombre de trajets effectués. Le jeu calculera une moyenne pour tes records de passages !
                  </p>
                </div>
              </div>

              <Button fullWidth onClick={() => setShowRulesModal(false)}>
                J'ai compris
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Menu Modal */}
      <AnimatePresence>
        {showMenuModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowMenuModal(false)}
          >
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-3"
            >
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2 sm:hidden"></div>
              <h2 className="text-xl font-display text-white mb-2">Menu</h2>
              
              <button 
                onClick={() => { setShowMenuModal(false); navigate('/leaderboard'); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <BarChart3 className="w-5 h-5 text-yellow-500" />
                <span className="font-bold text-white">Classement</span>
              </button>

              <button 
                onClick={() => { setShowMenuModal(false); navigate('/achievements'); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <Trophy className="w-5 h-5 text-purple-500" />
                <span className="font-bold text-white">Succès</span>
              </button>

              <button 
                onClick={() => { setShowMenuModal(false); navigate('/history'); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <History className="w-5 h-5 text-blue-500" />
                <span className="font-bold text-white">Historique</span>
              </button>

              <div className="w-full h-px bg-white/10 my-1"></div>

              <button 
                onClick={() => { setShowMenuModal(false); navigate('/settings'); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <Settings className="w-5 h-5 text-white/70" />
                <span className="font-bold text-white">Paramètres</span>
              </button>

              <button 
                onClick={() => { setShowMenuModal(false); setShowRulesModal(true); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <Info className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-white">Règles du jeu</span>
              </button>

              <button 
                onClick={() => { setShowMenuModal(false); navigate('/feedback'); }}
                className="relative w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <MessageSquare className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="font-bold text-white">Aide & Retours</span>
                {unreadFeedbackCount > 0 && (
                  <span className="ml-auto min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-primary text-black text-xs font-bold">
                    {unreadFeedbackCount > 99 ? '99+' : unreadFeedbackCount}
                  </span>
                )}
              </button>

              <button 
                onClick={() => { setShowMenuModal(false); handleLogout(); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-failure/10 hover:bg-failure/20 transition-colors text-left mt-2 border border-failure/20"
              >
                <LogOut className="w-5 h-5 text-failure" />
                <span className="font-bold text-failure">Déconnexion</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GPS Trip Modal (Overlay) */}
      <AnimatePresence>
        {activeOption === 'gps' && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <TripPlanner onClose={() => setActiveOption('none')} />
          </motion.div>
        )}
        {activeOption === 'live' && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <LiveTracker onClose={() => setActiveOption('none')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
