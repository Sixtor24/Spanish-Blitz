import { useEffect, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

/**
 * Higher-Order Component for route protection
 * Provides consistent authentication and authorization across the app
 * 
 * @param Component - The component to protect
 * @param options - Configuration options
 * @param options.roles - Array of allowed roles (optional)
 * @param options.redirectTo - Custom redirect path (default: '/account/signin')
 * @param options.requireAuth - Whether authentication is required (default: true)
 * 
 * @example
 * // Protect a page that requires authentication
 * export default withAuth(DashboardPage);
 * 
 * @example
 * // Protect a page that requires specific roles
 * export default withAuth(TeacherPanelPage, { roles: ['teacher', 'admin'] });
 * 
 * @example
 * // Protect with custom redirect
 * export default withAuth(ProfilePage, { redirectTo: '/dashboard' });
 */

interface WithAuthOptions {
  roles?: string[];
  redirectTo?: string;
  requireAuth?: boolean;
}

export function withAuth<P extends object>(
  Component: ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const {
    roles = [],
    redirectTo = '/account/signin',
    requireAuth = true,
  } = options;

  return function AuthenticatedComponent(props: P) {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
      // Wait for auth state to load
      if (loading) return;

      // Check if authentication is required
      if (requireAuth && !user) {
        console.warn('[withAuth] User not authenticated, redirecting to:', redirectTo);
        navigate(redirectTo, { replace: true });
        return;
      }

      // Check role-based authorization
      if (user && roles.length > 0) {
        const userRole = user.role || 'user';
        const hasRequiredRole = roles.includes(userRole);

        if (!hasRequiredRole) {
          console.warn(
            `[withAuth] User role "${userRole}" not authorized. Required roles:`,
            roles
          );
          // Redirect based on user role
          const fallbackRedirect = userRole === 'teacher' || userRole === 'admin' 
            ? '/teacher' 
            : '/dashboard';
          navigate(fallbackRedirect, { replace: true });
        }
      }
    }, [user, loading, navigate]);

    // Show loading state while checking auth
    if (loading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    // Don't render if not authenticated
    if (requireAuth && !user) {
      return null;
    }

    // Don't render if role check fails
    if (user && roles.length > 0) {
      const userRole = user.role || 'user';
      if (!roles.includes(userRole)) {
        return null;
      }
    }

    // Render the protected component
    return <Component {...props} />;
  };
}

/**
 * Convenience wrapper for teacher-only pages
 */
export function withTeacherAuth<P extends object>(Component: ComponentType<P>) {
  return withAuth(Component, { roles: ['teacher', 'admin'] });
}

/**
 * Convenience wrapper for admin-only pages
 */
export function withAdminAuth<P extends object>(Component: ComponentType<P>) {
  return withAuth(Component, { roles: ['admin'] });
}

/**
 * Convenience wrapper for student-only pages
 */
export function withStudentAuth<P extends object>(Component: ComponentType<P>) {
  return withAuth(Component, { roles: ['user'] });
}
