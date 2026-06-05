'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [invite, setInvite] = useState<any>(null);
  const [gym, setGym] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);

  useEffect(() => {
    // Get session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && code) {
        verifyInvite(session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [code]);

  const verifyInvite = async (userEmail: string) => {
    try {
      setLoading(true);
      setError(null);

      if (!code) {
        setError('No invitation code provided in the URL.');
        setLoading(false);
        return;
      }

      // Query the invitation
      const { data: inviteData, error: inviteError } = await supabase
        .from('gym_invitations')
        .select('*')
        .eq('code', code)
        .eq('is_used', false)
        .single();

      if (inviteError || !inviteData) {
        setError('Invalid, expired, or already claimed invitation code.');
        setLoading(false);
        return;
      }

      // Check expiration
      if (new Date(inviteData.expires_at).getTime() < Date.now()) {
        setError('This invitation code has expired.');
        setLoading(false);
        return;
      }

      setInvite(inviteData);

      // Fetch Gym Location details
      const { data: gymData, error: gymError } = await supabase
        .from('gym_locations')
        .select('*')
        .eq('id', inviteData.gym_id)
        .single();

      if (!gymError && gymData) {
        setGym(gymData);
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred while verifying the invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimInvite = async () => {
    if (!session || !invite) return;
    setClaimLoading(true);
    setError(null);

    try {
      const targetRole = invite.role; // e.g., 'User-Student' or 'Teacher'
      const gymId = invite.gym_id;

      // 1. Update user profile's access_role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ access_role: targetRole, is_premium_tier: true }) // Student and Teacher inherit Premium perks
        .eq('id', session.user.id);

      if (profileError) throw profileError;

      // 2. Insert into gym_memberships
      // Map 'User-Student' to 'Student' role token in membership, and 'Teacher' to 'Teacher'
      const roleToken = targetRole === 'User-Student' ? 'Student' : 'Teacher';
      const { error: membershipError } = await supabase
        .from('gym_memberships')
        .upsert({
          user_id: session.user.id,
          gym_id: gymId,
          role_token: roleToken
        });

      if (membershipError) throw membershipError;

      // 3. Mark invite code as used
      const { error: inviteUpdateError } = await supabase
        .from('gym_invitations')
        .update({ is_used: true })
        .eq('id', invite.id);

      if (inviteUpdateError) throw inviteUpdateError;

      setSuccess(`Congratulations! You have successfully joined ${gym ? gym.name : 'the academy'} as a ${roleToken}.`);
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Failed to claim invitation. Please try again.');
    } finally {
      setClaimLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-neon border-t-transparent animate-spin" />
        <p className="text-secondary text-sm">Verifying invitation credentials...</p>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="max-w-md mx-auto my-12 bg-surface border border-gray-800 rounded-2xl p-8 text-center space-y-4">
        <div className="text-red-400 text-3xl">⚠️</div>
        <h2 className="text-xl font-bold text-primary">NO CODE PROVIDED</h2>
        <p className="text-xs text-secondary leading-relaxed">
          This URL requires an invitation code parameter (e.g. <code>/invite?code=XYZ</code>). Please make sure you clicked the complete link.
        </p>
        <Link href="/profile" className="inline-block bg-neon text-main font-semibold text-xs py-2.5 px-6 rounded-lg">
          Go to Profile
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto my-12 bg-surface border border-gray-800 rounded-2xl p-8 text-center space-y-6">
        <div className="w-12 h-12 rounded-full bg-neon/10 border border-neon/30 flex items-center justify-center mx-auto text-neon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-primary">AUTHENTICATION REQUIRED</h2>
        <p className="text-xs text-secondary leading-relaxed">
          You must be logged in to claim this invitation. If you do not have an account yet, you can sign up on the Profile page.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/profile" className="bg-neon text-main font-bold text-xs py-2.5 px-6 rounded-lg transition-colors hover:bg-neon/90">
            Sign In / Sign Up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-12">
      <div className="bg-surface border border-gray-800/80 rounded-2xl p-8 shadow-xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full pointer-events-none" />

        <div className="text-center mb-8">
          <span className="text-[10px] bg-neon/10 text-neon border border-neon/20 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
            Academy Handshake
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-primary mt-3 uppercase">
            Claim Invitation
          </h1>
          <p className="text-xs text-secondary mt-1">
            Connect your GrappleTracker stats to your home gym.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-xs leading-relaxed">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-neon text-xs leading-relaxed">
            {success}
          </div>
        )}

        {!error && !success && invite && (
          <div className="space-y-6">
            <div className="p-4 bg-main/50 border border-gray-850 rounded-xl space-y-3">
              <div className="flex justify-between text-xs border-b border-gray-800 pb-2">
                <span className="text-secondary">Academy:</span>
                <span className="text-primary font-bold">{gym ? gym.name : 'Local Gym'}</span>
              </div>
              {gym?.address && (
                <div className="flex justify-between text-xs border-b border-gray-800 pb-2">
                  <span className="text-secondary">Address:</span>
                  <span className="text-primary truncate max-w-[180px]">{gym.address}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-secondary">Target Role:</span>
                <span className="text-neon font-bold">{invite.role === 'User-Student' ? 'Student Affiliation' : 'Teacher Authority'}</span>
              </div>
            </div>

            <p className="text-xs text-secondary leading-relaxed text-center">
              Claiming this code will instantly promote your account tier, pre-populate lesson focus inputs, and link your roster card to your coach's board.
            </p>

            <button
              onClick={handleClaimInvite}
              disabled={claimLoading}
              className="w-full bg-neon hover:bg-neon/90 text-main font-bold text-sm py-3 rounded-lg shadow-lg transition-colors flex items-center justify-center"
            >
              {claimLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-main border-t-transparent animate-spin" />
              ) : (
                'Accept Invitation'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-neon border-t-transparent animate-spin" />
        <p className="text-secondary text-sm">Initializing invitation portal...</p>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
