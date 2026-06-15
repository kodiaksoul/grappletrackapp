'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';
import { getBetaSettings, submitFeedback } from './actions/betaActions';

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
  const [isBetaMode, setIsBetaMode] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastFadeOut, setToastFadeOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkBetaMode() {
      try {
        const enabled = await getBetaSettings();
        if (isMounted) {
          setIsBetaMode(enabled);
        }
      } catch (err) {
        console.error('Error checking beta mode:', err);
      }
    }
    checkBetaMode();
    return () => {
      isMounted = false;
    };
  }, [pathname, session]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || submittingFeedback) return;

    setSubmittingFeedback(true);
    const userEmail = session?.user?.email || 'Anonymous';
    
    const res = await submitFeedback(userEmail, feedbackText.trim(), pathname);
    setSubmittingFeedback(false);

    if (res.success) {
      setFeedbackText('');
      setShowToast(true);
      setToastFadeOut(false);
      setTimeout(() => {
        setToastFadeOut(true);
        setTimeout(() => {
          setShowToast(false);
        }, 500);
      }, 4500);
    } else {
      alert(`Failed to submit feedback: ${res.error}`);
    }
  };

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
      <div className="flex flex-col md:flex-row w-full min-h-dvh">
        {showNav && <Navigation />}
        <main className={`flex-1 min-h-dvh transition-all ${showNav ? 'md:pl-64 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0' : ''}`}>
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] bg-bg-main">
                <div className="w-10 h-10 border-4 border-neon border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <div className={loading ? 'hidden' : ''}>
              {children}

              {/* Persistent Suggestion & Issue Box */}
              {isBetaMode && session && profile?.access_role !== 'Master Admin' && (
                <div className="mt-16 border-t border-gray-800/60 pt-8 max-w-3xl">
                  <div className="bg-bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-neon/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-105" />
                    <div className="relative z-10 space-y-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
                          <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                            Beta Suggestion & Issue Box
                            <span className="text-[9px] font-bold text-brand-neon bg-brand-neon/10 px-2 py-0.5 rounded border border-brand-neon/20 tracking-wider">
                              v0.1.3-beta
                            </span>
                          </h4>
                        </div>
                        <p className="text-[11px] text-text-secondary">
                          Have an issue, bug, or idea? Drop it here to send it directly to the Master Admin.
                        </p>
                      </div>
                      
                      <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                        <textarea
                          placeholder="Describe the issue or suggestion in detail..."
                          required
                          rows={3}
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          className="w-full bg-bg-main border border-gray-800 rounded-xl px-4 py-3 text-xs text-text-primary placeholder-gray-600 focus:outline-none focus:border-brand-neon transition-colors resize-none"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-text-secondary italic">
                            Submitting as: <strong className="text-brand-neon select-all font-mono">{session.user.email}</strong>
                          </span>
                          <button
                            type="submit"
                            disabled={submittingFeedback}
                            className="bg-brand-neon hover:bg-neon/90 disabled:opacity-50 text-bg-main font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-brand-neon/5 active:scale-95 flex items-center gap-1.5"
                          >
                            {submittingFeedback ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-bg-main border-t-transparent rounded-full animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                </svg>
                                Submit Feedback
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Toast Notification Overlay */}
      {showToast && (
        <div 
          className={`fixed bottom-24 right-4 z-[9999] max-w-md bg-bg-surface/95 border border-brand-neon/40 text-text-primary px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all duration-500 ease-in-out ${
            toastFadeOut ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          }`}
        >
          <div className="bg-brand-neon/10 p-1.5 rounded-lg shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-brand-neon">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-brand-neon uppercase tracking-wider">Comments Submitted</p>
            <p className="text-xs text-text-secondary leading-relaxed">
              Comments have been submitted. Master Admin will contact you in 24-48hrs. Thank you for your help.
            </p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}
