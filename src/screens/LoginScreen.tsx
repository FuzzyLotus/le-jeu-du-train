import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthService } from '../services/AuthService';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { Button } from '../components/Button';
import { APP_VERSION } from '../version';
import { Train, Terminal } from 'lucide-react';

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const addToast = useToastStore((state) => state.addToast);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);
    try {
      const user = await AuthService.login(username, password);
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
        
        <h1 className="font-display text-3xl text-center mb-2">Le Jeu du Train</h1>
        <p className="text-white/50 text-center mb-10">Lève tes jambes ou perds tout.</p>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <input
            type="text"
            placeholder="Nom d'utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-surface border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
          <div className="relative">
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Link to="/reset-password" className="text-xs text-primary hover:underline">
                Oublié?
              </Link>
            </div>
          </div>
          
          <Button 
            type="submit" 
            disabled={!username || !password || isLoading}
            className="mt-4"
          >
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        <p className="mt-8 text-white/50 text-sm">
          Nouveau joueur?{' '}
          <Link to="/signup" className="text-primary hover:underline font-bold">
            Créer un compte
          </Link>
        </p>
        
        <Link to="/privacy" className="mt-6 text-xs text-white/30 hover:text-white/50 transition-colors">
          Politique de Confidentialité
        </Link>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] text-white/20 font-mono uppercase tracking-widest">
        <span>Le Jeu du Train</span>
        <span className="w-1 h-1 rounded-full bg-white/10" />
        <span>v{APP_VERSION}</span>
      </div>

      {/* Secret Console Access */}
      <button 
        onClick={() => navigate('/console')}
        className="absolute bottom-6 right-6 w-8 h-8 flex items-center justify-center text-white/10 hover:text-white/30 transition-colors"
        title="Dev Console"
      >
        <Terminal className="w-4 h-4" />
      </button>
    </div>
  );
}
