'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthGuard';

export default function RootPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const addFriendId = params.get('add_friend');
      if (addFriendId) {
        router.replace(`/profile?add_friend=${addFriendId}`);
        return;
      }
    }

    if (!session) {
      router.replace('/profile');
    } else if (profile) {
      // Determine dynamic landing page path based on user settings
      const landingPage = profile.default_landing_page || 'Dashboard';
      let path = '/dashboard';
      if (landingPage === 'Dictionary') {
        path = '/dictionary';
      } else if (landingPage === 'History') {
        path = '/history';
      } else if (landingPage === 'Gym Desk') {
        const isAuthorized = ['Teacher', 'Admin', 'Master Admin'].includes(profile.access_role);
        path = isAuthorized ? '/gymdesk' : '/dashboard';
      } else if (landingPage === 'Profile') {
        path = '/profile';
      }
      router.replace(path);
    } else {
      // If session exists but profile is not yet created/loaded, route to /profile
      router.replace('/profile');
    }
  }, [session, profile, loading, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-bg-main">
      <div className="w-10 h-10 border-4 border-neon border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
