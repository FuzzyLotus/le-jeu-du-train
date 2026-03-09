import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

export function PrivacyPolicyScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-2xl mx-auto relative pb-24">
      <header className="flex items-center gap-4 mb-8 mt-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-display text-white">Légal & Confidentialité</h1>
      </header>

      <div className="flex gap-2 mb-6">
        <button 
          onClick={() => setActiveTab('privacy')}
          className={clsx("flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2", activeTab === 'privacy' ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-white/40")}
        >
          <Shield className="w-4 h-4" />
          Confidentialité
        </button>
        <button 
          onClick={() => setActiveTab('terms')}
          className={clsx("flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2", activeTab === 'terms' ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-white/40")}
        >
          <FileText className="w-4 h-4" />
          Conditions (CGU)
        </button>
      </div>

      <div className="bg-surface border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 text-white/80 leading-relaxed">
        
        {activeTab === 'privacy' ? (
          <>
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-2">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            
            <h2 className="text-2xl font-display text-white">Politique de Confidentialité</h2>
            <p className="text-sm text-white/50">Dernière mise à jour : Mars 2026</p>

            <p>
              Le Jeu du Train est un projet <strong>gratuit et open source</strong>. Nous croyons en un web libre et respectueux de la vie privée. Voici comment nous gérons vos données.
            </p>

            <h3 className="text-xl font-display text-white mt-4">1. Données collectées</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Données de compte :</strong> Nom d'utilisateur, nom d'affichage, et statistiques de jeu (points, trajets, etc.).</li>
              <li><strong>Données de récupération :</strong> Si vous choisissez de fournir une adresse email ou un numéro de téléphone, ces informations sont hachées cryptographiquement et ne sont utilisées <strong>que</strong> pour la récupération de votre compte.</li>
              <li><strong>Données de localisation (GPS) :</strong> Lors de l'utilisation du "Trajet Planifié" ou du "Simulateur", votre position GPS est traitée <strong>localement sur votre appareil</strong> pour détecter les passages à niveau. Votre position en temps réel n'est jamais envoyée ni stockée sur nos serveurs.</li>
              <li><strong>Historique des trajets :</strong> Les points de départ et d'arrivée (noms des villes/pays), la distance, et le nombre de passages sont enregistrés pour votre historique et le classement.</li>
            </ul>

            <h3 className="text-xl font-display text-white mt-4">2. Zéro revente, Zéro partage</h3>
            <p>
              Nous nous engageons formellement à ne <strong>jamais</strong> vendre, louer, ou partager vos données personnelles avec qui que ce soit. Aucune entreprise tierce n'y aura accès.
            </p>

            <h3 className="text-xl font-display text-white mt-4">3. Sans publicité, pour toujours</h3>
            <p>
              Nous détestons les publicités autant que vous. Il n'y a pas de traqueurs publicitaires ici, et il n'y en aura jamais. Le jeu restera toujours sans pub.
            </p>

            <h3 className="text-xl font-display text-white mt-4">4. Sécurité et Chiffrement</h3>
            <p>
              Toutes vos informations de récupération (email, téléphone, phrase secrète) ainsi que votre mot de passe sont <strong>chiffrés (hachés)</strong> avant d'être sauvegardés. Nous ne stockons aucune de ces données en texte clair. Même en cas d'accès à la base de données, vos informations restent illisibles et protégées.
            </p>

            <h3 className="text-xl font-display text-white mt-4">5. Suppression des données</h3>
            <p>
              Vous pouvez demander la suppression complète et définitive de votre compte et de toutes les données associées en contactant un administrateur via la section "Aide & Retours" ou en supprimant votre compte depuis les paramètres (si la fonctionnalité est activée).
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-2">
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
            
            <h2 className="text-2xl font-display text-white">Conditions Générales d'Utilisation</h2>
            <p className="text-sm text-white/50">Dernière mise à jour : Mars 2026</p>

            <p>
              En utilisant "Le Jeu du Train", vous acceptez les présentes conditions d'utilisation.
            </p>

            <h3 className="text-xl font-display text-white mt-4">1. Sécurité au volant (Important)</h3>
            <p className="text-red-400 font-bold">
              La sécurité routière est la priorité absolue. Vous ne devez en aucun cas manipuler l'application en conduisant.
            </p>
            <p>
              L'application est conçue pour être configurée <strong>avant</strong> le départ. Le suivi GPS et les alertes sonores/vibratoires fonctionnent en arrière-plan. Le créateur de l'application décline toute responsabilité en cas d'accident, de contravention ou de dommage résultant de l'utilisation de cette application au volant.
            </p>

            <h3 className="text-xl font-display text-white mt-4">2. Utilisation du service</h3>
            <p>
              Ce service est fourni "tel quel", sans garantie d'aucune sorte. Bien que nous fassions de notre mieux pour assurer la disponibilité du service et la sauvegarde de vos données, nous ne pouvons garantir une disponibilité à 100% ni l'absence de bugs.
            </p>

            <h3 className="text-xl font-display text-white mt-4">3. Fair-play et triche</h3>
            <p>
              Le Jeu du Train repose sur l'honnêteté des joueurs (lever les jambes aux passages à niveau). L'utilisation de bots, de scripts d'automatisation, ou l'exploitation de failles pour gonfler artificiellement son score est interdite. Les administrateurs se réservent le droit de réinitialiser les scores ou de bannir les comptes présentant une activité manifestement frauduleuse.
            </p>

            <h3 className="text-xl font-display text-white mt-4">4. Services Tiers (APIs)</h3>
            <p>
              L'application utilise des services tiers publics (OpenStreetMap, OSRM, Overpass) pour le calcul des itinéraires et la détection des passages à niveau. En utilisant la fonction GPS, vous acceptez que vos coordonnées de départ et d'arrivée soient envoyées à ces services pour calculer l'itinéraire.
            </p>

            <h3 className="text-xl font-display text-white mt-4">5. Modifications</h3>
            <p>
              Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications mineures prendront effet immédiatement. Pour les changements majeurs, une annonce sera faite dans l'application.
            </p>
          </>
        )}

      </div>
    </div>
  );
}
