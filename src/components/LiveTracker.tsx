import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Activity } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from './Button';
import { GameService } from '../services/GameService';
import { AchievementEngine } from '../services/AchievementEngine';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { db } from '../db/database';
import clsx from 'clsx';

type Step = 'tracking' | 'confirming' | 'done';

interface LiveTrackerProps {
  onClose: () => void;
}

export function LiveTracker({ onClose }: LiveTrackerProps) {
  const { currentUser, setCurrentUser } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  const [step, setStep] = useState<Step>('tracking');
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [isFailed, setIsFailed] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        // @ts-ignore
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.error('Wake Lock error:', err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current !== null) {
      wakeLockRef.current.release()
        .then(() => {
          wakeLockRef.current = null;
        });
    }
  };

  useEffect(() => {
    if (step === 'tracking') {
      requestWakeLock();
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => {
        clearInterval(interval);
        releaseWakeLock();
      };
    }
  }, [step, startTime]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const stopTracking = () => {
    setStep('confirming');
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#FFC107', '#FFD54F', '#FFA000', '#4CAF50']
    });
  };

  const finishTrip = async (failed: boolean) => {
    if (!currentUser?.id) return;

    try {
      const updatedUser = await GameService.submitScore(0, confirmedCount, failed);

      if (!failed && confirmedCount > 0) {
        triggerConfetti();
        addToast({ title: `Trajet parfait! +${confirmedCount} points 🎉`, type: 'success' });
      } else if (failed) {
        addToast({ title: `Trajet terminé. Tu as perdu tes points.`, type: 'info' });
      } else {
        addToast({ title: 'Trajet terminé sans passage à niveau.', type: 'info' });
      }

      // Save Trip to DB
      await db.trips.add({
        userId: currentUser.id,
        routeName: 'Trajet Live',
        distanceKm: 0,
        crossingsCount: confirmedCount,
        success: !failed,
        date: Date.now(),
        hasBridge: false,
        hasTunnel: false,
        maxElevation: 0,
        minElevation: 0,
        maxBridgeLength: 0,
      });

      setCurrentUser(updatedUser);
      await AchievementEngine.check(updatedUser);

      setIsFailed(failed && confirmedCount > 0);
      setStep('done');
    } catch (error: any) {
      addToast({ title: 'Erreur', message: error.message, type: 'error' });
    }
  };

  return (
    <div className="flex flex-col flex-1 p-6 max-w-md mx-auto w-full relative h-full bg-background">
      <AnimatePresence mode="wait">
        {/* STEP 1: TRACKING */}
        {step === 'tracking' && (
          <motion.div 
            key="tracking"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col flex-1 items-center justify-center text-center"
          >
            <div className="relative w-48 h-48 flex items-center justify-center mb-8">
              {/* Radar pulses */}
              <motion.div 
                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                className="absolute inset-0 bg-primary/30 rounded-full"
              />
              <motion.div 
                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 1 }}
                className="absolute inset-0 bg-primary/30 rounded-full"
              />
              <div className="w-24 h-24 bg-surface border-2 border-primary rounded-full flex items-center justify-center z-10 shadow-[0_0_30px_rgba(255,193,7,0.3)]">
                <Activity className="w-10 h-10 text-primary" />
              </div>
            </div>
            
            <h2 className="font-display text-3xl mb-2 text-white">Tracking Actif</h2>
            <p className="text-white/50 mb-2">Conduis prudemment. Nous comptons en arrière-plan.</p>
            <div className="font-mono text-2xl text-primary mb-12">{formatTime(elapsed)}</div>

            <div className="w-full mt-auto">
              <Button variant="danger" fullWidth className="py-5 text-lg" onClick={stopTracking}>
                Terminer le trajet
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: CONFIRMING */}
        {step === 'confirming' && (
          <motion.div 
            key="confirming"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col flex-1"
          >
            <div className="text-center mb-8 mt-8">
              <h2 className="font-display text-3xl mb-2">Résumé du Trajet</h2>
              <p className="text-white/50 text-sm">Combien de passages as-tu réellement croisés ?</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center mb-6">
              <div className="flex items-center gap-6 bg-surface border border-white/10 p-6 rounded-3xl mb-8 shadow-xl">
                <button 
                  onClick={() => setConfirmedCount(Math.max(0, confirmedCount - 1))}
                  className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors"
                >
                  <span className="text-3xl text-white/70">-</span>
                </button>
                
                <div className="w-24 text-center">
                  <span className="font-display text-7xl text-primary drop-shadow-[0_0_15px_rgba(255,193,7,0.3)]">
                    {confirmedCount}
                  </span>
                </div>

                <button 
                  onClick={() => setConfirmedCount(confirmedCount + 1)}
                  className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors"
                >
                  <span className="text-3xl text-white/70">+</span>
                </button>
              </div>

              <div className="w-full max-w-xs">
                <p className="text-center text-sm mb-4 text-white/70">As-tu levé les jambes à <strong>tous</strong> les passages ?</p>
                <div className="flex flex-col gap-3">
                  <Button 
                    variant="primary" 
                    className="py-4 text-lg"
                    onClick={() => finishTrip(false)}
                  >
                    🦵 Oui, j'ai tout réussi !
                  </Button>
                  <Button 
                    variant="danger" 
                    className="py-4 text-lg"
                    onClick={() => finishTrip(true)}
                  >
                    😬 Non, j'ai oublié...
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: DONE */}
        {step === 'done' && (
          <motion.div 
            key="done"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center flex-1 text-center"
          >
            <div className={clsx(
              "w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl",
              isFailed ? "bg-failure/20 shadow-failure/20" : "bg-success/20 shadow-success/20"
            )}>
              {isFailed ? (
                <XCircle className="w-12 h-12 text-failure" />
              ) : (
                <CheckCircle2 className="w-12 h-12 text-success" />
              )}
            </div>
            
            <h2 className="font-display text-3xl mb-2">
              {isFailed ? "Catastrophe." : "Trajet Terminé!"}
            </h2>
            <p className="text-white/50 mb-12">
              {isFailed 
                ? "Tu as oublié de lever les jambes. Tous tes points sont perdus." 
                : "Bravo, tu as survécu à ce trajet sans perdre tes points."}
            </p>

            <Button fullWidth onClick={onClose}>
              Retour à l'accueil
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
