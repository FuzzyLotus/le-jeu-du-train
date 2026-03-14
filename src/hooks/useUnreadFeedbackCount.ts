import { useState, useEffect } from 'react';
import { AuthService } from '../services/AuthService';
import { getFeedbackLastRead } from '../utils/feedbackLastRead';
import type { Feedback } from '../types/models';

export function useUnreadFeedbackCount(userId: number | undefined, enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId || !enabled) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const response = await fetch('/api/feedback/my', {
          headers: AuthService.getAuthHeaders()
        });
        if (!response.ok || cancelled) return;
        const data: Feedback[] = await response.json();
        const lastRead = getFeedbackLastRead(userId);
        // User notification = threads with unread admin replies
        const unreadCount = data.filter((item) => {
          const adminReplies = item.replies?.filter((r) => r.isAdmin) ?? [];
          return adminReplies.some((r) => r.createdAt > lastRead);
        }).length;
        if (!cancelled) setCount(unreadCount);
      } catch {
        if (!cancelled) setCount(0);
      }
    };
    fetchCount();
    return () => { cancelled = true; };
  }, [userId, enabled]);

  return count;
}
