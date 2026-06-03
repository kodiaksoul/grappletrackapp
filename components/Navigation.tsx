'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../app/AuthGuard';

interface NavItem {
  name: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
}

export default function Navigation() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const role = profile?.access_role || null;

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (active) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      ),
    },
    {
      name: 'Dictionary',
      href: '/dictionary',
      icon: (active) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10M6 10h10M6 14h10" />
        </svg>
      ),
    },
    {
      name: 'History',
      href: '/history',
      icon: (active) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      name: 'Gym Desk',
      href: '/gymdesk',
      icon: (active) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M3 21h18M9 21V10h6v11M4 10h16L12 3z" />
        </svg>
      ),
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: (active) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  if (role === 'Master Admin') {
    navItems.push({
      name: 'Master Admin',
      href: '/master-admin',
      icon: (active) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      ),
    });
  }

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside className="fixed top-0 left-0 bottom-0 w-64 bg-bg-surface border-r border-gray-800/80 hidden md:flex flex-col z-50">
        <div className="h-16 flex items-center px-6 border-b border-gray-800/80">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="w-3 h-3 rounded-full bg-brand-neon animate-pulse" />
            <span className="font-bold text-lg tracking-wider text-text-primary group-hover:text-brand-neon transition-colors duration-200">
              GRAPPLE<span className="text-brand-neon">TRACK</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  active
                    ? 'bg-brand-neon/10 text-brand-neon'
                    : 'text-text-secondary hover:bg-gray-800/40 hover:text-text-primary'
                }`}
              >
                <div
                  className={`transition-colors duration-200 ${
                    active ? 'text-brand-neon' : 'text-text-secondary group-hover:text-text-primary'
                  }`}
                >
                  {item.icon(active)}
                </div>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800/80">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-semibold text-white">
              GT
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">Grappler Mode</p>
              <p className="text-[10px] text-text-secondary truncate">Supabase Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-bg-surface/90 backdrop-blur-md border-t border-gray-800/80 md:hidden flex justify-around items-center z-50 px-2 pb-safe">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-all duration-200 ${
                active ? 'text-brand-neon' : 'text-text-secondary'
              }`}
            >
              <div
                className={`mb-1 transition-transform duration-200 ${
                  active ? 'scale-110 text-brand-neon' : 'text-text-secondary'
                }`}
              >
                {item.icon(active)}
              </div>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
