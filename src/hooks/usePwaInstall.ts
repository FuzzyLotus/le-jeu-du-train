import { useState, useEffect } from 'react';

/** Browser event for PWA install prompt (Chromium). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Persist across navigations so the button still shows when returning to Home. */
let storedPrompt: BeforeInstallPromptEvent | null = null;

function isStandalone(): boolean {
  return (
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => storedPrompt);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      storedPrompt = prompt;
      setDeferredPrompt(prompt);
    };

    const handleInstalled = () => setIsInstalled(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    const prompt = deferredPrompt ?? storedPrompt;
    if (!prompt) return;
    await prompt.prompt();
  };

  const canInstall = !!(deferredPrompt ?? storedPrompt) && !isInstalled;

  return { canInstall, isInstalled, install };
}
