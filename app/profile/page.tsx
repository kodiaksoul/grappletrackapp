'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Profile {
  id: string;
  username: string;
  username_updated_at: string;
  name: string;
  current_rank: string;
  stripes: number;
  gender: string;
  weight_lbs: number;
  privacy_state: string;
  is_two_factor_enabled: boolean;
  is_premium_tier: boolean;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [currentRank, setCurrentRank] = useState('White');
  const [stripes, setStripes] = useState(0);
  const [gender, setGender] = useState('Male');
  const [weightLbs, setWeightLbs] = useState(170);
  const [privacyState, setPrivacyState] = useState('Public');

  // Lockout States
  const [initialUsername, setInitialUsername] = useState('');
  const [usernameUpdatedAt, setUsernameUpdatedAt] = useState('');

  // Auth States
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authName, setAuthName] = useState('');

  // Messaging States
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    // Check session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Profile does not exist yet (first sign-in without trigger database-side), create a default one
          const defaultProfile = {
            id: userId,
            username: `grappler_${userId.substring(0, 8)}`,
            username_updated_at: new Date(0).toISOString(), // epoch allows immediate change
            name: session?.user?.user_metadata?.name || 'New Grappler',
            current_rank: 'White',
            stripes: 0,
            gender: 'Male',
            weight_lbs: 170,
            privacy_state: 'Public',
            is_two_factor_enabled: false,
            is_premium_tier: false,
          };

          const { error: insertError } = await supabase
            .from('profiles')
            .insert(defaultProfile);

          if (insertError) throw insertError;
          setProfile(defaultProfile);
          populateForm(defaultProfile);
        } else {
          throw fetchError;
        }
      } else {
        setProfile(data);
        populateForm(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data: Profile) => {
    setName(data.name || '');
    setUsername(data.username || '');
    setCurrentRank(data.current_rank || 'White');
    setStripes(data.stripes || 0);
    setGender(data.gender || 'Male');
    setWeightLbs(data.weight_lbs || 170);
    setPrivacyState(data.privacy_state || 'Public');

    setInitialUsername(data.username || '');
    setUsernameUpdatedAt(data.username_updated_at || '');
  };

  // 90-Day Lockout Calculation & Submit
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaveLoading(true);

    if (!session) return;

    try {
      // If username has changed, execute lockout check
      if (username !== initialUsername) {
        const lastUpdate = usernameUpdatedAt ? new Date(usernameUpdatedAt) : new Date(0);
        const now = new Date();

        // Calculate time delta in days
        const diffTime = now.getTime() - lastUpdate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        if (diffDays < 90 && lastUpdate.getTime() !== new Date(0).getTime()) {
          const remainingDays = Math.ceil(90 - diffDays);
          throw new Error(`Username locked. You can modify your handle again in ${remainingDays} days.`);
        }
      }

      const updatedFields = {
        id: session.user.id,
        name,
        username,
        current_rank: currentRank,
        stripes: stripes,
        gender,
        weight_lbs: weightLbs,
        privacy_state: privacyState,
        username_updated_at: username !== initialUsername ? new Date().toISOString() : usernameUpdatedAt,
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(updatedFields);

      if (updateError) throw updateError;

      setSuccess('Profile updated successfully!');
      setInitialUsername(username);
      if (username !== initialUsername) {
        setUsernameUpdatedAt(new Date().toISOString());
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Auth Handling
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: authName,
            },
          },
        });
        if (signUpError) throw signUpError;
        setSuccess('Signup successful! Check your email for verification if enabled, or sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-neon border-t-transparent animate-spin" />
        <p className="text-secondary text-sm">Loading Identity Hub...</p>
      </div>
    );
  }

  // Render Login Panel if Unauthenticated
  if (!session) {
    return (
      <div className="max-w-md mx-auto my-12">
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-block w-3 h-3 rounded-full bg-neon mb-3 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              {isSignUp ? 'CREATE ATHLETIC CARD' : 'ATHLETIC PORTAL'}
            </h1>
            <p className="text-xs text-secondary mt-1">
              {isSignUp ? 'Initialize your GrappleTrack stats' : 'Access your training logs and scouting profile'}
            </p>
          </div>

          {authError && (
            <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-xs leading-relaxed">
              {authError}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-neon text-xs leading-relaxed">
              {success}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Roger Gracie"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon/80 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-neon hover:bg-neon/90 text-bg-main font-semibold text-sm py-3 rounded-lg shadow-lg shadow-neon/10 transition-colors duration-200 mt-2 flex items-center justify-center"
            >
              {authLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-bg-main border-t-transparent animate-spin" />
              ) : isSignUp ? (
                'Sign Up'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-800/60 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
                setSuccess(null);
              }}
              className="text-xs text-secondary hover:text-neon transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Hub for Authenticated Users
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">USER IDENTITY HUB</h1>
        <p className="text-sm text-secondary mt-1">
          Manage your athletic credentials, visual handshake key, and lockout cooldowns.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Athletic Profile Form */}
        <div className="lg:col-span-2 bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl">
          <h2 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-neon" />
            ATHLETIC PROFILE
          </h2>

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

          <form onSubmit={handleProfileSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Username / Handle
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon transition-colors"
                />
                <p className="text-[10px] text-secondary mt-1.5 leading-relaxed">
                  ⚠️ Restricted update: Username changes trigger a strict 90-day lock.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Belt Rank
                </label>
                <select
                  value={currentRank}
                  onChange={(e) => setCurrentRank(e.target.value)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon transition-colors appearance-none"
                >
                  {['White', 'Blue', 'Purple', 'Brown', 'Black'].map((belt) => (
                    <option key={belt} value={belt}>
                      {belt} Belt
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Stripes
                </label>
                <select
                  value={stripes}
                  onChange={(e) => setStripes(parseInt(e.target.value))}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon transition-colors appearance-none"
                >
                  {[0, 1, 2, 3, 4].map((stripe) => (
                    <option key={stripe} value={stripe}>
                      {stripe} {stripe === 1 ? 'Stripe' : 'Stripes'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon transition-colors appearance-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  required
                  min="50"
                  max="400"
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(parseInt(e.target.value) || 0)}
                  className="w-full bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon/80 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Privacy State
                </label>
                <div className="flex items-center gap-3 h-[42px]">
                  <button
                    type="button"
                    onClick={() => setPrivacyState(privacyState === 'Public' ? 'Private' : 'Public')}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                      privacyState === 'Public' ? 'bg-neon' : 'bg-gray-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-main transition-transform duration-200 ${
                        privacyState === 'Public' ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-medium text-primary">{privacyState} Mode</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-800/60 flex items-center justify-between">
              <span className="text-xs text-secondary">
                Last Username Update:{' '}
                {usernameUpdatedAt && new Date(usernameUpdatedAt).getTime() !== new Date(0).getTime()
                  ? new Date(usernameUpdatedAt).toLocaleDateString()
                  : 'Never updated'}
              </span>
              <button
                type="submit"
                disabled={saveLoading}
                className="bg-neon hover:bg-neon/90 text-bg-main font-semibold text-sm px-6 py-2.5 rounded-lg shadow-lg shadow-neon/5 transition-colors duration-200 flex items-center justify-center"
              >
                {saveLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-bg-main border-t-transparent animate-spin" />
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* QR Handshake Generator & Logout Card */}
        <div className="space-y-6">
          {/* QR Handshake Card */}
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl">
            <h2 className="text-md font-bold text-primary mb-4 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-neon"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              QR HANDSHAKE
            </h2>
            <p className="text-xs text-secondary leading-relaxed mb-6">
              Scan another grappler's QR code during open mats to instantly establish a cryptographic handshake and link training cards.
            </p>

            {/* QR Mock Box */}
            <div className="relative aspect-square w-full max-w-[200px] mx-auto border-2 border-dashed border-gray-850 bg-main rounded-xl p-4 flex items-center justify-center overflow-hidden group">
              {/* Corner Accents */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-neon/40 group-hover:border-neon transition-colors" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-neon/40 group-hover:border-neon transition-colors" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-neon/40 group-hover:border-neon transition-colors" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-neon/40 group-hover:border-neon transition-colors" />

              {/* Mock QR Grid Pattern */}
              <div className="w-32 h-32 opacity-20 group-hover:opacity-40 transition-opacity bg-[radial-gradient(#deff9a_1px,transparent_1px)] [background-size:8px_8px] flex flex-wrap gap-1 p-2">
                {/* Visual grid representations */}
                <div className="w-6 h-6 border-2 border-neon rounded" />
                <div className="w-6 h-6 bg-neon opacity-50 rounded" />
                <div className="w-12 h-6 border border-neon rounded" />
                <div className="w-6 h-12 bg-neon rounded" />
                <div className="w-6 h-6 border-2 border-neon rounded" />
              </div>

              <span className="absolute text-[10px] uppercase tracking-widest text-secondary bg-surface border border-gray-800 px-2 py-1 rounded">
                Placeholder
              </span>
            </div>

            <button
              disabled
              className="w-full mt-6 bg-gray-800/80 text-secondary cursor-not-allowed text-xs font-semibold py-2.5 rounded-lg border border-gray-700/60"
            >
              Generate Live Token
            </button>
          </div>

          {/* Account Status / Sign Out */}
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-primary">PORTAL CREDENTIALS</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-secondary">Logged in as:</span>
                <span className="text-primary font-medium truncate max-w-[180px]">{session.user.email}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-secondary">Security tier:</span>
                <span className="text-neon font-medium">Standard Grappler</span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/40 font-semibold text-xs py-2.5 rounded-lg transition-colors duration-200 flex items-center justify-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign Out from Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
