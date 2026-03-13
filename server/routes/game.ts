import express from 'express';
import { db } from '../db.js';
import { requireAuth, gameSubmitLimiter, safeJsonParse } from '../utils.js';

const router = express.Router();

router.post('/submit', requireAuth, gameSubmitLimiter, (req: any, res: any) => {
  const { distanceKm, crossings, isFailed, tripCount = 1, hasBridge = false, hasTunnel = false, maxElevation = 0, minElevation = 0, maxBridgeLength = 0, startCountry, endCountry, startIsland, endIsland } = req.body;
  const userId = req.user.id;

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
            max_crossings_in_trip = MAX(max_crossings_in_trip, ?)
        WHERE id = ?
      `).run(calculatedScore, calculatedScore, calculatedScore > 0 ? crossings : 0, tripCount, distanceKm, distanceKm, avgCrossings, userId);
    }

    db.prepare(`
      INSERT INTO game_sessions (user_id, score, distance_km, crossings, ended_at, has_bridge, has_tunnel, max_elevation, min_elevation, max_bridge_length, start_country, end_country, start_island, end_island)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, calculatedScore, distanceKm, crossings, now, hasBridge ? 1 : 0, hasTunnel ? 1 : 0, maxElevation, minElevation, maxBridgeLength, startCountry, endCountry, startIsland, endIsland);

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

router.get('/history', requireAuth, (req: any, res: any) => {
  const userId = req.user.id;

  try {
    const sessions = db.prepare(`
      SELECT * FROM game_sessions 
      WHERE user_id = ? 
      ORDER BY ended_at DESC
    `).all(userId);
    
    const trips = sessions.map((session: any) => ({
      id: session.id,
      userId: session.user_id,
      routeName: 'Trajet',
      distanceKm: session.distance_km,
      crossingsCount: session.crossings,
      success: session.score > 0,
      date: session.ended_at,
      hasBridge: session.has_bridge === 1,
      hasTunnel: session.has_tunnel === 1,
      maxElevation: session.max_elevation,
      minElevation: session.min_elevation,
      maxBridgeLength: session.max_bridge_length,
      startCountry: session.start_country,
      endCountry: session.end_country,
      startIsland: session.start_island,
      endIsland: session.end_island
    }));

    res.json(trips);
  } catch (error: any) {
    console.error('History error:', error.message);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique.' });
  }
});

// Leaderboard route
router.get('/leaderboard', requireAuth, (req: any, res: any) => {
  try {
    const users = db.prepare(`
      SELECT id, username, display_name, points, total_earned, trip_count, 
             streak, longest_trip_km, total_distance_km, highest_score
      FROM users
      WHERE is_admin = 0
      ORDER BY points DESC
      LIMIT 100
    `).all();

    res.json(users);
  } catch (error: any) {
    console.error('Leaderboard error:', error.message);
    res.status(500).json({ error: 'Erreur lors de la récupération du classement.' });
  }
});

export default router;

