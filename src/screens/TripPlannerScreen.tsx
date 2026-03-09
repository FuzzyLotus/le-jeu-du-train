import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MapPin, Navigation, AlertTriangle, Train, CheckCircle2, XCircle, Map } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { Button } from '../components/Button';
import { GameService } from '../services/GameService';
import { AchievementEngine } from '../services/AchievementEngine';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { db } from '../db/database';
import { TripEngine, type ProcessedTrip } from '../services/TripEngine';
import type { GeocodeResult } from '../api/geoServices';
import clsx from 'clsx';

type Step = 'input' | 'loading' | 'results' | 'en_route' | 'confirmation' | 'done';

export function TripPlannerScreen() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  const [step, setStep] = useState<Step>('input');
  const [startLoc, setStartLoc] = useState<GeocodeResult | null>(null);
  const [endLoc, setEndLoc] = useState<GeocodeResult | null>(null);
  const [trip, setTrip] = useState<ProcessedTrip | null>(null);
  const [crossingResults, setCrossingResults] = useState<boolean[]>([]);
  const [isFailed, setIsFailed] = useState(false);

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
  };

  const openGoogleMaps = () => {
    if (!startLoc || !endLoc) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${startLoc.lat},${startLoc.lon}&destination=${endLoc.lat},${endLoc.lon}`;
    window.open(url, '_blank');
  };

  const startConfirmation = () => {
    if (!trip) return;
    if (trip.crossings.length === 0) {
      finishTrip([]);
    } else {
      // Initialize all as true (optimistic)
      setCrossingResults(new Array(trip.crossings.length).fill(true));
      setStep('confirmation');
    }
  };

  const toggleCrossingResult = (index: number) => {
    setCrossingResults(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleConfirmResults = async () => {
    await finishTrip(crossingResults);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#FFC107', '#FFD54F', '#FFA000', '#4CAF50']
    });
  };

  const calculateEffectivePoints = (results: boolean[]) => {
    const lastFailIndex = results.lastIndexOf(false);
    if (lastFailIndex === -1) {
      return results.filter(Boolean).length;
    }
    // Count successes after the last fail
    let count = 0;
    for (let i = lastFailIndex + 1; i < results.length; i++) {
      if (results[i]) count++;
    }
    return count;
  };

  const finishTrip = async (results: boolean[]) => {
    if (!currentUser?.id || !trip) return;

    let tripFailed = false;

    // Calculate points based on results sequence
    results.forEach((success) => {
      if (!success) {
        tripFailed = true;
      }
    });

    const effectivePoints = calculateEffectivePoints(results);

    try {
      const updatedUser = await GameService.submitScore(trip.distanceKm, trip.crossings.length, tripFailed);

      if (effectivePoints > 0) {
        triggerConfetti();
        if (tripFailed) {
          addToast({ title: `Trajet terminé. Tu repars avec ${effectivePoints} points.`, type: 'info' });
        } else {
          addToast({ title: `Trajet parfait! +${effectivePoints} points 🎉`, type: 'success' });
        }
      } else if (trip.crossings.length > 0) {
        addToast({ title: 'Aucun point gagné. Dommage!', type: 'error' });
      } else {
        addToast({ title: 'Trajet terminé sans passage à niveau.', type: 'info' });
      }

      // Save Trip to DB
      await db.trips.add({
        userId: currentUser.id,
        routeName: trip.routeName,
        distanceKm: trip.distanceKm,
        crossingsCount: trip.crossings.length,
        success: !tripFailed,
        date: Date.now(),
        hasBridge: trip.hasBridge,
        hasTunnel: trip.hasTunnel,
        maxElevation: trip.maxElevation,
        minElevation: trip.minElevation,
        maxBridgeLength: trip.maxBridgeLength,
        startCountry: trip.startCountry,
        endCountry: trip.endCountry,
        startIsland: trip.startIsland,
        endIsland: trip.endIsland,
      });

      setCurrentUser(updatedUser);
      // Check Achievements
      await AchievementEngine.check(updatedUser);

      setIsFailed(tripFailed && effectivePoints === 0);
      setStep('done');
    } catch (error: any) {
      addToast({ title: 'Erreur', message: error.message, type: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto relative">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8 mt-4">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-display text-white">Nouveau Trajet</h1>
      </header>

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

            <div className="mt-auto">
              <Button 
                fullWidth 
                disabled={!startLoc || !endLoc}
                onClick={handlePlanTrip}
              >
                Analyser le trajet
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

            <div className="mt-auto">
              <Button fullWidth onClick={startDrive}>
                Démarrer le trajet
              </Button>
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
              <p className="text-white/50 mb-12 max-w-xs">
                Conduis prudemment. Tu peux utiliser ton application de navigation habituelle. Reviens ici quand tu seras arrivé pour confirmer tes passages.
              </p>

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
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl mb-2">Vérification</h2>
              <p className="text-white/50 text-sm">Coche les passages où tu as levé les jambes.</p>
            </div>

            <div className="flex-1 overflow-y-auto mb-6 pr-2 custom-scrollbar">
              <div className="flex flex-col gap-3">
                {trip.crossings.map((crossing, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleCrossingResult(idx)}
                    className={clsx(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      crossingResults[idx] 
                        ? "bg-success/10 border-success/30" 
                        : "bg-surface border-white/10 opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                        crossingResults[idx] ? "bg-success text-white" : "bg-white/10 text-white/30"
                      )}>
                        {crossingResults[idx] ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-white block">Passage #{idx + 1}</span>
                        <span className="text-xs text-white/40">
                          {/* Try to show a name if available in tags, otherwise generic */}
                          {(crossing.tags as any)?.name || "Passage à niveau"}
                        </span>
                      </div>
                    </div>
                    
                    <div className={clsx(
                      "text-sm font-bold uppercase tracking-wider",
                      crossingResults[idx] ? "text-success" : "text-white/30"
                    )}>
                      {crossingResults[idx] ? "Réussi" : "Raté"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto">
              <div className="bg-surface border border-white/10 rounded-2xl p-4 mb-4 flex justify-between items-center">
                <span className="text-white/50 text-sm">Score prévu:</span>
                <span className="font-display text-xl text-primary">
                  +{calculateEffectivePoints(crossingResults)} pts
                </span>
              </div>
              <Button 
                fullWidth 
                onClick={handleConfirmResults}
                className="py-4"
              >
                Valider mes passages
              </Button>
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

            <Button fullWidth onClick={() => navigate('/')}>
              Retour à l'accueil
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
