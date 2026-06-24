'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { fetchUserHistory } from '../actions/fetchHistory';
import { getBetaSettings, requestBetaAccess, verifyBetaAccess, handleInvitedUserSignUp, deleteUserAccount, getAllowedBetaRoles } from '../actions/betaActions';
import { useAuth } from '../AuthGuard';

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
  agreed_to_terms_at?: string;
  agreed_to_privacy_at?: string;
  agreed_to_waiver_at?: string;
  agreed_to_nda_at?: string;
  default_landing_page?: string;
  beta_code?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { session, profile, loading, refreshProfile } = useAuth();

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
  const [defaultLandingPage, setDefaultLandingPage] = useState('Dashboard');

  // Redirect tracking
  const [initialSessionChecked, setInitialSessionChecked] = useState(false);
  const [hadNoSessionInitially, setHadNoSessionInitially] = useState(false);

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
  const [allowedBetaRoles, setAllowedBetaRoles] = useState<string[]>(['User-Free', 'User-Premium', 'User-Student', 'Teacher', 'Admin']);

  // Invite Completion States
  const [isInviteCompleteNeeded, setIsInviteCompleteNeeded] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Legal Agreement States
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeWaiver, setAgreeWaiver] = useState(false);
  const [agreeNda, setAgreeNda] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | 'waiver' | 'nda' | null>(null);

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

  // Password Change States (authenticated)
  const [newPasswordState, setNewPasswordState] = useState('');
  const [confirmPasswordState, setConfirmPasswordState] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Forgot Password Request States (unauthenticated)
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Set New Password States (recovery URL redirect)
  const [isSettingNewPassword, setIsSettingNewPassword] = useState(false);
  const [newRecoveryPassword, setNewRecoveryPassword] = useState('');
  const [confirmRecoveryPassword, setConfirmRecoveryPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Subscription Toggle & Deletion flow states
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPasswordState.length < 6) {
      setPwError('Password must be at least 6 characters.');
      return;
    }
    if (newPasswordState !== confirmPasswordState) {
      setPwError('Passwords do not match.');
      return;
    }

    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPasswordState });
      if (error) throw error;
      setPwSuccess('Password updated successfully!');
      setNewPasswordState('');
      setConfirmPasswordState('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleResetPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);
    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/profile?recovery=true`,
      });
      if (error) throw error;
      setResetSuccess('Password reset link sent! Check your email inbox.');
      setResetEmail('');
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSaveRecoveryPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(null);

    if (newRecoveryPassword.length < 6) {
      setRecoveryError('Password must be at least 6 characters.');
      return;
    }
    if (newRecoveryPassword !== confirmRecoveryPassword) {
      setRecoveryError('Passwords do not match.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newRecoveryPassword });
      if (error) throw error;
      setRecoverySuccess('Password reset successfully! Redirecting you...');
      
      await refreshProfile();
      
      setTimeout(() => {
        setIsSettingNewPassword(false);
        setNewRecoveryPassword('');
        setConfirmRecoveryPassword('');
      }, 2000);
    } catch (err: any) {
      setRecoveryError(err.message || 'Failed to save password.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleToggleSubscription = async () => {
    if (!session || !profile) return;
    setSubscriptionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const nextRole = profile.access_role === 'User-Free' ? 'User-Premium' : 'User-Free';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          access_role: nextRole,
          is_premium_tier: nextRole === 'User-Premium'
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;
      setSuccess(`Subscription successfully updated to ${nextRole === 'User-Premium' ? 'Premium' : 'Free'}!`);
      await refreshProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to update subscription.');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (deleteConfirmText !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion.');
      return;
    }

    setDeleteLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await deleteUserAccount(session.user.id, session.user.id);
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete account.');
      }
      
      // Sign out and redirect
      await supabase.auth.signOut();
      router.push('/profile');
    } catch (err: any) {
      setError(err.message || 'An error occurred during account deletion.');
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const isRecovery = params.get('recovery') === 'true' || hash.includes('type=recovery');
      if (isRecovery) {
        setIsSettingNewPassword(true);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'light';
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

    getAllowedBetaRoles().then((roles) => {
      if (roles && roles.length > 0) {
        setAllowedBetaRoles(roles);
        setSelectedRole(roles[0] as any);
      }
    });

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const code = params.get('beta_code');
      const urlEmail = params.get('email');
      
      const isInviteAccept = hash.includes('type=invite');

      if (code) {
        setBetaCode(code);
        setIsSignUp(true); // Switch to signup automatically when a link is clicked
        if (urlEmail) {
          setEmail(decodeURIComponent(urlEmail));
        }
        if (!isInviteAccept) {
          supabase.auth.signOut();
        }
      }
    }
  }, []);

  useEffect(() => {
    if (profile) {
      populateForm(profile as Profile);
    }
  }, [profile]);

  useEffect(() => {
    if (session?.user?.id) {
      loadGymData(session.user.id);
      loadFriendsData(session.user.id);
    }
  }, [session]);

  // Post-login redirect hook
  useEffect(() => {
    if (!loading && !initialSessionChecked) {
      setInitialSessionChecked(true);
      if (!session) {
        setHadNoSessionInitially(true);
      }
    }
  }, [loading, session, initialSessionChecked]);

  useEffect(() => {
    if (session && profile && initialSessionChecked && hadNoSessionInitially) {
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
      
      if (path !== '/profile') {
        router.push(path);
      }
      setHadNoSessionInitially(false);
    }
  }, [session, profile, initialSessionChecked, hadNoSessionInitially, router]);

  useEffect(() => {
    const checkProfileExistence = async () => {
      if (!session || loading) return;

      if (profile) {
        setIsInviteCompleteNeeded(false);
        return;
      }

      const isInvite = typeof window !== 'undefined' && window.location.hash.includes('type=invite');
      const hasNoName = !session?.user?.user_metadata?.name || session?.user?.user_metadata?.name === 'New Grappler';

      if (isInvite || hasNoName) {
        setIsInviteCompleteNeeded(true);
        return;
      }

      // Auto-create default profile row if none exists
      try {
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const urlBetaCode = urlParams?.get('beta_code');
        const finalBetaCode = urlBetaCode || session?.user?.user_metadata?.beta_code || null;

        const isSpecialEmail = session?.user?.email?.toLowerCase() === 'kodiaksoul@grappletrack.com';
        const metadataRole = isSpecialEmail ? 'Master Admin' : (session?.user?.user_metadata?.access_role || 'User-Free');
        const defaultProfile = {
          id: session.user.id,
          username: `grappler_${session.user.id.substring(0, 8)}`,
          username_updated_at: new Date(0).toISOString(),
          name: session?.user?.user_metadata?.name || 'New Grappler',
          current_rank: 'White',
          stripes: 0,
          gender: 'Male',
          weight_lbs: 170,
          privacy_state: 'Public',
          is_two_factor_enabled: false,
          is_premium_tier: (metadataRole !== 'User-Free' || !!finalBetaCode),
          access_role: metadataRole,
          agreed_to_terms_at: session?.user?.user_metadata?.agreed_to_terms_at || null,
          agreed_to_privacy_at: session?.user?.user_metadata?.agreed_to_privacy_at || null,
          agreed_to_waiver_at: session?.user?.user_metadata?.agreed_to_waiver_at || null,
          agreed_to_nda_at: session?.user?.user_metadata?.agreed_to_nda_at || null,
          default_landing_page: 'Dashboard',
          beta_code: finalBetaCode,
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .upsert(defaultProfile);

        if (!insertError) {
          await refreshProfile();
          if (defaultProfile.access_role === 'Master Admin') {
            router.push('/master-admin');
          }
        }
      } catch (err) {
        console.error('Error auto-creating profile:', err);
      }
    };

    checkProfileExistence();
  }, [session, profile, loading, refreshProfile, router]);

  useEffect(() => {
    if (profile?.access_role === 'Master Admin') {
      router.push('/master-admin');
    }
  }, [profile, router]);

  const handleCompleteInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError(null);
    setSuccess(null);

    if (!agreeTerms || !agreePrivacy || !agreeWaiver || !agreeNda) {
      setError('You must accept the Terms of Service, Privacy Policy, Release of Liability Waiver, and Beta Testing and Non-Disclosure Agreement to activate your account.');
      return;
    }

    setInviteLoading(true);
    try {
      // 1. Update password and metadata
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlBetaCode = urlParams?.get('beta_code');
      const finalBetaCode = urlBetaCode || session?.user?.user_metadata?.beta_code || null;

      const { error: passwordError } = await supabase.auth.updateUser({
        password: invitePassword,
        data: {
          name: inviteName,
          access_role: 'User-Premium',
          agreed_to_terms_at: new Date().toISOString(),
          agreed_to_privacy_at: new Date().toISOString(),
          agreed_to_waiver_at: new Date().toISOString(),
          agreed_to_nda_at: new Date().toISOString(),
          beta_code: finalBetaCode || undefined,
        }
      });
      if (passwordError) throw passwordError;

      // 2. Create the profile row
      const defaultProfile = {
        id: session.user.id,
        username: `grappler_${session.user.id.substring(0, 8)}`,
        username_updated_at: new Date(0).toISOString(),
        name: inviteName,
        current_rank: 'White',
        stripes: 0,
        gender: 'Male',
        weight_lbs: 170,
        privacy_state: 'Public',
        is_two_factor_enabled: false,
        is_premium_tier: true,
        access_role: 'User-Premium' as const,
        agreed_to_terms_at: new Date().toISOString(),
        agreed_to_privacy_at: new Date().toISOString(),
        agreed_to_waiver_at: new Date().toISOString(),
        agreed_to_nda_at: new Date().toISOString(),
        default_landing_page: 'Dashboard',
        beta_code: finalBetaCode,
      };

      const { error: insertError } = await supabase
        .from('profiles')
        .insert(defaultProfile);

      if (insertError) throw insertError;

      // 3. Clear URL hash so refreshing doesn't trigger invite flow again
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }

      await refreshProfile();
      populateForm(defaultProfile as any);
      setIsInviteCompleteNeeded(false);
      setSuccess('Account setup completed successfully!');

      // Redirect to landing page after registration completion
      const landingPage = defaultProfile.default_landing_page || 'Dashboard';
      let path = '/dashboard';
      if (landingPage === 'Dictionary') path = '/dictionary';
      else if (landingPage === 'History') path = '/history';
      else if (landingPage === 'Gym Desk') path = '/gymdesk';
      else if (landingPage === 'Profile') path = '/profile';
      
      if (path !== '/profile') {
        router.push(path);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration.');
    } finally {
      setInviteLoading(false);
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
    setDefaultLandingPage(data.default_landing_page || 'Dashboard');
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
        default_landing_page: defaultLandingPage,
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
      await refreshProfile();
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
        if (!agreeTerms || !agreePrivacy || !agreeWaiver || !agreeNda) {
          throw new Error('You must accept the Terms of Service, Privacy Policy, Release of Liability Waiver, and Beta Testing and Non-Disclosure Agreement to sign up.');
        }
 
        if (betaModeEnabled) {
          if (!betaCode.trim()) {
            throw new Error('Beta access code is required to sign up.');
          }
          const isVerified = await verifyBetaAccess(targetEmail, betaCode);
          if (!isVerified) {
            throw new Error('Invalid or unapproved Beta Access Code for this email address.');
          }
          if (!allowedBetaRoles.includes(selectedRole)) {
            throw new Error(`The role "${selectedRole}" is currently restricted and unavailable for registration.`);
          }
        }
 
        // Pre-populate invited user records if they exist to prevent client-side signUp from discarding password/metadata
        const signUpRes = await handleInvitedUserSignUp(targetEmail, password, {
          name: authName,
          access_role: selectedRole,
          agreed_to_terms_at: new Date().toISOString(),
          agreed_to_privacy_at: new Date().toISOString(),
          agreed_to_waiver_at: new Date().toISOString(),
          agreed_to_nda_at: new Date().toISOString(),
          beta_code: betaCode || undefined,
        });
        if (signUpRes && !signUpRes.success) {
          throw new Error(signUpRes.error);
        }
 
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/profile`,
            data: {
              name: authName,
              access_role: selectedRole,
              agreed_to_terms_at: new Date().toISOString(),
              agreed_to_privacy_at: new Date().toISOString(),
              agreed_to_waiver_at: new Date().toISOString(),
              agreed_to_nda_at: new Date().toISOString(),
              beta_code: betaCode || undefined,
            },
          },
        });
        if (signUpError) throw signUpError;
 
        // If the user was invited, the signUp call will succeed but their user_metadata won't have the name/access_role.
        // We check if we have a session. If so, let's explicitly update user metadata and upsert the profile.
        const sessionObj = signUpData?.session;
        if (sessionObj) {
          try {
            // Update auth user metadata
            await supabase.auth.updateUser({
              data: {
                name: authName,
                access_role: selectedRole,
                agreed_to_terms_at: new Date().toISOString(),
                agreed_to_privacy_at: new Date().toISOString(),
                agreed_to_waiver_at: new Date().toISOString(),
                agreed_to_nda_at: new Date().toISOString(),
                beta_code: betaCode || undefined,
              }
            });
 
            // Insert or update profile in database directly to ensure it has the correct values
            const metadataRole = targetEmail.toLowerCase() === 'kodiaksoul@grappletrack.com' ? 'Master Admin' : selectedRole;
            const defaultProfile = {
              id: sessionObj.user.id,
              username: `grappler_${sessionObj.user.id.substring(0, 8)}`,
              username_updated_at: new Date(0).toISOString(),
              name: authName || 'New Grappler',
              current_rank: 'White',
              stripes: 0,
              gender: 'Male',
              weight_lbs: 170,
              privacy_state: 'Public',
              is_two_factor_enabled: false,
              is_premium_tier: (metadataRole !== 'User-Free' || !!betaCode),
              access_role: metadataRole,
              agreed_to_terms_at: new Date().toISOString(),
              agreed_to_privacy_at: new Date().toISOString(),
              agreed_to_waiver_at: new Date().toISOString(),
              agreed_to_nda_at: new Date().toISOString(),
              default_landing_page: 'Dashboard',
              beta_code: betaCode || null,
            };

            await supabase.from('profiles').upsert(defaultProfile);
          } catch (updateErr) {
            console.error('Error updating metadata/profile for invited user:', updateErr);
          }
        }

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

  if (isSettingNewPassword) {
    return (
      <div className="max-w-md mx-auto my-12">
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-block w-3 h-3 rounded-full bg-neon mb-3 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-primary uppercase">
              RESET PASSWORD
            </h1>
            <p className="text-xs text-secondary mt-1">
              Enter your new account password to regain portal access.
            </p>
          </div>

          {recoveryError && (
            <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-xs leading-relaxed">
              {recoveryError}
            </div>
          )}

          {recoverySuccess && (
            <div className="mb-6 p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-neon text-xs leading-relaxed">
              {recoverySuccess}
            </div>
          )}

          <form onSubmit={handleSaveRecoveryPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                New Password
              </label>
              <input
                type="password"
                required
                placeholder="New password (min 6 chars)"
                value={newRecoveryPassword}
                onChange={(e) => setNewRecoveryPassword(e.target.value)}
                className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                placeholder="Confirm new password"
                value={confirmRecoveryPassword}
                onChange={(e) => setConfirmRecoveryPassword(e.target.value)}
                className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={recoveryLoading}
              className="w-full bg-neon hover:bg-neon/90 text-main font-bold text-sm py-3 rounded-lg shadow-lg shadow-neon/10 transition-colors duration-200 mt-2 flex items-center justify-center"
            >
              {recoveryLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-main border-t-transparent animate-spin" />
              ) : (
                'Save Password'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Complete Registration form if user accepted an invitation but has no profile record yet
  if (session && isInviteCompleteNeeded) {
    return (
      <div className="max-w-md mx-auto my-12">
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-block w-3 h-3 rounded-full bg-neon mb-3 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              COMPLETE YOUR REGISTRATION
            </h1>
            <p className="text-xs text-secondary mt-1">
              Choose a password and enter your name to activate your account
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

          <form onSubmit={handleCompleteInviteSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={session.user.email}
                className="w-full bg-main/50 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-secondary cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Roger Gracie"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
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
                placeholder="Choose a password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                className="w-full bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon/80 transition-colors"
              />
            </div>

            {/* Legal Agreement Checkboxes */}
            <div className="space-y-3 pt-2 pb-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="inviteAgreeTerms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 accent-neon rounded border-gray-850 focus:ring-neon cursor-pointer h-4 w-4 bg-main"
                />
                <label htmlFor="inviteAgreeTerms" className="text-xs text-secondary leading-relaxed select-none">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setActiveLegalModal('terms')}
                    className="text-neon hover:underline inline font-semibold"
                  >
                    Terms of Service
                  </button>
                </label>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="inviteAgreePrivacy"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="mt-1 accent-neon rounded border-gray-850 focus:ring-neon cursor-pointer h-4 w-4 bg-main"
                />
                <label htmlFor="inviteAgreePrivacy" className="text-xs text-secondary leading-relaxed select-none">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setActiveLegalModal('privacy')}
                    className="text-neon hover:underline inline font-semibold"
                  >
                    Privacy Policy
                  </button>
                </label>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="inviteAgreeWaiver"
                  checked={agreeWaiver}
                  onChange={(e) => setAgreeWaiver(e.target.checked)}
                  className="mt-1 accent-neon rounded border-gray-850 focus:ring-neon cursor-pointer h-4 w-4 bg-main"
                />
                <label htmlFor="inviteAgreeWaiver" className="text-xs text-secondary leading-relaxed select-none">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setActiveLegalModal('waiver')}
                    className="text-neon hover:underline inline font-semibold"
                  >
                    Release of Liability Waiver
                  </button>
                </label>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="inviteAgreeNda"
                  checked={agreeNda}
                  onChange={(e) => setAgreeNda(e.target.checked)}
                  className="mt-1 accent-neon rounded border-gray-850 focus:ring-neon cursor-pointer h-4 w-4 bg-main"
                />
                <label htmlFor="inviteAgreeNda" className="text-xs text-secondary leading-relaxed select-none">
                  By checking here you agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setActiveLegalModal('nda')}
                    className="text-neon hover:underline inline font-semibold"
                  >
                    Beta Testing and Non-Disclosure Agreement
                  </button>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={inviteLoading}
              className="w-full bg-neon hover:bg-neon/90 text-bg-main font-semibold text-sm py-3 rounded-lg shadow-lg shadow-neon/10 transition-colors duration-200 mt-2 flex items-center justify-center"
            >
              {inviteLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-bg-main border-t-transparent animate-spin" />
              ) : (
                'Activate Account'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Login Panel if Unauthenticated
  if (!session) {
    if (isForgotPassword) {
      return (
        <div className="max-w-md mx-auto my-12">
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-8 shadow-xl">
            <div className="text-center mb-8">
              <div className="inline-block w-3 h-3 rounded-full bg-neon mb-3 animate-pulse" />
              <h1 className="text-2xl font-bold tracking-tight text-primary uppercase">
                FORGOT PASSWORD
              </h1>
              <p className="text-xs text-secondary mt-1">
                Enter your email address to receive a recovery link.
              </p>
            </div>

            {resetError && (
              <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-xs leading-relaxed">
                {resetError}
              </div>
            )}

            {resetSuccess && (
              <div className="mb-6 p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-neon text-xs leading-relaxed">
                {resetSuccess}
              </div>
            )}

            <form onSubmit={handleResetPasswordRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@domain.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-neon hover:bg-neon/90 text-main font-bold text-sm py-3 rounded-lg shadow-lg shadow-neon/10 transition-colors duration-200 mt-2 flex items-center justify-center"
              >
                {resetLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-main border-t-transparent animate-spin" />
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-800/60 text-center">
              <button
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetError(null);
                  setResetSuccess(null);
                }}
                className="text-xs text-secondary hover:text-neon transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto my-12">
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-block w-3 h-3 rounded-full bg-neon mb-3 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-primary uppercase">
              GRAPPLE TRACKER
            </h1>
            <p className="text-xs text-neon mt-1 tracking-widest uppercase font-semibold">
              TRAIN ANALYZE EVOLVE
            </p>
            <div className="mt-3">
              <span className="inline-block text-[9px] bg-neon/10 border border-neon/30 text-neon px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                Beta v0.2.6
              </span>
            </div>
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
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider">
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setResetError(null);
                      setResetSuccess(null);
                    }}
                    className="text-xs text-neon hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
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
                  {[
                    { value: 'User-Free', label: 'User - Free' },
                    { value: 'User-Premium', label: 'User - Premium' },
                    { value: 'User-Student', label: 'User - Student' },
                    { value: 'Teacher', label: 'Teacher' },
                    { value: 'Admin', label: 'Admin' }
                  ]
                    .filter(role => !betaModeEnabled || allowedBetaRoles.includes(role.value))
                    .map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))
                  }
                </select>
              </div>
            )}

            {isSignUp && (
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="agreeTerms"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-1 accent-neon rounded border-gray-850 focus:ring-neon cursor-pointer h-4 w-4 bg-main"
                  />
                  <label htmlFor="agreeTerms" className="text-xs text-secondary leading-relaxed select-none">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setActiveLegalModal('terms')}
                      className="text-neon hover:underline inline font-semibold"
                    >
                      Terms of Service
                    </button>
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="agreePrivacy"
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                    className="mt-1 accent-neon rounded border-gray-850 focus:ring-neon cursor-pointer h-4 w-4 bg-main"
                  />
                  <label htmlFor="agreePrivacy" className="text-xs text-secondary leading-relaxed select-none">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setActiveLegalModal('privacy')}
                      className="text-neon hover:underline inline font-semibold"
                    >
                      Privacy Policy
                    </button>
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="agreeWaiver"
                    checked={agreeWaiver}
                    onChange={(e) => setAgreeWaiver(e.target.checked)}
                    className="mt-1 accent-neon rounded border-gray-850 focus:ring-neon cursor-pointer h-4 w-4 bg-main"
                  />
                  <label htmlFor="agreeWaiver" className="text-xs text-secondary leading-relaxed select-none">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setActiveLegalModal('waiver')}
                      className="text-neon hover:underline inline font-semibold"
                    >
                      Release of Liability Waiver
                    </button>
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="agreeNda"
                    checked={agreeNda}
                    onChange={(e) => setAgreeNda(e.target.checked)}
                    className="mt-1 accent-neon rounded border-gray-850 focus:ring-neon cursor-pointer h-4 w-4 bg-main"
                  />
                  <label htmlFor="agreeNda" className="text-xs text-secondary leading-relaxed select-none">
                    By checking here you agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setActiveLegalModal('nda')}
                      className="text-neon hover:underline inline font-semibold"
                    >
                      Beta Testing and Non-Disclosure Agreement
                    </button>
                  </label>
                </div>
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
          
          {/* Legal Document Modal Overlay */}
          {activeLegalModal && (
            <div className="fixed inset-0 bg-main/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-surface border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative overflow-hidden">
                <div className="p-5 border-b border-gray-800/80 flex items-center justify-between">
                  <h3 className="font-bold text-primary text-sm tracking-widest uppercase">
                    {activeLegalModal === 'terms' && 'Terms of Service'}
                    {activeLegalModal === 'privacy' && 'Privacy Policy'}
                    {activeLegalModal === 'waiver' && 'Release of Liability Waiver'}
                    {activeLegalModal === 'nda' && 'Beta Testing and Non-Disclosure Agreement'}
                  </h3>
                  <button
                    onClick={() => setActiveLegalModal(null)}
                    className="text-secondary hover:text-primary transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 text-xs text-secondary leading-relaxed max-w-none">
                  {activeLegalModal === 'terms' && (
                    <div className="space-y-4 whitespace-pre-wrap text-left">
                      <h4 className="text-sm font-bold text-primary">TERMS OF SERVICE</h4>
                      <p className="text-[10px] text-secondary">Last Updated: May 2026</p>
                      <p>Welcome to GrappleTracker ("the Application"). By accessing our live testing domains, registering an account, or logging training metrics, you agree to be bound by these Terms of Service. These Terms constitute a binding legal agreement between you and GrappleTracker, governed by the laws of the State of Texas, USA.</p>
                      
                      <p><strong>1. Eligibility and Staging Accounts</strong><br />
                      GrappleTracker is currently operating under a closed beta staging track. Access tokens, codes, or credentials issued to you are personal, non-transferable, and may be revoked by the Administration at any time without notice or liability.</p>

                      <p><strong>2. User Content & Training Metrics</strong><br />
                      You retain full ownership of the data, notes, opponent metrics, and technical videos you log into the platform. By entering data, you grant GrappleTracker a non-exclusive, worldwide, royalty-free license to store, process, and display this data strictly to provide tracking features to you and your designated peers or affiliated academies.</p>

                      <p><strong>3. Academy Affiliation & Data Governance</strong><br />
                      If you affiliate your account with a gym or school on the platform (modifying your status to "User-Student"), you explicitly authorize designated Teachers and Admins associated with that specific academy tenant to view your training logs, performance metrics, and history ledger.</p>
                      <p><em>Unlinking Provision:</em> Your data belongs entirely to you. The moment you leave or unlink from an academy roster, all access privileges for that school’s Teachers and Admins are instantly revoked. The school can no longer view any part of your historical or future training ledger.</p>
                      <p><em>Joining Provision:</em> When you explicitly join a new academy roster, the designated instructors of that school are granted immediate authorization to view your past and present training logs for technical evaluation and belt graduation analytics.</p>

                      <p><strong>4. Assumption of Risk & Liability Disclaimer</strong><br />
                      GrappleTracker is a software performance log. Martial arts, combat sports, and Brazilian Jiu-Jitsu carry inherent physical risks of severe injury, paralysis, or death. GrappleTracker does not provide physical training advice, medical critique, or health diagnoses. You agree that GrappleTracker and its creators operate within the jurisdiction of Texas, USA, and hold zero liability for any physical injury, property damage, data anomaly, or hardware failure resulting from or occurring during your use of the software.</p>

                      <p><strong>5. Subscription Tiers, Billing, and Ad-Mask Simulations</strong><br />
                      The application tests features across separate access tiers. While some tiers are currently simulated, future upgrades will utilize secure third-party billing providers, including Stripe and PayPal. We reserve the right to alter features, locks, pricing structures, and tier requirements without notice during the beta testing lifecycle.</p>

                      <p><strong>6. Termination</strong><br />
                      We reserve the absolute right to suspend or terminate staging accounts, erase legacy development databases, or modify data tracking configurations at our sole discretion to preserve system stability.</p>
                    </div>
                  )}
                  {activeLegalModal === 'privacy' && (
                    <div className="space-y-4 whitespace-pre-wrap text-left">
                      <h4 className="text-sm font-bold text-primary">PRIVACY POLICY</h4>
                      <p className="text-[10px] text-secondary">Last Updated: May 2026</p>
                      <p>This Privacy Policy outlines how GrappleTracker collects, stores, and handles the personal identity tokens and training metrics you generate inside the application workspace.</p>

                      <p><strong>1. Data We Collect</strong><br />
                      • <em>Account Identity Tokens:</em> Email addresses and usernames processed securely via Supabase Authentication.<br />
                      • <em>Performance Metrics:</em> Training metadata including attire choices, rolling modalities, round timestamps, notes, and technical success vectors.<br />
                      • <em>Ecosystem Variables:</em> Training partner names, belt classifications, and relative weight parameters entered by you to compute analytics.<br />
                      • <em>Integrated Media:</em> Embedded YouTube video URLs attached to your technique cards for video playback analysis.<br />
                      • <em>Payment Information:</em> Future transactional billing will be managed exclusively through secure, PCI-compliant third-party gateways (Stripe and PayPal). GrappleTracker never stores or processes raw credit card numbers or financial account credentials on its own servers.</p>

                      <p><strong>2. How We Use Data</strong><br />
                      We use your data strictly to run the core features of your dashboard. This includes rendering your training schedule calendar, generating history ledgers, calculating performance trends, and syncing your curriculum layouts with your academy. We do not, and will never, sell or distribute your training metrics or identity emails to third-party data brokers.</p>

                      <p><strong>3. Data Isolation and Academy Access Rules</strong><br />
                      By default, your data is isolated so that only your authenticated user token can view it.<br />
                      • <em>Peer Sharing:</em> If you choose to upgrade to an independent tier with peer network features, your data is shared only with specific profiles you explicitly select and authorize as "Friends."<br />
                      • <em>Academy Mappings:</em> If you associate your account with a gym, your metrics become visible to that school's authorized staff. The moment you unlink your profile from that school, the database instantly cuts off the school's viewing lens, returning complete, isolated data control to you.</p>

                      <p><strong>4. Future Analytics Tracking</strong><br />
                      We reserve the right to integrate standard, privacy-compliant external web analytics tracking tools in future optimization updates to track user engagement patterns and interface choke points.</p>

                      <p><strong>5. Data Deletion & Privacy Rights</strong><br />
                      You retain the absolute right to erase your profile. Deleting your account via your settings hub will execute a cascading purge across our active database tables, destroying your identity tokens and history logs permanently. For privacy inquiries, manual data removal, or security audits, contact us directly at: privacy@grappletrackapp.com.</p>
                    </div>
                  )}
                  {activeLegalModal === 'waiver' && (
                    <div className="space-y-4 whitespace-pre-wrap text-left">
                      <h4 className="text-sm font-bold text-primary">RELEASE OF LIABILITY, WAIVER OF CLAIMS, AND ASSUMPTION OF RISK AGREEMENT</h4>
                      <p className="text-[10px] text-secondary">Last Updated: May 2026</p>
                      <p>BY CREATING AN ACCOUNT, COMPLETING THE REGISTRATION PROCESS, OR USING GRAPPLETRACKER ("THE APPLICATION"), YOU EXPLICITLY ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND VOLUNTARILY AGREE TO ALL THE TERMS CONTAINED WITHIN THIS RELEASE OF LIABILITY WAIVER. IF YOU DO NOT AGREE, DISCONTINUE USE OF THE APPLICATION IMMEDIATELY.</p>

                      <p><strong>1. Purpose of the Application</strong><br />
                      GrappleTracker is strictly a digital data logging, tracking, and metric visualization notebook software tool. The Application provides data input cards, historical timelines, calendars, and structural graphs to assist combat sports practitioners in reviewing their training volume. GrappleTracker does not provide physical training, technical instruction, medical advice, safety supervision, or fitness coaching.</p>

                      <p><strong>2. Inherent Physical Risks of Combat Sports</strong><br />
                      You explicitly acknowledge and understand that the practice of martial arts, combat sports, submission grappling, and Brazilian Jiu-Jitsu (BJJ) involves strenuous physical exertion and highly dangerous contact. Training involves inherent risks of severe physical injury, including but not limited to: joint dislocations, bone fractures, ligament tears, concussions, skin infections, cardiovascular overexertion, paralysis, or death.</p>
                      <p>You acknowledge that using GrappleTracker to document these activities occurs entirely independently of your physical performance on the mats.</p>

                      <p><strong>3. Assumption of Risk</strong><br />
                      You agree that your participation in any physical activity, sparring round, positional drill, or training session recorded within GrappleTracker is entirely voluntary. You assume full, sole, and exclusive responsibility for all risks of personal injury, illness, death, or property damage that may occur while you are engaging in training, regardless of whether those sessions are logged or visualized within the Application.</p>

                      <p><strong>4. Waiver of Claims and Release of Liability</strong><br />
                      To the maximum extent permitted by applicable law, you hereby release, waive, acquit, and forever discharge GrappleTracker, its creators, developers, owners, administrators, affiliates, and agents (collectively referred to as the "Released Parties") from any and all claims, demands, causes of action, lawsuits, liabilities, or financial damages arising out of, or connected in any way to, your use of the software or your physical training.</p>
                      <p>This release includes, but is not limited to, claims for personal injury or property damage resulting from:<br />
                      • Your execution or drilling of techniques, positions, or strategies recorded or documented within the Application.<br />
                      • Any technical instructions, peer critiques, or teacher/coach feedback shared, inputted, or transmitted through the software's sharing tools.<br />
                      • Any software malfunctions, data inaccuracies, tracking errors, or application downtime.</p>

                      <p><strong>5. Hold Harmless and Indemnification</strong><br />
                      You agree to indemnify and hold harmless the Released Parties from any and all liabilities, losses, damages, costs, or expenses (including reasonable attorneys' fees) incurred as a result of any claims brought by you, your family, your heirs, or any third party arising out of your actions, physical training sessions, or use of the Application.</p>

                      <p><strong>6. Health and Fitness Representation</strong><br />
                      By utilizing GrappleTracker, you represent and warrant that you are in good physical health and possess the functional capacity to participate in strenuous physical training. You acknowledge that it is your sole responsibility to consult with a qualified physician prior to engaging in combat sports or utilizing tracking metrics to benchmark your exertion.</p>

                      <p><strong>7. Governing Law and Severability</strong><br />
                      This agreement shall be governed by, and construed in accordance with, the laws of the State of Texas, USA, without regard to conflict of law principles. If any provision or clause of this Waiver is found by a court of competent jurisdiction to be invalid, illegal, or unenforceable, the remaining provisions shall remain in full force and effect.</p>

                      <p><strong>ACKNOWLEDGEMENT OF UNDERSTANDING</strong><br />
                      BY INTERACTING WITH THE APPLICATION SIGN-UP SYSTEM, I VERIFY THAT I AM AT LEAST 18 YEARS OF AGE, HAVE READ THIS RELEASE OF LIABILITY AND ASSUMPTION OF RISK AGREEMENT, FULLY UNDERSTAND THAT I AM WAIVING SUBSTANTIAL LEGAL RIGHTS (INCLUDING THE RIGHT TO SUE GRAPPLETRACKER AND ITS CREATORS), AND AGREE TO IT FREELY AND VOLUNTARILY WITHOUT ANY INDUCEMENT.</p>
                    </div>
                  )}
                  {activeLegalModal === 'nda' && (
                    <div className="space-y-4 whitespace-pre-wrap text-left">
                      <h4 className="text-sm font-bold text-primary">GRAPPLETRACKER APP BETA TESTING AND NON-DISCLOSURE AGREEMENT</h4>
                      <p className="text-[10px] text-secondary">Last Updated: May 27, 2026</p>
                      <p>This Beta Testing and Non-Disclosure Agreement (the "Agreement") is entered into by and between GrappleTrackerApp LLC ("Company") and you, the individual accessing, downloading, or using the beta version of the software application known as GrappleTrackerApp (the "Beta Software").</p>
                      <p>By checking the box "I agree," or by downloading, installing, or using the Beta Software, you agree to be bound by all the terms of this Agreement. If you do not agree, do not check the box and do not use the Beta Software.</p>
                      
                      <p><strong>1. Purpose of the Beta</strong><br />
                      Company is providing you with access to an early, pre-release version of the Beta Software for the sole purpose of testing, evaluating, and providing feedback to the Company.</p>
 
                      <p><strong>2. Confidential Information Defined</strong><br />
                      "Confidential Information" means any and all information disclosed by Company to you, or acquired by you during your testing of the Beta Software, which is not generally known to the public. This includes, but is not limited to:<br />
                      • The Beta Software itself, including its code, user interface, features, functionality, visual design, and performance metrics.<br />
                      • Screenshots, video recordings, or descriptions of the software.<br />
                      • Underlying logic, data models, algorithms, and technical architecture.<br />
                      • Product roadmaps, upcoming features, and business strategies.<br />
                      • Any feedback, bug reports, or suggestions you provide to the Company.</p>
 
                      <p><strong>3. Non-Disclosure and Use Restrictions</strong><br />
                      You agree that you will:<br />
                      • Keep all Confidential Information strictly confidential and take reasonable precautions to protect it from unauthorized disclosure.<br />
                      • NOT share, publish, tweet, post screenshots, stream video, or discuss the Beta Software, its features, or your experience on any public forum, social media platform, blog, or community (including but not limited to Reddit, X, YouTube, Discord, or public forums) without the express written consent of the Company.<br />
                      • NOT reverse engineer, decompile, disassemble, or attempt to derive the source code of the Beta Software.<br />
                      • NOT allow any third party to use, view, or access the Beta Software under your login credentials.</p>
 
                      <p><strong>4. Ownership of Intellectual Property & Feedback</strong><br />
                      • <em>Ownership:</em> Company retains all rights, title, and interest in and to the Beta Software, including all intellectual property rights. No license or rights are granted to you except the limited right to use the software for beta testing.<br />
                      • <em>Feedback License:</em> If you provide any feedback, bug reports, suggestions, or ideas to the Company ("Feedback"), you hereby assign to Company all right, title, and interest in such Feedback. Company is free to use, implement, and commercialize such Feedback without any obligation, restriction, or compensation to you.</p>
 
                      <p><strong>5. "AS IS" Disclaimer and Limitation of Liability</strong><br />
                      • <em>No Warranty:</em> You acknowledge that the Beta Software is a pre-release version, may contain bugs, errors, or inaccuracies, and may cause data loss or system instability. The Beta Software is provided entirely "AS IS" and without warranties of any kind.<br />
                      • <em>Assumption of Physical Risk:</em> Because the Beta Software tracks physical activities and combat sports (including Brazilian Jiu-Jitsu and grappling), you explicitly acknowledge that martial arts carry inherent risks of physical injury. The Beta Software is a tracking tool, not a medical or professional training adviser. You assume all physical risks while using the app, and Company shall not be liable for any physical injuries sustained during your training.<br />
                      • <em>Limitation of Liability:</em> In no event shall Company be liable for any damages, including lost data, lost profits, or personal injury, arising out of or related to this Agreement or the use of the Beta Software.</p>
 
                      <p><strong>6. Term and Termination</strong><br />
                      This Agreement and your right to use the Beta Software may be terminated by Company at any time, with or without cause, immediately upon notice. Your obligations of confidentiality under Section 3 shall survive for a period of five (5) years from the date you first agreed to this Agreement, or until the Confidential Information becomes publicly known through no fault of your own.</p>
 
                      <p><strong>7. Governing Law</strong><br />
                      This Agreement shall be governed by, and construed in accordance with, the laws of the State of Texas, without regard to its conflict of laws principles. Any legal action arising out of this Agreement must be brought exclusively in the state or federal courts located in Texas.</p>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-800/80 flex justify-end bg-surface/50">
                  <button
                    onClick={() => setActiveLegalModal(null)}
                    className="bg-neon hover:bg-neon/90 text-main font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
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
          Manage your Grapple Track credentials, visual handshake key, and lockout cooldowns.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Athletic Profile Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl">
          <h2 className="text-lg font-bold text-primary mb-6 flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-neon" />
            GRAPPLE TRACKER PROFILE
            <span className="text-[10px] font-bold text-neon bg-neon/10 px-2 py-0.5 rounded border border-neon/20 uppercase tracking-wider">
              Beta v0.2.6
            </span>
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
                  value={useMetric ? (Math.round(weightLbs / 2.20462) || '') : (weightLbs || '')}
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
                      value={heightCm || ''}
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
                        value={heightFt || ''}
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
                        value={heightInches || ''}
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

            {/* Default Landing Tab Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-800/40">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Default Landing Tab
                </label>
                <div className="relative">
                  <select
                    value={defaultLandingPage}
                    onChange={(e) => setDefaultLandingPage(e.target.value)}
                    className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-neon transition-colors appearance-none pr-10"
                  >
                    <option value="Dashboard">Dashboard</option>
                    <option value="Dictionary">Dictionary</option>
                    <option value="History">History</option>
                    {['Teacher', 'Admin', 'Master Admin'].includes(profile?.access_role) && (
                      <option value="Gym Desk">Gym Desk (if Teacher or Owner)</option>
                    )}
                    <option value="Profile">Profile</option>
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-secondary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-[10px] text-secondary mt-1.5 leading-relaxed">
                  Choose which section you land on automatically when opening the app.
                </p>
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

        {/* ACCOUNT MANAGEMENT */}
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-neon animate-pulse" />
            ACCOUNT MANAGEMENT
          </h2>
          <p className="text-xs text-secondary leading-relaxed">
            Manage your subscription status and billing preferences, or permanently deactivate your account and purge stored metadata.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subscription / Billing Controls */}
            <div className="bg-main/30 border border-gray-850 p-5 rounded-xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] text-neon font-bold uppercase tracking-wider block">Subscription Billing</span>
                {profile?.beta_code ? (
                  <>
                    <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                      Beta Member (Lifetime Premium)
                      <span className="text-[9px] bg-emerald-950/40 text-neon border border-emerald-800/40 px-2 py-0.5 rounded uppercase font-bold">
                        LIFETIME FREE
                      </span>
                    </h3>
                    <p className="text-xs text-secondary leading-relaxed">
                      You are registered with beta invite code <strong className="font-mono text-neon">{profile.beta_code}</strong>. You have unlimited lifetime premium privileges.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                      {profile?.access_role === 'User-Premium' ? 'Premium Tier' : 'Free Tier'}
                      <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold border ${
                        profile?.access_role === 'User-Premium'
                          ? 'bg-neon/10 border-neon/30 text-neon'
                          : 'bg-gray-950 border-gray-800 text-secondary'
                      }`}>
                        {profile?.access_role === 'User-Premium' ? 'PRO ACTIVE' : 'FREE ACCESS'}
                      </span>
                    </h3>
                    <p className="text-xs text-secondary leading-relaxed">
                      {profile?.access_role === 'User-Premium'
                        ? 'You have full access to all advanced analytics, sparring mirror matrices, and custom dictionaries.'
                        : 'Your account is currently on the Free plan. Upgrade to unlock all advanced logging capability.'}
                    </p>
                  </>
                )}
              </div>

              <div>
                {profile?.beta_code ? (
                  <button
                    disabled
                    className="w-full bg-main/50 text-secondary/40 text-xs font-semibold py-2.5 rounded-lg border border-secondary/10 cursor-not-allowed text-center"
                  >
                    Billing Managed by Beta Code
                  </button>
                ) : !['User-Free', 'User-Premium'].includes(profile?.access_role) ? (
                  <button
                    disabled
                    className="w-full bg-main/50 text-secondary/40 text-xs font-semibold py-2.5 rounded-lg border border-secondary/10 cursor-not-allowed text-center"
                  >
                    Role: {profile?.access_role} (Managed)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleSubscription}
                    disabled={subscriptionLoading}
                    className="w-full bg-neon hover:bg-neon/90 text-main font-bold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center animate-pulse-slow"
                  >
                    {subscriptionLoading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-main border-t-transparent animate-spin" />
                    ) : profile?.access_role === 'User-Premium' ? (
                      'Downgrade to Free Tier'
                    ) : (
                      'Upgrade to Premium Tier'
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Danger Zone Controls */}
            <div className="bg-red-950/5 border border-red-900/30 p-5 rounded-xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">Danger Zone</span>
                <h3 className="text-sm font-bold text-red-400">Deactivate Account</h3>
                <p className="text-xs text-secondary leading-relaxed">
                  {profile?.beta_code ? (
                    <span className="text-red-300 font-medium">
                      ⚠️ WARNING: Deleting your account will cause you to permanently forfeit your lifetime free beta invite code. This cannot be undone.
                    </span>
                  ) : (
                    <span>Permanently delete your profile and purge all training logs, rounds, friend visibility, and credentials from our staging servers.</span>
                  )}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/40 font-semibold text-xs py-2.5 rounded-lg transition-colors duration-200 text-center"
                >
                  Delete Account...
                </button>
              </div>
            </div>
          </div>
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

          {/* Change Password Card */}
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2">
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
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              CHANGE PASSWORD
            </h2>
            <p className="text-xs text-secondary leading-relaxed">
              Update your account credentials to log in securely next time.
            </p>

            {pwError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-xs leading-relaxed">
                {pwError}
              </div>
            )}

            {pwSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-neon text-xs leading-relaxed">
                {pwSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="New password (min 6 chars)"
                  value={newPasswordState}
                  onChange={(e) => setNewPasswordState(e.target.value)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={confirmPasswordState}
                  onChange={(e) => setConfirmPasswordState(e.target.value)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={pwLoading}
                className="w-full bg-neon hover:bg-neon/90 text-main font-bold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center"
              >
                {pwLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-main border-t-transparent animate-spin" />
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
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

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-main/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-red-950 rounded-2xl w-full max-w-md flex flex-col shadow-2xl relative overflow-hidden p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center mx-auto text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 animate-bounce">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-red-400 tracking-wider uppercase">
                Confirm Account Deletion
              </h3>
              <p className="text-xs text-secondary leading-relaxed">
                This is a permanent action. All your profile data, training history, personal dictionary, and gym affiliations will be purged. You cannot recover this data.
              </p>
            </div>

            {profile?.beta_code && (
              <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 text-xs text-red-300 leading-relaxed font-medium">
                ⚠️ IMPORTANT: As a Beta Member, you will lose your lifetime free premium access code (<strong className="font-mono text-neon select-all">{profile.beta_code}</strong>) forever.
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest text-center">
                  To confirm, type <span className="text-red-400 font-bold select-none">DELETE</span> below:
                </label>
                <input
                  type="text"
                  required
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-primary placeholder-gray-700 text-center uppercase tracking-widest focus:outline-none focus:border-red-900 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                    setError(null);
                  }}
                  className="flex-1 bg-main border border-gray-850 hover:border-gray-700 text-secondary font-bold text-xs py-2.5 rounded-lg transition-colors text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                  className="flex-1 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/40 font-bold text-xs py-2.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {deleteLoading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                  ) : (
                    'Confirm Delete'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
