import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Check, X, Users } from 'lucide-react';
import { AuthService } from '../services/AuthService';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import type { User, FriendRequest } from '../types/models';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

export function FriendsScreen() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const addToast = useToastStore((state) => state.addToast);

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFriendsData = async () => {
      if (!currentUser?.id) return;

      try {
        const response = await fetch('/api/friends', {
          headers: AuthService.getAuthHeaders()
        });
        // #region agent log
        fetch('http://127.0.0.1:7831/ingest/d0f4f769-8050-4800-9144-f9e35d5afd0c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bda411'},body:JSON.stringify({sessionId:'bda411',location:'FriendsScreen.tsx:loadFriends',message:'GET /api/friends',data:{status:response.status,ok:response.ok,contentType:response.headers.get('content-type')?.slice(0,30)},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        if (response.status === 401) {
          useAuthStore.getState().logout();
          navigate('/login');
          return;
        }

        if (!response.ok) throw new Error('Failed to load friends');
        const data = await response.json();
        // #region agent log
        fetch('http://127.0.0.1:7831/ingest/d0f4f769-8050-4800-9144-f9e35d5afd0c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bda411'},body:JSON.stringify({sessionId:'bda411',location:'FriendsScreen.tsx:loadFriendsData',message:'friends response shape',data:{isArray:Array.isArray(data),length:Array.isArray(data)?data.length:0,sampleKeys:Array.isArray(data)&&data[0]?Object.keys(data[0]):null},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        // Process data
        const pending = data
          .filter((req: any) => req.receiver_id === currentUser.id && req.status === 'pending')
          .map((req: any) => ({
            id: req.id,
            sender: {
              id: req.sender_id,
              username: req.sender_username,
              displayName: req.sender_display_name
            }
          }));

        const accepted = data
          .filter((req: any) => req.status === 'accepted')
          .map((req: any) => {
            const isSender = req.sender_id === currentUser.id;
            return {
              id: isSender ? req.receiver_id : req.sender_id,
              username: isSender ? req.receiver_username : req.sender_username,
              displayName: isSender ? req.receiver_display_name : req.sender_display_name,
              points: isSender ? (req.receiver_points ?? 0) : (req.sender_points ?? 0),
            };
          });

        // Deduplicate friends
        const uniqueFriends = Array.from(new Map(accepted.map((item: any) => [item.id, item])).values());

        setPendingRequests(pending);
        setFriends(uniqueFriends as any);

      } catch (error) {
        console.error("Error loading friends:", error);
        addToast({ title: 'Erreur', message: 'Impossible de charger les amis.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    loadFriendsData();
  }, [currentUser?.id, addToast]);

  const handleAccept = async (requestId: number) => {
    try {
      const response = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({ requestId })
      });
      // #region agent log
      fetch('http://127.0.0.1:7831/ingest/d0f4f769-8050-4800-9144-f9e35d5afd0c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bda411'},body:JSON.stringify({sessionId:'bda411',location:'FriendsScreen.tsx:handleAccept',message:'POST /api/friends/accept',data:{status:response.status,ok:response.ok},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (!response.ok) throw new Error('Failed to accept');
      
      // Move from pending to friends list locally
      const request = pendingRequests.find(r => r.id === requestId);
      if (request) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        setFriends(prev => [...prev, request.sender]);
        addToast({ title: 'Succès', message: 'Ami ajouté !', type: 'success' });
      }
    } catch (error) {
      console.error(error);
      addToast({ title: 'Erreur', message: 'Action impossible.', type: 'error' });
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      const response = await fetch('/api/friends/reject', {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({ requestId })
      });
      
      if (!response.ok) throw new Error('Failed to reject');

      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      addToast({ title: 'Refusé', message: 'Demande supprimée.', type: 'info' });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto relative pb-24">
      <header className="flex items-center gap-4 mb-8 mt-4">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-display text-white">Amis</h1>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        
        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <section>
            <h2 className="text-white font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider opacity-70">
              <UserPlus className="w-4 h-4" />
              Demandes en attente ({pendingRequests.length})
            </h2>
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {pendingRequests.map(req => (
                  <motion.div 
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-surface border border-white/10 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {req.sender.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-white font-bold block">{req.sender.displayName}</span>
                        <span className="text-white/40 text-xs">@{req.sender.username}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => req.id && handleReject(req.id)}
                        className="w-8 h-8 rounded-full bg-failure/10 text-failure flex items-center justify-center hover:bg-failure/20 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => req.id && handleAccept(req.id)}
                        className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center hover:bg-success/20 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Friends List */}
        <section>
          <h2 className="text-white font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider opacity-70">
            <Users className="w-4 h-4" />
            Mes Amis ({friends.length})
          </h2>
          
          {friends.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {friends.map(friend => (
                <div 
                  key={friend.id}
                  onClick={() => navigate(`/profile/${friend.id}`)}
                  className="bg-surface border border-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
                      {friend.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-white font-bold block">{friend.displayName}</span>
                      <span className="text-white/40 text-xs">@{friend.username}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-primary font-display text-lg block">{friend.points}</span>
                    <span className="text-[10px] uppercase text-white/30 font-bold">Points</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-surface/50 rounded-2xl border border-white/5 border-dashed">
              <Users className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-white/50 text-sm">Vous n'avez pas encore d'amis.</p>
              <p className="text-white/30 text-xs mt-1">Ajoutez des joueurs depuis le classement !</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
