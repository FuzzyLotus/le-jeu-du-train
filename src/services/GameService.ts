import type { User } from '../types/models';
import { AuthService } from './AuthService';
import { AchievementEngine } from './AchievementEngine';

export class GameService {
  static async submitScore(distanceKm: number, crossings: number, isFailed: boolean = false, tripCount: number = 1): Promise<User> {
    const response = await fetch('/api/game/submit', {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
      body: JSON.stringify({ score: crossings, distanceKm, crossings, isFailed, tripCount }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la sauvegarde de la partie');
    }

    const user = await response.json();
    await AchievementEngine.syncFromServer(user);
    return user;
  }
}
