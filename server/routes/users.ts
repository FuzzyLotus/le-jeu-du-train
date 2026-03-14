import express from 'express';
import { db } from '../db.js';
import { requireAuth, safeJsonParse } from '../utils.js';

const router = express.Router();

function sessionToTrip(session: any) {
  return {
    id: session.id,
    userId: session.user_id,
    routeName: 'Trajet',
    distanceKm: session.distance_km ?? 0,
    crossingsCount: session.crossings ?? 0,
    success: (session.score ?? 0) > 0,
    date: session.ended_at,
    hasBridge: session.has_bridge === 1,
    hasTunnel: session.has_tunnel === 1,
    maxElevation: session.max_elevation,
    minElevation: session.min_elevation,
    maxBridgeLength: session.max_bridge_length,
    startCountry: session.start_country,
    endCountry: session.end_country,
    startIsland: session.start_island,
    endIsland: session.end_island,
  };
}

// GET /api/users/me
router.get('/me', requireAuth, (req: any, res: any) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const achievementIds = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
      .all(user.id).map((a: any) => a.achievement_id);

    const sessions = db.prepare(`
      SELECT * FROM game_sessions WHERE user_id = ? ORDER BY ended_at DESC LIMIT 10
    `).all(user.id) as any[];

    const pointsRank = 1 + (db.prepare('SELECT COUNT(*) as n FROM users WHERE points > ?').get(user.points ?? 0) as { n: number }).n;
    const tripsRank = 1 + (db.prepare('SELECT COUNT(*) as n FROM users WHERE trip_count > ?').get(user.trip_count ?? 0) as { n: number }).n;

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
        pointsRank,
        tripsRank,
      },
      achievements: achievementIds,
      recentTrips: sessions.map(sessionToTrip),
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

// POST /api/users/achievements — sync newly unlocked achievements (e.g. after a trip)
router.post('/achievements', requireAuth, (req: any, res: any) => {
  try {
    const { achievements } = req.body;
    if (!Array.isArray(achievements) || achievements.length === 0) {
      return res.status(400).json({ error: 'Tableau achievements requis.' });
    }
    const userId = req.user.id;
    const now = Date.now();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
      VALUES (?, ?, ?)
    `);
    for (const item of achievements) {
      const achievementId = item?.achievementId ?? item?.achievement_id;
      const unlockedAt = typeof item?.unlockedAt === 'number' ? item.unlockedAt : now;
      if (typeof achievementId === 'string' && achievementId.trim()) {
        insert.run(userId, achievementId.trim(), unlockedAt);
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('Sync achievements error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la synchronisation des succès.' });
  }
});

// GET /api/users/achievement-rarity — % of users who have each achievement (for profile display)
router.get('/achievement-rarity', requireAuth, (req: any, res: any) => {
  try {
    const totalRow = db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number };
    const totalUsers = totalRow?.n ?? 0;
    const rows = db.prepare(`
      SELECT achievement_id, COUNT(DISTINCT user_id) as c
      FROM user_achievements
      GROUP BY achievement_id
    `).all() as { achievement_id: string; c: number }[];
    const byAchievement: Record<string, number> = {};
    for (const r of rows) byAchievement[r.achievement_id] = r.c;
    res.json({ totalUsers, byAchievement });
  } catch (err: any) {
    console.error('Achievement rarity error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/users/:id
router.get('/:id', requireAuth, (req: any, res: any) => {
  try {
    const currentUserId = req.user.id;
    const targetId = parseInt(req.params.id);
    if (isNaN(targetId)) return res.status(400).json({ error: 'ID invalide' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const achievementIds = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
      .all(user.id).map((a: any) => a.achievement_id);

    const sessions = db.prepare(`
      SELECT * FROM game_sessions WHERE user_id = ? ORDER BY ended_at DESC LIMIT 10
    `).all(user.id) as any[];

    const fr = db.prepare(`
      SELECT status, sender_id, receiver_id FROM friend_requests
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at DESC LIMIT 1
    `).get(currentUserId, targetId, targetId, currentUserId) as any;
    let friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends' = 'none';
    if (fr) {
      if (fr.status === 'accepted') friendStatus = 'friends';
      else if (fr.sender_id === currentUserId && fr.receiver_id === targetId) friendStatus = 'pending_sent';
      else friendStatus = 'pending_received';
    }

    const pointsRank = 1 + (db.prepare('SELECT COUNT(*) as n FROM users WHERE points > ?').get(user.points ?? 0) as { n: number }).n;
    const tripsRank = 1 + (db.prepare('SELECT COUNT(*) as n FROM users WHERE trip_count > ?').get(user.trip_count ?? 0) as { n: number }).n;

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
        pointsRank,
        tripsRank,
      },
      achievements: achievementIds,
      recentTrips: sessions.map(sessionToTrip),
      friendStatus,
    });
  } catch (err: any) {
    console.error('Get user error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;