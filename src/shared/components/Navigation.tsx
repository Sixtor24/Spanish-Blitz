import { useState, memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Shield, GraduationCap, Users } from 'lucide-react';
import useUser from '@/shared/hooks/useUser';

type NavLink = {
  href: string;
  label: string;
};

function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: user } = useUser();

  // Memoize links calculation
  const links: NavLink[] = useMemo(() => {
    const baseLinks: NavLink[] = [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/profile', label: 'Profile' },
    ];

    // Plans link only for teachers and admins
    return user?.role === 'teacher' || user?.role === 'admin'
      ? [
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/pricing', label: 'Plans' },
          { href: '/profile', label: 'Profile' },
        ]
      : baseLinks;
  }, [user?.role]);

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to={user ? "/dashboard" : "/"} className="flex items-center">
              <img
                src="https://ucarecdn.com/df05b2e5-6ee7-4c41-b12b-d556708883a3/-/format/auto/"
                alt="The Spanish Blitz"
                className="h-10 w-auto"
              />
            </Link>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {user && user.role !== 'teacher' && user.role !== 'admin' && (
              <Link
                to="/classrooms"
                className="px-3 py-2 rounded-md text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1"
              >
                <Users size={16} />
                Assignments
              </Link>
            )}
            {(user?.role === 'teacher' || user?.role === 'admin') && (
              <Link
                to="/teacher"
                className="px-3 py-2 rounded-md text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-1"
              >
                <GraduationCap size={16} />
                Teacher Panel
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link
                to="/admin/users"
                className="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
              >
                <Shield size={16} />
                Admin
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 hover:text-blue-600"
              aria-label="Toggle navigation"
              type="button"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                {link.label}
              </Link>
            ))}
            {user && user.role !== 'teacher' && user.role !== 'admin' && (
              <Link
                to="/classrooms"
                onClick={() => setMobileMenuOpen(false)}
                className="flex px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-blue-50 items-center gap-1"
              >
                <Users size={16} />
                Assignments
              </Link>
            )}
            {(user?.role === 'teacher' || user?.role === 'admin') && (
              <Link
                to="/teacher"
                onClick={() => setMobileMenuOpen(false)}
                className="flex px-3 py-2 rounded-md text-base font-medium text-purple-600 hover:bg-purple-50 items-center gap-1"
              >
                <GraduationCap size={16} />
                Teacher Panel
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link
                to="/admin/users"
                onClick={() => setMobileMenuOpen(false)}
                className="flex px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50 items-center gap-1"
              >
                <Shield size={16} />
                Admin
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default memo(Navigation);
