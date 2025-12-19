/**
 * Custom hook for using the API client
 * Provides easy access to all API endpoints with proper typing
 */
import { api } from '@/config/api';

export function useApi() {
  return api;
}

export default useApi;

