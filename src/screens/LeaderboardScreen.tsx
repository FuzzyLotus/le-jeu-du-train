import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Users, Globe } from 'lucide-react';
import { db } from '../db/database';
import { useAuthStore } from '../store/useAuthStore';
import { AuthService } from '../services/AuthService';
import type { User } from '../types/models';
import clsx from 'clsx';
import { motion } from 'motion/react';

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const [users, setUsers] = useState<User[]>([]);
  const [friends, setFriends] = useState<number[]>([]);
  const [filter, setFilter] = useState<'all' | 'friends'>('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [leaderboardRes, friendsRes] = await Promise.all([
          fetch('/api/game/leaderboard', { headers: AuthService.getAuthHeaders() }),
          fetch('/api/friends', { headers: AuthService.getAuthHeaders() })
        ]);

        if (leaderboardRes.status === 401 || friendsRes.status === 401) {
          useAuthStore.getState().logout();
          navigate('/login');
          return;
        }

        if (leaderboardRes.ok) {
          let normalized: User[] = [];

          try {
            const contentType = leaderboardRes.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
              const data = await leaderboardRes.json();

              normalized = data.map((u: any) => ({
                ...u,
                displayName: u.display_name ?? u.displayName,
                totalEarned: u.total_earned ?? u.totalEarned,
                tripCount: u.trip_count ?? u.tripCount,
                longestTripKm: u.longest_trip_km ?? u.longestTripKm,
                totalDistanceKm: u.total_distance_km ?? u.totalDistanceKm,
                highestScore: u.highest_score ?? u.highestScore,
              }));
            } else {
              // Non-JSON response (likely HTML fallback in dev/PWA) – log quietly
              const text = await leaderboardRes.text();
              console.warn('Leaderboard returned non-JSON response; using fallback data.', {
                status: leaderboardRes.status,
                contentType,
                bodyPreview: text.slice(0, 200),
              });
            }
          } catch (err) {
            console.warn('Failed to parse leaderboard response as JSON; using fallback data.', err);
          }

          // Ensure the current user is always present in the leaderboard,
          // even if the API failed or returned nothing.
          if (currentUser?.id != null) {
            const alreadyIncluded = normalized.some(u => u.id === currentUser.id);
            if (!alreadyIncluded) {
              normalized.push(currentUser);
            }
          }

          // If we still have no users but we are logged in, at least show "me".
          if (normalized.length === 0 && currentUser) {
            normalized = [currentUser];
          }

          // Keep ordering by points so your rank is meaningful
          normalized.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

          setUsers(normalized);
        }

        if (friendsRes.ok) {
          try {
            const contentType = friendsRes.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
              const data = await friendsRes.json();
              const accepted = data.filter((req: any) => req.status === 'accepted');
              const friendIds = accepted.map((req: any) => 
                req.sender_id === currentUser?.id ? req.receiver_id : req.sender_id
              );
              setFriends(friendIds);
            } else {
              // In dev/offline modes the friends endpoint might serve HTML; just skip quietly.
              const text = await friendsRes.text();
              console.warn('Friends endpoint returned non-JSON response; skipping friends filter.', {
                status: friendsRes.status,
                contentType,
                bodyPreview: text.slice(0, 200),
              });
            }
          } catch (err) {
            console.warn('Failed to parse friends response as JSON; skipping friends filter.', err);
          }
        }
      } catch (error) {
        console.error('Failed to load leaderboard data', error);
      }
    };
    loadData();
  }, [currentUser?.id]);

  const displayedUsers = filter === 'all' 
    ? users 
    : users.filter(u => friends.includes(u.id) || u.id === currentUser?.id);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <span className="text-3xl drop-shadow-lg">🥇</span>;
      case 1: return <span className="text-3xl drop-shadow-lg">🥈</span>;
      case 2: return <span className="text-3xl drop-shadow-lg">🥉</span>;
      default: return (
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-white/50 font-bold text-xs border border-white/5">
          {index + 1}
        </span>
      );
    }
  };

  return (
    <div className="min-h-0 flex flex-col p-6 max-w-md mx-auto relative pb-24">
      <header className="flex items-center gap-4 mb-6 mt-4">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-display text-white">Classement</h1>
        </div>
      </header>

      {/* Filter Toggle */}
      <div className="flex bg-surface border border-white/10 rounded-xl p-1 mb-6 relative">
        <div className="absolute inset-0 p-1">
          <motion.div 
            className="w-1/2 h-full bg-white/10 rounded-lg shadow-sm"
            animate={{ x: filter === 'all' ? '0%' : '100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
        <button 
          onClick={() => setFilter('all')}
          className={clsx(
            "flex-1 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 relative z-10 transition-colors",
            filter === 'all' ? "text-white" : "text-white/40 hover:text-white/60"
          )}
        >
          <Globe className="w-4 h-4" />
          Global
        </button>
        <button 
          onClick={() => setFilter('friends')}
          className={clsx(
            "flex-1 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 relative z-10 transition-colors",
            filter === 'friends' ? "text-white" : "text-white/40 hover:text-white/60"
          )}
        >
          <Users className="w-4 h-4" />
          Amis
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {displayedUsers.map((user, index) => {
          const isCurrentUser = user.id === currentUser?.id;
          
          return (
            <div 
              key={user.id}
              onClick={() => navigate(`/profile/${user.id}`)}
              className={clsx(
                "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer hover:bg-white/5",
                isCurrentUser 
                  ? "bg-primary/15 border-primary/60 shadow-[0_0_25px_rgba(255,193,7,0.45)] ring-2 ring-primary/50"
                  : "bg-surface border-white/5"
              )}
            >
              <div className="w-10 flex justify-center shrink-0">
                {getRankIcon(index)}
              </div>
              
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className={clsx("font-bold truncate", isCurrentUser ? "text-primary" : "text-white")}>
                    {user.displayName}
                  </span>
                  {isCurrentUser && (
                    <span className="bg-primary text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                      Toi
                    </span>
                  )}
                </div>
                <span className="text-xs text-white/40 truncate">@{user.username}</span>
              </div>

              <div className="flex flex-col items-end shrink-0 text-right">
                <span className="font-display text-xl text-white leading-none mb-1">{user.points}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold leading-none mb-1">Points</span>
                {user.highestScore !== undefined && user.highestScore > 0 && (
                  <span className="text-[10px] text-primary/80 font-mono font-bold">Record: {user.highestScore}</span>
                )}
              </div>
            </div>
          );
        })}

        {displayedUsers.length === 0 && (
          <div className="text-center text-white/50 py-10">
            Aucun joueur enregistré.
          </div>
        )}
      </div>
    </div>
  );
}
