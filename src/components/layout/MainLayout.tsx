import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart3, User, Settings } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'motion/react';
import { AuthService } from '../../services/AuthService';
import { useAuthStore } from '../../store/useAuthStore';

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const currentUser = useAuthStore((state) => state.currentUser);

  useEffect(() => {
    if (currentUser) return;
    const fetchUser = async () => {
      try {
        const user = await AuthService.getMe();
        setCurrentUser(user);
      } catch (e) {
        console.error('Failed to refresh user profile', e);
        AuthService.clearToken();
        setCurrentUser(null);
      }
    };
    fetchUser();
  }, [setCurrentUser, currentUser]);

  const tabs = [
    { id: 'home', path: '/', icon: Home, label: 'Jeu' },
    { id: 'leaderboard', path: '/leaderboard', icon: BarChart3, label: 'Classement' },
    { id: 'profile', path: '/profile/me', icon: User, label: 'Profil' },
  ];

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto relative bg-background text-white">
      <div className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 z-50">
        <div className="bg-surface/90 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl flex items-center justify-around p-2">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path || (tab.id === 'profile' && location.pathname.startsWith('/profile'));
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={clsx(
                  "relative flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-300",
                  isActive ? "text-primary" : "text-white/40 hover:text-white/70"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white/5 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={clsx("w-6 h-6 mb-1 z-10", isActive && "stroke-[2.5px]")} />
                <span className="text-[10px] font-bold z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
