'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import {
  getBetaSettings,
  toggleBetaMode,
  getBetaRequests,
  approveBetaRequest,
  deleteBetaRequest,
  updateMasterAdminEmail,
  getAllowedBetaRoles,
  updateAllowedBetaRoles,
  searchUserActivity
} from '../actions/betaActions';


interface BetaRequest {
  id: string;
  email: string;
  code: string | null;
  status: 'pending' | 'approved';
  created_at: string;
  updated_at: string;
}

export default function MasterAdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [betaMode, setBetaMode] = useState(false);
  const [requests, setRequests] = useState<BetaRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaveMessage, setEmailSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['User-Free', 'User-Premium', 'User-Student', 'Teacher', 'Admin']);
  const [savingRoles, setSavingRoles] = useState(false);
  const [rolesMessage, setRolesMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // User Activity Tracker States
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [activityResult, setActivityResult] = useState<any>(null);
  const [searchingActivity, setSearchingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndLoad() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (isMounted) {
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('access_role, contact_email')
          .eq('id', session.user.id)
          .single();

        if (error || !profile || profile.access_role !== 'Master Admin') {
          if (isMounted) {
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setIsAdmin(true);
          setAdminUser(session.user);
          setContactEmail(profile.contact_email || '');
        }

        // Load Settings & Requests
        const enabled = await getBetaSettings();
        if (isMounted) setBetaMode(enabled);

        const rolesRes = await getAllowedBetaRoles();
        if (isMounted) setAllowedRoles(rolesRes || ['User-Free', 'User-Premium', 'User-Student', 'Teacher', 'Admin']);

        const res = await getBetaRequests(session.user.id);
        if (isMounted && res.success) {
          setRequests(res.requests || []);
        }
      } catch (err) {
        console.error('Error loading master admin dashboard:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkAuthAndLoad();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleBetaMode = async () => {
    if (!adminUser) return;
    const originalState = betaMode;
    const targetState = !originalState;
    setBetaMode(targetState); // optimistic update

    const res = await toggleBetaMode(adminUser.id, targetState);
    if (!res.success) {
      alert(`Failed to update beta mode: ${res.error}`);
      setBetaMode(originalState); // rollback
    }
  };

  const handleRoleToggle = (role: string) => {
    setAllowedRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSaveAllowedRoles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) return;
    setSavingRoles(true);
    setRolesMessage(null);

    const res = await updateAllowedBetaRoles(adminUser.id, allowedRoles);
    setSavingRoles(false);
    if (res.success) {
      setRolesMessage({ text: 'Allowed signup roles updated successfully.', type: 'success' });
      setTimeout(() => setRolesMessage(null), 4000);
    } else {
      setRolesMessage({ text: `Failed to update roles: ${res.error}`, type: 'error' });
    }
  };

  const handleSearchUserActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activitySearchQuery.trim()) {
      setActivityError('Please enter a user email address.');
      return;
    }

    setSearchingActivity(true);
    setActivityError(null);
    setActivityResult(null);

    try {
      const res = await searchUserActivity(adminUser.id, activitySearchQuery.trim());
      if (!res.success) {
        throw new Error(res.error || 'Failed to retrieve user activity.');
      }

      if (!res.found) {
        setActivityError('No user account found matching that email address.');
      } else {
        setActivityResult(res);
      }
    } catch (err: any) {
      setActivityError(err.message || 'An error occurred while searching.');
    } finally {
      setSearchingActivity(false);
    }
  };

  const handleUpdateContactEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) return;
    setSavingEmail(true);
    setEmailSaveMessage(null);

    const res = await updateMasterAdminEmail(adminUser.id, contactEmail);
    setSavingEmail(false);
    if (res.success) {
      setEmailSaveMessage({ text: 'User Contact Email updated successfully.', type: 'success' });
      setTimeout(() => setEmailSaveMessage(null), 4000);
    } else {
      setEmailSaveMessage({ text: `Failed to update: ${res.error}`, type: 'error' });
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!adminUser) return;
    setActionInProgress(requestId);

    const res = await approveBetaRequest(adminUser.id, requestId);
    if (res.success && res.code) {
      setRequests(prev =>
        prev.map(r => (r.id === requestId ? { ...r, status: 'approved', code: res.code } : r))
      );
    } else {
      alert(`Approval failed: ${res.error}`);
    }
    setActionInProgress(null);
  };

  const handleCopyLink = (requestId: string, code: string, email: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/profile?beta_code=${code}&email=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(requestId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/profile');
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!adminUser) return;
    if (!confirm('Are you sure you want to remove this user request?')) return;
    setActionInProgress(requestId);

    const res = await deleteBetaRequest(adminUser.id, requestId);
    if (res.success) {
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } else {
      alert(`Failed to remove request: ${res.error}`);
    }
    setActionInProgress(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-neon border-t-transparent rounded-full animate-spin" />
        <p className="text-secondary text-sm tracking-wider uppercase font-semibold">Verifying credentials...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4 bg-surface border border-gray-800/80 rounded-2xl shadow-xl mt-12">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className="w-16 h-16 text-red-500 mx-auto mb-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        <h2 className="text-2xl font-bold text-primary mb-2">Access Denied</h2>
        <p className="text-secondary text-sm leading-relaxed mb-6">
          You do not have the required permissions to view this page. Access is restricted to site administrators.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center justify-center bg-neon hover:bg-neon/90 text-main font-bold px-6 py-2.5 rounded-xl transition-all duration-200"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // Filter requests
  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && r.status === 'pending') ||
      (statusFilter === 'approved' && r.status === 'approved');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800/80">
        <div>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Master Admin Control Panel</h1>
          <p className="text-secondary text-sm mt-1">
            Global configurations and registrations approval ledger
          </p>
        </div>
        <div>
          <button
            onClick={handleSignOut}
            className="w-full md:w-auto bg-red-950/40 border border-red-800/50 hover:bg-red-900/30 text-red-400 font-semibold text-xs px-5 py-2.5 rounded-xl transition-all duration-200"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Global Config Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Beta Registration Mode Card */}
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-105" />
            <div className="flex items-center justify-between gap-4 relative z-10">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-neon animate-pulse" />
                  <h3 className="text-lg font-bold text-primary">Beta Registration Mode</h3>
                </div>
                <p className="text-xs text-secondary max-w-md leading-relaxed">
                  When enabled, registrations on the profile page will be restricted. Standard users must provide a valid beta access code generated by an administrator.
                </p>
              </div>
              
              {/* Custom Toggle Switch */}
              <button
                onClick={handleToggleBetaMode}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
                  betaMode ? 'bg-neon' : 'bg-gray-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-main shadow-lg ring-0 transition duration-300 ease-in-out ${
                    betaMode ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800/40 flex items-center justify-between text-[11px] text-secondary">
              <span>Status: <strong className={betaMode ? 'text-neon' : 'text-gray-400'}>{betaMode ? 'ACTIVE (RESTRICTED SIGNUP)' : 'INACTIVE (OPEN SIGNUP)'}</strong></span>
              <span>Setting: system_settings.beta_mode_enabled</span>
            </div>
          </div>

          {/* Allowed Signup Roles in Beta Mode Card */}
          {betaMode && (
            <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group animate-fade-in">
              <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-105" />
              <div className="relative z-10 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-neon animate-pulse">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <h3 className="text-lg font-bold text-primary">Allowed Signup User Types</h3>
                  </div>
                  <p className="text-xs text-secondary max-w-md leading-relaxed">
                    Select which user types/roles are available for selection during signup under Beta Mode. Checked roles will be visible to new users; unchecked roles will be removed entirely.
                  </p>
                </div>

                <form onSubmit={handleSaveAllowedRoles} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { value: 'User-Free', label: 'User - Free' },
                      { value: 'User-Premium', label: 'User - Premium' },
                      { value: 'User-Student', label: 'User - Student' },
                      { value: 'Teacher', label: 'Teacher' },
                      { value: 'Admin', label: 'Admin' }
                    ].map((role) => {
                      const isChecked = allowedRoles.includes(role.value);
                      return (
                        <label
                          key={role.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                            isChecked
                              ? 'bg-neon/10 border-neon/30 text-neon'
                              : 'bg-main/30 border-gray-800 text-secondary hover:border-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleRoleToggle(role.value)}
                            className="accent-neon h-4 w-4 bg-main rounded border-gray-850 cursor-pointer"
                          />
                          <span className="text-xs font-semibold">{role.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-800/40">
                    <span className="text-[10px] text-secondary italic">
                      Setting: system_settings.allowed_beta_roles
                    </span>
                    <button
                      type="submit"
                      disabled={savingRoles || allowedRoles.length === 0}
                      className="bg-neon hover:bg-neon/90 disabled:opacity-50 text-main font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-neon/5 active:scale-95 flex items-center justify-center min-w-[100px]"
                    >
                      {savingRoles ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </form>

                {rolesMessage && (
                  <p className={`text-xs ${rolesMessage.type === 'success' ? 'text-neon' : 'text-red-400'} animate-fade-in`}>
                    {rolesMessage.text}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* User Contact Email Card */}
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-105" />
            <div className="relative z-10 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-neon">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <h3 className="text-lg font-bold text-primary">User Contact Email</h3>
                </div>
                <p className="text-xs text-secondary max-w-md leading-relaxed">
                  Enter the email address where all user feedback and suggestions will be delivered.
                </p>
              </div>

              <form onSubmit={handleUpdateContactEmail} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  placeholder="admin@domain.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="flex-1 bg-main border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
                />
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="bg-neon hover:bg-neon/90 disabled:opacity-50 text-main font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-neon/5 active:scale-95 whitespace-nowrap self-stretch sm:self-auto flex items-center justify-center min-w-[90px]"
                >
                  {savingEmail ? 'Saving...' : 'Save Email'}
                </button>
              </form>

              {emailSaveMessage && (
                <p className={`text-xs ${emailSaveMessage.type === 'success' ? 'text-neon' : 'text-red-400'} animate-fade-in`}>
                  {emailSaveMessage.text}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Column */}
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-between h-auto min-h-[200px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4" />
          <div className="relative z-10">
            <p className="text-xs font-semibold text-secondary uppercase tracking-widest mb-1">Total Access Requests</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-4xl font-extrabold text-primary">{requests.length}</span>
              <span className="text-sm font-semibold text-secondary">Submissions</span>
            </div>
            <p className="text-[10px] text-secondary mt-2">
              {requests.filter(r => r.status === 'pending').length} pending approval
            </p>
          </div>
        </div>
      </div>

      {/* User Activity Tracker Card */}
      <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-neon">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <h2 className="text-lg font-bold text-primary">User Activity Tracker</h2>
        </div>
        <p className="text-xs text-secondary leading-relaxed">
          Search for any registered user by their email address to inspect their usage metrics, account timeline, and training activity feeds.
        </p>

        <form onSubmit={handleSearchUserActivity} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            placeholder="Search user email (e.g. user@grappletrack.com)"
            value={activitySearchQuery}
            onChange={(e) => setActivitySearchQuery(e.target.value)}
            className="flex-1 bg-main border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-neon transition-colors"
          />
          <button
            type="submit"
            disabled={searchingActivity}
            className="bg-neon hover:bg-neon/90 disabled:opacity-50 text-main font-bold text-xs px-6 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-neon/5 flex items-center justify-center min-w-[110px]"
          >
            {searchingActivity ? (
              <div className="w-4 h-4 border-2 border-main border-t-transparent rounded-full animate-spin" />
            ) : (
              'Search Activity'
            )}
          </button>
        </form>

        {activityError && (
          <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-900/40 text-red-400 text-xs animate-fade-in">
            {activityError}
          </div>
        )}

        {activityResult && activityResult.found && (
          <div className="space-y-6 pt-4 border-t border-gray-800/40 animate-fade-in">
            {/* User Info Header & Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile Overview */}
              <div className="md:col-span-1 bg-main/30 border border-gray-850 p-5 rounded-xl space-y-4">
                <div>
                  <span className="text-[10px] text-neon font-bold uppercase tracking-wider block">User Overview</span>
                  <h3 className="text-md font-bold text-primary mt-1.5">{activityResult.user.name}</h3>
                  <p className="text-xs text-secondary font-mono">@{activityResult.user.username}</p>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-secondary">Email:</span>
                    <span className="text-primary font-medium truncate max-w-[180px]">{activityResult.user.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Access Role:</span>
                    <span className="text-neon font-semibold">{activityResult.user.access_role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Belt Rank:</span>
                    <span className="text-primary font-medium">
                      {activityResult.user.current_rank} Belt ({activityResult.user.stripes} {activityResult.user.stripes === 1 ? 'Stripe' : 'Stripes'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Training Logs Overview */}
              <div className="md:col-span-2 bg-main/20 border border-gray-850 p-5 rounded-xl">
                <span className="text-[10px] text-neon font-bold uppercase tracking-wider block mb-4">Training Metrics</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-surface border border-gray-850/80 p-3 rounded-lg text-center">
                    <span className="text-[10px] text-secondary uppercase tracking-wider block mb-1">Active Days</span>
                    <span className="text-2xl font-bold text-primary">{activityResult.activity.activeDays}</span>
                    <span className="text-[9px] text-secondary block mt-0.5">days trained</span>
                  </div>
                  <div className="bg-surface border border-gray-850/80 p-3 rounded-lg text-center">
                    <span className="text-[10px] text-secondary uppercase tracking-wider block mb-1">Logs Created</span>
                    <span className="text-2xl font-bold text-primary">{activityResult.activity.logCount}</span>
                    <span className="text-[9px] text-secondary block mt-0.5">sessions logged</span>
                  </div>
                  <div className="bg-surface border border-gray-850/80 p-3 rounded-lg text-center">
                    <span className="text-[10px] text-secondary uppercase tracking-wider block mb-1">Rounds Sparred</span>
                    <span className="text-2xl font-bold text-primary">{activityResult.activity.roundCount}</span>
                    <span className="text-[9px] text-secondary block mt-0.5">logged rounds</span>
                  </div>
                  <div className="bg-surface border border-gray-850/80 p-3 rounded-lg text-center">
                    <span className="text-[10px] text-secondary uppercase tracking-wider block mb-1">Total Mat Time</span>
                    <span className="text-xl font-bold text-neon block mt-1">
                      {Math.floor(activityResult.activity.totalMatTime / 60)}h {activityResult.activity.totalMatTime % 60}m
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-4 border-t border-gray-800/20 text-xs">
                  <div className="flex justify-between">
                    <span className="text-secondary">Account Created:</span>
                    <span className="text-primary font-medium">
                      {new Date(activityResult.user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Last App Sign-In:</span>
                    <span className="text-primary font-medium">
                      {activityResult.user.last_sign_in_at 
                        ? new Date(activityResult.user.last_sign_in_at).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity feed */}
            <div className="space-y-3">
              <span className="text-[10px] text-secondary uppercase tracking-widest font-bold block">
                Recent Training Activity (Last 5 Sessions)
              </span>
              {activityResult.activity.recentLogs.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-gray-850 rounded-xl">
                  <p className="text-xs text-secondary italic">This user hasn't logged any training sessions yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activityResult.activity.recentLogs.map((log: any) => (
                    <div key={log.id} className="bg-main/30 border border-gray-850 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-850/60">
                        <span className="text-[11px] font-bold text-primary">
                          {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-[9px] bg-neon/10 border border-neon/30 text-neon px-2 py-0.5 rounded uppercase font-bold">
                          {log.attire_type}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-secondary">
                        <span>Logged Rounds:</span>
                        <span className="font-semibold text-primary">{log.roundsCount}</span>
                      </div>
                      {log.notes ? (
                        <p className="text-xs text-secondary italic font-serif line-clamp-2 mt-1">
                          "{log.notes}"
                        </p>
                      ) : (
                        <p className="text-[10px] text-secondary/50 italic mt-1">
                          No notes recorded.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ledger Section */}
      <div className="bg-surface border border-gray-800/80 rounded-2xl shadow-xl overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-6 border-b border-gray-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/50">
          <h2 className="text-lg font-bold text-primary">Beta Requests Ledger</h2>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="email"
                placeholder="Search requests by email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-main border border-gray-800 rounded-xl text-sm text-primary placeholder-text-secondary/50 focus:outline-none focus:border-neon/60 transition-all"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-4 h-4 text-text-secondary/50 absolute left-3 top-3"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
              </svg>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-main border border-gray-800 rounded-xl p-1 w-full sm:w-auto">
              {(['all', 'pending', 'approved'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    statusFilter === f
                      ? 'bg-neon text-main'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          {filteredRequests.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs font-semibold text-secondary uppercase bg-main/20">
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">Submitted At</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Invite Code</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-sm">
                {filteredRequests.map(req => (
                  <tr key={req.id} className="hover:bg-main/10 transition-colors">
                    <td className="py-4 px-6 font-medium text-primary select-all">{req.email}</td>
                    <td className="py-4 px-6 text-secondary text-xs">
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      {req.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs">
                      {req.code ? (
                        <span className="text-neon tracking-wide bg-neon/5 px-2 py-1 rounded border border-neon/10">
                          {req.code}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {req.status === 'pending' ? (
                          <button
                            onClick={() => handleApproveRequest(req.id)}
                            disabled={actionInProgress === req.id}
                            className="bg-neon hover:bg-neon/90 disabled:opacity-50 text-main font-bold text-xs px-4 py-2 rounded-xl transition-all duration-200 shadow-md shadow-neon/5 hover:scale-105 active:scale-95 whitespace-nowrap"
                          >
                            {actionInProgress === req.id ? 'Generating...' : 'Enable Access'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCopyLink(req.id, req.code || '', req.email)}
                            className="inline-flex items-center gap-1.5 border border-gray-700 hover:border-neon hover:bg-neon/5 text-secondary hover:text-neon text-xs px-4 py-2 rounded-xl transition-all duration-200 whitespace-nowrap"
                          >
                            {copiedId === req.id ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5 text-neon">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                Link Copied!
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                                </svg>
                                Copy Signup Link
                              </>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRequest(req.id)}
                          disabled={actionInProgress === req.id}
                          className="border border-red-800/30 hover:border-red-600 hover:bg-red-950/20 text-red-400 text-xs px-3 py-2 rounded-xl transition-all duration-200"
                          title="Remove Request"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 px-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-12 h-12 text-text-secondary/30 mx-auto mb-3"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 13.5h3.86a2.25 2.25 0 012.008 1.24l.885 1.77a2.25 2.25 0 002.007 1.24h1.98a2.25 2.25 0 002.007-1.24l.885-1.77a2.25 2.25 0 012.007-1.24h3.86m-18 0h18a2.25 2.25 0 012.25 2.25v4.5A2.25 2.25 0 0120.25 21H3.75A2.25 2.25 0 011.5 18.75v-4.5A2.25 2.25 0 012.25 13.5zm0-3h18a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v3.31A2.25 2.25 0 002.25 10.5z"
                />
              </svg>
              <p className="text-secondary text-sm">No access requests match the filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
