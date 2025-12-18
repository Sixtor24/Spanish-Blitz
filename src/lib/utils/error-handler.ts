/**
 * Centralized error handling for API routes
 */

/**
 * Handle API errors consistently
 */
export function handleApiError(error: unknown, context: string): Response {
  console.error(`Error in ${context}:`, error);

  // If error is already a Response, return it
  if (error instanceof Response) {
    return error;
  }

  // Handle known error types
  if (error instanceof Error) {
    return Response.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }

  // Unknown error
  return Response.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

/**
 * Wrap an API handler with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  context: string
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, context);
    }
  }) as T;
}

