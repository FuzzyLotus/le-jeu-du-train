import { db } from '../db/database';
import type { User, Trip } from '../types/models';
import { useToastStore } from '../store/useToastStore';

export const ACHIEVEMENTS = [
  // Common (1-15)
  { id: '1', title: 'Premier Passage 🚂', description: 'Gagne 1 point.', rarity: 'Common', condition: (u: User, trips: Trip[]) => u.totalEarned >= 1 },
  { id: '2', title: 'Dix Points ⭐', description: 'Atteins 10 points.', rarity: 'Common', condition: (u: User, trips: Trip[]) => u.points >= 10 },
  { id: '3', title: 'Cinquante! 🏆', description: 'Atteins 50 points.', rarity: 'Common', condition: (u: User, trips: Trip[]) => u.points >= 50 },
  { id: '4', title: 'Voyageur 🗺️', description: '5 trajets.', rarity: 'Common', condition: (u: User, trips: Trip[]) => u.tripCount >= 5 },
  { id: '5', title: 'Sans Faute 🔥', description: '5 streak.', rarity: 'Common', condition: (u: User, trips: Trip[]) => u.streak >= 5 },
  { id: '6', title: 'Promeneur 🚶', description: '50 km total.', rarity: 'Common', condition: (u: User, trips: Trip[]) => (u.totalDistanceKm || 0) >= 50 },
  { id: '7', title: 'Le Touriste 🎒', description: 'Échoue dès le tout premier passage.', rarity: 'Common', condition: (u: User, trips: Trip[]) => u.hasLost && u.tripCount === 1 },
  { id: '8', title: 'Oups, encore raté 💥', description: 'Échoue deux trajets d\'affilée.', rarity: 'Common', condition: (u: User, trips: Trip[]) => {
    const sorted = [...trips].sort((a, b) => b.date - a.date);
    return sorted.length >= 2 && !sorted[0].success && !sorted[1].success;
  }},
  { id: '9', title: 'Lève-tôt 🌅', description: 'Passe avant 6h00 du matin.', rarity: 'Common', condition: (u: User, trips: Trip[]) => {
    const h = new Date().getHours();
    return h >= 4 && h < 6;
  }},
  { id: '10', title: 'Oiseau de nuit 🦉', description: 'Passe après minuit.', rarity: 'Common', condition: (u: User, trips: Trip[]) => {
    const h = new Date().getHours();
    return h >= 0 && h < 4;
  }},
  { id: '11', title: 'Distrait 🧠', description: 'Échoue, puis réussis immédiatement après.', rarity: 'Common', condition: (u: User, trips: Trip[]) => {
    const sorted = [...trips].sort((a, b) => b.date - a.date);
    return sorted.length >= 2 && sorted[0].success && !sorted[1].success;
  }},
  { id: '12', title: 'Le Sceptique 🤨', description: 'Ajoute un trajet avec 0 passage.', rarity: 'Common', condition: (u: User, trips: Trip[]) => trips.some(t => t.crossingsCount === 0) },
  { id: '13', title: 'Chance du débutant 🍀', description: 'Réussis dès le premier essai.', rarity: 'Common', condition: (u: User, trips: Trip[]) => trips.length === 1 && trips[0].success },
  { id: '14', title: 'Le Procrastinateur ⏳', description: 'Joue après 1 semaine d\'inactivité.', rarity: 'Common', condition: (u: User, trips: Trip[]) => {
    const sorted = [...trips].sort((a, b) => b.date - a.date);
    if (sorted.length < 2) return false;
    return (sorted[0].date - sorted[1].date) > 7 * 24 * 60 * 60 * 1000;
  }},
  { id: '15', title: 'Le Maladroit 🦶', description: 'Échoue un trajet avec seulement 1 passage.', rarity: 'Common', condition: (u: User, trips: Trip[]) => trips.some(t => !t.success && t.crossingsCount === 1) },

  // Uncommon (16-30)
  { id: '16', title: 'Le Nouveau 🐣', description: 'Crée un compte.', rarity: 'Uncommon', condition: (u: User, trips: Trip[]) => !!u.id },
  { id: '17', title: 'Premier Ami 🤝', description: 'Ajoute 1 ami.', rarity: 'Uncommon', condition: async (u: User, trips: Trip[]) => {
    const count = await db.friendRequests.where({ status: 'accepted' }).and(r => r.senderId === u.id || r.receiverId === u.id!).count();
    return count >= 1;
  }},
  { id: '18', title: 'Apprentissage Rapide ⚡', description: 'Gagne 10 pts dans la première heure.', rarity: 'Uncommon', condition: (u: User, trips: Trip[]) => {
    if (u.totalEarned < 10) return false;
    const firstTrip = [...trips].sort((a, b) => a.date - b.date)[0];
    if (!firstTrip) return false;
    const tenthPointTrip = [...trips].sort((a, b) => a.date - b.date).reduce((acc, t) => {
      if (acc.pts >= 10) return acc;
      return { pts: acc.pts + (t.success ? t.crossingsCount : 0), time: t.date };
    }, { pts: 0, time: firstTrip.date });
    return tenthPointTrip.pts >= 10 && (tenthPointTrip.time - firstTrip.date) <= 60 * 60 * 1000;
  }},
  { id: '19', title: 'Centurion 👑', description: 'Atteins 100 points.', rarity: 'Uncommon', condition: (u: User, trips: Trip[]) => u.points >= 100 },
  { id: '20', title: 'Quart de Mille 🏁', description: 'Atteins 250 points.', rarity: 'Uncommon', condition: (u: User, trips: Trip[]) => u.points >= 250 },
  { id: '21', title: 'Globe-Trotter 🌍', description: '20 trajets.', rarity: 'Uncommon', condition: (u: User, trips: Trip[]) => u.tripCount >= 20 },
  { id: '22', title: 'Chauffeur 🧢', description: '50 trajets.', rarity: 'Uncommon', condition: (u: User, trips: Trip[]) => u.tripCount >= 50 },
  { id: '23', title: 'Sérieux 🎯', description: '10 streak.', rarity: 'Uncommon', condition: (u: User, trips: Trip[]) => u.streak >= 10 },
  { id: '24', title: 'Imbattable 🚀', description: '25 streak.', rarity: 'Uncommon', condition: (u: User, trips: Trip[]) => u.streak >= 25 },
  { id: '25', title: 'Aventurier 🤠', description: '250 km total.', rarity: 'Uncommon', condition: (u: User, trips: Trip[]) => (u.totalDistanceKm || 0) >= 250 },
  { id: '26', title: 'Guerrier du Week-end 🏖️', description: '5 trajets le samedi ou dimanche.', rarity: 'Uncommon', condition: async (u: User, trips: Trip[]) => {
    const weekendTrips = trips.filter(t => {
      const d = new Date(t.date);
      return d.getDay() === 0 || d.getDay() === 6;
    });
    return weekendTrips.length >= 5;
  }},
  { id: '27', title: 'Pause Déjeuner 🥪', description: '5 trajets pendant le déjeuner.', rarity: 'Uncommon', condition: async (u: User, trips: Trip[]) => {
    const lunchTrips = trips.filter(t => {
      const d = new Date(t.date);
      return d.getHours() >= 12 && d.getHours() < 14;
    });
    return lunchTrips.length >= 5;
  }},
  { id: '28', title: 'Heure de Pointe 🚗', description: '5 trajets à 17h.', rarity: 'Uncommon', condition: async (u: User, trips: Trip[]) => {
    const rushTrips = trips.filter(t => {
      const d = new Date(t.date);
      return d.getHours() === 17;
    });
    return rushTrips.length >= 5;
  }},
  { id: '29', title: 'Régulier 🗓️', description: '3 trajets en 1 seule journée.', rarity: 'Uncommon', condition: async (u: User, trips: Trip[]) => {
    const tripsByDay = trips.reduce((acc, t) => {
      const day = new Date(t.date).toDateString();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.values(tripsByDay).some(count => count >= 3);
  }},
  { id: '30', title: 'Mondain 👯', description: 'Ajoute 3 amis.', rarity: 'Uncommon', condition: async (u: User, trips: Trip[]) => {
    const count = await db.friendRequests.where({ status: 'accepted' }).and(r => r.senderId === u.id || r.receiverId === u.id!).count();
    return count >= 3;
  }},

  // Rare (31-40)
  { id: '31', title: 'Le Minimaliste 🤏', description: '1 trajet, exactement 1 passage.', rarity: 'Rare', condition: (u: User, trips: Trip[]) => trips.some(t => t.crossingsCount === 1) },
  { id: '32', title: 'Le Planificateur 🗺️', description: '5 trajets > 10km chacun.', rarity: 'Rare', condition: (u: User, trips: Trip[]) => trips.filter(t => t.distanceKm > 10).length >= 5 },
  { id: '33', title: 'Le Manuel ✍️', description: '5 trajets < 1km chacun.', rarity: 'Rare', condition: (u: User, trips: Trip[]) => trips.filter(t => t.distanceKm > 0 && t.distanceKm < 1).length >= 5 },
  { id: '34', title: 'Main Sûre ✋', description: '10 passages d\'affilée.', rarity: 'Rare', condition: (u: User, trips: Trip[]) => u.streak >= 10 },
  { id: '35', title: 'Le Navetteur 🚇', description: '10 trajets avec 2 passages ou plus.', rarity: 'Rare', condition: (u: User, trips: Trip[]) => trips.filter(t => t.crossingsCount >= 2).length >= 10 },
  { id: '36', title: 'Matinal ☀️', description: '10 trajets avant 8h du matin.', rarity: 'Rare', condition: async (u: User, trips: Trip[]) => {
    const earlyTrips = trips.filter(t => {
      const d = new Date(t.date);
      return d.getHours() < 8;
    });
    return earlyTrips.length >= 10;
  }},
  { id: '37', title: 'Alpiniste 🧗', description: 'Passe au-dessus de 1000m d\'altitude.', rarity: 'Rare', condition: async (u: User, trips: Trip[]) => {
    return trips.some(t => (t.maxElevation || 0) >= 1000);
  }},
  { id: '38', title: 'Longue Distance 🚚', description: 'Termine un trajet de plus de 100km.', rarity: 'Rare', condition: (u: User, trips: Trip[]) => trips.some(t => t.distanceKm >= 100) },
  { id: '39', title: 'Habitant des Tunnels 🚇', description: 'Passe dans un tunnel.', rarity: 'Rare', condition: async (u: User, trips: Trip[]) => {
    return trips.some(t => t.hasTunnel);
  }},
  { id: '40', title: 'Traverseur de Rivières 🌊', description: 'Passe sur un pont.', rarity: 'Rare', condition: async (u: User, trips: Trip[]) => {
    return trips.some(t => t.hasBridge);
  }},

  // Very Rare (41-48)
  { id: '41', title: 'Le Revenant 🦅', description: 'Récupère 50 pts après une défaite.', rarity: 'Very Rare', condition: (u: User, trips: Trip[]) => u.hasLost && u.points >= 50 },
  { id: '42', title: 'Flambeur 🎲', description: '10 passages ou plus en 1 seul trajet.', rarity: 'Very Rare', condition: (u: User, trips: Trip[]) => u.maxCrossingsInTrip >= 10 },
  { id: '43', title: 'Casse-cou 😈', description: '5 trajets avec 5 passages ou plus.', rarity: 'Very Rare', condition: (u: User, trips: Trip[]) => trips.filter(t => t.crossingsCount >= 5).length >= 5 },
  { id: '44', title: 'Survivant 🛡️', description: '200 pts sans aucune défaite.', rarity: 'Very Rare', condition: (u: User, trips: Trip[]) => u.points >= 200 && !u.hasLost },
  { id: '45', title: 'Le Joueur 🃏', description: 'Gagne avec une série de 50+.', rarity: 'Very Rare', condition: (u: User, trips: Trip[]) => u.streak >= 50 },
  { id: '46', title: 'Marathonien 🏃‍♂️', description: '50 km en 1 seul trajet.', rarity: 'Very Rare', condition: (u: User, trips: Trip[]) => (u.longestTripKm || 0) >= 50 },
  { id: '47', title: 'Concentré 🧘', description: '20 passages en un seul trajet.', rarity: 'Very Rare', condition: (u: User, trips: Trip[]) => u.maxCrossingsInTrip >= 20 },
  { id: '48', title: 'Le Perfectionniste 💎', description: '10 trajets, 100% de réussite.', rarity: 'Very Rare', condition: (u: User, trips: Trip[]) => u.tripCount >= 10 && !u.hasLost },

  // Legendary (49-50)
  { id: '49', title: 'Dieu du Rail ⚡', description: 'Atteins 1000 points.', rarity: 'Legendary', condition: (u: User, trips: Trip[]) => u.points >= 1000 },
  { id: '50', title: 'Routier Extrême 🚛', description: '250 trajets.', rarity: 'Legendary', condition: (u: User, trips: Trip[]) => u.tripCount >= 250 },
  
  // Secret (51-60)
  { id: '51', title: 'Le Fantôme 👻', description: 'Joue entre 3h00 et 3h59 du matin.', rarity: 'Secret', condition: (u: User, trips: Trip[]) => {
    const h = new Date().getHours();
    return h === 3;
  }},
  { id: '52', title: 'Dévoué 📱', description: 'Joue 7 jours d\'affilée.', rarity: 'Secret', condition: (u: User, trips: Trip[]) => {
    const days = [...new Set(trips.map(t => new Date(t.date).toDateString()))].map(d => new Date(d).getTime()).sort((a,b) => a-b);
    let maxStreak = 0;
    let currentStreak = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i] - days[i-1] <= 24 * 60 * 60 * 1000 * 1.5) { // 1.5 days to account for DST/time changes
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      maxStreak = Math.max(maxStreak, currentStreak);
    }
    return maxStreak >= 7;
  }},
  { id: '53', title: 'Malchanceux 🌧️', description: 'Perds 3 fois dans la même journée.', rarity: 'Secret', condition: (u: User, trips: Trip[]) => {
    const lossesByDay = trips.filter(t => !t.success).reduce((acc, t) => {
      const day = new Date(t.date).toDateString();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.values(lossesByDay).some(count => count >= 3);
  }},
  { id: '54', title: 'Saute-Frontière 🛂', description: 'Traverse une frontière nationale.', rarity: 'Secret', condition: async (u: User, trips: Trip[]) => {
    return trips.some(t => t.startCountry && t.endCountry && t.startCountry !== t.endCountry);
  }},
  { id: '55', title: 'Explorateur 🧭', description: '10 pays différents.', rarity: 'Secret', condition: (u: User, trips: Trip[]) => {
    const countries = new Set(trips.flatMap(t => [t.startCountry, t.endCountry]).filter(Boolean));
    return countries.size >= 10;
  }},
  { id: '56', title: 'Saute-Île 🏝️', description: 'Passe sur une île.', rarity: 'Secret', condition: async (u: User, trips: Trip[]) => {
    return trips.some(t => t.startIsland || t.endIsland);
  }},
  { id: '57', title: 'Plongeur 🕳️', description: 'Passe sous le niveau de la mer.', rarity: 'Secret', condition: async (u: User, trips: Trip[]) => {
    return trips.some(t => (t.minElevation || 0) < 0);
  }},
  { id: '58', title: 'Grand Traverseur 🏗️', description: 'Passe sur un pont de plus de 1km.', rarity: 'Secret', condition: async (u: User, trips: Trip[]) => {
    return trips.some(t => (t.maxBridgeLength || 0) > 1);
  }},
  { id: '59', title: 'L\'Habitant 🏡', description: '50 trajets dans le même pays.', rarity: 'Secret', condition: (u: User, trips: Trip[]) => {
    const countryCounts = trips.reduce((acc, t) => {
      if (t.startCountry) acc[t.startCountry] = (acc[t.startCountry] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.values(countryCounts).some(c => c >= 50);
  }},
  { id: '60', title: 'Maître de Tout 🏆', description: 'Déverrouille les 59 autres succès.', rarity: 'Secret', condition: (u: User, trips: Trip[]) => (u.achievements?.length || 0) >= 59 },
];

export class AchievementEngine {
  /**
   * Checks if the user has unlocked any new achievements based on their current state.
   */
  static async cleanupInvalidAchievements(userId: number) {
    const unlocked = await db.achievements.where('userId').equals(userId).toArray();
    const validAchievementIds = new Set(ACHIEVEMENTS.map(a => a.id));
    
    for (const ach of unlocked) {
      if (!validAchievementIds.has(ach.achievementId)) {
        await db.achievements.delete(ach.id!);
      }
    }
  }

  static async check(user: User) {
    if (!user.id) return;

    const unlocked = await db.achievements.where('userId').equals(user.id).toArray();
    const unlockedIds = new Set(unlocked.map(a => a.achievementId));
    const newlyUnlocked = [];

    const userTrips = await db.trips.where('userId').equals(user.id).toArray();

    for (const ach of ACHIEVEMENTS) {
      if (!unlockedIds.has(ach.id) && await ach.condition(user, userTrips)) {
        // Unlock new achievement
        await db.achievements.add({
          userId: user.id,
          achievementId: ach.id,
          unlockedAt: Date.now(),
        });
        newlyUnlocked.push(ach);
      }
    }

    if (newlyUnlocked.length === 1) {
      useToastStore.getState().addToast({
        title: 'Succès Déverrouillé!',
        message: newlyUnlocked[0].title,
        type: 'achievement',
      });
    } else if (newlyUnlocked.length > 1) {
      useToastStore.getState().addToast({
        title: 'Pluie de Succès! 🏆',
        message: `${newlyUnlocked.length} succès déverrouillés d'un coup!`,
        type: 'achievement',
      });
    }

    if (newlyUnlocked.length > 0) {
      try {
        const { AuthService } = await import('./AuthService');
        await fetch('/api/users/achievements', {
          method: 'POST',
          headers: { ...AuthService.getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            achievements: newlyUnlocked.map(a => ({ achievementId: a.id, unlockedAt: Date.now() }))
          })
        });
      } catch (e) {
        console.error('Failed to sync achievements', e);
      }
    }
  }

  static async syncFromServer(user: User) {
    if (!user.id || !user.achievements) return;
    
    const unlocked = await db.achievements.where('userId').equals(user.id).toArray();
    const unlockedIds = new Set(unlocked.map(a => a.achievementId));
    
    for (const achId of user.achievements) {
      if (!unlockedIds.has(achId)) {
        await db.achievements.add({
          userId: user.id,
          achievementId: achId,
          unlockedAt: Date.now(),
        });
      }
    }
  }
}
