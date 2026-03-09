import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Bug, MessageSquare, Clock, CheckCircle2, XCircle, Loader2, MessageCircle, Lock, Github, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { AuthService } from '../services/AuthService';
import { Button } from '../components/Button';
import clsx from 'clsx';
import type { Feedback, FeedbackType, FeedbackStatus, FeedbackReply } from '../types/models';

export function FeedbackScreen() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  
  const [type, setType] = useState<FeedbackType>('feedback');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [myFeedback, setMyFeedback] = useState<Feedback[]>([]);
  const [replyText, setReplyText] = useState<{[key: number]: string}>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const fetchFeedback = async () => {
    if (!currentUser?.id) return;
    try {
      const response = await fetch('/api/feedback/my', {
        headers: AuthService.getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setMyFeedback(data);
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [currentUser?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !message.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({ type, message: message.trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit');
      }
      
      setMessage('');
      addToast({ title: 'Envoyé!', message: 'Merci pour votre retour. Synchronisé avec GitHub.', type: 'success' });
      fetchFeedback();
    } catch (error: any) {
      console.error(error);
      addToast({ title: 'Erreur', message: error.message || "Impossible d'envoyer le message.", type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (feedbackId: number) => {
    if (!currentUser?.id || !replyText[feedbackId]?.trim()) return;

    try {
      const response = await fetch('/api/feedback/reply', {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({ feedbackId, message: replyText[feedbackId].trim() })
      });

      if (!response.ok) throw new Error('Failed to reply');

      setReplyText(prev => ({ ...prev, [feedbackId]: '' }));
      addToast({ title: 'Envoyé!', message: 'Réponse ajoutée.', type: 'success' });
      fetchFeedback();
    } catch (error) {
      console.error(error);
      addToast({ title: 'Erreur', message: "Impossible d'envoyer la réponse.", type: 'error' });
    }
  };

  const getStatusIcon = (status: FeedbackStatus) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'in_progress': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'resolved': 
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'rejected': 
      case 'closed': return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusLabel = (status: FeedbackStatus) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'in_progress': return 'En cours';
      case 'resolved': return 'Résolu';
      case 'completed': return 'Terminé';
      case 'rejected': return 'Rejeté';
      case 'closed': return 'Fermé';
    }
  };

  const closedStatuses: FeedbackStatus[] = ['resolved', 'completed', 'rejected', 'closed'];
  const openFeedback = myFeedback?.filter(f => !closedStatuses.includes(f.status)) || [];
  const closedFeedback = myFeedback?.filter(f => closedStatuses.includes(f.status)) || [];

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto relative pb-24">
      <header className="flex items-center gap-4 mb-8 mt-4">
        <button 
          onClick={() => navigate('/')}
          className="w-12 h-12 rounded-full bg-surface border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors active:scale-95"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-display text-white">Aide & Retours</h1>
        </div>
      </header>

      {/* Form */}
      <div className="bg-surface border border-white/5 rounded-3xl p-6 mb-8">
        <h2 className="font-bold text-lg mb-4 text-white">Nouveau message</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-2 p-1 bg-black/20 rounded-xl">
            <button
              type="button"
              onClick={() => setType('feedback')}
              className={clsx(
                "flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                type === 'feedback' ? "bg-primary text-black shadow-lg" : "text-white/50 hover:text-white"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Suggestion
            </button>
            <button
              type="button"
              onClick={() => setType('bug')}
              className={clsx(
                "flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                type === 'bug' ? "bg-failure text-white shadow-lg" : "text-white/50 hover:text-white"
              )}
            >
              <Bug className="w-4 h-4" />
              Bug
            </button>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={type === 'feedback' ? "Une idée pour améliorer le jeu ?" : "Décrivez le problème rencontré..."}
            className="w-full h-32 bg-black/20 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 transition-colors resize-none"
            required
          />

          <Button type="submit" disabled={isSubmitting || message.trim().length < 2} fullWidth>
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Envoyer</>}
          </Button>
        </form>
      </div>

      {/* History */}
      <div>
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="font-bold text-lg text-white">Mes messages</h2>
          <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-wider font-bold">
            <Lock className="w-3 h-3" />
            Privé
          </div>
        </div>
        
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* Open Feedback */}
              {openFeedback.map((item) => (
                <div key={item.id} className="bg-surface border border-white/5 rounded-2xl p-4 overflow-hidden">
                  <div 
                    className="flex items-start justify-between mb-2 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id!)}
                  >
                    <div className="flex items-center gap-2">
                      {item.type === 'bug' ? (
                        <span className="bg-failure/20 text-failure text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold flex items-center gap-1">
                          <Bug className="w-3 h-3" /> Bug
                        </span>
                      ) : (
                        <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Suggestion
                        </span>
                      )}
                      <span className="text-xs text-white/30">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={clsx(
                      "flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full border",
                      item.status === 'pending' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                      item.status === 'in_progress' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                      (item.status === 'resolved' || item.status === 'completed') && "bg-green-500/10 text-green-500 border-green-500/20",
                      (item.status === 'rejected' || item.status === 'closed') && "bg-red-500/10 text-red-500 border-red-500/20",
                    )}>
                      {getStatusIcon(item.status)}
                      {getStatusLabel(item.status)}
                    </div>
                  </div>
                  
                  <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap mb-3">{item.message}</p>

                  {item.githubIssueUrl && (
                    <a 
                      href={item.githubIssueUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] text-white/40 hover:text-primary transition-colors mb-3 bg-white/5 px-2 py-1 rounded-md"
                    >
                      <Github className="w-3 h-3" />
                      GitHub Issue #{item.githubIssueNumber}
                      <ExternalLink className="w-2 h-2" />
                    </a>
                  )}

                  {/* Replies Section */}
                  {item.replies && item.replies.length > 0 && (
                    <div className="mt-4 pl-4 border-l-2 border-white/10 space-y-3">
                      {item.replies.map((reply, idx) => (
                        <div key={idx} className={clsx("text-sm", reply.isAdmin ? "text-primary/90" : "text-white/70")}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-xs uppercase tracking-wider">
                              {reply.isAdmin ? 'Support' : 'Moi'}
                            </span>
                            <span className="text-[10px] text-white/30">
                              {new Date(reply.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{reply.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Input */}
                  {expandedId === item.id && !['resolved', 'completed', 'rejected', 'closed'].includes(item.status) && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText[item.id!] || ''}
                          onChange={(e) => setReplyText(prev => ({ ...prev, [item.id!]: e.target.value }))}
                          placeholder="Répondre..."
                          className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (item.id) handleReply(item.id);
                            }
                          }}
                        />
                        <button
                          onClick={() => item.id && handleReply(item.id)}
                          disabled={!replyText[item.id!]?.trim()}
                          className="p-2 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Expand/Collapse Hint */}
                  {(!expandedId || expandedId !== item.id) && !['resolved', 'completed', 'rejected', 'closed'].includes(item.status) && (
                    <div 
                      className="mt-2 text-center"
                      onClick={() => setExpandedId(item.id!)}
                    >
                      <button className="text-[10px] text-white/30 uppercase tracking-wider hover:text-white/50 flex items-center justify-center gap-1 w-full">
                        <MessageCircle className="w-3 h-3" />
                        {item.replies?.length ? `${item.replies.length} réponse(s)` : 'Répondre'}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Closed Feedback Toggle */}
              {closedFeedback.length > 0 && (
                <div className="mt-4">
                  <button 
                    onClick={() => setShowClosed(!showClosed)}
                    className="w-full py-3 px-4 rounded-xl border border-white/5 bg-white/5 text-[10px] text-white/40 uppercase tracking-widest font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                  >
                    {showClosed ? 'Masquer les messages fermés' : `Voir les messages fermés (${closedFeedback.length})`}
                  </button>
                  
                  {showClosed && (
                    <div className="flex flex-col gap-3 mt-3">
                      {closedFeedback.map((item) => (
                        <div key={item.id} className="bg-surface/50 border border-white/5 rounded-2xl p-4 overflow-hidden opacity-70">
                          <div 
                            className="flex items-start justify-between mb-2 cursor-pointer"
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id!)}
                          >
                            <div className="flex items-center gap-2">
                              {item.type === 'bug' ? (
                                <span className="bg-failure/20 text-failure text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold flex items-center gap-1">
                                  <Bug className="w-3 h-3" /> Bug
                                </span>
                              ) : (
                                <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" /> Suggestion
                                </span>
                              )}
                              <span className="text-xs text-white/30">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className={clsx(
                              "flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full border",
                              (item.status === 'resolved' || item.status === 'completed') && "bg-green-500/10 text-green-500 border-green-500/20",
                              (item.status === 'rejected' || item.status === 'closed') && "bg-red-500/10 text-red-500 border-red-500/20",
                            )}>
                              {getStatusIcon(item.status)}
                              {getStatusLabel(item.status)}
                            </div>
                          </div>
                          
                          <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap mb-3">{item.message}</p>

                          {item.githubIssueUrl && (
                            <a 
                              href={item.githubIssueUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10px] text-white/40 hover:text-primary transition-colors mb-3 bg-white/5 px-2 py-1 rounded-md"
                            >
                              <Github className="w-3 h-3" />
                              GitHub Issue #{item.githubIssueNumber}
                              <ExternalLink className="w-2 h-2" />
                            </a>
                          )}

                          {/* Replies Section */}
                          {expandedId === item.id && item.replies && item.replies.length > 0 && (
                            <div className="mt-4 pl-4 border-l-2 border-white/10 space-y-3">
                              {item.replies.map((reply, idx) => (
                                <div key={idx} className={clsx("text-sm", reply.isAdmin ? "text-primary/90" : "text-white/70")}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-xs uppercase tracking-wider">
                                      {reply.isAdmin ? 'Support' : 'Moi'}
                                    </span>
                                    <span className="text-[10px] text-white/30">
                                      {new Date(reply.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="whitespace-pre-wrap">{reply.message}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Show replies count if not expanded */}
                          {(!expandedId || expandedId !== item.id) && item.replies && item.replies.length > 0 && (
                            <div 
                              className="mt-2 text-center"
                              onClick={() => setExpandedId(item.id!)}
                            >
                              <button className="text-[10px] text-white/30 uppercase tracking-wider hover:text-white/50 flex items-center justify-center gap-1 w-full">
                                <MessageCircle className="w-3 h-3" />
                                {item.replies.length} réponse(s)
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {openFeedback.length === 0 && closedFeedback.length === 0 && (
                <div className="text-center text-white/30 py-8 bg-surface/50 rounded-2xl border border-white/5 border-dashed">
                  Aucun message envoyé pour le moment.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
