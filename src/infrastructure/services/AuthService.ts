/**
 * Auth Service Implementation
 * 
 * Provides authentication and authorization services for use cases.
 * Abstracts the auth context and API calls.
 */

import { api } from '../../config/api';
import type { IAuthService } from '../../domain/use-cases/classroom';

export class AuthService implements IAuthService {
  /**
   * Get the currently authenticated user
   * 
   * @throws Error if user is not authenticated
   */
  async getCurrentUser(): Promise<{ id: string; role: string; email: string }> {
    try {
      const user = await api.users.current();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      return {
        id: user.id,
        role: user.role || 'user',
        email: user.email,
      };
    } catch (error) {
      throw new Error('Failed to get current user: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Check if current user has a specific role
   */
  async hasRole(role: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return user.role === role;
    } catch {
      return false;
    }
  }

  /**
   * Check if current user has any of the specified roles
   */
  async hasAnyRole(roles: string[]): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return roles.includes(user.role);
    } catch {
      return false;
    }
  }
}
