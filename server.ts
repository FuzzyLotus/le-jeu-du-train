import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { db } from './server/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-le-jeu-du-train-12345';

import authRouter from './server/routes/auth';
import gameRouter from './server/routes/game';
import { requireAuth, requireAdmin, authLimiter, gameSubmitLimiter } from './server/utils';

// Helper to parse JSON safely
const safeJsonParse = (str: string | null) => {
  if (!str) return undefined;
  try { return JSON.parse(str); } catch { return undefined; }
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(self), screen-wake-lock=(self)');
    next();
  });
  app.use(express.json({ limit: '10kb' }));

  app.use('/api/auth', authRouter);
  app.use('/api/game', gameRouter);

  // API Routes
  app.post('/api/auth/signup', authLimiter, async (req, res) => {
    const { username, displayName, password, recoveryPhrase, email, phone } = req.body;

    if (typeof username !== 'string' || typeof displayName !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: "Format de données invalide." });
    }
    if (!username.trim() || !displayName.trim() || !password) {
      return res.status(400).json({ error: "Champs requis manquants." });
    }
    if (username.length > 50 || displayName.length > 50) {
      return res.status(400).json({ error: "Nom d'utilisateur ou d'affichage trop long (max 50)." });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "Le mot de passe doit contenir entre 8 et 128 caractères." });
    }
    if (email && (typeof email !== 'string' || email.length > 254)) {
       return res.status(400).json({ error: "Email invalide." });
    }
    if (phone && (typeof phone !== 'string' || phone.length > 20)) {
       return res.status(400).json({ error: "Téléphone invalide." });
    }
    if (recoveryPhrase && (typeof recoveryPhrase !== 'string' || recoveryPhrase.length > 200)) {
       return res.status(400).json({ error: "Phrase de récupération invalide." });
    }

    try {
      const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (existing) {
        return res.status(400).json({ error: "Ce nom d'utilisateur est déjà pris." });
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);
      const createdAt = Date.now();
      
      // Hash recovery data if provided
      const recoveryPhraseHash = recoveryPhrase ? bcrypt.hashSync(recoveryPhrase.toLowerCase().trim(), salt) : null;
      const emailHash = email ? bcrypt.hashSync(email.toLowerCase().trim(), salt) : null;
      const phoneHash = phone ? bcrypt.hashSync(phone.replace(/\s+/g, ''), salt) : null;
      
      // Check if first user (admin)
      const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      const isAdmin = count.count === 0 ? 1 : 0;

      const stmt = db.prepare(`
        INSERT INTO users (username, display_name, password_hash, created_at, is_admin, recovery_phrase, email, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const info = stmt.run(username, displayName, passwordHash, createdAt, isAdmin, recoveryPhraseHash, emailHash, phoneHash);
      const userId = info.lastInsertRowid;

      const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      
      const token = jwt.sign(
        { id: newUser.id, isAdmin: newUser.is_admin === 1 },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          displayName: newUser.display_name,
          points: newUser.points,
          totalEarned: newUser.total_earned,
          tripCount: newUser.trip_count,
          streak: newUser.streak,
          longestTripKm: newUser.longest_trip_km,
          totalDistanceKm: newUser.total_distance_km,
          maxCrossingsInTrip: newUser.max_crossings_in_trip,
          highestScore: newUser.highest_score,
          createdAt: newUser.created_at,
          isAdmin: newUser.is_admin === 1,
          preferences: safeJsonParse(newUser.preferences),
          homeLocation: safeJsonParse(newUser.home_location),
          achievements: []
        }
      });
    } catch (error: any) {
      console.error('Signup error:', error.message);
      res.status(500).json({ error: 'Erreur lors de l\'inscription.' });
    }
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: "Format de données invalide." });
    }
    if (!username.trim() || !password) {
      return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis." });
    }

    // Artificial delay
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
      
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "Identifiants invalides." });
      }

      const token = jwt.sign(
        { id: user.id, isAdmin: user.is_admin === 1 },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const unlockedAchievements = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(user.id);
      const achievementIds = unlockedAchievements.map((a: any) => a.achievement_id);

      res.json({
        token,
        user: {
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
        }
      });
    } catch (error: any) {
      console.error('Login error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la connexion.' });
    }
  });

  app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    const { username, recoveryPhrase, newPassword } = req.body;

    if (typeof username !== 'string' || typeof recoveryPhrase !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: "Format de données invalide." });
    }
    if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir entre 8 et 128 caractères." });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
      
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé." });
      }

      const methodLower = (recoveryPhrase || '').toLowerCase().trim();
      const matchesPhrase = user.recovery_phrase && bcrypt.compareSync(methodLower, user.recovery_phrase);

      if (!matchesPhrase) {
        return res.status(401).json({ error: "Phrase de récupération incorrecte." });
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(newPassword, salt);

      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Reset password error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe.' });
    }
  });

  app.post('/api/auth/request-reset', authLimiter, async (req, res) => {
    const { username, contactMethod } = req.body;

    if (typeof username !== 'string' || typeof contactMethod !== 'string') {
      return res.status(400).json({ error: "Format de données invalide." });
    }
    if (contactMethod.length > 254) {
      return res.status(400).json({ error: "Méthode de contact trop longue." });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
      
      if (!user) {
        // Return success anyway to prevent username enumeration
        return res.json({ success: true });
      }

      // Verify if the contact method matches the hashed email or phone
      const methodLower = (contactMethod || '').toLowerCase().trim();
      const methodPhone = (contactMethod || '').replace(/\s+/g, '');

      const matchesEmail = user.email && bcrypt.compareSync(methodLower, user.email);
      const matchesPhone = user.phone && bcrypt.compareSync(methodPhone, user.phone);

      if (!matchesEmail && !matchesPhone) {
        // Return success anyway to prevent enumeration, but don't create ticket
        return res.json({ success: true });
      }

      // Store the masked contact method in the ticket so admins can see it and contact them
      const maskedContact = contactMethod.includes('@') 
        ? contactMethod.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + '*'.repeat(gp3.length))
        : contactMethod.slice(0, 3) + '****' + contactMethod.slice(-2);

      db.prepare(`
        INSERT INTO password_reset_requests (user_id, contact_method, created_at)
        VALUES (?, ?, ?)
      `).run(user.id, maskedContact, Date.now());

      res.json({ success: true });
    } catch (error: any) {
      console.error('Request reset error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation.' });
    }
  });

  app.post('/api/admin/dummy-users', requireAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const dummyUsers = [
        {
          username: 'alice_w',
          displayName: 'Alice Wonderland',
          passwordHash: bcrypt.hashSync('password123', 10),
          points: 150,
          totalEarned: 150,
          tripCount: 12,
          streak: 5,
          hasLost: 0,
          longestTripKm: 45.2,
          totalDistanceKm: 320.5,
          maxCrossingsInTrip: 3,
          highestScore: 150,
          createdAt: Date.now(),
          preferences: JSON.stringify({
            isPublicProfile: true,
            showTripsOnLeaderboard: true,
            allowFriendRequests: true,
            showStats: true,
            showTripHistory: true
          })
        },
        {
          username: 'bob_builder',
          displayName: 'Bob The Builder',
          passwordHash: bcrypt.hashSync('password123', 10),
          points: 85,
          totalEarned: 90,
          tripCount: 8,
          streak: 2,
          hasLost: 1,
          longestTripKm: 12.5,
          totalDistanceKm: 85.0,
          maxCrossingsInTrip: 2,
          highestScore: 90,
          createdAt: Date.now(),
          preferences: JSON.stringify({
            isPublicProfile: true,
            showTripsOnLeaderboard: true,
            allowFriendRequests: true,
            showStats: true,
            showTripHistory: false
          })
        }
      ];

      for (const user of dummyUsers) {
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
        if (!existing) {
          db.prepare(`
            INSERT INTO users (username, display_name, password_hash, points, total_earned, trip_count, streak, has_lost, longest_trip_km, total_distance_km, max_crossings_in_trip, highest_score, created_at, preferences, is_admin, recovery_phrase, email, phone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL)
          `).run(
            user.username, user.displayName, user.passwordHash, user.points, user.totalEarned, user.tripCount, user.streak, user.hasLost, user.longestTripKm, user.totalDistanceKm, user.maxCrossingsInTrip, user.highestScore, user.createdAt, user.preferences
          );
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Generate dummy users error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la création des utilisateurs factices.' });
    }
  });

  app.post('/api/admin/bot-action', requireAuth, requireAdmin, async (req: any, res: any) => {
    const { action, botName } = req.body;
    const userId = req.user.id;

    if (!action || !botName) {
      return res.status(400).json({ error: 'Action et nom du bot requis' });
    }

    try {
      const bot = db.prepare('SELECT * FROM users WHERE username = ?').get(botName) as any;
      if (!bot) {
        return res.status(404).json({ error: `${botName} introuvable. Générez-les d'abord.` });
      }

      if (action === 'send_request') {
        const existing = db.prepare('SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').get(bot.id, userId);
        if (existing) {
          return res.status(400).json({ error: 'Demande déjà existante' });
        }
        db.prepare(`
          INSERT INTO friend_requests (sender_id, receiver_id, status, created_at)
          VALUES (?, ?, 'pending', ?)
        `).run(bot.id, userId, Date.now());
        res.json({ success: true, message: `${bot.display_name} vous a envoyé une demande!` });
      } else if (action === 'accept_request') {
        const request = db.prepare('SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').get(userId, bot.id) as any;
        if (!request) {
          return res.status(404).json({ error: `Aucune demande de votre part vers ${bot.display_name}` });
        }
        db.prepare(`
          UPDATE friend_requests SET status = 'accepted' WHERE id = ?
        `).run(request.id);
        res.json({ success: true, message: `${bot.display_name} a accepté votre demande!` });
      } else {
        res.status(400).json({ error: 'Action non reconnue' });
      }
    } catch (error: any) {
      console.error('Bot action error:', error.message);
      res.status(500).json({ error: 'Erreur lors de l\'action du bot.' });
    }
  });

  app.post('/api/admin/generate-trips', requireAuth, requireAdmin, async (req: any, res: any) => {
    const userId = req.user.id;

    try {
      let totalPoints = 0;
      let totalKm = 0;
      let maxCrossings = 0;
      let longestTrip = 0;

      for (let i = 0; i < 10; i++) {
        const distance = Math.floor(Math.random() * 50) + 5;
        const crossings = Math.floor(Math.random() * 5) + 1;
        const points = crossings; // Assuming success
        const date = Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);

        db.prepare(`
          INSERT INTO game_sessions (user_id, score, distance_km, crossings, ended_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, points, distance, crossings, date);

        totalPoints += points;
        totalKm += distance;
        if (crossings > maxCrossings) maxCrossings = crossings;
        if (distance > longestTrip) longestTrip = distance;
      }

      db.prepare(`
        UPDATE users 
        SET points = points + ?, 
            total_earned = total_earned + ?, 
            trip_count = trip_count + 10, 
            total_distance_km = total_distance_km + ?, 
            longest_trip_km = MAX(longest_trip_km, ?), 
            max_crossings_in_trip = MAX(max_crossings_in_trip, ?)
        WHERE id = ?
      `).run(totalPoints, totalPoints, totalKm, longestTrip, maxCrossings, userId);

      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

      res.json({
        success: true,
        user: {
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
          highestScore: updatedUser.highest_score,
          createdAt: updatedUser.created_at,
          isAdmin: updatedUser.is_admin === 1,
          preferences: safeJsonParse(updatedUser.preferences),
          homeLocation: safeJsonParse(updatedUser.home_location)
        }
      });
    } catch (error: any) {
      console.error('Generate trips error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la génération des trajets.' });
    }
  });

  app.get('/api/admin/reset-requests', requireAuth, requireAdmin, (req: any, res: any) => {
    try {
      const requests = db.prepare(`
        SELECT r.id, r.status, r.contact_method, r.created_at, u.username, u.email, u.phone
        FROM password_reset_requests r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
      `).all();
      res.json(requests);
    } catch (error: any) {
      console.error('Get reset requests error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la récupération des demandes.' });
    }
  });

  app.post('/api/admin/resolve-reset', requireAuth, requireAdmin, async (req: any, res: any) => {
    const { requestId, newPassword } = req.body;

    if (typeof requestId !== 'number' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: "Format de données invalide." });
    }
    if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir entre 8 et 128 caractères." });
    }

    try {
      const request = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(requestId) as any;
      if (!request) {
        return res.status(404).json({ error: "Demande non trouvée." });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user_id) as any;
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé." });
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(newPassword, salt);

      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, request.user_id);
      db.prepare('UPDATE password_reset_requests SET status = ?, contact_method = ? WHERE id = ?').run('resolved', '[EFFACÉ]', requestId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Resolve reset error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la résolution de la demande.' });
    }
  });

  app.get('/api/leaderboard', requireAuth, (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, username, display_name, points, total_earned, trip_count, streak, longest_trip_km, total_distance_km, highest_score
        FROM users
        ORDER BY points DESC
        LIMIT 10
      `).all();
      res.json(users);
    } catch (error: any) {
      console.error('Leaderboard error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la récupération du classement.' });
    }
  });

  app.post('/api/game/submit', requireAuth, gameSubmitLimiter, (req: any, res: any) => {
    const { score, distanceKm, crossings, isFailed, tripCount = 1 } = req.body;
    const userId = req.user.id; // Extracted securely from JWT

    // Input validation
    if (typeof score !== 'number' || score < 0 || score > 50000 || !Number.isInteger(score)) {
      return res.status(400).json({ error: 'Score invalide' });
    }
    if (typeof distanceKm !== 'number' || distanceKm < 0 || distanceKm > 10000) {
      return res.status(400).json({ error: 'Distance invalide' });
    }
    if (typeof crossings !== 'number' || crossings < 0 || crossings > 1000 || !Number.isInteger(crossings)) {
      return res.status(400).json({ error: 'Nombre de passages invalide' });
    }
    if (isFailed !== undefined && typeof isFailed !== 'boolean') {
      return res.status(400).json({ error: 'Format isFailed invalide' });
    }
    if (typeof tripCount !== 'number' || tripCount < 1 || tripCount > 100 || !Number.isInteger(tripCount)) {
      return res.status(400).json({ error: 'Nombre de trajets invalide' });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const now = Date.now();
      const avgCrossings = Math.floor(crossings / tripCount);
      const calculatedScore = isFailed ? 0 : crossings; // Assuming multiplier is 1 for now
      
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

      // Record session
      db.prepare(`
        INSERT INTO game_sessions (user_id, score, distance_km, crossings, ended_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, calculatedScore, distanceKm, crossings, now);

      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      
      const unlockedAchievements = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(userId);
      const achievementIds = unlockedAchievements.map((a: any) => a.achievement_id);

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
        achievements: achievementIds
      });
    } catch (error: any) {
      console.error('Submit game error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la sauvegarde de la partie.' });
    }
  });

  app.get('/api/history', requireAuth, (req: any, res: any) => {
    const userId = req.user.id; // Extracted securely from JWT

    try {
      const sessions = db.prepare(`
        SELECT * FROM game_sessions 
        WHERE user_id = ? 
        ORDER BY ended_at DESC
      `).all(userId);
      
      const trips = sessions.map((session: any) => ({
        id: session.id,
        userId: session.user_id,
        routeName: 'Trajet', // Default name as backend doesn't store route name yet
        distanceKm: session.distance_km,
        crossingsCount: session.crossings,
        success: session.score > 0, // Simplified success check
        date: session.ended_at
      }));

      res.json(trips);
    } catch (error: any) {
      console.error('History error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique.' });
    }
  });

  // User Profile Endpoints
  app.post('/api/users/achievements', requireAuth, (req: any, res: any) => {
    const { achievements } = req.body;
    if (!Array.isArray(achievements)) {
      return res.status(400).json({ error: 'Format invalide' });
    }

    try {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
        VALUES (?, ?, ?)
      `);
      
      const transaction = db.transaction((userId: number, achs: any[]) => {
        for (const ach of achs) {
          if (ach.achievementId && typeof ach.achievementId === 'string') {
            stmt.run(userId, ach.achievementId, ach.unlockedAt || Date.now());
          }
        }
      });
      
      transaction(req.user.id, achievements);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Save achievements error:', error.message);
      res.status(500).json({ error: 'Erreur lors de la sauvegarde des succès.' });
    }
  });

  app.get('/api/users/me', requireAuth, (req: any, res: any) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

      const unlockedAchievements = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(user.id);
      const achievementIds = unlockedAchievements.map((a: any) => a.achievement_id);

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
    } catch (error: any) {
      console.error('Get me error:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.put('/api/users/me', requireAuth, (req: any, res: any) => {
    const { displayName, preferences, homeLocation } = req.body;

    if (displayName && (typeof displayName !== 'string' || displayName.length > 50)) {
      return res.status(400).json({ error: 'Nom d\'affichage invalide' });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

      const newDisplayName = displayName || user.display_name;
      const newPreferences = preferences ? JSON.stringify(preferences) : user.preferences;
      const newHomeLocation = homeLocation ? JSON.stringify(homeLocation) : user.home_location;

      db.prepare(`
        UPDATE users 
        SET display_name = ?, preferences = ?, home_location = ?
        WHERE id = ?
      `).run(newDisplayName, newPreferences, newHomeLocation, req.user.id);

      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;

      const unlockedAchievements = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(req.user.id);
      const achievementIds = unlockedAchievements.map((a: any) => a.achievement_id);

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
        achievements: achievementIds
      });
    } catch (error: any) {
      console.error('Update me error:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.get('/api/users/:id', requireAuth, (req: any, res: any) => {
    try {
      const targetId = parseInt(req.params.id, 10);
      if (isNaN(targetId)) return res.status(400).json({ error: 'ID invalide' });

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

      const prefs = safeJsonParse(user.preferences);
      if (prefs && prefs.isPublicProfile === false && req.user.id !== user.id && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Profil privé' });
      }

      // Check friendship status
      let friendStatus = 'none';
      if (req.user.id === user.id) {
        friendStatus = 'self';
      } else {
        const sentRequest = db.prepare('SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').get(req.user.id, user.id) as any;
        const receivedRequest = db.prepare('SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').get(user.id, req.user.id) as any;

        if (sentRequest?.status === 'accepted' || receivedRequest?.status === 'accepted') {
          friendStatus = 'friends';
        } else if (sentRequest?.status === 'pending') {
          friendStatus = 'pending_sent';
        } else if (receivedRequest?.status === 'pending') {
          friendStatus = 'pending_received';
        }
      }

      // Load recent trips if allowed
      let recentTrips: any[] = [];
      const canViewTrips = prefs?.showTripHistory !== false;
      if (canViewTrips) {
        const sessions = db.prepare(`
          SELECT * FROM game_sessions 
          WHERE user_id = ? 
          ORDER BY ended_at DESC
          LIMIT 50
        `).all(user.id);
        
        recentTrips = sessions.map((session: any) => ({
          id: session.id,
          userId: session.user_id,
          routeName: 'Trajet',
          distanceKm: session.distance_km,
          crossingsCount: session.crossings,
          success: session.score > 0,
          date: session.ended_at
        }));
      }

      // Load achievements
      const unlockedAchievements = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(user.id);
      const achievementIds = unlockedAchievements.map((a: any) => a.achievement_id);

      res.json({
        user: {
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
          preferences: prefs
        },
        friendStatus,
        recentTrips,
        achievements: achievementIds
      });
    } catch (error: any) {
      console.error('Get user error:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Friends Endpoints
  app.get('/api/friends', requireAuth, (req: any, res: any) => {
    try {
      const requests = db.prepare(`
        SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at,
               u1.username as sender_username, u1.display_name as sender_display_name,
               u2.username as receiver_username, u2.display_name as receiver_display_name
        FROM friend_requests fr
        JOIN users u1 ON fr.sender_id = u1.id
        JOIN users u2 ON fr.receiver_id = u2.id
        WHERE fr.sender_id = ? OR fr.receiver_id = ?
      `).all(req.user.id, req.user.id);
      
      res.json(requests);
    } catch (error: any) {
      console.error('Get friends error details:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  app.post('/api/friends/request', requireAuth, (req: any, res: any) => {
    const { targetUserId } = req.body;
    if (typeof targetUserId !== 'number' || targetUserId === req.user.id) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }

    try {
      const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId) as any;
      if (!targetUser) return res.status(404).json({ error: 'Utilisateur non trouvé' });

      const prefs = safeJsonParse(targetUser.preferences);
      if (prefs && prefs.allowFriendRequests === false) {
        return res.status(403).json({ error: 'Cet utilisateur n\'accepte pas les demandes d\'amis' });
      }

      db.prepare(`
        INSERT INTO friend_requests (sender_id, receiver_id, created_at)
        VALUES (?, ?, ?)
      `).run(req.user.id, targetUserId, Date.now());

      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'Demande déjà envoyée' });
      }
      console.error('Friend request error:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.post('/api/friends/accept', requireAuth, (req: any, res: any) => {
    const { requestId } = req.body;
    if (typeof requestId !== 'number') return res.status(400).json({ error: 'ID invalide' });

    try {
      const info = db.prepare(`
        UPDATE friend_requests 
        SET status = 'accepted' 
        WHERE id = ? AND receiver_id = ? AND status = 'pending'
      `).run(requestId, req.user.id);

      if (info.changes === 0) return res.status(404).json({ error: 'Demande non trouvée ou déjà traitée' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Accept friend error:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.post('/api/friends/reject', requireAuth, (req: any, res: any) => {
    const { requestId } = req.body;
    if (typeof requestId !== 'number') return res.status(400).json({ error: 'ID invalide' });

    try {
      const info = db.prepare(`
        UPDATE friend_requests 
        SET status = 'rejected' 
        WHERE id = ? AND receiver_id = ? AND status = 'pending'
      `).run(requestId, req.user.id);

      if (info.changes === 0) return res.status(404).json({ error: 'Demande non trouvée ou déjà traitée' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Reject friend error:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GitHub Integration Helpers
  async function createGithubIssue(title: string, body: string, labels: string[] = []) {
    let token = process.env.GITHUB_TOKEN?.trim();
    let repo = process.env.GITHUB_REPO?.trim();

    if (!token || !repo) {
      console.warn('GitHub integration not configured (missing GITHUB_TOKEN or GITHUB_REPO)');
      return null;
    }

    // Smart parsing for repo: handle full URLs or just owner/repo
    if (repo.includes('github.com/')) {
      repo = repo.split('github.com/')[1].split('?')[0].split('#')[0];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);
    }
    
    // Remove leading/trailing slashes
    repo = repo.replace(/^\/+|\/+$/g, '');

    if (!repo.includes('/') || repo.split('/').length !== 2) {
      console.error(`GitHub API error: GITHUB_REPO format invalid. Received: "${repo}". Expected "owner/repo" (e.g. FuzzyLotus/le-jeu-du-train)`);
      return null;
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Le-Jeu-Du-Train-App'
        },
        body: JSON.stringify({ title, body, labels })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('GitHub API error:', response.status, JSON.stringify(data, null, 2));
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to create GitHub issue:', error);
      return null;
    }
  }

  async function getGithubIssueStatus(issueNumber: number) {
    let token = process.env.GITHUB_TOKEN?.trim();
    let repo = process.env.GITHUB_REPO?.trim();

    if (!token || !repo || !issueNumber) return null;

    if (repo.includes('github.com/')) {
      repo = repo.split('github.com/')[1].split('?')[0].split('#')[0];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);
    }
    repo = repo.replace(/^\/+|\/+$/g, '');

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Le-Jeu-Du-Train-App'
        }
      });

      if (!response.ok) return null;
      const data = await response.json();
      
      // Map GitHub state to app status
      // state: 'open' or 'closed'
      // state_reason: 'completed', 'not_planned', or null
      if (data.state === 'closed') {
        return data.state_reason === 'completed' ? 'completed' : 'closed';
      }
      return 'pending';
    } catch (error) {
      console.error('Failed to fetch GitHub issue status:', error);
      return null;
    }
  }

  async function getGithubIssueComments(issueNumber: number) {
    let token = process.env.GITHUB_TOKEN?.trim();
    let repo = process.env.GITHUB_REPO?.trim();

    if (!token || !repo || !issueNumber) return [];

    if (repo.includes('github.com/')) {
      repo = repo.split('github.com/')[1].split('?')[0].split('#')[0];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);
    }
    repo = repo.replace(/^\/+|\/+$/g, '');

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Le-Jeu-Du-Train-App'
        }
      });

      if (!response.ok) return [];
      const comments = await response.json();
      
      return comments.map((c: any) => ({
        senderId: -1, // System/GitHub
        isAdmin: true, // GitHub comments are treated as support responses
        message: c.body,
        createdAt: new Date(c.created_at).getTime(),
        githubCommentId: c.id
      }));
    } catch (error) {
      console.error('Failed to fetch GitHub comments:', error);
      return [];
    }
  }

  // Feedback Endpoints
  app.post('/api/feedback/submit', requireAuth, async (req: any, res: any) => {
    const { type, message } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string' || message.trim().length < 2) {
      return res.status(400).json({ error: 'Message trop court (min. 2 caractères)' });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      const now = Date.now();

      // Create GitHub Issue if configured
      let githubIssue = null;
      try {
        const issueTitle = `[${type.toUpperCase()}] ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;
        const issueBody = `**Type:** ${type}\n**Utilisateur:** ${user.username} (ID: ${userId})\n**Date:** ${new Date(now).toLocaleString()}\n\n**Message:**\n${message}`;
        const labels = [type === 'bug' ? 'bug' : 'enhancement', 'user-feedback'];
        
        githubIssue = await createGithubIssue(issueTitle, issueBody, labels);
      } catch (ghError) {
        console.error('GitHub issue creation failed, but continuing with DB save:', ghError);
      }

      const stmt = db.prepare(`
        INSERT INTO feedback (user_id, type, message, created_at, updated_at, github_issue_number, github_issue_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const info = stmt.run(
        userId, 
        type, 
        message.trim(), 
        now, 
        now, 
        githubIssue?.number || null, 
        githubIssue?.html_url || null
      );

      res.json({ 
        success: true, 
        id: info.lastInsertRowid,
        githubIssueNumber: githubIssue?.number,
        githubIssueUrl: githubIssue?.html_url
      });
    } catch (error: any) {
      console.error('Submit feedback error:', error);
      res.status(500).json({ error: `Erreur serveur: ${error.message}` });
    }
  });

  app.get('/api/feedback/my', requireAuth, async (req: any, res: any) => {
    try {
      const feedback = db.prepare(`
        SELECT * FROM feedback 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).all(req.user.id) as any[];
      
      const formatted = [];
      for (const f of feedback) {
        let currentStatus = f.status;
        let localReplies = typeof f.replies === 'string' ? (safeJsonParse(f.replies) || []) : (f.replies || []);
        
        // If it has a GitHub issue, check for updates
        if (f.github_issue_number) {
          // Sync status
          if (f.status !== 'completed' && f.status !== 'closed') {
            const newStatus = await getGithubIssueStatus(f.github_issue_number);
            if (newStatus && newStatus !== f.status) {
              db.prepare('UPDATE feedback SET status = ?, updated_at = ? WHERE id = ?')
                .run(newStatus, Date.now(), f.id);
              currentStatus = newStatus;
            }
          }

          // Sync comments
          const githubComments = await getGithubIssueComments(f.github_issue_number);
          if (githubComments.length > 0) {
            // Merge comments: keep local replies and add GitHub comments that aren't already there
            // We use githubCommentId to avoid duplicates if we were to save them back, 
            // but for now we just merge them for the response.
            const mergedReplies = [...localReplies];
            
            for (const ghc of githubComments) {
              // Check if this comment is already in local replies (by message and date roughly, or just message)
              const exists = localReplies.some((r: any) => r.message === ghc.message);
              if (!exists) {
                mergedReplies.push(ghc);
              }
            }
            
            // Sort by date
            mergedReplies.sort((a: any, b: any) => a.createdAt - b.createdAt);
            localReplies = mergedReplies;
          }
        }

        formatted.push({
          id: f.id,
          userId: f.user_id,
          type: f.type,
          message: f.message,
          status: currentStatus,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
          replies: localReplies,
          githubIssueNumber: f.github_issue_number,
          githubIssueUrl: f.github_issue_url
        });
      }

      res.json(formatted);
    } catch (error: any) {
      console.error('Get my feedback error:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.post('/api/feedback/reply', requireAuth, (req: any, res: any) => {
    const { feedbackId, message } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message vide' });
    }

    try {
      const feedback = db.prepare('SELECT * FROM feedback WHERE id = ?').get(feedbackId) as any;
      if (!feedback) return res.status(404).json({ error: 'Feedback non trouvé' });

      // Security: Only owner or admin can reply
      if (feedback.user_id !== userId && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Action non autorisée' });
      }

      const replies = safeJsonParse(feedback.replies) || [];
      const newReply = {
        senderId: userId,
        isAdmin: req.user.isAdmin === true,
        message: message.trim(),
        createdAt: Date.now()
      };
      replies.push(newReply);

      db.prepare('UPDATE feedback SET replies = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(replies), Date.now(), feedbackId);

      res.json({ success: true, reply: newReply });
    } catch (error: any) {
      console.error('Reply feedback error:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Admin User Moderation
  app.get('/api/admin/users', requireAuth, requireAdmin, (req: any, res: any) => {
    try {
      const users = db.prepare(`
        SELECT id, username, display_name, points, total_earned, trip_count, streak, longest_trip_km, total_distance_km, created_at, is_admin
        FROM users
        ORDER BY created_at DESC
      `).all();
      
      const formattedUsers = users.map((u: any) => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        points: u.points,
        totalEarned: u.total_earned,
        tripCount: u.trip_count,
        streak: u.streak,
        longestTripKm: u.longest_trip_km,
        totalDistanceKm: u.total_distance_km,
        createdAt: u.created_at,
        isAdmin: u.is_admin === 1
      }));

      res.json(formattedUsers);
    } catch (error: any) {
      console.error('Admin get users error:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req: any, res: any) => {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId) || targetId === req.user.id) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    try {
      db.transaction(() => {
        db.prepare('DELETE FROM game_sessions WHERE user_id = ?').run(targetId);
        db.prepare('DELETE FROM password_reset_requests WHERE user_id = ?').run(targetId);
        db.prepare('DELETE FROM friend_requests WHERE sender_id = ? OR receiver_id = ?').run(targetId, targetId);
        db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
      })();
      res.json({ success: true });
    } catch (error: any) {
      console.error('Admin delete user error:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
