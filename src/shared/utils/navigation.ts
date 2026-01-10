/**
 * Safe navigation utilities
 * Provides consistent navigation methods across the app
 * Replaces direct window.location usage with React Router navigation
 */

import type { NavigateFunction } from 'react-router';

/**
 * Navigate to a path using React Router (SPA navigation)
 * Preferred over window.location.href as it maintains app state
 * 
 * @param navigate - useNavigate() hook result
 * @param path - Target path
 * @param options - Navigation options
 */
export function navigateTo(
  navigate: NavigateFunction,
  path: string,
  options?: { replace?: boolean; state?: any }
) {
  navigate(path, options);
}

/**
 * Navigate and replace current history entry
 * Useful for redirects where you don't want back button to return
 */
export function redirectTo(navigate: NavigateFunction, path: string) {
  navigate(path, { replace: true });
}

/**
 * Hard reload navigation (full page reload)
 * Only use when absolutely necessary (e.g., after logout)
 * 
 * @param path - Target path
 */
export function hardNavigate(path: string) {
  window.location.href = path;
}

/**
 * Check if a path requires authentication
 */
export function isProtectedRoute(path: string): boolean {
  const publicRoutes = [
    '/',
    '/account/signin',
    '/account/signup',
    '/account/forgot-password',
    '/account/reset-password',
    '/privacy',
    '/pricing',
  ];
  
  return !publicRoutes.some(route => path.startsWith(route));
}

/**
 * Check if a path requires specific roles
 */
export function getRequiredRoles(path: string): string[] | null {
  if (path.startsWith('/admin')) {
    return ['admin'];
  }
  
  if (path.startsWith('/teacher')) {
    return ['teacher', 'admin'];
  }
  
  // Most routes just require authentication, not specific roles
  return null;
}

/**
 * Get redirect path based on user role
 */
export function getDefaultRedirectForRole(role?: string | null): string {
  switch (role) {
    case 'admin':
      return '/admin/users';
    case 'teacher':
      return '/teacher';
    case 'user':
    default:
      return '/dashboard';
  }
}
