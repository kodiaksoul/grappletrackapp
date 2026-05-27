'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';

interface AuthContextType {
  session: any;
  profile: any;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  // 1. Initial auth and profile setup
  useEffect(() => {
    let isMounted = true;
    let activeSubscription: any = null;

    const initializeAuth = async () => {
      try {
        const { data: { session: activeSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(activeSession);
        if (activeSession) {
          await fetchProfile(activeSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
        if (!isMounted) return;
        setSession(activeSession);
        if (activeSession) {
          // Trigger profile fetch (sync callback to avoid deadlocks)
          fetchProfile(activeSession.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      });

      activeSubscription = subscription;
    };

    initializeAuth();

    return () => {
      isMounted = false;
      if (activeSubscription) {
        activeSubscription.unsubscribe();
      }
    };
  }, [fetchProfile]);

  // 2. Redirect validation rules
  useEffect(() => {
    if (loading) return; // Wait for initial session validation to finish

    const isPublicPage = pathname === '/profile' || pathname === '/invite';
    if (!session && !isPublicPage) {
      router.push('/profile');
    }
  }, [session, pathname, loading, router]);

  const showNav = !!session;

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>
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
    </AuthContext.Provider>
  );
}
