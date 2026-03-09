import { useState, useEffect } from 'react';
import { Share, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if device is iOS
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };

    // Check if the app is already installed (running in standalone mode)
    const isStandalone = () => {
      return ('standalone' in window.navigator && (window.navigator as any).standalone) || 
             window.matchMedia('(display-mode: standalone)').matches;
    };

    let timer: NodeJS.Timeout;

    // Only show on iOS if not already installed, and if we haven't dismissed it recently
    if (isIos() && !isStandalone()) {
      const dismissed = localStorage.getItem('pwa-prompt-dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) { // Show again after 7 days
        // Delay the prompt slightly so it's not too aggressive
        timer = setTimeout(() => setShowPrompt(true), 3000);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 left-4 right-4 z-50 bg-primary text-white p-4 rounded-2xl shadow-2xl flex items-start gap-4"
        >
          <div className="flex-1">
            <h3 className="font-bold mb-1">Installer l'application</h3>
            <p className="text-sm text-white/90 leading-tight">
              Pour une meilleure expérience, installez l'app sur votre iPhone : touchez l'icône <Share className="inline w-4 h-4 mx-1" /> puis <strong>"Sur l'écran d'accueil"</strong>.
            </p>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-1 bg-black/20 rounded-full hover:bg-black/30 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
