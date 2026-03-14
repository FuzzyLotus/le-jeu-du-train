import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth, requireAdmin, safeJsonParse } from '../utils.js';

const router = express.Router();

function feedbackRowToJson(row: any) {
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

// GET /api/admin/feedback — list all feedback (admin only)
router.get('/feedback', requireAuth, requireAdmin, (req: any, res: any) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM feedback ORDER BY created_at DESC
    `).all() as any[];
    res.json(rows.map(feedbackRowToJson));
  } catch (err: any) {
    console.error('Admin feedback list error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des retours.' });
  }
});

// PATCH /api/admin/feedback/:id — update feedback status (admin only)
router.patch('/feedback/:id', requireAuth, requireAdmin, (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
    const { status } = req.body;
    const allowed = ['pending', 'in_progress', 'resolved', 'rejected', 'completed', 'closed'];
    if (typeof status !== 'string' || !allowed.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    const now = Date.now();
    const info = db.prepare('UPDATE feedback SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
    if (info.changes === 0) return res.status(404).json({ error: 'Feedback non trouvé' });
    const row = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) as any;
    res.json(feedbackRowToJson(row));
  } catch (err: any) {
    console.error('Admin feedback update error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
});

// POST /api/admin/feedback/:id/reply — add admin reply to feedback (admin only)
router.post('/feedback/:id/reply', requireAuth, requireAdmin, (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
    const { message } = req.body;
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message requis' });
    }
    const row = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) as any;
    if (!row) return res.status(404).json({ error: 'Feedback non trouvé' });
    const replies: Array<{ senderId: number; isAdmin: boolean; message: string; createdAt: number }> = safeJsonParse(row.replies) || [];
    const now = Date.now();
    replies.push({
      senderId: req.user.id,
      isAdmin: true,
      message: message.trim(),
      createdAt: now,
    });
    db.prepare('UPDATE feedback SET replies = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(replies), now, id);
    const updated = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) as any;
    res.json(feedbackRowToJson(updated));
  } catch (err: any) {
    console.error('Admin feedback reply error:', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la réponse.' });
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

// Dummy users for dev: Alice (alice_w) and Bob (bob_builder). Shared dummy password.
const DUMMY_PASSWORD = 'dummy-dev-123';
const DUMMY_USERS = [
  { username: 'alice_w', displayName: 'Alice' },
  { username: 'bob_builder', displayName: 'Bob' },
] as const;

// POST /api/admin/dummy-users — create Alice & Bob (admin only, dev)
router.post('/dummy-users', requireAuth, requireAdmin, (req: any, res: any) => {
  try {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(DUMMY_PASSWORD, salt);
    const createdAt = Date.now();
    const insert = db.prepare(`
      INSERT INTO users (username, display_name, password_hash, created_at, is_admin, recovery_phrase, email, phone)
      VALUES (?, ?, ?, ?, 0, NULL, NULL, NULL)
    `);
    let created = 0;
    for (const { username, displayName } of DUMMY_USERS) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) continue;
      insert.run(username, displayName, passwordHash, createdAt);
      created++;
    }
    res.status(201).json({ success: true, created });
  } catch (err: any) {
    console.error('Admin dummy-users error:', err.message);
    res.status(500).json({ error: 'Échec création dummy users.' });
  }
});

// POST /api/admin/bot-action — see server.ts (registered explicitly so it always responds)

// POST /api/admin/generate-trips — add 10 dummy trips for current user (admin only, dev)
router.post('/generate-trips', requireAuth, requireAdmin, (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    const now = Date.now();
    const insertSession = db.prepare(`
      INSERT INTO game_sessions (user_id, score, distance_km, crossings, ended_at, has_bridge, has_tunnel, max_elevation, min_elevation, max_bridge_length, start_country, end_country, start_island, end_island)
      VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, NULL, NULL, NULL, NULL)
    `);

    const TRIP_COUNT = 10;
    const PER_TRIP_CROSSINGS = 1;
    const PER_TRIP_KM = 5;
    const PER_TRIP_SCORE = PER_TRIP_CROSSINGS;

    for (let i = 0; i < TRIP_COUNT; i++) {
      const t = now - (TRIP_COUNT - i) * 60_000;
      insertSession.run(userId, PER_TRIP_SCORE, PER_TRIP_KM, PER_TRIP_CROSSINGS, t);
    }

    const totalScore = TRIP_COUNT * PER_TRIP_SCORE;
    const totalKm = TRIP_COUNT * PER_TRIP_KM;
    const newPoints = (user.points ?? 0) + totalScore;
    db.prepare(`
      UPDATE users
      SET points = points + ?,
          total_earned = total_earned + ?,
          streak = streak + ?,
          trip_count = trip_count + ?,
          total_distance_km = total_distance_km + ?,
          longest_trip_km = MAX(longest_trip_km, ?),
          max_crossings_in_trip = MAX(max_crossings_in_trip, ?),
          highest_score = MAX(COALESCE(highest_score, 0), ?)
      WHERE id = ?
    `).run(totalScore, totalScore, totalScore, TRIP_COUNT, totalKm, PER_TRIP_KM, PER_TRIP_CROSSINGS, newPoints, userId);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const achievementIds = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
      .all(userId).map((a: any) => a.achievement_id);

    const userJson = {
      id: updated.id,
      username: updated.username,
      displayName: updated.display_name,
      points: updated.points,
      totalEarned: updated.total_earned,
      tripCount: updated.trip_count,
      streak: updated.streak,
      longestTripKm: updated.longest_trip_km,
      totalDistanceKm: updated.total_distance_km,
      maxCrossingsInTrip: updated.max_crossings_in_trip,
      highestScore: updated.highest_score ?? 0,
      createdAt: updated.created_at,
      isAdmin: updated.is_admin === 1,
      preferences: safeJsonParse(updated.preferences),
      homeLocation: safeJsonParse(updated.home_location),
      achievements: achievementIds,
    };

    res.status(201).json({ user: userJson });
  } catch (err: any) {
    console.error('Admin generate-trips error:', err.message);
    res.status(500).json({ error: 'Échec génération trajets.' });
  }
});

export default router;
