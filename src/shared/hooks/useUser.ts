import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession, type SessionData, type SessionUser } from '@auth/create/react';
import type { DbUser } from '@/lib/types/api.types';

const useUser = () => {
  const sessionResult = useSession() ?? { data: null, status: 'loading' as const };
  const session = sessionResult.data ?? null;
  const status = sessionResult.status ?? 'loading';

  const [user, setUser] = useState<SessionUser | DbUser>(session?.user ?? null);

  const fetchUser = useCallback(
    async (sessionData: SessionData, sessionStatus: typeof status) => {
      const baseUser = sessionData?.user ?? null;

      if (sessionStatus !== 'authenticated') return baseUser;

      try {
        const res = await fetch('/api/users/current');
        if (!res.ok) return baseUser;
        const data = (await res.json()) as DbUser;
        return data ?? baseUser;
      } catch {
        return baseUser;
      }
    },
    []
  );

  const refetchUser = useCallback(() => {
    if (status === 'authenticated') {
      fetchUser(session, status).then(setUser);
    } else {
      setUser(session?.user ?? null);
    }
  }, [fetchUser, session, status]);

  const loading = useMemo(
    () => status === 'loading' || (status === 'authenticated' && !user),
    [status, user],
  );

  useEffect(refetchUser, [refetchUser]);

  return {
    user,
    data: user,
    loading,
    refetch: refetchUser,
  } as const;
};

export { useUser };
export default useUser;