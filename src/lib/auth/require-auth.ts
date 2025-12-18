/**
 * Authentication utilities for API routes
 */

import { auth } from '@/auth';
import type { AuthSession } from '../types/api.types';

/**
 * Require authentication for an API route
 * Returns the session or throws a Response with 401
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await auth();

  if (!session?.user?.email) {
    throw Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return session as AuthSession;
}

/**
 * Require admin role for an API route
 * Returns the session or throws a Response with 401/403
 */
export async function requireAdmin(sql: any): Promise<AuthSession> {
  const session = await requireAuth();

  const adminRows = await sql`
    SELECT role FROM users WHERE email = ${session.user.email} LIMIT 1
  `;

  if (adminRows.length === 0 || adminRows[0].role !== 'admin') {
    throw Response.json({ error: 'Access denied' }, { status: 403 });
  }

  return session;
}

/**
 * Get current user from database
 * Returns the user or throws a Response with 401/404
 */
export async function getCurrentUser(sql: any, session?: AuthSession) {
  const authSession = session ?? (await requireAuth());

  const userRows = await sql`
    SELECT id, email, display_name, role, preferred_locale, is_premium, plan, has_seen_welcome
    FROM users
    WHERE email = ${authSession.user.email}
    LIMIT 1
  `;

  if (userRows.length === 0) {
    throw Response.json({ error: 'User not found' }, { status: 404 });
  }

  return userRows[0];
}

