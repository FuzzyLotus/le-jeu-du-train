import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export function PrivacyPolicyScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-2xl mx-auto relative">
      <header className="flex items-center gap-4 mb-8 mt-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-display text-white">Politique de Confidentialité</h1>
      </header>

      <div className="bg-surface border border-white/10 rounded-3xl p-8 flex flex-col gap-6 text-white/80 leading-relaxed">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-2">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        
        <h2 className="text-2xl font-display text-white">Notre Promesse</h2>
        <p>
          Le Jeu du Train est un projet <strong>gratuit et open source</strong>. Nous croyons en un web libre et respectueux de la vie privée.
        </p>

        <h3 className="text-xl font-display text-white mt-4">1. Tes données t'appartiennent</h3>
        <p>
          Si tu choisis de fournir une adresse email ou un numéro de téléphone pour sécuriser ton compte, ces informations ne seront utilisées <strong>que</strong> pour la récupération de ton mot de passe.
        </p>

        <h3 className="text-xl font-display text-white mt-4">2. Zéro revente, Zéro partage</h3>
        <p>
          Nous nous engageons formellement à ne <strong>jamais</strong> vendre, louer, ou partager tes données personnelles avec qui que ce soit. Aucune entreprise tierce n'y aura accès.
        </p>

        <h3 className="text-xl font-display text-white mt-4">3. Sans publicité, pour toujours</h3>
        <p>
          Nous détestons les publicités autant que toi. Il n'y a pas de traqueurs publicitaires ici, et il n'y en aura jamais. Le jeu restera toujours sans pub.
        </p>

        <h3 className="text-xl font-display text-white mt-4">4. Sécurité et Chiffrement</h3>
        <p>
          Toutes tes informations de récupération (email, téléphone, phrase secrète) ainsi que ton mot de passe sont <strong>chiffrés (hachés)</strong> avant d'être sauvegardés. Nous ne stockons aucune de ces données en texte clair. Même en cas d'accès à la base de données, tes informations restent illisibles et protégées.
        </p>
      </div>
    </div>
  );
}
