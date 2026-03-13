import type { User } from '../types/models';
import { AchievementEngine } from './AchievementEngine';
import { db } from '../db/database';

export class AuthService {
  static getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  static setToken(token: string) {
    localStorage.setItem('auth_token', token);
  }

  static clearToken() {
    localStorage.removeItem('auth_token');
  }

  static getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
 }

  static async syncTripsFromServer(): Promise<void> {
    try {
      const response = await fetch('/api/game/history', { headers: this.getAuthHeaders() });
      if (response.ok) {
        const trips = await response.json();
        await db.trips.clear(); // Clear local cache
        await db.trips.bulkAdd(trips); // Populate with server truth
      }
    } catch (e) {
      console.error('Failed to sync trips', e);
    }
  }

  /**
   * Register a new user
   */
  static async signup(username: string, displayName: string, password: string, recoveryPhrase?: string, email?: string, phone?: string): Promise<User> {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, password, recoveryPhrase, email, phone }),
    });

    if (!response.ok) {
      let errorMessage = `Erreur ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (e) {
        console.error('Failed to parse error JSON', e);
      }
      throw new Error(errorMessage);
    }

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('Réponse serveur invalide');
    }
    
    if (data.token) this.setToken(data.token);
    if (data.user) {
      await AchievementEngine.syncFromServer(data.user);
      await this.syncTripsFromServer();
    }
    return data.user;
  }

  /**
   * Login an existing user
   */
  static async login(username: string, password: string): Promise<User> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      let errorMessage = `Erreur ${response.status}`;

      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (e) {
        console.error('Failed to parse error JSON', e);
      }

      throw new Error(errorMessage);
    }

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('Réponse serveur invalide');
    }

    if (data.token) this.setToken(data.token);
    if (data.user) {
      await AchievementEngine.syncFromServer(data.user);
      await this.syncTripsFromServer();
    }
    return data.user;
  }

  /**
   * Reset user password using recovery phrase
   */
  static async resetPassword(username: string, recoveryPhrase: string, newPassword: string): Promise<void> {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, recoveryPhrase, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la réinitialisation');
    }
  }

  /**
   * Request a password reset via admin ticket
   */
  static async requestReset(username: string, contactMethod: string): Promise<void> {
    const response = await fetch('/api/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, contactMethod }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la demande');
    }
  }

  /**
   * Get all pending password reset requests (Admin only)
   */
  static async getResetRequests(): Promise<any[]> {
    const response = await fetch(`/api/admin/reset-requests`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des demandes');
    }
    return response.json();
  }

  /**
   * Resolve a password reset request (Admin only)
   */
  static async resolveResetRequest(requestId: number, newPassword: string): Promise<void> {
    const response = await fetch('/api/admin/resolve-reset', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ requestId, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la résolution');
    }
  }

  static async updateProfile(data: Partial<User>): Promise<User> {
    const response = await fetch('/api/users/me', {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let errorMessage = `Erreur ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (e) {
        console.error('Failed to parse error JSON', e);
      }
      throw new Error(errorMessage);
    }

    const text = await response.text();
    let user;
    try {
      user = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('Réponse serveur invalide');
    }
    
    await AchievementEngine.syncFromServer(user);
    await this.syncTripsFromServer();
    return user;
  }

  static async getMe(): Promise<User> {
    const response = await fetch('/api/users/me', {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la récupération du profil');
    }

    const data = await response.json();
    // API sometimes wraps the user under a `user` key (server returns { user, achievements, recentTrips })
    const user = data?.user ?? data;
    await AchievementEngine.syncFromServer(user);
    await this.syncTripsFromServer();
    return user;
  }
}
