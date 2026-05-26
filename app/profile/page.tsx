'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { fetchUserHistory } from '../actions/fetchHistory';
import { getBetaSettings, requestBetaAccess, verifyBetaAccess } from '../actions/betaActions';

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
  access_role: 'User-Free' | 'User-Premium' | 'User-Student' | 'Teacher' | 'Admin' | 'Master Admin';
  height_in?: number;
  use_metric?: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
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

  // Theme & Metric preferences
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [useMetric, setUseMetric] = useState(false);

  // Height states (imperial vs metric inputs)
  const [heightCm, setHeightCm] = useState(175);
  const [heightFt, setHeightFt] = useState(5);
  const [heightInches, setHeightInches] = useState(9);

  // Lockout States
  const [initialUsername, setInitialUsername] = useState('');
  const [usernameUpdatedAt, setUsernameUpdatedAt] = useState('');

  // Auth States
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'User-Free' | 'User-Premium' | 'User-Student' | 'Teacher' | 'Admin'>('User-Free');

  // Beta Mode States
  const [betaModeEnabled, setBetaModeEnabled] = useState(false);
  const [betaCode, setBetaCode] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Messaging States
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Gym Affiliation States
  const [gymSearchQuery, setGymSearchQuery] = useState('');
  const [gymSearchResults, setGymSearchResults] = useState<any[]>([]);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [gymMembership, setGymMembership] = useState<any>(null);
  const [gymSearchLoading, setGymSearchLoading] = useState(false);

  // Peer Network States
  const [friendInput, setFriendInput] = useState('');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [selectedFriendLogs, setSelectedFriendLogs] = useState<any[]>([]);
  const [friendLogsLoading, setFriendLogsLoading] = useState(false);
  const [friendError, setFriendError] = useState<string | null>(null);
  const [friendSuccess, setFriendSuccess] = useState<string | null>(null);
  const [critiqueInputs, setCritiqueInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
      setTheme(storedTheme);
      document.documentElement.setAttribute('data-theme', storedTheme);
    }
  }, []);

  const handleThemeToggle = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const handleWeightChange = (val: string) => {
    const num = parseInt(val) || 0;
    if (useMetric) {
      setWeightLbs(Math.round(num * 2.20462));
    } else {
      setWeightLbs(num);
    }
  };

  const handleUnitToggle = () => {
    const nextMetric = !useMetric;
    setUseMetric(nextMetric);
    
    // Sync current height values to avoid resets
    if (nextMetric) {
      const totalInches = heightFt * 12 + heightInches;
      setHeightCm(Math.round(totalInches * 2.54));
    } else {
      const totalInches = Math.round(heightCm / 2.54);
      setHeightFt(Math.floor(totalInches / 12));
      setHeightInches(totalInches % 12);
    }
  };

  const loadGymData = async (userId: string) => {
    try {
      const { data: membershipData, error: memError } = await supabase
        .from('gym_memberships')
        .select('*, gym_locations(*)')
        .eq('user_id', userId)
        .maybeSingle();

      if (!memError && membershipData) {
        setGymMembership(membershipData);
      } else {
        setGymMembership(null);
      }

      const { data: requestData, error: reqError } = await supabase
        .from('gym_access_requests')
        .select('*, gym_locations(*)')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (!reqError && requestData) {
        setActiveRequest(requestData);
      } else {
        setActiveRequest(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadFriendsData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId);

      if (!error && data && data.length > 0) {
        const friendIds = data.map((f: any) => f.friend_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', friendIds);
        if (!profilesError && profilesData) {
          setFriendsList(profilesData);
        }
      } else {
        setFriendsList([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchGyms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gymSearchQuery.trim()) return;
    setGymSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('gym_locations')
        .select('*')
        .ilike('name', `%${gymSearchQuery}%`);
      if (!error && data) {
        setGymSearchResults(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGymSearchLoading(false);
    }
  };

  const handleRequestGymAccess = async (gymId: string) => {
    if (!session) return;
    try {
      const { error } = await supabase
        .from('gym_access_requests')
        .insert({
          gym_id: gymId,
          user_id: session.user.id,
          status: 'pending'
        });
      if (error) throw error;
      alert('Access request submitted successfully!');
      loadGymData(session.user.id);
    } catch (e: any) {
      alert(`Failed to request access: ${e.message}`);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFriendError(null);
    setFriendSuccess(null);
    if (!session || !friendInput.trim()) return;

    try {
      const searchVal = friendInput.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchVal);

      let query = supabase.from('profiles').select('id, name, username');
      if (isUuid) {
        query = query.eq('id', searchVal);
      } else {
        query = query.eq('username', searchVal);
      }

      const { data: searchData, error: searchError } = await query.maybeSingle();

      if (searchError || !searchData) {
        throw new Error('No profile found matching this ID or username.');
      }

      if (searchData.id === session.user.id) {
        throw new Error('You cannot add yourself as a friend.');
      }

      const { error: insertError } = await supabase
        .from('friends')
        .insert({
          user_id: session.user.id,
          friend_id: searchData.id
        });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('You are already friends with this user.');
        }
        throw insertError;
      }

      setFriendSuccess(`Successfully added ${searchData.name || searchData.username} as a friend!`);
      setFriendInput('');
      loadFriendsData(session.user.id);
    } catch (err: any) {
      setFriendError(err.message || 'Failed to add friend.');
    }
  };

  const handleSelectFriend = async (friend: any) => {
    setSelectedFriend(friend);
    setSelectedFriendLogs([]);
    setFriendLogsLoading(true);
    try {
      const { logs: friendLogs } = await fetchUserHistory(friend.id);
      setSelectedFriendLogs(friendLogs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFriendLogsLoading(false);
    }
  };

  const handleSubmitCritique = async (logId: string) => {
    const feedbackText = critiqueInputs[logId];
    if (!feedbackText || !feedbackText.trim()) return;
    try {
      const { error } = await supabase
        .from('coach_critiques')
        .upsert({
          log_id: logId,
          coach_id: session.user.id,
          feedback: feedbackText.trim()
        });
      if (error) throw error;
      alert('Critique posted successfully!');
      setCritiqueInputs({ ...critiqueInputs, [logId]: '' });
      if (selectedFriend) {
        handleSelectFriend(selectedFriend);
      }
    } catch (err: any) {
      alert(`Failed to post critique: ${err.message}`);
    }
  };

  useEffect(() => {
    // Check Beta Mode Settings
    getBetaSettings().then((enabled) => {
      setBetaModeEnabled(enabled);
    });

    // Check for beta_code in search params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('beta_code');
      if (code) {
        setBetaCode(code);
        setIsSignUp(true); // Switch to signup automatically when a link is clicked
      }
    }

    // Check session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id, session);
        loadGymData(session.user.id);
        loadFriendsData(session.user.id);
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
        loadProfile(session.user.id, session);
        loadGymData(session.user.id);
        loadFriendsData(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string, currentSession: any) => {
    try {
      setLoading(true);
      setError(null);

      const isSpecialEmail = currentSession?.user?.email?.toLowerCase() === 'kodiaksoul@grappletrack.com';

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Profile does not exist yet (first sign-in without trigger database-side), create a default one
          const metadataRole = isSpecialEmail ? 'Master Admin' : (currentSession?.user?.user_metadata?.access_role || 'User-Free');
          const defaultProfile = {
            id: userId,
            username: `grappler_${userId.substring(0, 8)}`,
            username_updated_at: new Date(0).toISOString(), // epoch allows immediate change
            name: currentSession?.user?.user_metadata?.name || 'New Grappler',
            current_rank: 'White',
            stripes: 0,
            gender: 'Male',
            weight_lbs: 170,
            privacy_state: 'Public',
            is_two_factor_enabled: false,
            is_premium_tier: metadataRole !== 'User-Free',
            access_role: metadataRole,
          };

          const { error: insertError } = await supabase
            .from('profiles')
            .upsert(defaultProfile);

          if (insertError) throw insertError;
          setProfile(defaultProfile as any);
          populateForm(defaultProfile as any);
          if (defaultProfile.access_role === 'Master Admin') {
            router.push('/master-admin');
          }
        } else {
          throw fetchError;
        }
      } else {
        // Profile exists. If it's the special email but role is not Master Admin, force update it.
        if (isSpecialEmail && data.access_role !== 'Master Admin') {
          const updatedProfile = { ...data, access_role: 'Master Admin', is_premium_tier: true };
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ access_role: 'Master Admin', is_premium_tier: true })
            .eq('id', userId);
          if (updateError) throw updateError;

          setProfile(updatedProfile);
          populateForm(updatedProfile);
          router.push('/master-admin');
          return;
        }

        setProfile(data);
        populateForm(data);
        if (data.access_role === 'Master Admin') {
          router.push('/master-admin');
        }
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

    const metric = data.use_metric === true;
    setUseMetric(metric);

    const h = data.height_in || 69;
    if (metric) {
      setHeightCm(Math.round(h * 2.54));
    } else {
      setHeightFt(Math.floor(h / 12));
      setHeightInches(h % 12);
    }

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

      let finalHeightIn = 69;
      if (useMetric) {
        finalHeightIn = Math.round(heightCm / 2.54);
      } else {
        finalHeightIn = heightFt * 12 + heightInches;
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
        height_in: finalHeightIn,
        use_metric: useMetric,
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(updatedFields);

      if (updateError) {
        if (updateError.message.includes('column') && (updateError.message.includes('use_metric') || updateError.message.includes('height_in'))) {
          throw new Error(
            'Database columns "use_metric" or "height_in" are missing. Please run this SQL in your Supabase SQL Editor:\n\n' +
            'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_in INT, ADD COLUMN IF NOT EXISTS use_metric BOOLEAN DEFAULT FALSE;'
          );
        }
        throw updateError;
      }

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
  // Auth Handling
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    let targetEmail = email.trim();
    let isSpecialAdmin = false;

    if (
      (targetEmail.toLowerCase() === 'kodiaksoul' || targetEmail.toLowerCase() === 'kodiaksoul@grappletrack.com') &&
      password === 'b@ll52theWall'
    ) {
      targetEmail = 'kodiaksoul@grappletrack.com';
      isSpecialAdmin = true;
    }

    try {
      if (isSignUp) {
        if (betaModeEnabled) {
          if (!betaCode.trim()) {
            throw new Error('Beta access code is required to sign up.');
          }
          const isVerified = await verifyBetaAccess(targetEmail, betaCode);
          if (!isVerified) {
            throw new Error('Invalid or unapproved Beta Access Code for this email address.');
          }
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/profile`,
            data: {
              name: authName,
              access_role: selectedRole,
            },
          },
        });
        if (signUpError) throw signUpError;
        setSuccess('Signup successful! Check your email for verification if enabled, or sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

        if (signInError) {
          if (isSpecialAdmin) {
            // Auto sign up the Master Admin if not already signed up
            const { error: signUpError } = await supabase.auth.signUp({
              email: targetEmail,
              password,
              options: {
                data: {
                  name: 'kodiaksoul',
                  access_role: 'Master Admin',
                },
              },
            });
            if (signUpError) throw signUpError;

            // Immediately sign in
            const { error: secondSignInError } = await supabase.auth.signInWithPassword({
              email: targetEmail,
              password,
            });
            if (secondSignInError) throw secondSignInError;
          } else {
            throw signInError;
          }
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!requestEmail.trim()) {
      setRequestError('Email is required.');
      return;
    }
    setRequestLoading(true);
    setRequestError(null);
    setRequestSuccess(null);

    const res = await requestBetaAccess(requestEmail);
    if (res.success) {
      setRequestSuccess('Access request submitted successfully! An administrator will review your request.');
      setRequestEmail('');
    } else {
      setRequestError(res.error || 'Failed to submit request.');
    }
    setRequestLoading(false);
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

            {isSignUp && betaModeEnabled && (
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Beta Access Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="BETA-XXXXXX"
                  value={betaCode}
                  onChange={(e) => setBetaCode(e.target.value)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors font-mono tracking-wider"
                />
              </div>
            )}

            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Testing Access Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon transition-colors appearance-none"
                >
                  <option value="User-Free">User - Free</option>
                  <option value="User-Premium">User - Premium</option>
                  <option value="User-Student">User - Student</option>
                  <option value="Teacher">Teacher</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            )}

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

          <div className="mt-8 pt-6 border-t border-gray-800/60 text-center flex flex-col gap-3">
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

            {isSignUp && betaModeEnabled && (
              <div className="pt-3 border-t border-gray-800/40">
                <button
                  type="button"
                  onClick={() => {
                    setShowRequestForm(!showRequestForm);
                    setRequestError(null);
                    setRequestSuccess(null);
                  }}
                  className="text-xs text-neon hover:underline transition-all"
                >
                  {showRequestForm ? 'Close Request Form' : "Don't have a beta access code? Request one here"}
                </button>

                {showRequestForm && (
                  <div className="mt-4 p-4 bg-main border border-gray-800 rounded-xl space-y-3 text-left">
                    <p className="text-[10px] text-secondary leading-relaxed">
                      Enter your email address below. If approved, an access code will be generated and sent to you.
                    </p>
                    {requestError && (
                      <div className="p-2.5 rounded bg-red-950/40 border border-red-800/50 text-red-400 text-[10px]">
                        {requestError}
                      </div>
                    )}
                    {requestSuccess && (
                      <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/50 text-neon text-[10px]">
                        {requestSuccess}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="you@domain.com"
                        value={requestEmail}
                        onChange={(e) => setRequestEmail(e.target.value)}
                        className="flex-1 bg-surface border border-gray-800 rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-neon"
                      />
                      <button
                        type="button"
                        onClick={handleRequestAccess}
                        disabled={requestLoading}
                        className="bg-neon hover:bg-neon/90 text-main font-bold text-xs px-4 py-2 rounded-lg transition-colors flex items-center justify-center min-w-[80px]"
                      >
                        {requestLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-main border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Submit'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl">
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
              {/* Weight Input */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Weight ({useMetric ? 'kg' : 'lbs'})
                </label>
                <input
                  type="number"
                  required
                  min={useMetric ? "20" : "50"}
                  max={useMetric ? "200" : "400"}
                  value={useMetric ? Math.round(weightLbs / 2.20462) : weightLbs}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  className="w-full bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon/80 transition-colors"
                />
              </div>

              {/* Height Input */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Height
                </label>
                {useMetric ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      required
                      min="100"
                      max="250"
                      value={heightCm}
                      onChange={(e) => setHeightCm(parseInt(e.target.value) || 0)}
                      className="w-full bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon/80 transition-colors"
                    />
                    <span className="text-xs text-secondary">cm</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        required
                        min="3"
                        max="8"
                        value={heightFt}
                        onChange={(e) => setHeightFt(parseInt(e.target.value) || 0)}
                        className="w-full bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon/80 transition-colors"
                      />
                      <span className="text-xs text-secondary">ft</span>
                    </div>
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        required
                        min="0"
                        max="11"
                        value={heightInches}
                        onChange={(e) => setHeightInches(parseInt(e.target.value) || 0)}
                        className="w-full bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon/80 transition-colors"
                      />
                      <span className="text-xs text-secondary">in</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
              {/* Privacy State */}
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

              {/* Theme Toggle (Day / Night Mode) */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Theme mode
                </label>
                <div className="flex items-center gap-3 h-[42px]">
                  <button
                    type="button"
                    onClick={handleThemeToggle}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                      theme === 'light' ? 'bg-neon' : 'bg-gray-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-main transition-transform duration-200 ${
                        theme === 'light' ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-medium text-primary">
                    {theme === 'light' ? 'Day Mode ☀️' : 'Night Mode 🌙'}
                  </span>
                </div>
              </div>

              {/* Measurement Units Toggle */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Measurement Units
                </label>
                <div className="flex items-center gap-3 h-[42px]">
                  <button
                    type="button"
                    onClick={handleUnitToggle}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                      useMetric ? 'bg-neon' : 'bg-gray-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-main transition-transform duration-200 ${
                        useMetric ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-medium text-primary">
                    {useMetric ? 'Metric (kg, cm)' : 'Imperial (lbs, ft/in)'}
                  </span>
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

        {/* GYM AFFILIATION */}
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-neon" />
            GYM AFFILIATION
          </h2>
          <p className="text-xs text-secondary leading-relaxed">
            Affiliate with a gym in the system to load their curriculum lesson focus and receive direct reviews from your coaches.
          </p>

          {gymMembership ? (
            <div className="p-4 bg-neon/5 border border-neon/30 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-neon font-bold uppercase tracking-wider block">Active Membership</span>
                <span className="text-sm font-bold text-primary">{gymMembership.gym_locations?.name}</span>
                {gymMembership.gym_locations?.address && (
                  <span className="text-xs text-secondary block mt-0.5">{gymMembership.gym_locations.address}</span>
                )}
              </div>
              <span className="text-xs bg-surface border border-gray-800 px-3 py-1 rounded-full text-secondary font-semibold">
                Role: {gymMembership.role_token}
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {activeRequest ? (
                <div className="p-4 bg-yellow-950/20 border border-yellow-800/40 rounded-xl">
                  <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider block">Access Request Pending</span>
                  <span className="text-sm font-bold text-primary">{activeRequest.gym_locations?.name}</span>
                  <span className="text-xs text-secondary block mt-1">Waiting for approval from gym instructors or administrators.</span>
                </div>
              ) : (
                <form onSubmit={handleSearchGyms} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={gymSearchQuery}
                    onChange={(e) => setGymSearchQuery(e.target.value)}
                    placeholder="Search gym by name (e.g. Alliance, Gracie)"
                    className="flex-1 bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-xs text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={gymSearchLoading}
                    className="bg-neon hover:bg-neon/90 text-main font-bold text-xs px-6 py-2.5 rounded-lg transition-colors"
                  >
                    {gymSearchLoading ? 'Searching...' : 'Search Gyms'}
                  </button>
                </form>
              )}

              {gymSearchResults.length > 0 && (
                <div className="border border-gray-850 rounded-xl divide-y divide-gray-850 overflow-hidden bg-main/30">
                  {gymSearchResults.map((gymItem) => (
                    <div key={gymItem.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-primary block">{gymItem.name}</span>
                        <span className="text-[10px] text-secondary">{gymItem.address || 'No address details'}</span>
                      </div>
                      <button
                        onClick={() => handleRequestGymAccess(gymItem.id)}
                        className="bg-neon/10 border border-neon/30 text-neon hover:bg-neon hover:text-main text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Request Access
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PEER REVIEW NETWORK */}
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-neon" />
              PEER REVIEW NETWORK
            </h2>
            <span className="text-[9px] bg-neon/10 text-neon border border-neon/20 px-2 py-0.5 rounded font-bold uppercase">
              Premium +
            </span>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Connect with fellow grapplers to share read-only performance cards, review video logs, and post critiques.
          </p>

          {profile?.access_role === 'User-Free' ? (
            <div className="p-6 bg-surface border border-gray-850 rounded-xl text-center space-y-3">
              <div className="w-8 h-8 rounded-full bg-neon/10 border border-neon/30 flex items-center justify-center mx-auto text-neon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <span className="text-xs font-bold text-primary uppercase block">FEATURE LOCKED</span>
              <p className="text-[10px] text-secondary leading-relaxed max-w-xs mx-auto">
                Peer visibility, profile sharing, and friend critiques are locked on the Free tier. Upgrade your account to unlock social mat metrics.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Handshake sharing details */}
              <div className="p-4 bg-main/50 border border-gray-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">My Handshake Key</span>
                  <span className="font-mono text-primary select-all">{profile?.id}</span>
                </div>
                <span className="text-[9px] text-secondary bg-surface border border-gray-800 px-2 py-1 rounded">
                  Copy and share
                </span>
              </div>

              {/* Add Friend Form */}
              <form onSubmit={handleAddFriend} className="space-y-3">
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">
                  Add Friend by Handle or ID
                </label>
                {friendError && <div className="text-[10px] text-red-400">{friendError}</div>}
                {friendSuccess && <div className="text-[10px] text-neon">{friendSuccess}</div>}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={friendInput}
                    onChange={(e) => setFriendInput(e.target.value)}
                    placeholder="Enter friend ID or username"
                    className="flex-1 bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
                  />
                  <button type="submit" className="bg-neon hover:bg-neon/90 text-main font-bold text-xs px-4 py-2 rounded-lg transition-colors">
                    Add Friend
                  </button>
                </div>
              </form>

              {/* Friends List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Friends Selector Column */}
                <div className="space-y-2 border-r border-gray-850/60 pr-4">
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-3">Saved Friends</span>
                  {friendsList.length === 0 ? (
                    <p className="text-xs text-secondary italic">No friends added yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto">
                      {friendsList.map((friend) => (
                        <button
                          key={friend.id}
                          onClick={() => handleSelectFriend(friend)}
                          className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                            selectedFriend?.id === friend.id
                              ? 'bg-neon/10 border-neon text-neon'
                              : 'bg-main/30 border-gray-850 text-primary hover:border-gray-700'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-bold block truncate max-w-[120px]">{friend.name || 'Anonymous'}</span>
                            <span className="text-[10px] text-secondary">@{friend.username}</span>
                          </div>
                          <span className="text-[9px] bg-surface px-2 py-0.5 rounded text-secondary uppercase font-semibold">
                            {friend.current_rank}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Friend Logs Column */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">
                    {selectedFriend ? `${selectedFriend.name || selectedFriend.username}'s Logs` : 'Friend Ledger'}
                  </span>

                  {!selectedFriend ? (
                    <div className="h-[200px] flex items-center justify-center border border-dashed border-gray-850 rounded-xl p-4 text-center">
                      <p className="text-xs text-secondary italic">Select a friend to view their video training logs and write feedback.</p>
                    </div>
                  ) : friendLogsLoading ? (
                    <div className="h-[200px] flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border-2 border-neon border-t-transparent animate-spin" />
                    </div>
                  ) : selectedFriendLogs.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-center">
                      <p className="text-xs text-secondary italic">No training logs found for this user.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                      {selectedFriendLogs.map((log) => (
                        <div key={log.id} className="bg-main/20 border border-gray-850 p-4 rounded-xl space-y-3">
                          <div className="flex justify-between items-center border-b border-gray-850 pb-2">
                            <span className="text-[10px] text-secondary">{new Date(log.created_at).toLocaleDateString()}</span>
                            <span className="text-[9px] bg-neon/10 border border-neon/30 text-neon px-2 py-0.5 rounded uppercase font-bold">
                              {log.attire_type}
                            </span>
                          </div>
                          <p className="text-xs text-secondary italic font-serif">"{log.notes || 'No summary notes'}"</p>

                          {/* Critique input */}
                          <div className="space-y-2 pt-2 border-t border-gray-850">
                            <label className="text-[9px] font-bold text-secondary uppercase tracking-wider block">Write Peer Critique</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={critiqueInputs[log.id] || ''}
                                onChange={(e) => setCritiqueInputs({ ...critiqueInputs, [log.id]: e.target.value })}
                                placeholder="e.g. Keep your elbows in..."
                                className="flex-1 bg-main border border-gray-850 rounded px-2.5 py-1.5 text-xs text-primary focus:outline-none"
                              />
                              <button
                                onClick={() => handleSubmitCritique(log.id)}
                                className="bg-neon text-main text-[10px] font-bold px-3 py-1.5 rounded transition-colors"
                              >
                                Post
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
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
              className="w-full mt-6 bg-main text-secondary/65 cursor-not-allowed text-xs font-semibold py-2.5 rounded-lg border border-secondary/20"
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
                <span className="text-neon font-medium">{profile?.access_role || 'User-Free'}</span>
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
