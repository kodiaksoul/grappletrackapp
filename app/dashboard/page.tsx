'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { saveTrainingSession } from '../actions/saveSession';
import { fetchUserHistory } from '../actions/fetchHistory';
import { fetchPersonalDictionary } from '../actions/personalDictionary';
import TechniqueMirror from '../../components/TechniqueMirror';
import MatTimeVolumeReport from '../../components/MatTimeVolumeReport';
import SearchableDropdown from '../../components/SearchableDropdown';
import TopMoves from '../../components/TopMoves';

interface TechniqueEntry {
  name: string;
  isSuccessful: boolean;
  resistanceLevel: 'Easy' | 'Moderate' | 'Difficult' | null;
  startingPosition?: string | null;
  type?: 'Takedown' | 'Sweep' | 'Submission' | 'Escape' | null;
}

interface RoundEntry {
  roundIndex: number;
  modality: 'Positional' | 'Full Roll';
  startingPosition: string;
  durationMinutes: number;
  partnerName: string;
  partnerBelt: string;
  partnerWeight: string;
  partnerGender: string;
  partnerHeight: string;
  techniques: TechniqueEntry[];
  notes: string;
}

export default function DashboardPage() {
  // Auth & Profile states
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userLogs, setUserLogs] = useState<any[]>([]);

  // Metric & Affiliation calculation states
  const [totalMatTime, setTotalMatTime] = useState<number>(0);
  const [attendanceRate, setAttendanceRate] = useState<number>(0);
  const [activeDaysPerWeek, setActiveDaysPerWeek] = useState<number>(0);
  const [isGymAffiliated, setIsGymAffiliated] = useState<boolean>(false);

  // Last Trained Session states
  const [lastTrainedDate, setLastTrainedDate] = useState<string | null>(null);
  const [daysSinceText, setDaysSinceText] = useState<string | null>(null);

  // Affiliation Overlay states
  const [showGymAffiliationCTA, setShowGymAffiliationCTA] = useState<boolean>(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');

  // Global Session Header Parameters
  const [attireType, setAttireType] = useState<'Gi' | 'No-Gi'>('Gi');
  const [sessionContext, setSessionContext] = useState<'Class Focus' | 'Independent'>('Independent');
  const [curriculumFocus, setCurriculumFocus] = useState('Closed Guard Kimura');

  // Progressive Wizard States
  const [roundCounter, setRoundCounter] = useState(1);
  const [roundsList, setRoundsList] = useState<RoundEntry[]>([]);

  // Date State helper & state
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [sessionDate, setSessionDate] = useState(getLocalDateString());

  // Current Card State
  const [currentModality, setCurrentModality] = useState<'Positional' | 'Full Roll'>('Full Roll');
  const [currentPosition, setCurrentPosition] = useState('Closed Guard');
  const [currentDuration, setCurrentDuration] = useState<number>(5);
  const [currentPartner, setCurrentPartner] = useState<string>('');
  const [currentPartnerBelt, setCurrentPartnerBelt] = useState<string>('Unknown');
  const [currentPartnerWeight, setCurrentPartnerWeight] = useState<string>('Unknown');
  const [currentPartnerGender, setCurrentPartnerGender] = useState<string>('Unknown');
  const [currentPartnerHeight, setCurrentPartnerHeight] = useState<string>('Unknown');
  const [currentTechniques, setCurrentTechniques] = useState<TechniqueEntry[]>([]);
  const [currentRoundNotes, setCurrentRoundNotes] = useState('');

  const [dbPositions, setDbPositions] = useState<string[]>([
    'Closed Guard', 'Open Guard', 'Half Guard', 'Side Control', 'Mount', 'Back Control', 'Turtle'
  ]);
  const [dbTechniques, setDbTechniques] = useState<string[]>([
    'Kimura', 'Armbar', 'Triangle Choke', 'Guillotine',
    'Scissor Sweep', 'Hip Bump Sweep', 'Knee Slide Pass',
    'Rear Naked Choke', 'Ankle Lock', 'De La Riva Sweep'
  ]);
  const availableTechniques = dbTechniques;
  
  const [officialDictTerms, setOfficialDictTerms] = useState<{ term_name: string; term_type: string }[]>([]);
  const [personalPositions, setPersonalPositions] = useState<string[]>([]);
  const [personalTechniques, setPersonalTechniques] = useState<string[]>([]);
  const [customTermsLogged, setCustomTermsLogged] = useState<{ term_name: string; term_type: 'Position' | 'Technique' }[]>([]);

  const [techInput, setTechInput] = useState('');
  const [customPositionText, setCustomPositionText] = useState('');
  const [customTechText, setCustomTechText] = useState('');
  const [showTransition, setShowTransition] = useState(false);
  const [techInput2, setTechInput2] = useState('');
  const [customTechText2, setCustomTechText2] = useState('');

  const combinedDbFocus = useMemo(() => {
    return Array.from(new Set([...dbPositions, ...dbTechniques])).sort((a, b) => a.localeCompare(b));
  }, [dbPositions, dbTechniques]);

  const combinedPersonalFocus = useMemo(() => {
    return Array.from(new Set([...personalPositions, ...personalTechniques])).sort((a, b) => a.localeCompare(b));
  }, [personalPositions, personalTechniques]);
  const [isAdTimerActive, setIsAdTimerActive] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [saveProgressMessage, setSaveProgressMessage] = useState('');
  const [savingState, setSavingState] = useState<'none' | 'saving' | 'saving_new' | 'cloning'>('none');
  const scrollPositionRef = useRef(0);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  const loadDictionaryTerms = async (userId?: string) => {
    try {
      const { data: officialData, error: officialError } = await supabase
        .from('official_dictionary')
        .select('term_name, term_type');

      let officialTermsList: { term_name: string; term_type: string }[] = [];
      if (!officialError && officialData) {
        officialTermsList = officialData;
        setOfficialDictTerms(officialData);
      }

      let personalTermsList: { term_name: string; term_type: string }[] = [];
      if (userId) {
        const res = await fetchPersonalDictionary(userId);
        if (res.success && res.terms) {
          personalTermsList = res.terms;
        }
      }

      const officialPositionsSet = new Set<string>();
      const officialTechniquesSet = new Set<string>();
      const personalPositionsSet = new Set<string>();
      const personalTechniquesSet = new Set<string>();

      const defaultPositions = ['Closed Guard', 'Open Guard', 'Half Guard', 'Side Control', 'Mount', 'Back Control', 'Turtle'];
      const defaultTechniques = [
        'Kimura', 'Armbar', 'Triangle Choke', 'Guillotine',
        'Scissor Sweep', 'Hip Bump Sweep', 'Knee Slide Pass',
        'Rear Naked Choke', 'Ankle Lock', 'De La Riva Sweep'
      ];

      defaultPositions.forEach(p => officialPositionsSet.add(p));
      defaultTechniques.forEach(t => officialTechniquesSet.add(t));

      officialTermsList.forEach(term => {
        const name = term.term_name.trim();
        if (!name) return;
        if (term.term_type === 'Position') {
          officialPositionsSet.add(name);
        } else if (term.term_type === 'Technique') {
          officialTechniquesSet.add(name);
        }
      });

      personalTermsList.forEach(term => {
        const name = term.term_name.trim();
        if (!name) return;
        if (term.term_type === 'Position') {
          personalPositionsSet.add(name);
        } else if (term.term_type === 'Technique') {
          personalTechniquesSet.add(name);
        }
      });

      // Filter out duplicate personal terms
      personalPositionsSet.forEach(pos => {
        if (officialPositionsSet.has(pos)) {
          personalPositionsSet.delete(pos);
        }
      });
      personalTechniquesSet.forEach(tech => {
        if (officialTechniquesSet.has(tech)) {
          personalTechniquesSet.delete(tech);
        }
      });

      const sortedOfficialPos = Array.from(officialPositionsSet).sort((a, b) => a.localeCompare(b));
      const sortedOfficialTech = Array.from(officialTechniquesSet).sort((a, b) => a.localeCompare(b));
      const sortedPersonalPos = Array.from(personalPositionsSet).sort((a, b) => a.localeCompare(b));
      const sortedPersonalTech = Array.from(personalTechniquesSet).sort((a, b) => a.localeCompare(b));

      setDbPositions(sortedOfficialPos);
      setDbTechniques(sortedOfficialTech);
      setPersonalPositions(sortedPersonalPos);
      setPersonalTechniques(sortedPersonalTech);
    } catch (err) {
      console.error('[GrappleTracker] Error loading dictionary terms:', err);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadDictionaryTerms();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
        loadMetrics(session.user.id);
        loadDictionaryTerms(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
        loadMetrics(session.user.id);
        loadDictionaryTerms(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
        loadDictionaryTerms();
      }
    });

    // Check if redirecting from history page with ?log=true
    const params = new URLSearchParams(window.location.search);
    if (params.get('log') === 'true') {
      setIsModalOpen(true);
      // clean up URL so refreshing doesn't keep opening it
      const cleanUrl = window.location.pathname + window.location.search.replace(/[?&]log=true/, '').replace(/^&/, '?').replace(/\?$/, '');
      window.history.replaceState({}, '', cleanUrl);
    }

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      scrollPositionRef.current = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.left = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = scrollPositionRef.current;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, scrollY);
      }
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error = null } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data);

        // Fetch active gym curriculum if user is a Student
        if (data.access_role === 'User-Student') {
          const { data: membershipData } = await supabase
            .from('gym_memberships')
            .select('gym_id')
            .eq('user_id', userId)
            .limit(1);

          if (membershipData && membershipData.length > 0) {
            const gymId = membershipData[0].gym_id;
            const { data: lessonData } = await supabase
              .from('curriculum_lessons')
              .select('week_topic, lesson')
              .eq('gym_id', gymId)
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(1);

            if (lessonData && lessonData.length > 0) {
              setCurriculumFocus(`[${lessonData[0].week_topic}] - ${lessonData[0].lesson}`);
              setSessionContext('Class Focus');
              setCurrentModality('Positional');
            }
          }
        }
      }

      // Fetch gym membership role if any
      const { data: membershipData } = await supabase
        .from('gym_memberships')
        .select('role_token')
        .eq('user_id', userId)
        .limit(1);

      if (membershipData && membershipData.length > 0) {
        setUserRole(membershipData[0].role_token);
      } else {
        setUserRole(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async (userId: string) => {
    try {
      // 1. Fetch user history using the Server Action
      const { logs } = await fetchUserHistory(userId);
      setUserLogs(logs || []);
      
      if (logs && logs.length > 0) {
        // Calculate Total Mat Time (sum of all round durations across all logs)
        let totalMinutes = 0;
        logs.forEach((log: any) => {
          if (log.rounds) {
            log.rounds.forEach((round: any) => {
              totalMinutes += round.duration_minutes || 0;
            });
          }
        });
        setTotalMatTime(Number((totalMinutes / 60).toFixed(1)));

        // Calculate Attendance Rate (Last 30 Days)
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        const last30DaysLogs = logs.filter((log: any) => new Date(log.created_at).getTime() >= thirtyDaysAgo);
        
        const uniqueDays = new Set(last30DaysLogs.map((log: any) => new Date(log.created_at).toDateString())).size;
        const targetDays = 12; // 3 classes/week * 4 weeks
        const calculatedRate = Math.min(Math.round((uniqueDays / targetDays) * 100), 100);
        setAttendanceRate(calculatedRate);

        // Active days per week in last 30 days
        const calculatedWeeks = 30 / 7;
        setActiveDaysPerWeek(Number((uniqueDays / calculatedWeeks).toFixed(1)));

        // Calculate Last Trained Session
        const sortedLogs = [...logs].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const latestLog = sortedLogs[0];
        const logDate = new Date(latestLog.created_at);
        const formattedDate = logDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        const d1 = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const today = new Date();
        const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let daysText = '';
        if (diffDays <= 0) {
          daysText = 'Today';
        } else if (diffDays === 1) {
          daysText = 'Yesterday';
        } else {
          daysText = `${diffDays} days ago`;
        }
        
        setLastTrainedDate(formattedDate);
        setDaysSinceText(daysText);
      } else {
        setTotalMatTime(0);
        setAttendanceRate(0);
        setActiveDaysPerWeek(0);
        setUserLogs([]);
        setLastTrainedDate(null);
        setDaysSinceText(null);
      }

      // 2. Check gym affiliation
      const { data: membershipData, error: memError } = await supabase
        .from('gym_memberships')
        .select('gym_id')
        .eq('user_id', userId)
        .limit(1);

      setIsGymAffiliated(!memError && membershipData && membershipData.length > 0);

    } catch (e) {
      console.error('Failed to load metrics:', e);
    }
  };

  const handleSimulatedUpgrade = async () => {
    if (!session) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ access_role: 'User-Premium', is_premium_tier: true })
        .eq('id', session.user.id);
      if (!error) {
        setProfile({ ...profile, access_role: 'User-Premium', is_premium_tier: true });
        setShowUpgradeModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getTechniqueLimit = (rank: string | null | undefined): number => {
    switch (rank) {
      case 'White':
      case 'Blue':
      case 'Purple':
        return 3;
      case 'Brown':
      case 'Black':
        return Infinity;
      default:
        return 3;
    }
  };

  const handleAddTechnique = () => {
    if (!techInput) return;
    const maxLimit = getTechniqueLimit(profile?.current_rank);
    if (currentTechniques.length >= maxLimit) return;

    const term1 = techInput === 'Other' ? customTechText.trim() : techInput;
    let finalTechName = term1;

    if (showTransition && techInput2) {
      const term2 = techInput2 === 'Other' ? customTechText2.trim() : techInput2;
      if (term2) {
        finalTechName = `${term1} ➔ ${term2}`;
      }
    }

    if (!finalTechName) return;

    if (currentTechniques.some((t) => t.name.toLowerCase() === finalTechName.toLowerCase())) return;

    // Track custom terms logged
    const addedCustom: { term_name: string; term_type: 'Position' | 'Technique' }[] = [];
    if (techInput === 'Other' && term1) {
      addedCustom.push({ term_name: term1, term_type: 'Technique' });
    }
    if (showTransition && techInput2 === 'Other') {
      const term2 = customTechText2.trim();
      if (term2) {
        addedCustom.push({ term_name: term2, term_type: 'Technique' });
      }
    }
    if (addedCustom.length > 0) {
      setCustomTermsLogged(prev => [...prev, ...addedCustom]);
    }

    setCurrentTechniques([
      ...currentTechniques,
      { name: finalTechName, isSuccessful: false, resistanceLevel: null, startingPosition: null, type: null },
    ]);
    setTechInput('');
    setCustomTechText('');
    setTechInput2('');
    setCustomTechText2('');
    setShowTransition(false);
  };

  const handleRemoveTechnique = (index: number) => {
    setCurrentTechniques(currentTechniques.filter((_, i) => i !== index));
  };

  const handleTechniqueSuccessToggle = (index: number, success: boolean) => {
    const updated = [...currentTechniques];
    updated[index].isSuccessful = success;
    updated[index].resistanceLevel = success ? 'Moderate' : null;
    setCurrentTechniques(updated);
  };

  const handleTechniqueResistanceChange = (index: number, level: 'Easy' | 'Moderate' | 'Difficult') => {
    const updated = [...currentTechniques];
    updated[index].resistanceLevel = level;
    setCurrentTechniques(updated);
  };

  const handleTechniqueTypeChange = (index: number, type: 'Takedown' | 'Sweep' | 'Submission' | 'Escape') => {
    const updated = [...currentTechniques];
    updated[index].type = type;
    setCurrentTechniques(updated);
  };

  const commitCurrentCard = (): RoundEntry => {
    const finalStartingPosition = currentModality === 'Positional'
      ? (currentPosition === 'Other' ? customPositionText.trim() : currentPosition)
      : 'Neutral Start';

    if (currentModality === 'Positional' && currentPosition === 'Other' && finalStartingPosition) {
      setCustomTermsLogged(prev => [...prev, { term_name: finalStartingPosition, term_type: 'Position' }]);
    }

    return {
      roundIndex: roundCounter,
      modality: currentModality,
      startingPosition: finalStartingPosition,
      durationMinutes: currentDuration,
      partnerName: currentPartner.trim() || 'Anonymous Partner',
      partnerBelt: currentPartnerBelt,
      partnerWeight: currentPartnerWeight,
      partnerGender: currentPartnerGender,
      partnerHeight: currentPartnerHeight,
      techniques: currentTechniques,
      notes: currentRoundNotes,
    };
  };

  const handleContextChange = (context: 'Class Focus' | 'Independent') => {
    if (context === 'Class Focus' && !isGymAffiliated) {
      setShowGymAffiliationCTA(true);
      return;
    }
    setSessionContext(context);
    setCurrentModality(context === 'Independent' ? 'Full Roll' : 'Positional');
  };

  const resetCardState = () => {
    setCurrentTechniques([]);
    setCurrentRoundNotes('');
    setCurrentDuration(5);
    setCurrentPartner('');
    setCurrentPartnerBelt('Unknown');
    setCurrentPartnerWeight('Unknown');
    setCurrentPartnerGender('Unknown');
    setCurrentPartnerHeight('Unknown');
    setTechInput('');
    setCurrentPosition('Closed Guard');
    setCustomPositionText('');
    setCustomTechText('');
    setTechInput2('');
    setCustomTechText2('');
    setShowTransition(false);
    setCurrentModality(sessionContext === 'Independent' ? 'Full Roll' : 'Positional');
  };

  const handleSaveAndExit = async () => {
    const finalRound = commitCurrentCard();
    const allRounds = [...roundsList, finalRound];
    setSavingState('saving');

    if (session) {
      try {
        await saveSessionToSupabase(allRounds);
        await loadMetrics(session.user.id);
      } catch (err) {
        console.error('Error saving training session:', err);
      }
    }

    const isPremiumOrAbove = (profile?.access_role && profile.access_role !== 'User-Free') || !!profile?.beta_code;
    setSavingState('none');
    if (isPremiumOrAbove) {
      resetSessionWizard();
    } else {
      setIsAdTimerActive(true);
      setAdCountdown(5);
    }
  };

  const handleSaveAndNewBlank = () => {
    setSavingState('saving_new');
    setTimeout(() => {
      const committed = commitCurrentCard();
      setRoundsList([...roundsList, committed]);
      setRoundCounter((prev) => prev + 1);
      resetCardState();
      setSavingState('none');
      if (modalScrollRef.current) {
        modalScrollRef.current.scrollTop = 0;
      }
    }, 800);
  };

  const handleSaveAndDuplicateClone = () => {
    const isPremiumOrAbove = (profile?.access_role && profile.access_role !== 'User-Free') || !!profile?.beta_code;
    if (!isPremiumOrAbove) {
      setShowUpgradeModal(true);
      return;
    }
    setSavingState('cloning');
    setTimeout(() => {
      const committed = commitCurrentCard();
      setRoundsList([...roundsList, committed]);
      setRoundCounter((prev) => prev + 1);
      setSavingState('none');
      if (modalScrollRef.current) {
        modalScrollRef.current.scrollTop = 0;
      }
    }, 800);
  };

  const handleCancelLogging = async () => {
    if (roundsList.length > 0) {
      const confirmed = window.confirm(`You have logged ${roundsList.length} round(s). Would you like to save these logged rounds and exit? (The current card will be disregarded).`);
      if (confirmed) {
        setSavingState('saving');
        if (session) {
          try {
            await saveSessionToSupabase(roundsList);
            await loadMetrics(session.user.id);
          } catch (err) {
            console.error('Error saving training session:', err);
          }
        }
        setSavingState('none');
        resetSessionWizard();
      }
    } else {
      const confirmed = window.confirm('Discard unsaved training log? All current progress will be lost.');
      if (confirmed) {
        resetSessionWizard();
      }
    }
  };

  const resetSessionWizard = () => {
    setIsModalOpen(false);
    setIsAdTimerActive(false);
    setRoundsList([]);
    setRoundCounter(1);
    resetCardState();
    setSessionNotes('');
    setSessionDate(getLocalDateString());
    setShowGymAffiliationCTA(false);
    setCustomTermsLogged([]);
  };

  // DIAGNOSTIC DATABASE SAVE PIPELINE
  const saveSessionToSupabase = async (allRounds: RoundEntry[]) => {
    try {
      const finalNotes = sessionNotes || (sessionContext === 'Class Focus' ? `Curriculum: ${curriculumFocus}` : 'Independent session');
      
      let customDate: string | undefined = undefined;
      if (sessionDate) {
        const todayStr = getLocalDateString();
        if (sessionDate === todayStr) {
          customDate = new Date().toISOString();
        } else {
          customDate = new Date(`${sessionDate}T12:00:00`).toISOString();
        }
      }

      // 1. Gather all positions and techniques that are actually present in the final rounds
      const activePositions = new Set<string>();
      const activeTechniques = new Set<string>();

      allRounds.forEach(round => {
        if (round.startingPosition) {
          activePositions.add(round.startingPosition.trim().toLowerCase());
        }
        round.techniques.forEach(tech => {
          if (tech.name) {
            activeTechniques.add(tech.name.trim().toLowerCase());
          }
          if (tech.startingPosition) {
            activePositions.add(tech.startingPosition.trim().toLowerCase());
          }
        });
      });

      // 2. Filter customTermsLogged: must be present in the active sets
      const customTermsMap: Record<string, 'Position' | 'Technique'> = {};
      customTermsLogged.forEach(item => {
        const nameTrimmed = item.term_name.trim();
        if (!nameTrimmed) return;

        const nameLower = nameTrimmed.toLowerCase();
        if (item.term_type === 'Position' && activePositions.has(nameLower)) {
          customTermsMap[nameTrimmed] = 'Position';
        } else if (item.term_type === 'Technique' && activeTechniques.has(nameLower)) {
          customTermsMap[nameTrimmed] = 'Technique';
        }
      });

      // 3. Filter out terms that exist in the official dictionary (case-insensitive)
      const officialLowerSet = new Set(
        officialDictTerms.map(t => t.term_name.trim().toLowerCase())
      );
      // Include standard hardcoded default positions/techniques
      const defaultPositions = ['Closed Guard', 'Open Guard', 'Half Guard', 'Side Control', 'Mount', 'Back Control', 'Turtle', 'Neutral Start'];
      const defaultTechniques = [
        'Kimura', 'Armbar', 'Triangle Choke', 'Guillotine',
        'Scissor Sweep', 'Hip Bump Sweep', 'Knee Slide Pass',
        'Rear Naked Choke', 'Ankle Lock', 'De La Riva Sweep'
      ];
      defaultPositions.forEach(p => officialLowerSet.add(p.trim().toLowerCase()));
      defaultTechniques.forEach(t => officialLowerSet.add(t.trim().toLowerCase()));

      const customTermsList = Object.entries(customTermsMap)
        .filter(([name]) => !officialLowerSet.has(name.trim().toLowerCase()))
        .map(([name, type]) => ({
          term_name: name,
          term_type: type
        }));

      // CALL SERVER ACTION TO BYPASS RLS
      await saveTrainingSession(session.user.id, attireType, finalNotes, allRounds, customDate, customTermsList);
      
    } catch (err: any) {
      const flatErrorString = `DATABASE_COMMIT_FAIL -> MSG: ${err?.message || err} | CODE: UNKNOWN | HINT: None | DETAILS: None`;
      console.error('💥 CRITICAL WRITE EXCEPTION:', flatErrorString);
      throw new Error(flatErrorString);
    }
  };

  useEffect(() => {
    let timer: any;
    if (isAdTimerActive && adCountdown > 0) {
      timer = setTimeout(() => setAdCountdown((prev) => prev - 1), 1000);
    } else if (isAdTimerActive && adCountdown === 0) {
      resetSessionWizard();
    }
    return () => clearTimeout(timer);
  }, [isAdTimerActive, adCountdown]);

  const getTierName = () => {
    if (profile?.beta_code) return 'Beta (Premium)';
    if (!profile?.access_role) return 'Free';
    return profile.access_role.replace('User-', '');
  };

  return (
    <div className="space-y-8">
      {/* KPI & Headers Elements */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">DASHBOARD</h1>
          <p className="text-sm text-secondary mt-1">Analyze your training logs and enter progressive sessions.</p>
        </div>
        <div>
          {session ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary">Account Tier:</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border transition-colors ${(profile?.access_role && profile.access_role !== 'User-Free') || !!profile?.beta_code ? 'bg-neon/15 text-neon border border-neon/30' : 'bg-surface border border-secondary/20 text-secondary'}`}>
                {getTierName()}
              </span>
            </div>
          ) : (
            <span className="text-xs text-secondary">Demo Mode (Log in under Profile to save logs)</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-115" />
          <div>
            <p className="text-xs font-semibold text-secondary uppercase tracking-widest mb-1">Last Time on the Mats</p>
            {lastTrainedDate ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                <span className="text-2xl font-extrabold text-primary">{lastTrainedDate}</span>
                <span className="text-[10px] font-bold text-neon bg-neon/10 px-2 py-0.5 rounded border border-neon/20 self-start sm:self-auto uppercase tracking-wide">
                  {daysSinceText}
                </span>
              </div>
            ) : (
              <p className="text-xs text-secondary italic mt-1">No sessions logged yet</p>
            )}
            <p className="text-[9px] text-secondary mt-1">Includes classroom logins and independent training</p>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-800/60 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-secondary uppercase tracking-widest mb-1">Mat Time (Total)</p>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-extrabold text-primary">{totalMatTime}</span>
                <span className="text-sm font-semibold text-secondary">Hours</span>
              </div>
              <p className="text-[10px] text-secondary mt-2">Calculated from logged training session rounds</p>
            </div>
            
            <div className="relative z-10 shrink-0">
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="bg-neon hover:bg-neon/90 text-main font-extrabold text-xs px-4 py-3 rounded-xl shadow-md shadow-neon/5 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
              >
                LOG SESSION
              </button>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[120px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-115" />
          <div>
            <p className="text-xs font-semibold text-secondary uppercase tracking-widest mb-1">Attendance Rate</p>
            {isGymAffiliated ? (
              <>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-extrabold text-primary">{attendanceRate}</span>
                  <span className="text-sm font-semibold text-secondary">% (Last 30 Days)</span>
                </div>
                <p className="text-[10px] text-secondary mt-2">
                  Average of {activeDaysPerWeek} active days per week (Target: 3 days/week)
                </p>
              </>
            ) : (
              <div className="mt-2 space-y-2 relative z-10">
                <p className="text-[10px] text-secondary leading-relaxed max-w-xs">
                  You are not affiliated with a gym. Join a school to track class attendance, see curriculums, and receive coach critiques.
                </p>
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1.5 bg-neon hover:bg-neon/90 text-main text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-md shadow-neon/5"
                >
                  Join a School to track classes
                  <svg xmlns="http://www.w3.org/2050/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Performing & Focus Moves Card */}
      {session && (
        <TopMoves
          logs={userLogs}
          isPremium={(profile?.access_role && profile.access_role !== 'User-Free') || !!profile?.beta_code}
          handleUpgrade={handleSimulatedUpgrade}
        />
      )}

      {/* Performance Analytics Grid */}
      {session && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(profile?.access_role && profile.access_role !== 'User-Free') || !!profile?.beta_code ? (
            <TechniqueMirror logs={userLogs} currentRank={profile?.current_rank || 'White'} />
          ) : (
            <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[300px]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-105" />
              <div className="relative z-10 space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-neon uppercase tracking-widest bg-neon/10 px-2.5 py-1 rounded">Premium Feature</span>
                  <h3 className="text-lg font-bold text-primary uppercase tracking-wider mt-3">Technique Performance Mirror</h3>
                  <p className="text-xs text-secondary leading-relaxed">
                    Track your moves against different belt ranks! Analyze execution outcomes (🟢 successes vs 🔴 failures) and get dynamic training focus recommendations based on your sparring data.
                  </p>
                </div>

                {/* Locked Preview UI mockup */}
                <div className="border border-gray-800/50 bg-main/40 rounded-xl p-4 blur-[2px] select-none pointer-events-none space-y-2.5 max-w-md">
                  <div className="flex justify-between text-xs text-secondary">
                    <span>⚪ White Belt Opponents</span>
                    <div className="flex gap-3">
                      <span>🟢 12</span>
                      <span>🔴 3</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-secondary">
                    <span>🔵 Blue Belt Opponents</span>
                    <div className="flex gap-3">
                      <span>🟢 4</span>
                      <span>🔴 8</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSimulatedUpgrade}
                  className="bg-neon hover:bg-neon/90 text-main font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-neon/5 active:scale-95 self-start flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2050/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Unlock Technique Analytics
                </button>
              </div>
            </div>
          )}

          {/* Opponent Metrics Coming Soon Card */}
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[300px]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
            <div className="relative z-10 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest bg-zinc-800/60 px-2.5 py-1 rounded border border-zinc-700/50">
                  Feature
                </span>
                <h3 className="text-lg font-bold text-primary uppercase tracking-wider mt-3">Opponent Metrics</h3>
                <p className="text-xs text-secondary leading-relaxed">
                  Coming Soon - Gather information on your advantages and disadvantages against different types of opponents to assist in future rolls.
                </p>
              </div>

              {/* Locked Preview/Coming Soon graphic mock */}
              <div className="border border-gray-800/50 bg-main/40 rounded-xl p-5 space-y-3.5 select-none pointer-events-none relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-main/90 via-main/40 to-transparent z-10" />
                <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-widest text-neon mb-1">
                  <span>Example</span>
                </div>
                <div className="grid grid-cols-3 text-[10px] uppercase font-mono tracking-widest text-zinc-500 pb-1 border-b border-gray-800/40">
                  <span>Opponent Type</span>
                  <span className="text-center">Technique</span>
                  <span className="text-right">Success Rate</span>
                </div>
                <div className="grid grid-cols-3 text-xs items-center">
                  <span className="text-secondary font-medium">⚖️ Heavier</span>
                  <span className="text-center text-secondary">Kimura</span>
                  <span className="text-right text-neon/70 font-mono font-bold">54%</span>
                </div>
                <div className="grid grid-cols-3 text-xs items-center">
                  <span className="text-secondary font-medium">📏 Taller</span>
                  <span className="text-center text-secondary">Triangle Choke</span>
                  <span className="text-right text-red-400/70 font-mono font-bold">38%</span>
                </div>
                <div className="grid grid-cols-3 text-xs items-center">
                  <span className="text-secondary font-medium">🏃‍♂️ Lighter</span>
                  <span className="text-center text-secondary">Knee Slide</span>
                  <span className="text-right text-yellow-400/70 font-mono font-bold">72%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mat Time Volume Report */}
      {session && (
        <MatTimeVolumeReport logs={userLogs} />
      )}



      {/* OVERLAY WIZARD PORTAL */}
      {mounted && typeof document !== 'undefined' ? (
        createPortal(
          <>
            {isModalOpen && (
              <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 md:p-8 overflow-y-auto pt-safe pb-safe overscroll-contain">
          <div className="w-full max-w-2xl bg-surface border border-gray-800/80 rounded-2xl flex flex-col max-h-[85dvh] md:max-h-[92vh] shadow-2xl relative overflow-hidden">
            {/* Gym Affiliation CTA Overlay */}
            {showGymAffiliationCTA && (
              <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-sm z-40 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
                <div className="max-w-md w-full bg-surface border border-gray-800 rounded-2xl p-8 shadow-2xl space-y-6 relative z-50">
                  <div className="w-16 h-16 rounded-full bg-neon/15 border border-neon/30 flex items-center justify-center mx-auto text-neon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-primary uppercase tracking-wider">Gym Affiliation Required</h3>
                    <p className="text-xs text-secondary leading-relaxed">
                      Class Focus logs are linked directly to your gym's curriculum and lesson plans. To log a class focus session, you must be affiliated with a school.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowGymAffiliationCTA(false);
                        handleContextChange('Independent');
                      }} 
                      className="bg-main border border-gray-800 text-secondary hover:text-primary font-bold text-xs px-6 py-3 rounded-xl transition-all"
                    >
                      Keep Independent
                    </button>
                    <Link 
                      href="/profile" 
                      onClick={(e) => {
                        const confirmed = window.confirm('Discard unsaved training log? All current progress will be lost.');
                        if (!confirmed) {
                          e.preventDefault();
                        } else {
                          resetSessionWizard();
                        }
                      }}
                      className="bg-neon text-main hover:bg-neon/90 font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md shadow-neon/5 hover:scale-105 active:scale-95 text-center"
                    >
                      Join a School
                    </Link>
                  </div>
                </div>
              </div>
            )}
            {/* Header */}
            <div className="p-4 md:p-5 border-b border-gray-800/80 flex items-center justify-between bg-surface/50">
              <h2 className="font-bold text-primary text-xs md:text-sm tracking-widest uppercase truncate mr-2">TRAINING LOG (Rounds: {roundCounter})</h2>
              <button onClick={handleCancelLogging} className="text-secondary hover:text-primary shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            {/* Form Content */}
            <div ref={modalScrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-gray-800">
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Training Date</label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full max-w-[180px] md:max-w-none bg-main border border-gray-800 rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-neon/80"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Attire Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setAttireType('Gi')} className={`py-2 text-xs font-semibold rounded-lg border ${attireType === 'Gi' ? 'bg-neon/10 border-neon text-neon' : 'bg-main border-gray-800 text-secondary'}`}>Gi</button>
                    <button type="button" onClick={() => setAttireType('No-Gi')} className={`py-2 text-xs font-semibold rounded-lg border ${attireType === 'No-Gi' ? 'bg-neon/10 border-neon text-neon' : 'bg-main border-gray-800 text-secondary'}`}>No-Gi</button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Session Context</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleContextChange('Independent')} className={`py-2 text-xs font-semibold rounded-lg border ${sessionContext === 'Independent' ? 'bg-neon/10 border-neon text-neon' : 'bg-main border-gray-800 text-secondary'}`}>Independent</button>
                    <button 
                      type="button" 
                      onClick={() => handleContextChange('Class Focus')} 
                      className={`py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1 ${
                        sessionContext === 'Class Focus' 
                          ? 'bg-neon/10 border-neon text-neon' 
                          : 'bg-main border-gray-800 text-secondary'
                      } ${!isGymAffiliated ? 'opacity-65' : ''}`}
                    >
                      Class Focus {!isGymAffiliated && '🔒'}
                    </button>
                  </div>
                </div>
              </div>

              {sessionContext === 'Class Focus' && (
                <div className="bg-main/60 border border-gray-800 p-4 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Curriculum Lesson Focus</span>
                  <input type="text" value={curriculumFocus} onChange={(e) => setCurriculumFocus(e.target.value)} className="w-full bg-main border border-gray-800/80 rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-neon/80" />
                </div>
              )}

              {/* Progressive Wizard Round Card Module */}
              <div className="border border-gray-800 bg-main/30 rounded-xl p-5 md:p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <span className="text-xs font-bold text-neon uppercase tracking-widest">Round Card #{roundCounter}</span>
                </div>

                {/* Modality & Duration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Round Modality</label>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 py-2.5">
                      <label className="flex items-center gap-2 text-xs text-primary cursor-pointer"><input type="radio" name="modality" checked={currentModality === 'Positional'} onChange={() => setCurrentModality('Positional')} className="accent-neon w-4 h-4 bg-main" />Positional Roll</label>
                      <label className="flex items-center gap-2 text-xs text-primary cursor-pointer"><input type="radio" name="modality" checked={currentModality === 'Full Roll'} onChange={() => setCurrentModality('Full Roll')} className="accent-neon w-4 h-4 bg-main" />Full Roll</label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Round Duration</label>
                    <select value={currentDuration} onChange={(e) => setCurrentDuration(Number(e.target.value))} className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-xs text-primary focus:outline-none">
                      {[2, 3, 4, 5, 6, 7, 8, 10].map((mins) => <option key={mins} value={mins}>{mins} Minutes</option>)}
                    </select>
                  </div>
                </div>

                {/* Targeted Technique Focus Box */}
                <div className="p-4 bg-main/40 border border-gray-800 rounded-xl space-y-4">
                  <span className="text-[10px] font-bold text-neon uppercase tracking-wider block border-b border-gray-800 pb-2">Targeted Technique Focus</span>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider">Add Technique Focus</label>
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
                          {getTechniqueLimit(profile?.current_rank) === Infinity
                            ? `${currentTechniques.length} Focuses Per Round`
                            : `${currentTechniques.length}/${getTechniqueLimit(profile?.current_rank)} Focuses Per Round`}
                        </span>
                      </div>
                      
                      {/* First Focus Input */}
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <SearchableDropdown
                            value={techInput}
                            onChange={(val) => {
                              if (val === 'Other' && !profile?.is_premium_tier) {
                                setShowUpgradeModal(true);
                                return;
                              }
                              setTechInput(val);
                            }}
                            options={combinedDbFocus}
                            personalOptions={combinedPersonalFocus}
                            placeholder="-- Select Focus --"
                            allowEmpty={true}
                            emptyLabel="-- Select Focus --"
                            otherLabel="Other (Custom Focus)"
                          />
                          {techInput === 'Other' && (
                            <input
                              type="text"
                              value={customTechText}
                              onChange={(e) => setCustomTechText(e.target.value)}
                              className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary placeholder-gray-650 focus:outline-none focus:border-neon"
                              placeholder="Type custom focus name..."
                              required
                            />
                          )}
                        </div>
                        {techInput && !showTransition && (
                          <button
                            type="button"
                            onClick={() => setShowTransition(true)}
                            className="bg-main hover:bg-main/80 border border-gray-800 hover:border-neon hover:text-neon text-secondary rounded-lg px-3 py-2.5 text-xs font-bold transition-all duration-200"
                            title="Add transition"
                          >
                            ➔
                          </button>
                        )}
                      </div>

                      {/* Second Focus Input (Transition) */}
                      {showTransition && (
                        <div className="border border-dashed border-gray-800 rounded-xl p-3 bg-main/20 space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-neon uppercase tracking-wider">➔ Transition To</span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowTransition(false);
                                setTechInput2('');
                                setCustomTechText2('');
                              }}
                              className="text-secondary hover:text-red-400 text-[10px]"
                            >
                              Remove Transition
                            </button>
                          </div>
                          <SearchableDropdown
                            value={techInput2}
                            onChange={(val) => {
                              if (val === 'Other' && !profile?.is_premium_tier) {
                                setShowUpgradeModal(true);
                                return;
                              }
                              setTechInput2(val);
                            }}
                            options={combinedDbFocus}
                            personalOptions={combinedPersonalFocus}
                            placeholder="-- Select Transition Target --"
                            allowEmpty={true}
                            emptyLabel="-- Select Transition Target --"
                            otherLabel="Other (Custom Focus)"
                          />
                          {techInput2 === 'Other' && (
                            <input
                              type="text"
                              value={customTechText2}
                              onChange={(e) => setCustomTechText2(e.target.value)}
                              className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary placeholder-gray-650 focus:outline-none focus:border-neon"
                              placeholder="Type custom focus name..."
                              required
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddTechnique}
                      disabled={
                        !techInput ||
                        (techInput === 'Other' && !customTechText.trim()) ||
                        (showTransition && !techInput2) ||
                        (showTransition && techInput2 === 'Other' && !customTechText2.trim()) ||
                        currentTechniques.length >= getTechniqueLimit(profile?.current_rank)
                      }
                      className="w-full bg-neon disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed hover:bg-neon/90 text-main font-bold text-xs py-2.5 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-neon/5 text-center block mt-3"
                    >
                      ADD Focus
                    </button>
                  </div>
                </div>

                {currentTechniques.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-gray-800">
                    {currentTechniques.map((tech, idx) => (
                      <div key={idx} className="bg-surface/50 border border-gray-800 p-4 rounded-lg space-y-4 relative">
                        <button type="button" onClick={() => handleRemoveTechnique(idx)} className="absolute top-3 right-3 text-secondary hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        
                        <div className="flex flex-col gap-1 pr-6 border-b border-gray-800 pb-2">
                          <span className="text-[10px] font-bold text-neon uppercase tracking-wider">Focus #{idx + 1}</span>
                          <span className="text-xs font-bold text-primary break-words">
                            {tech.name}
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Type</label>
                          <div className="flex flex-wrap gap-1">
                            {['Takedown', 'Sweep', 'Submission', 'Escape'].map((tType) => (
                              <button
                                key={tType}
                                type="button"
                                onClick={() => handleTechniqueTypeChange(idx, tType as 'Takedown' | 'Sweep' | 'Submission' | 'Escape')}
                                className={`px-2.5 py-1 text-[10px] font-semibold rounded border transition-all ${
                                  tech.type === tType
                                    ? 'bg-neon text-main border-neon'
                                    : 'bg-main border-gray-800 text-secondary'
                                }`}
                              >
                                {tType}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <span className="text-xs text-secondary">Did you hit the move?</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleTechniqueSuccessToggle(idx, true)} className={`px-4 py-1.5 text-[10px] font-bold rounded border ${tech.isSuccessful ? 'bg-neon text-main border-neon' : 'bg-main border-gray-800 text-secondary'}`}>YES</button>
                            <button type="button" onClick={() => handleTechniqueSuccessToggle(idx, false)} className={`px-4 py-1.5 text-[10px] font-bold rounded border ${!tech.isSuccessful ? 'bg-red-500/10 border-red-500/40 text-red-400' : 'bg-main border-gray-800 text-secondary'}`}>NO</button>
                          </div>
                        </div>
                        {tech.isSuccessful && (
                          <div className="pt-3 border-t border-gray-800">
                            <span className="text-[10px] text-secondary uppercase tracking-wider block mb-2">Resistance Level</span>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                              {['Easy', 'Moderate', 'Difficult'].map((lvl) => (
                                <label key={lvl} className="flex items-center gap-1.5 text-xs text-primary cursor-pointer"><input type="radio" name={`resistance-${idx}`} checked={tech.resistanceLevel === lvl} onChange={() => handleTechniqueResistanceChange(idx, lvl as 'Easy' | 'Moderate' | 'Difficult')} className="accent-neon w-3.5 h-3.5 bg-main" />{lvl}</label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Partner Profile UI Blocks */}
                <div className="p-4 bg-main/40 border border-gray-800 rounded-xl space-y-4">
                  <span className="text-[10px] font-bold text-neon uppercase tracking-wider block border-b border-gray-800 pb-2">Opponent / Partner Profile</span>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Partner Identity</label>
                    <input type="text" value={currentPartner} onChange={(e) => setCurrentPartner(e.target.value)} className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary focus:outline-none" placeholder="Manual Name Input (Optional)" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Opponent Belt Rank</label>
                    <div className="flex flex-wrap gap-1">
                      {['Unknown', 'White', 'Blue', 'Purple', 'Brown', 'Black'].map((belt) => (
                        <button key={belt} type="button" onClick={() => setCurrentPartnerBelt(belt)} className={`px-2.5 py-1 text-[10px] font-semibold rounded border transition-all ${currentPartnerBelt === belt ? 'bg-neon text-main border-neon' : 'bg-main border-gray-800 text-secondary'}`}>{belt}</button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Relative Weight Class</label>
                      <div className="flex flex-wrap gap-1">
                        {['Unknown', 'Lighter', 'Similar', 'Heavier'].map((weight) => (
                          <button key={weight} type="button" onClick={() => setCurrentPartnerWeight(weight)} className={`px-2.5 py-1 text-[10px] font-semibold rounded border transition-all ${currentPartnerWeight === weight ? 'bg-neon text-main border-neon' : 'bg-main border-gray-800 text-secondary'}`}>{weight}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Relative Height Class</label>
                      <div className="flex flex-wrap gap-1">
                        {['Unknown', 'Shorter', 'Same', 'Taller'].map((h) => (
                          <button key={h} type="button" onClick={() => setCurrentPartnerHeight(h)} className={`px-2.5 py-1 text-[10px] font-semibold rounded border transition-all ${currentPartnerHeight === h ? 'bg-neon text-main border-neon' : 'bg-main border-gray-800 text-secondary'}`}>{h}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Opponent Gender</label>
                    <div className="flex flex-wrap gap-1">
                      {['Unknown', 'Male', 'Female'].map((gender) => (
                        <button key={gender} type="button" onClick={() => setCurrentPartnerGender(gender)} className={`px-4 py-1 text-[10px] font-semibold rounded border transition-all ${currentPartnerGender === gender ? 'bg-neon text-main border-neon' : 'bg-main border-gray-800 text-secondary'}`}>{gender}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Round Notes</label>
                  <textarea rows={2} value={currentRoundNotes} onChange={(e) => setCurrentRoundNotes(e.target.value)} className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-xs text-primary placeholder-gray-600 focus:outline-none focus:border-neon/80" placeholder="Enter notes about sparring partners, sweeps, or mistakes..." />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Session Notes (Overall Summary)</label>
                <textarea rows={2} value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-xs text-primary placeholder-gray-600 focus:outline-none focus:border-neon/80" placeholder="Enter overall mat notes, coach adjustments, or conditioning logs..." />
              </div>
            </div>

            {/* Sticky Footers */}
            <div className="p-3 md:p-4 bg-surface border-t border-gray-800/80 grid grid-cols-2 md:flex md:flex-row gap-2 md:gap-3 w-full">
              <button type="button" onClick={handleSaveAndExit} className="w-full md:flex-1 bg-main hover:bg-neon active:bg-neon text-primary hover:text-main active:text-main font-bold text-xs py-3 rounded-lg border border-secondary/20 transition-all duration-200 text-center">Save & Exit</button>
              <button type="button" onClick={handleSaveAndNewBlank} className="w-full md:flex-1 bg-main hover:bg-neon active:bg-neon text-primary hover:text-main active:text-main font-bold text-xs py-3 rounded-lg border border-secondary/20 transition-all duration-200 text-center">Save & New</button>
              <button type="button" onClick={handleSaveAndDuplicateClone} className="w-full md:flex-1 bg-main hover:bg-neon active:bg-neon text-primary hover:text-main active:text-main font-bold text-xs py-3 rounded-lg border border-secondary/20 transition-all duration-200 text-center">Clone Card</button>
              <button type="button" onClick={handleCancelLogging} className="w-full md:flex-1 bg-main hover:bg-red-500/10 active:bg-red-500/20 text-red-400 font-bold text-xs py-3 rounded-lg border border-red-500/30 hover:border-red-500/50 transition-all duration-200 text-center">Cancel</button>
            </div>

            {/* Unified Premium Thinking / Saving / Ad Overlay */}
            {(savingState !== 'none' || isAdTimerActive) && (
              <div className="absolute inset-0 bg-main/95 z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
                {/* Rich Orbital Loading Animation */}
                <div className="relative w-20 h-20 mb-6">
                  {/* Outer spinning ring */}
                  <div className="absolute inset-0 rounded-full border-4 border-neon/10 border-t-neon animate-spin" style={{ animationDuration: '1.5s' }} />
                  {/* Middle pulsing ring */}
                  <div className="absolute inset-[10px] rounded-full border-4 border-neon/20 border-b-neon animate-pulse" />
                  {/* Inner fast spinning orbit */}
                  <div className="absolute inset-[20px] rounded-full border-4 border-transparent border-r-neon/60 animate-spin" style={{ animationDuration: '0.8s', animationDirection: 'reverse' }} />
                  {/* Core logo icon */}
                  <div className="absolute inset-[28px] bg-neon/15 rounded-full flex items-center justify-center border border-neon/30 text-neon font-bold text-[10px]">
                    GT
                  </div>
                </div>
                
                <h3 className="text-sm font-bold text-primary tracking-widest uppercase animate-pulse">
                  {savingState === 'saving' && 'Saving Training Log...'}
                  {savingState === 'saving_new' && 'Saving Round...'}
                  {savingState === 'cloning' && 'Saving and Cloning Round...'}
                  {isAdTimerActive && 'Loading Secured Ad...'}
                </h3>
                
                <p className="text-[11px] text-secondary mt-3 max-w-xs leading-relaxed">
                  {savingState === 'saving' && 'Analyzing data and preparing database write...'}
                  {savingState === 'saving_new' && 'Preparing next round card...'}
                  {savingState === 'cloning' && 'Duplicating session telemetry...'}
                  {isAdTimerActive && (
                    <>
                      Ad verification check in progress. Wrapping up in{' '}
                      <span className="text-neon font-bold text-sm">{adCountdown}s</span>.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

            {/* Floating Cancel FAB */}
            {isModalOpen && (
              <button
                type="button"
                onClick={handleCancelLogging}
                className="fixed bottom-6 right-6 z-[10000] w-12 h-12 rounded-full bg-surface hover:bg-zinc-800/80 border border-gray-800 text-secondary hover:text-red-400 flex items-center justify-center shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 group"
                title="Discard Session and Close"
              >
          <span className="sr-only">Cancel and Go Back</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
            className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

            {showUpgradeModal && (
              <div className="fixed inset-0 bg-main/90 z-[10001] flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-surface border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 bg-neon/10 text-neon rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">👑</div>
                  <h3 className="text-sm font-bold text-primary uppercase tracking-widest">Upgrade to Premium</h3>
                  <p className="text-xs text-secondary leading-relaxed">
                    Custom techniques and positions (Personal Dictionary tracking) are exclusive to Premium members. Upgrade to unlock customizable tracking, advanced opponent analytics, and coach critiques.
                  </p>
                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSimulatedUpgrade}
                      className="w-full bg-neon hover:bg-neon/90 text-main font-bold text-xs py-3 rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Simulate Premium Upgrade
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUpgradeModal(false)}
                      className="w-full bg-main hover:bg-zinc-800 text-secondary hover:text-primary border border-gray-800 text-xs font-semibold py-3 rounded-lg transition-all duration-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body
        )
      ) : null}
    </div>
  );
}