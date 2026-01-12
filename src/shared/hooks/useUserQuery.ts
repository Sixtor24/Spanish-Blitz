import { useQuery } from '@tanstack/react-query';
import { api } from '@/config/api';
import type { DbUser } from '@/types/api.types';

export function useUserQuery() {
  return useQuery<DbUser>({
    queryKey: ['user', 'current'],
    queryFn: () => api.users.current(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useStatsQuery() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.stats.get(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useDecksQuery(params?: { search?: string; filter?: 'all' | 'owned' | 'assigned' | 'public' }) {
  return useQuery({
    queryKey: ['decks', params],
    queryFn: () => api.decks.list(params),
    staleTime: 1000 * 30, // 30 seconds
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useClassroomsQuery() {
  return useQuery({
    queryKey: ['classrooms'],
    queryFn: () => api.classrooms.list(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
