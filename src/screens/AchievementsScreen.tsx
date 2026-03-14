import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, CheckCircle2, X, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useAuthStore } from '../store/useAuthStore';
import { ACHIEVEMENTS, AchievementEngine } from '../services/AchievementEngine';
import clsx from 'clsx';

export function AchievementsScreen() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  
  const unlocked = useLiveQuery(async () => {
    if (!currentUser?.id) return [];
    
    // Cleanup invalid achievements first
    await AchievementEngine.cleanupInvalidAchievements(currentUser.id);
    
    return await db.achievements.where('userId').equals(currentUser.id).toArray();
  }, [currentUser?.id]);

  const unlockedIds = new Set(unlocked?.map(a => a.achievementId) || []);
  const [selectedAchievement, setSelectedAchievement] = useState<typeof ACHIEVEMENTS[0] | null>(null);

  const progress = Math.round((unlockedIds.size / ACHIEVEMENTS.length) * 100);

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

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto relative">
      <header className="flex items-center gap-4 mb-8 mt-4">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-display text-white">Succès ({unlockedIds.size}/{ACHIEVEMENTS.length})</h1>
        </div>
      </header>

      <div className="mb-8">
        <div className="flex justify-between text-xs text-white/50 mb-2 font-bold uppercase tracking-wider">
          <span>Progression</span>
          <span>{progress}%</span>
        </div>
        <div className="h-3 bg-surface rounded-full overflow-hidden border border-white/10">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pb-8">
        {ACHIEVEMENTS.map((ach) => {
          const isUnlocked = unlockedIds.has(ach.id);
          const isSecret = ach.rarity === 'Secret';
          
          const parts = ach.title.split(' ');
          const icon = parts.length > 1 ? parts[parts.length - 1] : '🏆';
          const title = parts.length > 1 ? parts.slice(0, -1).join(' ') : ach.title;

          const displayTitle = (isSecret && !isUnlocked) ? 'Succès Secret' : title;
          const displayIcon = (isSecret && !isUnlocked) ? '❓' : (isUnlocked ? icon : '🔒');

          return (
            <motion.button
              key={ach.id}
              onClick={() => setSelectedAchievement(ach)}
              className={clsx(
                "flex flex-col items-center justify-center p-3 rounded-2xl border transition-colors text-center relative overflow-hidden h-32 group",
                isUnlocked 
                  ? "bg-primary/10 border-primary/30 opacity-100 hover:scale-[1.02]" 
                  : "bg-surface border-white/5 opacity-40 hover:opacity-60"
              )}
              animate={isUnlocked ? {
                boxShadow: [
                  '0 0 5px rgba(255,193,7,0.1)',
                  '0 0 11px rgba(255,193,7,0.175)',
                  '0 0 5px rgba(255,193,7,0.1)',
                ],
              } : undefined}
              transition={isUnlocked ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
            >
              <div className={clsx("absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-tighter text-white/90", getRarityColor(ach.rarity))}>
                {getRarityLabel(ach.rarity)}
              </div>
              
              <span className={clsx(
                "text-3xl mb-2 mt-2 transition-all duration-500",
                isUnlocked ? "scale-100 filter-none" : "scale-90 grayscale opacity-40"
              )}>
                {displayIcon}
              </span>
              
              <span className={clsx(
                "font-bold text-[10px] leading-tight px-1",
                isUnlocked ? "text-white" : "text-white/30"
              )}>
                {displayTitle}
              </span>
            </motion.button>
          );
        })}
      </div>

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
                  unlockedIds.has(selectedAchievement.id) ? "bg-primary/20" : "bg-white/5 grayscale"
                )}>
                  {selectedAchievement.rarity === 'Secret' && !unlockedIds.has(selectedAchievement.id) 
                    ? '❓' 
                    : (selectedAchievement.title.split(' ').pop() || '🏆')}
                </div>

                <h2 className="font-display text-2xl text-white mb-2">
                  {selectedAchievement.rarity === 'Secret' && !unlockedIds.has(selectedAchievement.id)
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
                    unlockedIds.has(selectedAchievement.id) 
                      ? "bg-primary/20 text-primary" 
                      : "bg-white/10 text-white/50"
                  )}>
                    {unlockedIds.has(selectedAchievement.id) ? "Déverrouillé" : "Verrouillé"}
                  </div>
                </div>

                <p className="text-white/70 leading-relaxed">
                  {selectedAchievement.rarity === 'Secret' && !unlockedIds.has(selectedAchievement.id)
                    ? "Déverrouille ce succès pour découvrir son secret."
                    : (selectedAchievement as any).description || "Pas de description disponible."}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
