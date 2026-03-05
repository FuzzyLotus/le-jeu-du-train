import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { db } from './server/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/auth/signup', async (req, res) => {
    const { username, displayName, password, recoveryPhrase, email, phone } = req.body;

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
      
      res.json({
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
        isAdmin: newUser.is_admin === 1
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'inscription.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    // Artificial delay
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
      
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "Identifiants invalides." });
      }

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
        createdAt: user.created_at,
        isAdmin: user.is_admin === 1
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Erreur lors de la connexion.' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const { username, recoveryPhrase, newPassword } = req.body;

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
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe.' });
    }
  });

  app.post('/api/auth/request-reset', async (req, res) => {
    const { username, contactMethod } = req.body;

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

      // Store the PLAINTEXT contact method in the ticket so admins can see it and contact them
      db.prepare(`
        INSERT INTO password_reset_requests (user_id, contact_method, created_at)
        VALUES (?, ?, ?)
      `).run(user.id, contactMethod, Date.now());

      // Temporarily store the plaintext in the users table so admins can see it in the UI
      // It will be re-hashed when the ticket is resolved
      if (matchesEmail) {
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(methodLower, user.id);
      } else if (matchesPhone) {
        db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(methodPhone, user.id);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Request reset error:', error);
      res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation.' });
    }
  });

  app.get('/api/admin/reset-requests', (req, res) => {
    const adminId = req.query.adminId;
    if (!adminId) return res.status(401).json({ error: 'Non autorisé' });

    try {
      const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(adminId) as any;
      if (!admin || !admin.is_admin) {
        return res.status(403).json({ error: 'Accès refusé' });
      }

      const requests = db.prepare(`
        SELECT r.id, r.status, r.contact_method, r.created_at, u.username, u.email, u.phone
        FROM password_reset_requests r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
      `).all();
      res.json(requests);
    } catch (error) {
      console.error('Get reset requests error:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des demandes.' });
    }
  });

  app.post('/api/admin/resolve-reset', async (req, res) => {
    const { adminId, requestId, newPassword } = req.body;

    if (!adminId) return res.status(401).json({ error: 'Non autorisé' });

    try {
      const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(adminId) as any;
      if (!admin || !admin.is_admin) {
        return res.status(403).json({ error: 'Accès refusé' });
      }

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

      // Re-hash the email/phone if they are currently in plaintext (which they would be if a ticket is open)
      // We check if they look like bcrypt hashes (start with $2a$ or $2b$)
      let newEmail = user.email;
      let newPhone = user.phone;

      if (user.email && !user.email.startsWith('$2')) {
        newEmail = bcrypt.hashSync(user.email, salt);
      }
      if (user.phone && !user.phone.startsWith('$2')) {
        newPhone = bcrypt.hashSync(user.phone, salt);
      }

      db.prepare('UPDATE users SET password_hash = ?, email = ?, phone = ? WHERE id = ?').run(passwordHash, newEmail, newPhone, request.user_id);
      db.prepare('UPDATE password_reset_requests SET status = ? WHERE id = ?').run('resolved', requestId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Resolve reset error:', error);
      res.status(500).json({ error: 'Erreur lors de la résolution de la demande.' });
    }
  });

  app.get('/api/leaderboard', (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, username, display_name, points, total_earned, trip_count, streak, longest_trip_km, total_distance_km
        FROM users
        ORDER BY points DESC
        LIMIT 10
      `).all();
      res.json(users);
    } catch (error) {
      console.error('Leaderboard error:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération du classement.' });
    }
  });

  app.post('/api/game/submit', (req, res) => {
    const { userId, score, distanceKm, crossings } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const now = Date.now();
      
      // Update user stats
      const newPoints = user.points + score; // Accumulate points? Or replace if higher? Assuming accumulate for now based on "totalEarned" vs "points"
      // Wait, usually "points" is current score/currency, "totalEarned" is lifetime.
      // Let's assume "points" is current balance.
      
      const newTotalEarned = user.total_earned + score;
      const newTripCount = user.trip_count + 1;
      const newTotalDistance = user.total_distance_km + distanceKm;
      const newLongestTrip = Math.max(user.longest_trip_km, distanceKm);
      const newMaxCrossings = Math.max(user.max_crossings_in_trip, crossings);

      db.prepare(`
        UPDATE users 
        SET points = ?, total_earned = ?, trip_count = ?, total_distance_km = ?, longest_trip_km = ?, max_crossings_in_trip = ?
        WHERE id = ?
      `).run(newPoints, newTotalEarned, newTripCount, newTotalDistance, newLongestTrip, newMaxCrossings, userId);

      // Record session
      db.prepare(`
        INSERT INTO game_sessions (user_id, score, distance_km, crossings, ended_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, score, distanceKm, crossings, now);

      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      
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
        isAdmin: updatedUser.is_admin === 1
      });
    } catch (error) {
      console.error('Submit game error:', error);
      res.status(500).json({ error: 'Erreur lors de la sauvegarde de la partie.' });
    }
  });

  app.get('/api/history', (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

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
    } catch (error) {
      console.error('History error:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique.' });
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
