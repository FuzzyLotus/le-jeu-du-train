import express from 'express';
import { db } from '../db.js';
import { requireAuth, safeJsonParse } from '../utils.js';

const router = express.Router();

function rowToFeedback(row: any) {
  const replies = safeJsonParse(row.replies);
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    replies: Array.isArray(replies) ? replies : [],
    ...(row.github_issue_number != null && { githubIssueNumber: row.github_issue_number }),
    ...(row.github_issue_url != null && { githubIssueUrl: row.github_issue_url }),
  };
}

// GET /api/feedback/my — list current user's feedback
router.get('/my', requireAuth, (req: any, res: any) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id) as any[];
    res.json(rows.map(rowToFeedback));
  } catch (err: any) {
    console.error('Feedback list error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/feedback/submit — create new feedback
router.post('/submit', requireAuth, (req: any, res: any) => {
  try {
    const { type, message } = req.body;
    if (typeof type !== 'string' || (type !== 'bug' && type !== 'feedback')) {
      return res.status(400).json({ error: 'Type invalide (bug ou feedback)' });
    }
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message requis' });
    }
    const now = Date.now();
    const info = db.prepare(`
      INSERT INTO feedback (user_id, type, message, status, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `).run(req.user.id, type, message.trim(), now, now);
    const row = db.prepare('SELECT * FROM feedback WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json(rowToFeedback(row));
  } catch (err: any) {
    console.error('Feedback submit error:', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message.' });
  }
});

// POST /api/feedback/reply — add a reply to one of my feedback items
router.post('/reply', requireAuth, (req: any, res: any) => {
  try {
    const { feedbackId, message: msg } = req.body;
    const id = typeof feedbackId === 'number' ? feedbackId : parseInt(feedbackId, 10);
    if (isNaN(id) || typeof msg !== 'string' || !msg.trim()) {
      return res.status(400).json({ error: 'feedbackId et message requis' });
    }
    const row = db.prepare('SELECT * FROM feedback WHERE id = ? AND user_id = ?').get(id, req.user.id) as any;
    if (!row) {
      return res.status(404).json({ error: 'Feedback non trouvé' });
    }
    const replies: Array<{ senderId: number; isAdmin: boolean; message: string; createdAt: number }> = safeJsonParse(row.replies) || [];
    const now = Date.now();
    replies.push({
      senderId: req.user.id,
      isAdmin: req.user.isAdmin === true,
      message: msg.trim(),
      createdAt: now,
    });
    db.prepare('UPDATE feedback SET replies = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(replies), now, id);
    const updated = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) as any;
    res.json(rowToFeedback(updated));
  } catch (err: any) {
    console.error('Feedback reply error:', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la réponse.' });
  }
});

export default router;
