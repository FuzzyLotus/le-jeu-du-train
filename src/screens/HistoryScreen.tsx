import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { db } from '../db/database';
import { useAuthStore } from '../store/useAuthStore';
import { AuthService } from '../services/AuthService';
import type { Trip } from '../types/models';
import clsx from 'clsx';

export function HistoryScreen() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!currentUser?.id) return;
      try {
        const response = await fetch('/api/game/history', {
          headers: AuthService.getAuthHeaders()
        });
        if (response.ok) {
          const userTrips = await response.json();
          setTrips(userTrips);
        }
      } catch (error) {
        console.error('Failed to load history', error);
      }
    };
    loadHistory();
  }, [currentUser?.id]);

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('fr-CA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
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
          <History className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-display text-white">Historique</h1>
        </div>
      </header>

      <div className="flex flex-col gap-6 relative pl-4">
        {/* Timeline Line */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-white/10 -translate-x-1/2" />

        {trips.map((trip) => (
          <div key={trip.id} className="relative pl-6">
            {/* Timeline Dot */}
            <div className={clsx(
              "absolute left-0 top-6 w-3 h-3 rounded-full border-2 border-surface -translate-x-1/2 z-10",
              trip.success ? "bg-success" : "bg-failure"
            )} />

            <div 
              className={clsx(
                "flex flex-col p-5 rounded-3xl border transition-all hover:bg-white/5",
                trip.success 
                  ? "bg-surface border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]" 
                  : "bg-surface border-white/5 opacity-80"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-white/70 font-bold">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="truncate max-w-[180px]">{trip.routeName}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 shrink-0 bg-white/5 px-2 py-1 rounded-md">
                  {formatDate(trip.date)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={clsx(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                    trip.success ? "bg-success/10 text-success" : "bg-failure/10 text-failure"
                  )}>
                    {trip.success ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <XCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className={clsx("font-bold text-sm", trip.success ? "text-success" : "text-failure")}>
                      {trip.success ? "Réussi" : "Échoué"}
                    </span>
                    <span className="text-xs text-white/40 mt-0.5">
                      {trip.distanceKm.toFixed(1)} km • {trip.crossingsCount} passages
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className={clsx("font-display text-2xl", trip.success ? "text-success" : "text-white/20")}>
                    {trip.success ? `+${trip.crossingsCount}` : "0"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Points</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {trips.length === 0 && (
          <div className="text-center text-white/50 py-10 pl-0">
            Aucun trajet enregistré.
          </div>
        )}
      </div>
    </div>
  );
}
