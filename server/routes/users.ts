import express from 'express';
import { db } from '../db.js';
import { requireAuth, safeJsonParse } from '../utils.js';

const router = express.Router();

// GET /api/users/me
router.get('/me', requireAuth, (req: any, res: any) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const achievementIds = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
      .all(user.id).map((a: any) => a.achievement_id);

    const recentTrips = db.prepare(`
      SELECT * FROM game_sessions WHERE user_id = ? ORDER BY ended_at DESC LIMIT 10
    `).all(user.id);

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
        isAdmin: user.is_admin === 1,
        preferences: safeJsonParse(user.preferences),
        homeLocation: safeJsonParse(user.home_location),
      },
      achievements: achievementIds,
      recentTrips
    });
  } catch (err: any) {
    console.error('Get me error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/users/me
router.put('/me', requireAuth, (req: any, res: any) => {
  try {
    const { displayName, preferences, homeLocation } = req.body;

    db.prepare(`
      UPDATE users 
      SET display_name = COALESCE(?, display_name),
          preferences = COALESCE(?, preferences),
          home_location = COALESCE(?, home_location)
      WHERE id = ?
    `).run(
      displayName || null,
      preferences ? JSON.stringify(preferences) : null,
      homeLocation ? JSON.stringify(homeLocation) : null,
      req.user.id
    );

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
    const achievementIds = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
      .all(user.id).map((a: any) => a.achievement_id);

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
    console.error('Update profile error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
  }
});

// GET /api/users/:id
router.get('/:id', requireAuth, (req: any, res: any) => {
  try {
    const targetId = parseInt(req.params.id);
    if (isNaN(targetId)) return res.status(400).json({ error: 'ID invalide' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const achievementIds = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
      .all(user.id).map((a: any) => a.achievement_id);

    const recentTrips = db.prepare(`
      SELECT * FROM game_sessions WHERE user_id = ? ORDER BY ended_at DESC LIMIT 10
    `).all(user.id);

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
        isAdmin: user.is_admin === 1,
      },
      achievements: achievementIds,
      recentTrips
    });
  } catch (err: any) {
    console.error('Get user error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;