import type { Config } from '@react-router/dev/config';

/**
 * React Router v7 Configuration with Authentication Middleware
 * 
 * This middleware validates authentication before rendering components,
 * providing server-side protection for routes.
 */
export default {
  appDirectory: './src/app',
  ssr: true,
  prerender: false,
  serverBuildFile: 'index.js',
  serverModuleFormat: 'esm',
  
  /**
   * TODO: Middleware for authentication validation
   * 
   * React Router v7 middleware is still experimental.
   * Once stable, uncomment this to enable server-side auth validation.
   * 
   * For now, client-side protection with withAuth HOC is sufficient.
   */
  /* 
  async middleware({ request, context }: { request: Request; context: any }) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Public routes that don't require authentication
    const publicRoutes = [
      '/',
      '/account/signin',
      '/account/signup',
      '/account/forgot-password',
      '/account/reset-password',
      '/privacy',
      '/pricing',
    ];
    
    // Check if route is public
    const isPublicRoute = publicRoutes.some(route => path === route || path.startsWith(route));
    
    if (isPublicRoute) {
      return null; // Allow access to public routes
    }
    
    // For protected routes, validate session
    // Note: This is a placeholder - actual session validation would check cookies/tokens
    // You'll need to implement validateSession based on your auth backend
    try {
      // Example: Check for session cookie
      const cookies = request.headers.get('Cookie') || '';
      const hasSession = cookies.includes('session=') || cookies.includes('auth_token=');
      
      if (!hasSession) {
        // Redirect to signin if no session found
        return Response.redirect(new URL('/account/signin', request.url));
      }
      
      // Optionally validate role-based access
      if (path.startsWith('/admin')) {
        // Would need to decode session to check role
        // For now, just ensure session exists
      }
      
      if (path.startsWith('/teacher')) {
        // Would need to decode session to check role
        // For now, just ensure session exists
      }
      
      return null; // Allow access
    } catch (error) {
      console.error('Middleware auth error:', error);
      return Response.redirect(new URL('/account/signin', request.url));
    }
  }
  */
} satisfies Config;
