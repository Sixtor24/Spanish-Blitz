import { useAuth } from '@/lib/auth-context';
import type { DbUser } from '@/types/api.types';

interface UseUserReturn {
  user: DbUser | null;
  data: DbUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const useUser = (): UseUserReturn => {
  const { user, loading, refetch } = useAuth();

  return {
    user: user as DbUser | null,
    data: user as DbUser | null,
    loading,
    refetch,
  };
};

export { useUser };
export default useUser;
