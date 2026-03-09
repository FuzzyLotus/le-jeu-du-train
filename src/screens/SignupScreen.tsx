import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthService } from '../services/AuthService';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { Button } from '../components/Button';
import { Train, Eye, EyeOff } from 'lucide-react';

export function SignupScreen() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const addToast = useToastStore((state) => state.addToast);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !displayName || !password) return;

    if (password.length < 8) {
      addToast({ title: 'Erreur', message: 'Le mot de passe doit contenir au moins 8 caractères.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const user = await AuthService.signup(username, displayName, password, recoveryPhrase, email, phone);
      setCurrentUser(user);
      navigate('/');
    } catch (error: any) {
      addToast({ title: 'Erreur', message: error.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,193,7,0.2)]">
          <Train className="w-10 h-10 text-primary" />
        </div>
        
        <h1 className="font-display text-3xl text-center mb-2">Inscription</h1>
        <p className="text-white/50 text-center mb-10">Rejoins la partie.</p>

        <form onSubmit={handleSignup} className="w-full flex flex-col gap-4">
          <input
            type="text"
            placeholder="Nom d'utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-surface border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
          <input
            type="text"
            placeholder="Nom d'affichage (ex: Jean)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-surface border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          <div className="mt-4 p-5 bg-black/20 border border-white/5 rounded-2xl flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Récupération de compte</h3>
              <p className="text-xs text-white/50">Ajoute au moins une option pour pouvoir réinitialiser ton mot de passe en cas d'oubli.</p>
            </div>
            
            <input
              type="text"
              placeholder="Phrase secrète (ex: mon chat est bleu)"
              value={recoveryPhrase}
              onChange={(e) => setRecoveryPhrase(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            <input
              type="email"
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            <input
              type="tel"
              placeholder="Numéro de téléphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          
          <p className="text-xs text-white/50 text-center px-4 mt-2">
            En t'inscrivant, tu acceptes notre{' '}
            <Link to="/privacy" className="text-primary hover:underline">
              Politique de Confidentialité
            </Link>.
          </p>
          
          <Button 
            type="submit" 
            disabled={!username || !displayName || !password || isLoading}
            className="mt-4"
          >
            {isLoading ? 'Création...' : 'Créer mon compte'}
          </Button>
        </form>

        <p className="mt-8 text-white/50 text-sm">
          Déjà un compte?{' '}
          <Link to="/login" className="text-primary hover:underline font-bold">
            Se connecter
          </Link>
        </p>

        <Link to="/privacy" className="mt-6 text-xs text-white/30 hover:text-white/50 transition-colors">
          Politique de Confidentialité
        </Link>
      </div>
    </div>
  );
}
