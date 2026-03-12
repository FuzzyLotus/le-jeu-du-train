import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { authLimiter, safeJsonParse } from '../utils.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-le-jeu-du-train-12345';

router.post('/signup', authLimiter, async (req, res) => {
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
    
    const recoveryPhraseHash = recoveryPhrase ? bcrypt.hashSync(recoveryPhrase.toLowerCase().trim(), salt) : null;
    const emailHash = email ? bcrypt.hashSync(email.toLowerCase().trim(), salt) : null;
    const phoneHash = phone ? bcrypt.hashSync(phone.replace(/\s+/g, ''), salt) : null;
    
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

router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: "Format de données invalide." });
  }
  if (!username.trim() || !password) {
    return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis." });
  }

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

router.post('/reset-password', authLimiter, async (req, res) => {
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

router.post('/request-reset', authLimiter, async (req, res) => {
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
      return res.json({ success: true });
    }

    const methodLower = (contactMethod || '').toLowerCase().trim();
    const methodPhone = (contactMethod || '').replace(/\s+/g, '');

    const matchesEmail = user.email && bcrypt.compareSync(methodLower, user.email);
    const matchesPhone = user.phone && bcrypt.compareSync(methodPhone, user.phone);

    if (!matchesEmail && !matchesPhone) {
      return res.json({ success: true });
    }

    db.prepare(`
      INSERT INTO password_reset_requests (user_id, contact_method, created_at)
      VALUES (?, ?, ?)
    `).run(user.id, contactMethod, Date.now());

    res.json({ success: true });
  } catch (error: any) {
    console.error('Request reset error:', error.message);
    res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation.' });
  }
});

export default router;
