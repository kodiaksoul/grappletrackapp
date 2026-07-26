'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthGuard';
import {
  fetchStaffGyms,
  fetchKioskData,
  createCheckIn,
  deleteCheckIn,
} from '../actions/kioskActions';

// Helper for BJJ belt badge styling
function getBeltBadgeStyle(rank: string) {
  const normalized = (rank || '').trim().toLowerCase();
  switch (normalized) {
    case 'white':
      return 'bg-zinc-100 text-zinc-900 border border-zinc-300';
    case 'blue':
      return 'bg-blue-600 text-white border border-blue-800';
    case 'purple':
      return 'bg-purple-600 text-white border border-purple-800';
    case 'brown':
      return 'bg-amber-800 text-white border border-amber-950';
    case 'black':
      return 'bg-zinc-950 text-white border-2 border-red-600 font-bold';
    default:
      return 'bg-zinc-800 text-zinc-300 border border-zinc-700';
  }
}

export default function KioskPage() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();

  // Kiosk configuration states
  const [isLocked, setIsLocked] = useState(false);
  const [selectedGym, setSelectedGym] = useState<any>(null);
  const [kioskPin, setKioskPin] = useState('1234');
  const [availableGyms, setAvailableGyms] = useState<any[]>([]);
  const [loadingGyms, setLoadingGyms] = useState(true);

  // Kiosk runtime states
  const [roster, setRoster] = useState<any[]>([]);
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  // Clock state
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Flow control states
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState('BJJ Gi - Fundamentals');
  const [customClassName, setCustomClassName] = useState('');
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [successStudent, setSuccessStudent] = useState<any>(null);
  const [successClass, setSuccessClass] = useState('');
  const [successTimer, setSuccessTimer] = useState(0);

  // Admin access validation states
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [activeStaffTab, setActiveStaffTab] = useState<'attendance' | 'settings'>('attendance');

  // Load clock
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch staff gyms on mount / session load
  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      router.replace('/profile');
      return;
    }

    const isAuthorized = ['Teacher', 'Admin', 'Master Admin'].includes(profile?.access_role);
    if (!isAuthorized) {
      // Not staff, redirect to dashboard
      router.replace('/dashboard');
      return;
    }

    async function loadGyms() {
      try {
        setLoadingGyms(true);
        const res = await fetchStaffGyms(session.user.id);
        if (res.success && res.gyms && res.gyms.length > 0) {
          setAvailableGyms(res.gyms);
          setSelectedGym(res.gyms[0]);

          // Load from localStorage if already locked previously
          const savedKiosk = localStorage.getItem('gt_kiosk_locked_gym');
          const savedPin = localStorage.getItem('gt_kiosk_pin');
          if (savedKiosk) {
            const parsedGym = JSON.parse(savedKiosk);
            const foundGym = res.gyms.find((g: any) => g.gym_id === parsedGym.gym_id);
            if (foundGym) {
              setSelectedGym(foundGym);
              setIsLocked(true);
              if (savedPin) setKioskPin(savedPin);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching gyms:', err);
      } finally {
        setLoadingGyms(false);
      }
    }

    loadGyms();
  }, [session, profile, authLoading, router]);

  // Fetch Kiosk Roster and Curriculum when locked
  const loadKioskData = async () => {
    if (!selectedGym) return;
    try {
      setLoadingData(true);
      const res = await fetchKioskData(selectedGym.gym_id);
      if (res.success) {
        setRoster(res.roster || []);
        setCurriculum(res.curriculum || []);
        setCheckins(res.checkins || []);
      }
    } catch (err) {
      console.error('Error loading kiosk data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isLocked && selectedGym) {
      loadKioskData();
      // Periodically refresh data every 2 minutes
      const interval = setInterval(loadKioskData, 120 * 1000);
      return () => clearInterval(interval);
    }
  }, [isLocked, selectedGym]);

  // Lock configuration
  const handleLockKiosk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGym) return;
    if (!/^\d{4}$/.test(kioskPin)) {
      alert('Please enter a 4-digit PIN for staff controls.');
      return;
    }
    localStorage.setItem('gt_kiosk_locked_gym', JSON.stringify(selectedGym));
    localStorage.setItem('gt_kiosk_pin', kioskPin);
    setIsLocked(true);
    setSearchQuery('');
  };

  // Exit Kiosk flow with PIN check
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === kioskPin) {
      setShowPinModal(false);
      setPinInput('');
      setPinError(false);
      setShowStaffPanel(true);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleUnlockKiosk = () => {
    localStorage.removeItem('gt_kiosk_locked_gym');
    localStorage.removeItem('gt_kiosk_pin');
    setIsLocked(false);
    setShowStaffPanel(false);
  };

  // Student filtering
  const filteredRoster = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return roster.filter(
      (student) =>
        (student.name || '').toLowerCase().includes(query) ||
        (student.username || '').toLowerCase().includes(query)
    );
  }, [searchQuery, roster]);

  // Attendance submission
  const handleConfirmCheckIn = async () => {
    if (!selectedStudent || !selectedGym) return;

    const className = selectedClass === 'Custom' ? customClassName : selectedClass;
    if (selectedClass === 'Custom' && !customClassName.trim()) {
      alert('Please enter a custom class name.');
      return;
    }

    try {
      setIsSubmittingCheckIn(true);

      const activeLesson = curriculum[0] || null;
      const res = await createCheckIn(
        selectedGym.gym_id,
        selectedStudent.id,
        className,
        activeLesson ? activeLesson.week_topic : null,
        activeLesson ? activeLesson.lesson : null
      );

      if (res.success) {
        setSuccessStudent(selectedStudent);
        setSuccessClass(className);
        setSelectedStudent(null);
        setSearchQuery('');
        setCustomClassName('');

        // Success screen duration and progress animation
        setSuccessTimer(3);
        const timerInterval = setInterval(() => {
          setSuccessTimer((prev) => {
            if (prev <= 1) {
              clearInterval(timerInterval);
              setSuccessStudent(null);
              setSuccessClass('');
              loadKioskData(); // Reload checkins list
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        alert('Check-in failed. Please try again.');
      }
    } catch (err) {
      console.error('Check-in error:', err);
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const handleDeleteCheckIn = async (checkInId: string) => {
    if (!confirm('Are you sure you want to remove this check-in entry?')) return;
    try {
      const res = await deleteCheckIn(checkInId, selectedGym.gym_id);
      if (res.success) {
        loadKioskData();
      } else {
        alert('Failed to remove check-in.');
      }
    } catch (err) {
      console.error('Delete check-in error:', err);
    }
  };

  // RENDER LOADING SCREEN
  if (authLoading || loadingGyms) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
        <div className="w-10 h-10 rounded-full border-4 border-neon border-t-transparent animate-spin" />
        <p className="text-secondary text-sm font-semibold tracking-wide uppercase">Initializing Kiosk Terminal...</p>
      </div>
    );
  }

  // RENDER SETUP/UNLOCK SCREEN (UNLOCKED)
  if (!isLocked) {
    return (
      <div className="max-w-2xl mx-auto my-8">
        <div className="bg-surface border border-gray-800/80 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden space-y-8">
          <div className="absolute top-0 right-0 w-48 h-48 bg-neon/5 rounded-bl-full pointer-events-none" />

          <div className="space-y-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-neon/15 border border-neon/30 flex items-center justify-center mx-auto text-neon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
              </svg>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-primary">GYM DESK KIOSK INITIALIZATION</h1>
            <p className="text-xs text-secondary max-w-md mx-auto leading-relaxed">
              Lock this device into a dedicated student check-in tablet. Students can sign in for classes and view curriculum schedules.
            </p>
          </div>

          {availableGyms.length === 0 ? (
            <div className="p-6 bg-red-950/15 border border-red-900/30 rounded-2xl text-center space-y-3">
              <p className="text-xs text-red-400 font-semibold uppercase">No Gym Affiliations Found</p>
              <p className="text-xs text-secondary leading-relaxed">
                Your profile is not registered as a Teacher or Admin for any gym locations. Register a gym location on the <button onClick={() => router.push('/gymdesk')} className="text-neon underline">Academy Control Deck</button> first.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLockKiosk} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">Select Gym Location</label>
                <div className="grid gap-3">
                  {availableGyms.map((g) => (
                    <button
                      key={g.gym_id}
                      type="button"
                      onClick={() => setSelectedGym(g)}
                      className={`text-left p-5 rounded-2xl border transition-all duration-200 flex justify-between items-center ${
                        selectedGym?.gym_id === g.gym_id
                          ? 'bg-neon/10 border-neon text-neon shadow-lg shadow-neon/5'
                          : 'bg-main/30 border-gray-800 text-primary hover:border-gray-700'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-sm block">{g.name}</span>
                        <span className="text-xs text-secondary mt-1 block">{g.address || 'No address registered'}</span>
                      </div>
                      {selectedGym?.gym_id === g.gym_id && (
                        <div className="w-5 h-5 rounded-full bg-neon flex items-center justify-center text-main">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">Set 4-Digit Staff PIN</label>
                <input
                  type="text"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                  value={kioskPin}
                  onChange={(e) => setKioskPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  className="w-full bg-main border border-gray-800 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-primary focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon"
                />
                <span className="text-[10px] text-secondary block text-center mt-1">
                  Required to exit kiosk mode, unlock settings, or review attendance roll.
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-neon text-main font-bold text-sm py-4 rounded-2xl shadow-xl hover:shadow-neon/10 active:scale-[0.99] transition-all"
              >
                🔐 Activate Check-In Kiosk
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-gray-800/60 text-center">
            <button
              onClick={() => router.push('/gymdesk')}
              className="text-xs text-secondary hover:text-primary transition-colors flex items-center justify-center gap-1.5 mx-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Return to Staff Control Deck
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER RUNTIME KIOSK SCREEN (LOCKED)
  return (
    <div className="space-y-6 relative min-h-[85vh]">
      {/* 3. FULLSCREEN SUCCESS CHECK-IN OVERLAY */}
      {successStudent && (
        <div className="fixed inset-0 bg-emerald-950 z-[99999] flex flex-col items-center justify-center text-center p-6 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/35 to-zinc-950 pointer-events-none" />
          <div className="relative z-10 space-y-6 max-w-xl">
            {/* Pulsing check circle */}
            <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3.5" stroke="currentColor" className="w-12 h-12">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xs uppercase font-extrabold text-emerald-400 tracking-widest">Attendance Recorded</h2>
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-wide uppercase">CHECK-IN SUCCESSFUL</h1>
            </div>

            <p className="text-xl md:text-2xl font-bold text-zinc-100 mt-2">
              Welcome, <span className="text-emerald-400">{successStudent.name || successStudent.username}</span>!
            </p>

            <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl inline-block mt-4 text-xs font-mono text-zinc-300">
              <span className="block font-semibold text-zinc-400 uppercase tracking-widest text-[9px] mb-1">Class Registered</span>
              <span className="text-sm font-bold text-white uppercase">{successClass}</span>
            </div>

            <p className="text-xs text-zinc-400 italic">
              Auto-resetting kiosk in {successTimer} seconds...
            </p>

            {/* Micro-animation shrinking bar */}
            <div className="w-48 h-1 bg-zinc-850 rounded-full mx-auto overflow-hidden">
              <div 
                className="h-full bg-emerald-400 transition-all duration-1000 ease-linear"
                style={{ width: `${(successTimer / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* HEADER & TOP CONTROL BAR */}
      <div className="flex justify-between items-center bg-surface border border-gray-800/80 p-4 md:p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-neon animate-pulse" />
            <h1 className="text-lg md:text-xl font-black tracking-wider text-primary uppercase">
              {selectedGym?.name || 'Academy Check-In'}
            </h1>
          </div>
          <span className="text-[10px] text-secondary font-mono tracking-wider block">
            {currentTime ? currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            {' • '}
            {currentTime ? currentTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
          </span>
        </div>
        <div>
          <button
            onClick={() => {
              setPinError(false);
              setPinInput('');
              setShowPinModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-main hover:bg-zinc-900 text-secondary hover:text-primary border border-gray-800 rounded-xl text-xs font-bold transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Staff Portal
          </button>
        </div>
      </div>

      {/* DETAILED LAYOUT CONTENT */}
      {selectedStudent ? (
        /* STUDENT FOCUS CLASS SELECTION MODAL CARD */
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-2xl max-w-xl mx-auto space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[9px] text-neon font-bold uppercase tracking-wider block">Confirming check-in for</span>
              <h2 className="text-xl md:text-2xl font-black text-primary">{selectedStudent.name || selectedStudent.username}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-secondary">@{selectedStudent.username}</span>
                <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full ${getBeltBadgeStyle(selectedStudent.current_rank)}`}>
                  {selectedStudent.current_rank} Belt
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedStudent(null)}
              className="text-secondary hover:text-primary text-xs font-semibold px-2 py-1 border border-gray-800 rounded-lg bg-main"
            >
              Cancel [x]
            </button>
          </div>

          {/* Active curriculum info */}
          {curriculum.length > 0 && (
            <div className="p-4 bg-neon/5 border border-neon/20 rounded-xl space-y-2">
              <span className="text-[9px] text-neon font-bold uppercase tracking-wider block">Active Training Focus</span>
              <div>
                <span className="text-xs font-semibold text-primary block uppercase">{curriculum[0].week_topic}</span>
                <span className="text-xs text-secondary">{curriculum[0].lesson}</span>
              </div>
            </div>
          )}

          {/* Class selection grid */}
          <div className="space-y-3">
            <span className="block text-[10px] font-bold text-secondary uppercase tracking-widest">Select Class Type</span>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                'BJJ Gi - Fundamentals',
                'BJJ Gi - Advanced',
                'BJJ No-Gi - Fundamentals',
                'BJJ No-Gi - Advanced',
                'Open Mat',
                'Custom',
              ].map((cName) => (
                <button
                  key={cName}
                  onClick={() => setSelectedClass(cName)}
                  className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all text-center ${
                    selectedClass === cName
                      ? 'bg-neon text-main border-neon shadow-lg shadow-neon/10'
                      : 'bg-main/30 border-gray-800 text-primary hover:border-gray-700'
                  }`}
                >
                  {cName}
                </button>
              ))}
            </div>

            {selectedClass === 'Custom' && (
              <div className="space-y-1.5 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="block text-[9px] font-bold text-secondary uppercase tracking-widest">Enter Class Name</span>
                <input
                  type="text"
                  required
                  value={customClassName}
                  onChange={(e) => setCustomClassName(e.target.value)}
                  placeholder="e.g. BJJ Competition Sparring"
                  className="w-full bg-main border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-primary focus:outline-none focus:border-neon"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleConfirmCheckIn}
            disabled={isSubmittingCheckIn}
            className="w-full bg-neon text-main font-bold py-4 rounded-xl shadow-xl hover:shadow-neon/15 disabled:opacity-50 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            {isSubmittingCheckIn ? (
              <>
                <span className="w-4 h-4 border-2 border-main border-t-transparent rounded-full animate-spin" />
                Registering Attendance...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                CONFIRM CHECK IN
              </>
            )}
          </button>
        </div>
      ) : (
        /* KIOSK MAIN DIRECTORY SCREEN (SEARCH AND CURRICULUM DISPLAY) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main search check-in list (Left 2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-black text-primary tracking-wide">STUDENT ATTENDANCE SIGN-IN</h2>
                <p className="text-xs text-secondary">Search your profile on the roster below to register attendance.</p>
              </div>

              {/* Large search input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type your name or username to start check-in..."
                  className="w-full bg-main border-2 border-gray-800 rounded-2xl pl-12 pr-4 py-4 text-sm md:text-md text-primary placeholder-gray-600 focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon transition-colors font-semibold"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-gray-600 absolute left-4 top-1/2 -translate-y-1/2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                </svg>
              </div>

              {/* Roster Search Results */}
              {searchQuery.trim() === '' ? (
                <div className="p-8 text-center bg-main/15 border border-dashed border-gray-850 rounded-xl">
                  <p className="text-xs text-secondary italic">Roster search is active. Start typing your name to begin check-in.</p>
                </div>
              ) : filteredRoster.length === 0 ? (
                <div className="p-8 text-center bg-main/15 border border-gray-850 rounded-xl space-y-3">
                  <p className="text-xs text-secondary italic">No students match your query.</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed max-w-sm mx-auto">
                    If you are not registered on the roster, please ask a coach to add you via the control deck invitations page.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                  {filteredRoster.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => {
                        setSelectedStudent(student);
                        setSelectedClass('BJJ Gi - Fundamentals');
                      }}
                      className="text-left p-4 bg-main/30 border border-gray-800 rounded-xl hover:border-neon transition-colors flex items-center justify-between gap-4 group"
                    >
                      <div>
                        <span className="text-xs font-bold text-primary group-hover:text-neon transition-colors block">
                          {student.name || 'Anonymous Grappler'}
                        </span>
                        <span className="text-[10px] text-secondary">@{student.username}</span>
                      </div>
                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${getBeltBadgeStyle(student.current_rank)}`}>
                        {student.current_rank}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Curriculum Display & Notices (Right Column) */}
          <div className="space-y-6">
            {/* Active Curriculum Box */}
            <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active Training Focus
              </h2>

              {curriculum.length === 0 ? (
                <p className="text-xs text-secondary italic">No curriculum topics broadcasted for this period.</p>
              ) : (
                <div className="space-y-4 divide-y divide-gray-850">
                  {curriculum.map((c, i) => (
                    <div key={c.id} className={`space-y-1.5 ${i > 0 ? 'pt-3' : ''}`}>
                      <span className="text-[9px] font-mono text-neon font-bold uppercase tracking-wider block">
                        {c.week_topic}
                      </span>
                      <p className="text-xs font-semibold text-primary leading-relaxed">{c.lesson}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Stats box */}
            <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-3 text-center">
              <span className="block text-[9px] font-bold text-secondary uppercase tracking-widest">Signed In Today</span>
              <p className="text-3xl font-black text-neon">{checkins.length}</p>
              <span className="block text-[9px] text-secondary uppercase">Active Members Checked In</span>
            </div>
          </div>
        </div>
      )}

      {/* STAFF PIN AUTHENTICATION MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 max-w-xs w-full space-y-4 shadow-2xl relative">
            <div className="text-center space-y-1">
              <h3 className="font-bold text-sm text-primary uppercase">Staff Authentication</h3>
              <p className="text-[10px] text-secondary">Enter PIN to access staff controls.</p>
            </div>
            
            <form onSubmit={handleVerifyPin} className="space-y-3">
              <input
                type="password"
                maxLength={4}
                required
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className={`w-full bg-main border rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:ring-1 ${
                  pinError ? 'border-red-600 focus:ring-red-600' : 'border-gray-800 focus:border-neon focus:ring-neon'
                } text-primary`}
              />
              
              {pinError && (
                <span className="text-[9px] text-red-500 font-bold block text-center uppercase tracking-wider">
                  Incorrect PIN. Try again.
                </span>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-neon text-main font-bold text-xs py-2.5 rounded-lg"
                >
                  Verify
                </button>
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 bg-main border border-gray-800 text-secondary hover:text-primary text-xs py-2.5 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAFF PANEL OVERLAY */}
      {showStaffPanel && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[99998] flex items-center justify-center p-4 md:p-8">
          <div className="bg-surface border border-gray-800/80 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-gray-850 flex justify-between items-center bg-zinc-900/30">
              <div>
                <h2 className="text-md font-black text-primary uppercase tracking-wide">Kiosk Staff Dashboard</h2>
                <span className="text-[10px] text-secondary">Academy Location: {selectedGym?.name}</span>
              </div>
              <button
                onClick={() => setShowStaffPanel(false)}
                className="text-secondary hover:text-primary text-xs font-bold px-3 py-1.5 border border-gray-800 rounded-lg bg-main"
              >
                Close Dashboard [x]
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-850 px-5 gap-4">
              <button
                onClick={() => setActiveStaffTab('attendance')}
                className={`py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${
                  activeStaffTab === 'attendance'
                    ? 'border-neon text-neon'
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                Today's Attendance ({checkins.length})
              </button>
              <button
                onClick={() => setActiveStaffTab('settings')}
                className={`py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${
                  activeStaffTab === 'settings'
                    ? 'border-neon text-neon'
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                Kiosk Settings
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 min-h-[40vh]">
              {activeStaffTab === 'attendance' ? (
                /* TAB: TODAY'S ATTENDANCE LEDGER */
                <div className="space-y-4">
                  {checkins.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-gray-850 rounded-2xl">
                      <p className="text-xs text-secondary italic">No students have checked in today.</p>
                    </div>
                  ) : (
                    <div className="border border-gray-850 rounded-2xl overflow-hidden bg-main/20">
                      <table className="w-full text-left text-xs divide-y divide-gray-850">
                        <thead className="bg-zinc-950/60 text-secondary uppercase font-semibold text-[9px] tracking-widest">
                          <tr>
                            <th className="p-4">Student</th>
                            <th className="p-4">Rank</th>
                            <th className="p-4">Class Checked In</th>
                            <th className="p-4">Topic Focus</th>
                            <th className="p-4">Time</th>
                            <th className="p-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-850">
                          {checkins.map((c) => (
                            <tr key={c.id} className="hover:bg-zinc-900/10">
                              <td className="p-4 font-bold text-primary">
                                {c.student.name || 'Anonymous'}
                                <span className="block font-normal text-[10px] text-secondary font-mono">@{c.student.username}</span>
                              </td>
                              <td className="p-4">
                                <span className={`text-[9px] uppercase font-bold px-2.5 py-0.5 rounded-full ${getBeltBadgeStyle(c.student.current_rank)}`}>
                                  {c.student.current_rank}
                                </span>
                              </td>
                              <td className="p-4 uppercase font-medium text-zinc-300">{c.class_name}</td>
                              <td className="p-4">
                                {c.week_topic ? (
                                  <div>
                                    <span className="font-semibold text-neon block text-[10px]">{c.week_topic}</span>
                                    <span className="text-[10px] text-zinc-400">{c.lesson_topic}</span>
                                  </div>
                                ) : (
                                  <span className="text-zinc-500 italic text-[10px]">None</span>
                                )}
                              </td>
                              <td className="p-4 font-mono text-[10px] text-secondary">
                                {new Date(c.created_at).toLocaleTimeString(undefined, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handleDeleteCheckIn(c.id)}
                                  className="px-2.5 py-1 text-[9px] bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 rounded font-bold transition-all"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* TAB: SETTINGS & CONTROLS */
                <div className="max-w-md mx-auto space-y-6">
                  <div className="bg-main/30 border border-gray-800 p-5 rounded-2xl space-y-4">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider block">Terminal Settings</span>
                    
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">Kiosk PIN</span>
                      <input
                        type="text"
                        maxLength={4}
                        pattern="\d{4}"
                        value={kioskPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setKioskPin(val);
                          localStorage.setItem('gt_kiosk_pin', val);
                        }}
                        className="bg-main border border-gray-800 rounded-xl px-4 py-2.5 text-center text-md font-mono font-bold tracking-widest text-primary focus:outline-none focus:border-neon"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleUnlockKiosk}
                      className="w-full py-3.5 bg-red-950/25 border border-red-900/30 hover:bg-red-950/45 text-red-400 font-bold text-xs rounded-xl shadow-lg transition-all"
                    >
                      🔓 Unlock Kiosk (Change Gym Location / PIN)
                    </button>
                    <button
                      onClick={() => {
                        setShowStaffPanel(false);
                        router.push('/gymdesk');
                      }}
                      className="w-full py-3.5 bg-main border border-gray-800 text-secondary hover:text-primary font-bold text-xs rounded-xl transition-all"
                    >
                      Exit Kiosk to Academy Control Deck
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
