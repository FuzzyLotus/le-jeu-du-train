import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthService } from '../services/AuthService';
import { useToastStore } from '../store/useToastStore';
import { Button } from '../components/Button';
import { Train, KeyRound, Mail, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

export function ResetPasswordScreen() {
  const [mode, setMode] = useState<'phrase' | 'admin'>('phrase');
  const [username, setUsername] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [contactMethod, setContactMethod] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'phrase') {
      if (!username || !recoveryPhrase || !newPassword) return;
      if (newPassword.length < 8) {
        addToast({ title: 'Erreur', message: 'Le mot de passe doit contenir au moins 8 caractères.', type: 'error' });
        return;
      }

      setIsLoading(true);
      try {
        await AuthService.resetPassword(username, recoveryPhrase, newPassword);
        addToast({ title: 'Succès', message: 'Mot de passe réinitialisé avec succès.', type: 'success' });
        navigate('/login');
      } catch (error: any) {
        addToast({ title: 'Erreur', message: error.message, type: 'error' });
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!username || !contactMethod) return;
      
      setIsLoading(true);
      try {
        await AuthService.requestReset(username, contactMethod);
        setRequestSent(true);
        addToast({ title: 'Demande envoyée', message: 'Un administrateur vous contactera.', type: 'success' });
      } catch (error: any) {
        addToast({ title: 'Erreur', message: error.message, type: 'error' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,193,7,0.2)]">
          <Train className="w-10 h-10 text-primary" />
        </div>
        
        <h1 className="font-display text-3xl text-center mb-2">Réinitialisation</h1>
        <p className="text-white/50 text-center mb-8">Récupère ton compte.</p>

        {!requestSent ? (
          <>
            <div className="flex w-full bg-black/20 rounded-2xl p-1 mb-6 border border-white/5">
              <button
                onClick={() => setMode('phrase')}
                className={clsx(
                  "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
                  mode === 'phrase' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                <KeyRound className="w-4 h-4" />
                Phrase
              </button>
              <button
                onClick={() => setMode('admin')}
                className={clsx(
                  "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
                  mode === 'admin' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                <Mail className="w-4 h-4" />
                Admin
              </button>
            </div>

            <form onSubmit={handleReset} className="w-full flex flex-col gap-4">
              <input
                type="text"
                placeholder="Nom d'utilisateur"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              
              {mode === 'phrase' ? (
                <>
                  <input
                    type="text"
                    placeholder="Phrase secrète"
                    value={recoveryPhrase}
                    onChange={(e) => setRecoveryPhrase(e.target.value)}
                    className="w-full bg-surface border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Nouveau mot de passe"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-2xl px-5 py-4 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                      title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={!username || !recoveryPhrase || !newPassword || isLoading}
                    className="mt-4"
                  >
                    {isLoading ? 'Réinitialisation...' : 'Réinitialiser'}
                  </Button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Email ou Téléphone"
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value)}
                    className="w-full bg-surface border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                  <p className="text-xs text-white/50 text-center px-4">
                    Un administrateur vérifiera votre demande et vous contactera pour réinitialiser votre mot de passe.
                  </p>
                  <Button 
                    type="submit" 
                    disabled={!username || !contactMethod || isLoading}
                    className="mt-4"
                  >
                    {isLoading ? 'Envoi...' : 'Demander de l\'aide'}
                  </Button>
                </>
              )}
            </form>
          </>
        ) : (
          <div className="bg-success/10 border border-success/20 rounded-3xl p-6 text-center w-full">
            <h2 className="text-success font-bold text-lg mb-2">Demande envoyée !</h2>
            <p className="text-white/70 text-sm">
              Un administrateur a été notifié. Il vous contactera bientôt sur l'adresse email ou le numéro de téléphone fourni pour vous aider à récupérer votre compte.
            </p>
          </div>
        )}

        <p className="mt-8 text-white/50 text-sm">
          Tu te souviens de ton mot de passe?{' '}
          <Link to="/login" className="text-primary hover:underline font-bold">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
