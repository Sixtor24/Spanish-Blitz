import { useEffect } from 'react';
import type { ReactNode } from 'react';
import useUser from '../hooks/useUser';

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data: user, loading } = useUser();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/account/signin';
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
