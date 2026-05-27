'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // 1. Initial auth setup (runs ONLY ONCE on application mount)
  useEffect(() => {
    let isMounted = true;

    // Check initial session
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      if (!isMounted) return;
      setSession(activeSession);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      if (!isMounted) return;
      setSession(activeSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Redirect validation rules (runs whenever session, pathname, or loading state transitions)
  useEffect(() => {
    if (loading) return; // Wait for initial session validation to finish

    const isPublicPage = pathname === '/profile' || pathname === '/invite';
    if (!session && !isPublicPage) {
      router.push('/profile');
    }
  }, [session, pathname, loading, router]);

  const showNav = !!session;

  return (
    <div className="flex flex-col md:flex-row w-full min-h-screen">
      {showNav && <Navigation />}
      <main className={`flex-1 min-h-screen transition-all ${showNav ? 'md:pl-64 pb-16 md:pb-0' : ''}`}>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] bg-bg-main">
              <div className="w-10 h-10 border-4 border-neon border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className={loading ? 'hidden' : ''}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
