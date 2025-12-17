import { useState } from 'react';
import { Menu, X, Shield } from 'lucide-react';
import useUser from '@/shared/hooks/useUser';

type NavLink = {
  href: string;
  label: string;
};

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: user } = useUser();

  const links: NavLink[] = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/pricing', label: 'Plans' },
    { href: '/profile', label: 'Profile' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <a href="/" className="flex items-center">
              <img
                src="https://ucarecdn.com/df05b2e5-6ee7-4c41-b12b-d556708883a3/-/format/auto/"
                alt="The Spanish Blitz"
                className="h-10 w-auto"
              />
            </a>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {link.label}
              </a>
            ))}
            {user?.role === 'admin' && (
              <a
                href="/admin/users"
                className="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
              >
                <Shield size={16} />
                Admin
              </a>
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
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                {link.label}
              </a>
            ))}
            {user?.role === 'admin' && (
              <a
                href="/admin/users"
                onClick={() => setMobileMenuOpen(false)}
                className="flex px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50 items-center gap-1"
              >
                <Shield size={16} />
                Admin
              </a>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
