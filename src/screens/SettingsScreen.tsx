import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Shield, Home, Trash2, Save, Loader2, Eye, EyeOff, Map, History, BarChart3, UserPlus } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { AuthService } from '../services/AuthService';
import { Button } from '../components/Button';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import type { GeocodeResult } from '../types/models';

export function SettingsScreen() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, logout } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [isPublicProfile, setIsPublicProfile] = useState(currentUser?.preferences?.isPublicProfile ?? true);
  const [showFullTripDetails, setShowFullTripDetails] = useState(currentUser?.preferences?.showFullTripDetails ?? false);
  const [showTripHistory, setShowTripHistory] = useState(currentUser?.preferences?.showTripHistory ?? true);
  const [showStats, setShowStats] = useState(currentUser?.preferences?.showStats ?? true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(currentUser?.preferences?.allowFriendRequests ?? true);
  
  const [homeLocation, setHomeLocation] = useState<GeocodeResult | undefined>(currentUser?.homeLocation);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!currentUser) return null;

  const handleSave = async () => {
    if (!currentUser.id) return;
    setIsSaving(true);

    try {
      const updatedUser = await AuthService.updateProfile({
        displayName,
        homeLocation,
        preferences: {
          ...currentUser.preferences,
          isPublicProfile,
          showTripsOnLeaderboard: isPublicProfile, // Sync for now
          allowFriendRequests,
          showFullTripDetails,
          showTripHistory,
          showStats
        }
      });

      setCurrentUser(updatedUser);
      addToast({ title: 'Succès', message: 'Paramètres enregistrés.', type: 'success' });
    } catch (error: any) {
      console.error(error);
      addToast({ title: 'Erreur', message: error.message || 'Impossible de sauvegarder.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser.id) return;
    try {
      const response = await fetch(`/api/admin/users/${currentUser.id}`, {
        method: 'DELETE',
        headers: AuthService.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }
      
      logout();
      navigate('/login');
      addToast({ title: 'Compte supprimé', message: 'Au revoir !', type: 'info' });
    } catch (error) {
      console.error(error);
      addToast({ title: 'Erreur', message: 'Impossible de supprimer le compte.', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto relative pb-24">
      <header className="flex items-center gap-4 mb-8 mt-4">
        <button 
          onClick={() => navigate('/')}
          className="w-12 h-12 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors active:scale-95"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-display text-white">Paramètres</h1>
      </header>

      <div className="flex flex-col gap-6">
        
        {/* Profile Section */}
        <section className="bg-surface border border-white/5 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4 text-primary">
            <User className="w-5 h-5" />
            <h2 className="font-bold text-lg text-white">Profil</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wider font-bold mb-2">Nom d'affichage</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wider font-bold mb-2">Nom d'utilisateur</label>
              <div className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-4 text-white/50 cursor-not-allowed">
                @{currentUser.username}
              </div>
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="bg-surface border border-white/5 rounded-3xl p-6 overflow-hidden">
          <div className="flex items-center gap-3 mb-6 text-blue-400">
            <Shield className="w-5 h-5" />
            <h2 className="font-bold text-lg text-white">Confidentialité</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", isPublicProfile ? "bg-success/20 text-success" : "bg-white/10 text-white/30")}>
                  {isPublicProfile ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Profil Public</h3>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold mt-0.5">Visible dans le classement</p>
                </div>
              </div>
              <button
                onClick={() => setIsPublicProfile(!isPublicProfile)}
                className={clsx(
                  "w-12 h-7 rounded-full p-1 transition-colors relative",
                  isPublicProfile ? "bg-success" : "bg-white/10"
                )}
              >
                <motion.div
                  animate={{ x: isPublicProfile ? 20 : 0 }}
                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", showFullTripDetails ? "bg-purple-500/20 text-purple-400" : "bg-white/10 text-white/30")}>
                  <Map className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Détails des trajets</h3>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold mt-0.5">Adresses complètes</p>
                </div>
              </div>
              <button
                onClick={() => setShowFullTripDetails(!showFullTripDetails)}
                className={clsx(
                  "w-12 h-7 rounded-full p-1 transition-colors relative",
                  showFullTripDetails ? "bg-purple-500" : "bg-white/10"
                )}
              >
                <motion.div
                  animate={{ x: showFullTripDetails ? 20 : 0 }}
                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", showTripHistory ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-white/30")}>
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Historique</h3>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold mt-0.5">Visible par les autres</p>
                </div>
              </div>
              <button
                onClick={() => setShowTripHistory(!showTripHistory)}
                className={clsx(
                  "w-12 h-7 rounded-full p-1 transition-colors relative",
                  showTripHistory ? "bg-blue-500" : "bg-white/10"
                )}
              >
                <motion.div
                  animate={{ x: showTripHistory ? 20 : 0 }}
                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", showStats ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/30")}>
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Statistiques</h3>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold mt-0.5">Stats globales publiques</p>
                </div>
              </div>
              <button
                onClick={() => setShowStats(!showStats)}
                className={clsx(
                  "w-12 h-7 rounded-full p-1 transition-colors relative",
                  showStats ? "bg-yellow-500" : "bg-white/10"
                )}
              >
                <motion.div
                  animate={{ x: showStats ? 20 : 0 }}
                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", allowFriendRequests ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/30")}>
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Demandes d'amis</h3>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold mt-0.5">Autoriser les ajouts</p>
                </div>
              </div>
              <button
                onClick={() => setAllowFriendRequests(!allowFriendRequests)}
                className={clsx(
                  "w-12 h-7 rounded-full p-1 transition-colors relative",
                  allowFriendRequests ? "bg-green-500" : "bg-white/10"
                )}
              >
                <motion.div
                  animate={{ x: allowFriendRequests ? 20 : 0 }}
                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
          </div>
        </section>

        {/* Address Section */}
        <section className="bg-surface border border-white/5 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4 text-purple-400">
            <Home className="w-5 h-5" />
            <h2 className="font-bold text-lg text-white">Adresses</h2>
          </div>

          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider font-bold mb-2">Domicile</label>
            <p className="text-xs text-white/40 mb-3">
              Saisis "Maison" ou "Home" dans la recherche de trajet pour utiliser cette adresse.
            </p>
            <AddressAutocomplete
              placeholder="Rechercher ton adresse..."
              initialValue={homeLocation?.display_name}
              onSelect={(result) => setHomeLocation(result || undefined)}
              icon={<Home className="w-5 h-5 text-purple-400" />}
            />
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-surface border border-white/5 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4 text-failure">
            <Trash2 className="w-5 h-5" />
            <h2 className="font-bold text-lg text-white">Zone Danger</h2>
          </div>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-4 px-5 bg-failure/10 text-failure hover:bg-failure/20 rounded-xl font-bold text-sm transition-colors border border-failure/20"
            >
              Supprimer mon compte
            </button>
          ) : (
            <div className="bg-failure/10 border border-failure/20 rounded-xl p-4">
              <p className="text-white text-sm mb-4 text-center font-bold">Es-tu vraiment sûr ?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 py-3 bg-failure hover:bg-failure/80 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-failure/20"
                >
                  Confirmer
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="sticky bottom-6 mt-4">
          <Button fullWidth onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Enregistrer</>}
          </Button>
        </div>

      </div>
    </div>
  );
}
