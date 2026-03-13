import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../utils.js';

const router = express.Router();

function toUserRow(row: any) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    points: row.points ?? 0,
    totalEarned: row.total_earned ?? 0,
    tripCount: row.trip_count ?? 0,
    streak: row.streak ?? 0,
    longestTripKm: row.longest_trip_km ?? 0,
    totalDistanceKm: row.total_distance_km ?? 0,
    maxCrossingsInTrip: row.max_crossings_in_trip ?? 0,
    highestScore: row.highest_score ?? 0,
    createdAt: row.created_at,
    isAdmin: row.is_admin === 1,
  };
}

// GET /api/admin/users — list all users (admin only)
router.get('/users', requireAuth, requireAdmin, (req: any, res: any) => {
  try {
    const rows = db.prepare(`
      SELECT id, username, display_name, points, total_earned, trip_count,
             streak, longest_trip_km, total_distance_km, max_crossings_in_trip,
             highest_score, created_at, is_admin
      FROM users
      ORDER BY created_at DESC
    `).all() as any[];
    res.json(rows.map(toUserRow));
  } catch (err: any) {
    console.error('Admin list users error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
});

// DELETE /api/admin/users/:id — delete user (admin or self for account deletion)
router.delete('/users/:id', requireAuth, (req: any, res: any) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (Number.isNaN(targetId)) return res.status(400).json({ error: 'ID invalide' });

    const isAdmin = req.user.isAdmin === true;
    const isSelf = req.user.id === targetId;
    if (!isAdmin && !isSelf) return res.status(403).json({ error: 'Accès refusé' });

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    db.prepare('DELETE FROM user_achievements WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM game_sessions WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM password_reset_requests WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM friend_requests WHERE sender_id = ? OR receiver_id = ?').run(targetId, targetId);
    db.prepare('DELETE FROM feedback WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);

    res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Admin delete user error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

// GET /api/admin/reset-requests — list pending password reset requests (admin only)
router.get('/reset-requests', requireAuth, requireAdmin, (req: any, res: any) => {
  try {
    const rows = db.prepare(`
      SELECT r.id, r.user_id, r.contact_method, r.status, r.created_at,
             u.username
      FROM password_reset_requests r
      JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC
    `).all() as any[];
    const list = rows.map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      username: r.username,
      contact_method: r.contact_method,
      status: r.status,
      created_at: r.created_at,
      email: null,
      phone: null,
    }));
    res.json(list);
  } catch (err: any) {
    console.error('Admin reset-requests error:', err.message);
    res.status(500).json({ error: 'Impossible de récupérer les réinitialisations.' });
  }
});

// POST /api/admin/resolve-reset — set new password and mark request resolved (admin only)
router.post('/resolve-reset', requireAuth, requireAdmin, (req: any, res: any) => {
  try {
    const { requestId, newPassword } = req.body;
    if (typeof requestId !== 'number' && typeof requestId !== 'string') {
      return res.status(400).json({ error: 'requestId invalide' });
    }
    const id = typeof requestId === 'string' ? parseInt(requestId, 10) : requestId;
    if (Number.isNaN(id)) return res.status(400).json({ error: 'requestId invalide' });

    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir entre 8 et 128 caractères.' });
    }

    const request = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(id) as any;
    if (!request) return res.status(404).json({ error: 'Demande non trouvée' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée' });

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, request.user_id);
    db.prepare("UPDATE password_reset_requests SET status = 'resolved' WHERE id = ?").run(id);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Admin resolve-reset error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la résolution.' });
  }
});

export default router;
