import type { User } from '../types/models';

export class AuthService {
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
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de l\'inscription');
    }

    return response.json();
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
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la connexion');
    }

    return response.json();
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
  static async getResetRequests(adminId: number): Promise<any[]> {
    const response = await fetch(`/api/admin/reset-requests?adminId=${adminId}`);
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des demandes');
    }
    return response.json();
  }

  /**
   * Resolve a password reset request (Admin only)
   */
  static async resolveResetRequest(adminId: number, requestId: number, newPassword: string): Promise<void> {
    const response = await fetch('/api/admin/resolve-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, requestId, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la résolution');
    }
  }
}
