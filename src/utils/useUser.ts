import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '@auth/create/react';

type SessionUser = {
  id?: string;
  role?: string;
  [key: string]: unknown;
} | null;

type SessionData = {
  user?: SessionUser;
} | null;

const useUser = () => {
  const sessionResult = useSession() ?? { data: null, status: 'loading' as const };
  const session = (sessionResult as { data: SessionData }).data ?? null;
  const status = (sessionResult as { status: 'loading' | 'authenticated' | 'unauthenticated' }).status ?? 'loading';

  const [user, setUser] = useState<SessionUser>(session?.user ?? null);

  const fetchUser = useCallback(async (sessionData: SessionData) => sessionData?.user ?? null, []);

  const refetchUser = useCallback(() => {
    if (process.env.NEXT_PUBLIC_CREATE_ENV === 'PRODUCTION') {
      if (session?.user?.id) {
        fetchUser(session).then(setUser);
      } else {
        setUser(null);
      }
    } else {
      setUser(session?.user ?? null);
    }
  }, [fetchUser, session]);

  useEffect(refetchUser, [refetchUser]);

  const loading = useMemo(
    () => status === 'loading' || (status === 'authenticated' && !user),
    [status, user],
  );

  if (process.env.NEXT_PUBLIC_CREATE_ENV !== 'PRODUCTION') {
    return { user: session?.user ?? null, data: session?.user ?? null, loading, refetch: refetchUser } as const;
  }

  return { user, data: user, loading, refetch: refetchUser } as const;
};

export { useUser };

export default useUser;