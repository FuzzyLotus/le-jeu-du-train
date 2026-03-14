import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { db } from './server/db.js';

import authRouter from './server/routes/auth.js';
import gameRouter from './server/routes/game.js';
import usersRouter from './server/routes/users.js';
import adminRouter from './server/routes/admin.js';
import feedbackRouter from './server/routes/feedback.js';
import friendsRouter from './server/routes/friends.js';
import { requireAuth, requireAdmin, authLimiter, gameSubmitLimiter } from './server/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Safely parse JSON or return undefined
const safeJsonParse = (str: string | null) => {
  if (!str) return undefined;
  try { return JSON.parse(str); } catch { return undefined; }
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(self), screen-wake-lock=(self)');
    next();
  });

  app.use(express.json({ limit: '10kb' }));

  // ========================
  // API Routes (must be BEFORE static)
  // ========================
  app.use('/api/auth', authRouter);

  // Log to verify game router is actually hit
  app.use('/api/game', (req, res, next) => {
    console.log('Game router hit:', req.method, req.url);
    next();
  });
  app.use('/api/game', gameRouter);
  // Testing log to verify users router is hit
  app.use('/api/users', (req, res, next) => {
    console.log('Users router hit:', req.method, req.url);
    next();
  });
  app.use('/api/users', usersRouter);
  // Explicit admin dev routes (ensure they're registered even if router order differs)
  app.post('/api/admin/bot-action', requireAuth, requireAdmin, (req: any, res: any) => {
    try {
      const { action, botName } = req.body;
      const allowedBots = ['alice_w', 'bob_builder'];
      if (typeof action !== 'string' || typeof botName !== 'string' || !allowedBots.includes(botName)) {
        return res.status(400).json({ error: 'Action ou bot invalide.' });
      }
      if (action !== 'send_request' && action !== 'accept_request' && action !== 'remove_friend') {
        return res.status(400).json({ error: 'Action invalide.' });
      }
      const bot = db.prepare('SELECT id FROM users WHERE username = ?').get(botName) as { id: number } | undefined;
      if (!bot) return res.status(404).json({ error: 'Bot (Alice ou Bob) non trouvé. Créez-les d\'abord.' });
      const currentUserId = req.user.id;
      const botId = bot.id;
      if (action === 'send_request') {
        const existing = db.prepare(
          'SELECT id, status FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)'
        ).get(currentUserId, botId, botId, currentUserId) as any;
        if (existing) {
          if (existing.status === 'accepted') return res.status(400).json({ error: 'Vous êtes déjà amis.' });
          return res.status(400).json({ error: 'Demande déjà envoyée ou en attente.' });
        }
        const now = Date.now();
        db.prepare(
          'INSERT INTO friend_requests (sender_id, receiver_id, status, created_at) VALUES (?, ?, ?, ?)'
        ).run(currentUserId, botId, 'pending', now);
        return res.json({ success: true, message: 'Demande envoyée.' });
      }
      if (action === 'remove_friend') {
        const row = db.prepare(
          'SELECT id FROM friend_requests WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND status = ?'
        ).get(currentUserId, botId, botId, currentUserId, 'accepted') as { id: number } | undefined;
        if (!row) return res.status(404).json({ error: 'Vous n\'êtes pas amis avec ce bot.' });
        db.prepare('DELETE FROM friend_requests WHERE id = ?').run(row.id);
        return res.json({ success: true, message: 'Amitié retirée.' });
      }
      // Accept on behalf of the bot: find the pending request that current user sent TO the bot (receiver = bot)
      const row = db.prepare(
        'SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?'
      ).get(currentUserId, botId, 'pending') as { id: number } | undefined;
      if (!row) return res.status(404).json({ error: 'Aucune demande en attente (envoyez d\'abord une demande au bot).' });
      db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('accepted', row.id);
      res.json({ success: true, message: 'Demande acceptée.' });
    } catch (err: any) {
      console.error('Admin bot-action error:', err.message);
      res.status(500).json({ error: 'Action échouée.' });
    }
  });
  app.use('/api/admin', adminRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/friends', friendsRouter);

  /*app.post('/api/game/submit', requireAuth, gameSubmitLimiter, (req: any, res: any) => {
    const { score, distanceKm, crossings, isFailed, tripCount = 1 } = req.body;
    const userId = req.user.id;

    if (!Number.isInteger(score) || score < 0 || score > 50000) return res.status(400).json({ error: 'Score invalide' });
    if (typeof distanceKm !== 'number' || distanceKm < 0 || distanceKm > 10000) return res.status(400).json({ error: 'Distance invalide' });
    if (!Number.isInteger(crossings) || crossings < 0 || crossings > 1000) return res.status(400).json({ error: 'Nombre de passages invalide' });

    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

      const now = Date.now();
      const avgCrossings = Math.floor(crossings / tripCount);
      const calculatedScore = isFailed ? 0 : crossings;

      if (isFailed) {
        db.prepare(`
          UPDATE users
          SET points = 0,
              streak = 0,
              has_lost = 1,
              trip_count = trip_count + ?,
              total_distance_km = total_distance_km + ?,
              longest_trip_km = MAX(longest_trip_km, ?),
              max_crossings_in_trip = MAX(max_crossings_in_trip, ?)
          WHERE id = ?
        `).run(tripCount, distanceKm, distanceKm, avgCrossings, userId);
      } else {
        db.prepare(`
          UPDATE users
          SET points = points + ?,
              total_earned = total_earned + ?,
              streak = streak + ?,
              trip_count = trip_count + ?,
              total_distance_km = total_distance_km + ?,
              longest_trip_km = MAX(longest_trip_km, ?),
              max_crossings_in_trip = MAX(max_crossings_in_trip, ?),
              highest_score = MAX(highest_score, points + ?)
          WHERE id = ?
        `).run(calculatedScore, calculatedScore, calculatedScore > 0 ? crossings : 0, tripCount, distanceKm, distanceKm, avgCrossings, calculatedScore, userId);
      }

      db.prepare(`
        INSERT INTO game_sessions (user_id, score, distance_km, crossings, ended_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, calculatedScore, distanceKm, crossings, now);

      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      const unlockedAchievements = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(userId).map((a: any) => a.achievement_id);

      res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.display_name,
        points: updatedUser.points,
        totalEarned: updatedUser.total_earned,
        tripCount: updatedUser.trip_count,
        streak: updatedUser.streak,
        longestTripKm: updatedUser.longest_trip_km,
        totalDistanceKm: updatedUser.total_distance_km,
        maxCrossingsInTrip: updatedUser.max_crossings_in_trip,
        createdAt: updatedUser.created_at,
        isAdmin: updatedUser.is_admin === 1,
        preferences: safeJsonParse(updatedUser.preferences),
        homeLocation: safeJsonParse(updatedUser.home_location),
        achievements: unlockedAchievements
      });
    } catch (err: any) {
      console.error('Submit game error:', err.message);
      res.status(500).json({ error: 'Erreur lors de la sauvegarde de la partie.' });
    }
  }); */

  /* app.get('/api/users/me', requireAuth, (req: any, res: any) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

      const achievementIds = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(user.id).map((a: any) => a.achievement_id);

      res.json({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        points: user.points,
        totalEarned: user.total_earned,
        tripCount: user.trip_count,
        streak: user.streak,
        longestTripKm: user.longest_trip_km,
        totalDistanceKm: user.total_distance_km,
        maxCrossingsInTrip: user.max_crossings_in_trip,
        highestScore: user.highest_score,
        createdAt: user.created_at,
        isAdmin: user.is_admin === 1,
        preferences: safeJsonParse(user.preferences),
        homeLocation: safeJsonParse(user.home_location),
        achievements: achievementIds
      });
    } catch (err: any) {
      console.error('Get me error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }); */

  // ========================
  // Static + SPA Fallback (must be AFTER all API routes)
  // ========================
  app.use(express.static(path.join(__dirname, 'dist')));

  // SPA fallback: serve index.html for non-API GET routes only.
  // Do NOT intercept /api/* so those endpoints always return JSON.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

  // ========================
  // Start server
  // ========================
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(err => console.error('Failed to start server:', err));
