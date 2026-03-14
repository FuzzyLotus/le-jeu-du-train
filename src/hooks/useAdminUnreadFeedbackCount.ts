import { useState, useEffect } from 'react';
import { AuthService } from '../services/AuthService';
import { getFeedbackAdminLastRead } from '../utils/feedbackLastRead';
import type { Feedback } from '../types/models';

/** Admin notification = threads with unresponded messages from users (new from others, or user replies from others since last read). */
export function useAdminUnreadFeedbackCount(adminUserId: number | undefined, enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!adminUserId || !enabled) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const response = await fetch('/api/admin/feedback', { headers: AuthService.getAuthHeaders() });
        if (!response.ok || cancelled) return;
        const data: Feedback[] = await response.json();
        const lastRead = getFeedbackAdminLastRead(adminUserId);
        const unreadCount = data.filter((item) =>
          (item.status === 'new' && item.createdAt > lastRead && item.userId !== adminUserId) ||
          item.replies?.some((r) => !r.isAdmin && r.createdAt > lastRead && r.senderId !== adminUserId)
        ).length;
        if (!cancelled) setCount(unreadCount);
      } catch {
        if (!cancelled) setCount(0);
      }
    };
    fetchCount();
    return () => { cancelled = true; };
  }, [adminUserId, enabled]);

  return count;
}
