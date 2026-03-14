import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation, AlertTriangle, Train, CheckCircle2, XCircle, Map, Play, StopCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AddressAutocomplete } from './AddressAutocomplete';
import { Button } from './Button';
import { GameService } from '../services/GameService';
import { AchievementEngine } from '../services/AchievementEngine';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { db } from '../db/database';
import { TripEngine, type ProcessedTrip } from '../services/TripEngine';
import type { GeocodeResult } from '../api/geoServices';
import { getDistance } from '../utils/geoUtils';
import clsx from 'clsx';

type Step = 'input' | 'loading' | 'results' | 'en_route' | 'confirmation' | 'done';

interface TripPlannerProps {
  onClose: () => void;
}

export function TripPlanner({ onClose }: TripPlannerProps) {
  const { currentUser, setCurrentUser } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  const [step, setStep] = useState<Step>('input');
  const [startLoc, setStartLoc] = useState<GeocodeResult | null>(null);
  const [endLoc, setEndLoc] = useState<GeocodeResult | null>(null);
  const [trip, setTrip] = useState<ProcessedTrip | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [isFailed, setIsFailed] = useState(false);

  // GPS & Simulation State
  const [isTracking, setIsTracking] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [enableSimulator, setEnableSimulator] = useState(false);
  const [detectedCrossings, setDetectedCrossings] = useState<Set<number>>(new Set());
  const detectedCrossingsRef = useRef<Set<number>>(new Set());
  const watchIdRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
    const loadSettings = async () => {
      const setting = await db.settings.get('enableSimulator');
      if (setting && setting.value) {
        setEnableSimulator(true);
      }
    };
    loadSettings();

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (simulationIntervalRef.current !== null) clearInterval(simulationIntervalRef.current);
      releaseWakeLock();
    };
  }, []);

  const checkCrossings = (lat: number, lon: number, currentTrip: ProcessedTrip) => {
    let newlyDetected = false;
    currentTrip.crossings.forEach(crossing => {
      if (!detectedCrossingsRef.current.has(crossing.id) && crossing.lat && crossing.lon) {
        const dist = getDistance(lat, lon, crossing.lat, crossing.lon);
        if (dist < 50) { // 50 meters detection radius
          detectedCrossingsRef.current.add(crossing.id);
          newlyDetected = true;
          addToast({ title: 'Passage à niveau détecté !', message: 'Lève les jambes !', type: 'success' });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
      }
    });
    if (newlyDetected) {
      setDetectedCrossings(new Set(detectedCrossingsRef.current));
    }
  };

  const startRealTracking = () => {
    if (!trip) return;
    if (!navigator.geolocation) {
      addToast({ title: 'Erreur', message: 'GPS non supporté', type: 'error' });
      return;
    }
    setIsTracking(true);
    requestWakeLock();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        checkCrossings(pos.coords.latitude, pos.coords.longitude, trip);
      },
      (err) => {
        console.error(err);
        addToast({ title: 'Erreur GPS', message: err.message, type: 'error' });
        setIsTracking(false);
        releaseWakeLock();
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  const stopRealTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    releaseWakeLock();
  };

  const startSimulation = () => {
    if (!trip) return;
    setIsSimulating(true);
    requestWakeLock();
    let index = 0;
    
    const totalPoints = trip.routeCoordinates.length;
    const stepSize = Math.max(1, Math.floor(totalPoints / 100)); // ~100 steps total

    simulationIntervalRef.current = setInterval(() => {
      if (index >= totalPoints) {
        if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
        setIsSimulating(false);
        releaseWakeLock();
        addToast({ title: 'Simulation terminée', type: 'info' });
        return;
      }
      
      const [lon, lat] = trip.routeCoordinates[index];
      checkCrossings(lat, lon, trip);
      
      index += stepSize;
    }, 200); // Update every 200ms
  };

  const stopSimulation = () => {
    if (simulationIntervalRef.current !== null) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsSimulating(false);
    releaseWakeLock();
  };

  const handlePlanTrip = async () => {
    if (!startLoc || !endLoc) return;
    
    setStep('loading');
    try {
      const processedTrip = await TripEngine.planTrip(startLoc, endLoc);
      setTrip(processedTrip);
      setStep('results');
    } catch (error: any) {
      addToast({ title: 'Erreur', message: error.message, type: 'error' });
      setStep('input');
    }
  };

  const startDrive = () => {
    if (!trip) return;
    setStep('en_route');
    detectedCrossingsRef.current = new Set();
    setDetectedCrossings(new Set());
  };

  const openGoogleMaps = () => {
    if (!startLoc || !endLoc) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${startLoc.lat},${startLoc.lon}&destination=${endLoc.lat},${endLoc.lon}`;
    window.open(url, '_blank');
  };

  const startConfirmation = () => {
    if (!trip) return;
    stopRealTracking();
    stopSimulation();
    
    // Pre-fill with automatically detected crossings if any, or the expected amount
    setConfirmedCount(Math.max(detectedCrossings.size, trip.crossings.length));
    setStep('confirmation');
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#FFC107', '#FFD54F', '#FFA000', '#4CAF50']
    });
  };

  const finishTrip = async (count: number, failed: boolean) => {
    if (!currentUser?.id || !trip) return;

    try {
      const updatedUser = await GameService.submitScore(trip.distanceKm, count, failed);

      if (!failed && count > 0) {
        triggerConfetti();
        addToast({ title: `Trajet parfait! +${count} points 🎉`, type: 'success' });
      } else if (failed) {
        addToast({ title: `Trajet terminé. Tu as perdu tes points.`, type: 'info' });
      } else {
        addToast({ title: 'Trajet terminé sans passage à niveau.', type: 'info' });
      }

      // Save Trip to DB
      const tripToSave: any = {
        userId: currentUser.id,
        routeName: trip.routeName,
        distanceKm: trip.distanceKm,
        crossingsCount: count,
        success: !failed,
        date: Date.now(),
        hasBridge: trip.hasBridge,
        hasTunnel: trip.hasTunnel,
        maxElevation: trip.maxElevation,
        minElevation: trip.minElevation,
        maxBridgeLength: trip.maxBridgeLength,
      };
      
      if (trip.startCountry) tripToSave.startCountry = trip.startCountry;
      if (trip.endCountry) tripToSave.endCountry = trip.endCountry;
      if (trip.startIsland) tripToSave.startIsland = trip.startIsland;
      if (trip.endIsland) tripToSave.endIsland = trip.endIsland;

      await db.trips.add(tripToSave);

      setCurrentUser(updatedUser);
      // Check Achievements
      await AchievementEngine.check(updatedUser);

      setIsFailed(failed && count > 0);
      setStep('done');
    } catch (error: any) {
      addToast({ title: 'Erreur', message: error.message, type: 'error' });
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-background h-full p-6 max-w-md mx-auto w-full">
      <AnimatePresence mode="wait">
        {/* STEP 1: INPUT */}
        {step === 'input' && (
          <motion.div 
            key="input"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-6 flex-1"
          >
            <div className="bg-surface border border-white/5 rounded-3xl p-6 flex flex-col gap-4 relative">
              {/* Connecting line between inputs */}
              <div className="absolute left-[38px] top-[52px] bottom-[52px] w-0.5 bg-white/10 z-0"></div>
              
              <AddressAutocomplete 
                placeholder="Point de départ" 
                onSelect={setStartLoc}
                icon={<MapPin className="w-5 h-5 text-primary" />}
                allowCurrentLocation
              />
              <AddressAutocomplete 
                placeholder="Destination" 
                onSelect={setEndLoc}
                icon={<Navigation className="w-5 h-5 text-success" />}
              />
            </div>

            <div className="mt-auto flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
              <Button 
                className="flex-1"
                disabled={!startLoc || !endLoc}
                onClick={handlePlanTrip}
              >
                Analyser
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: LOADING */}
        {step === 'loading' && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center flex-1 gap-8"
          >
            <motion.div 
              animate={{ y: [0, -20, 0] }}
              transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
              className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,193,7,0.3)]"
            >
              <Train className="w-12 h-12 text-primary" />
            </motion.div>
            <div className="text-center">
              <h2 className="font-display text-2xl mb-2">Recherche en cours...</h2>
              <p className="text-white/50">Analyse des voies ferrées sur ton itinéraire</p>
            </div>
          </motion.div>
        )}

        {/* STEP 3: RESULTS */}
        {step === 'results' && trip && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col flex-1"
          >
            <div className="bg-surface border border-white/5 rounded-3xl p-8 flex flex-col items-center text-center mb-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
              
              <span className="text-sm font-bold uppercase tracking-widest text-white/50 mb-2">
                Passages à niveau trouvés
              </span>
              <span className="font-display text-8xl text-primary drop-shadow-[0_0_20px_rgba(255,193,7,0.4)] mb-6">
                {trip.crossings.length}
              </span>
              
              <div className="flex items-center gap-4 text-sm text-white/70 bg-black/20 px-4 py-2 rounded-full">
                <span>🛣️ {trip.distanceKm.toFixed(1)} km</span>
                <span className="w-1 h-1 bg-white/30 rounded-full"></span>
                <span>⏱️ {trip.durationMinutes} min</span>
              </div>
            </div>

            {trip.crossings.length > 0 ? (
              <div className="bg-failure/10 border border-failure/20 rounded-2xl p-4 flex items-start gap-4 mb-8">
                <AlertTriangle className="w-6 h-6 text-failure shrink-0 mt-1" />
                <p className="text-sm text-failure/90 leading-relaxed">
                  <strong>Attention!</strong> Tu vas croiser {trip.crossings.length} voies ferrées. 
                  Oublier de lever les jambes te fera perdre tes {currentUser?.points} points actuels.
                </p>
              </div>
            ) : (
              <div className="bg-success/10 border border-success/20 rounded-2xl p-4 flex items-start gap-4 mb-8">
                <CheckCircle2 className="w-6 h-6 text-success shrink-0 mt-1" />
                <p className="text-sm text-success/90 leading-relaxed">
                  Aucun passage à niveau sur ce trajet. Tu peux te détendre.
                </p>
              </div>
            )}

            <div className="mt-auto flex flex-col gap-3">
              <Button fullWidth onClick={startDrive} className="py-4">
                Démarrer ce trajet
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep('input')} className="flex-1">
                  Retour
                </Button>
                <Button variant="secondary" onClick={startConfirmation} className="flex-1">
                  Trajet passé ? Valider
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3.5: EN ROUTE (SAFE DRIVING) */}
        {step === 'en_route' && trip && (
          <motion.div 
            key="en_route"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col flex-1"
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-surface border border-white/10 rounded-full flex items-center justify-center mb-6">
                <Navigation className="w-10 h-10 text-primary" />
              </div>
              <h2 className="font-display text-4xl mb-4 leading-tight">
                En route !
              </h2>
              <p className="text-white/50 mb-8 max-w-xs">
                Conduis prudemment. L'application peut détecter les passages automatiquement si tu actives le GPS.
              </p>

              {/* GPS & Simulation Controls */}
              <div className="flex flex-col gap-3 w-full mb-8 bg-black/20 p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-white/70">Passages détectés:</span>
                  <span className="font-display text-2xl text-primary">{detectedCrossings.size} / {trip.crossings.length}</span>
                </div>
                
                {!isTracking && !isSimulating ? (
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 py-3 text-sm" onClick={startRealTracking}>
                      <Navigation className="w-4 h-4 mr-2" />
                      Activer GPS
                    </Button>
                    {currentUser?.isAdmin && enableSimulator && (
                      <Button variant="secondary" className="flex-1 py-3 text-sm" onClick={startSimulation}>
                        <Play className="w-4 h-4 mr-2" />
                        Simuler
                      </Button>
                    )}
                  </div>
                ) : isTracking ? (
                  <Button variant="danger" className="w-full py-3 text-sm animate-pulse" onClick={stopRealTracking}>
                    <StopCircle className="w-4 h-4 mr-2" />
                    Arrêter GPS
                  </Button>
                ) : (
                  <Button variant="danger" className="w-full py-3 text-sm animate-pulse" onClick={stopSimulation}>
                    <StopCircle className="w-4 h-4 mr-2" />
                    Arrêter Simulation
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-4 w-full">
                <Button 
                  variant="secondary" 
                  className="py-6 text-lg"
                  onClick={openGoogleMaps}
                >
                  <Map className="w-5 h-5 mr-2" />
                  Ouvrir dans Google Maps
                </Button>
                <Button 
                  className="py-6 text-lg"
                  onClick={startConfirmation}
                >
                  Je suis arrivé 🏁
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4: CONFIRMATION CHECKLIST */}
        {step === 'confirmation' && trip && (
          <motion.div 
            key="confirmation"
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
                <p className="text-center text-base font-medium mb-4 text-white/70">As-tu levé les jambes à <strong className="text-white">tous</strong> les passages ?</p>
                <div className="flex flex-col gap-3">
                  <Button 
                    variant="primary" 
                    className="py-4 text-lg"
                    onClick={() => finishTrip(confirmedCount, false)}
                  >
                    🦵 Oui, j'ai tout réussi !
                  </Button>
                  <Button 
                    variant="danger" 
                    className="py-4 text-lg"
                    onClick={() => finishTrip(confirmedCount, true)}
                  >
                    😬 Non, j'ai oublié...
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 5: DONE */}
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
