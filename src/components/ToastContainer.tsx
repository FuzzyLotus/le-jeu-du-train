import { AnimatePresence, motion } from 'motion/react';
import { useToastStore } from '../store/useToastStore';
import { CheckCircle, XCircle, Trophy, Info } from 'lucide-react';
import clsx from 'clsx';

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-6 h-6 text-success" />;
      case 'error': return <XCircle className="w-6 h-6 text-failure" />;
      case 'achievement': return <Trophy className="w-6 h-6 text-primary" />;
      default: return <Info className="w-6 h-6 text-blue-400" />;
    }
  };

  return (
    <div className="fixed top-4 left-0 right-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={clsx(
              "flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl pointer-events-auto max-w-sm w-full border backdrop-blur-md",
              toast.type === 'achievement' ? "bg-primary/10 border-primary/30" : "bg-surface border-white/10"
            )}
          >
            <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-white/5">
              {toast.icon ? <span className="text-2xl">{toast.icon}</span> : getIcon(toast.type)}
            </div>
            <div className="flex flex-col">
              <span className={clsx("font-bold text-sm", toast.type === 'achievement' ? "text-primary" : "text-white")}>
                {toast.title}
              </span>
              {toast.message && (
                <span className="text-xs text-white/70">{toast.message}</span>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
