import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../utils.js';

const router = express.Router();

// GET /api/friends — list all friend requests involving current user (for display: pending received, pending sent, accepted)
router.get('/', requireAuth, (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const rows = db.prepare(`
      SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at,
        s.username AS sender_username, s.display_name AS sender_display_name, s.points AS sender_points,
        r.username AS receiver_username, r.display_name AS receiver_display_name, r.points AS receiver_points
      FROM friend_requests fr
      JOIN users s ON s.id = fr.sender_id
      JOIN users r ON r.id = fr.receiver_id
      WHERE fr.sender_id = ? OR fr.receiver_id = ?
      ORDER BY fr.created_at DESC
    `).all(userId, userId) as any[];

    const list = rows.map((row: any) => ({
      id: row.id,
      sender_id: row.sender_id,
      receiver_id: row.receiver_id,
      status: row.status,
      created_at: row.created_at,
      sender_username: row.sender_username,
      sender_display_name: row.sender_display_name,
      sender_points: row.sender_points ?? 0,
      receiver_username: row.receiver_username,
      receiver_display_name: row.receiver_display_name,
      receiver_points: row.receiver_points ?? 0,
    }));

    res.json(list);
  } catch (err: any) {
    console.error('Friends list error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des amis.' });
  }
});

// POST /api/friends/request — send a friend request
router.post('/request', requireAuth, (req: any, res: any) => {
  try {
    const senderId = req.user.id;
    const targetUserId = req.body.targetUserId;
    const receiverId = typeof targetUserId === 'number' ? targetUserId : parseInt(String(targetUserId), 10);
    if (isNaN(receiverId) || receiverId === senderId) {
      return res.status(400).json({ error: 'Utilisateur cible invalide.' });
    }

    const existing = db.prepare(
      'SELECT id, status FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)'
    ).get(senderId, receiverId, receiverId, senderId) as any;
    if (existing) {
      if (existing.status === 'accepted') return res.status(400).json({ error: 'Vous êtes déjà amis.' });
      if (existing.status === 'pending') return res.status(400).json({ error: 'Demande déjà envoyée ou en attente.' });
    }

    const now = Date.now();
    db.prepare(
      'INSERT INTO friend_requests (sender_id, receiver_id, status, created_at) VALUES (?, ?, ?, ?)'
    ).run(senderId, receiverId, 'pending', now);

    res.status(201).json({ success: true });
  } catch (err: any) {
    console.error('Friend request error:', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la demande.' });
  }
});

// POST /api/friends/accept — accept a friend request (receiver only)
router.post('/accept', requireAuth, (req: any, res: any) => {
  try {
    const receiverId = req.user.id;
    const requestId = typeof req.body.requestId === 'number' ? req.body.requestId : parseInt(String(req.body.requestId), 10);
    if (isNaN(requestId)) return res.status(400).json({ error: 'Demande invalide.' });

    const row = db.prepare('SELECT id, receiver_id, status FROM friend_requests WHERE id = ?').get(requestId) as any;
    if (!row) return res.status(404).json({ error: 'Demande non trouvée.' });
    if (row.receiver_id !== receiverId) return res.status(403).json({ error: 'Vous ne pouvez pas accepter cette demande.' });
    if (row.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée.' });

    db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('accepted', requestId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Friend accept error:', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'acceptation.' });
  }
});

// POST /api/friends/reject — reject a friend request (receiver only)
router.post('/reject', requireAuth, (req: any, res: any) => {
  try {
    const receiverId = req.user.id;
    const requestId = typeof req.body.requestId === 'number' ? req.body.requestId : parseInt(String(req.body.requestId), 10);
    if (isNaN(requestId)) return res.status(400).json({ error: 'Demande invalide.' });

    const row = db.prepare('SELECT id, receiver_id FROM friend_requests WHERE id = ?').get(requestId) as any;
    if (!row) return res.status(404).json({ error: 'Demande non trouvée.' });
    if (row.receiver_id !== receiverId) return res.status(403).json({ error: 'Accès refusé.' });

    db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Friend reject error:', err.message);
    res.status(500).json({ error: 'Erreur lors du refus.' });
  }
});

// POST /api/friends/remove — remove friendship (either user can remove)
router.post('/remove', requireAuth, (req: any, res: any) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = typeof req.body.targetUserId === 'number' ? req.body.targetUserId : parseInt(String(req.body.targetUserId), 10);
    if (isNaN(targetUserId) || targetUserId === currentUserId) {
      return res.status(400).json({ error: 'Utilisateur cible invalide.' });
    }

    const row = db.prepare(
      'SELECT id FROM friend_requests WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND status = ?'
    ).get(currentUserId, targetUserId, targetUserId, currentUserId, 'accepted') as { id: number } | undefined;
    if (!row) return res.status(404).json({ error: 'Vous n\'êtes pas amis avec cet utilisateur.' });

    db.prepare('DELETE FROM friend_requests WHERE id = ?').run(row.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Friend remove error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'amitié.' });
  }
});

export default router;
