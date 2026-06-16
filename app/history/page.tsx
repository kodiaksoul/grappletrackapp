'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { fetchUserHistory } from '../actions/fetchHistory';
import { updateTrainingLog, deleteTrainingRound } from '../actions/saveSession';
import { fetchPersonalDictionary } from '../actions/personalDictionary';
import { savePersonalTerm } from '../actions/personalDictionary';
import { useAuth } from '../AuthGuard';
import SearchableDropdown from '../../components/SearchableDropdown';

interface ExecutedTechnique {
  id: string;
  technique_name: string;
  is_successful: boolean;
  resistance_level: 'Easy' | 'Moderate' | 'Difficult' | null;
  match_video_url: string | null;
  starting_position?: string | null;
  technique_type?: 'Takedown' | 'Sweep' | 'Submission' | 'Escape' | null;
}

interface Round {
  id: string;
  round_index: number;
  modality: 'Positional' | 'Full Roll';
  starting_position: string | null;
  duration_minutes: number;
  partner_name: string;
  partner_belt: string;
  partner_weight: string;
  partner_gender: string | null;
  partner_height: string | null;
  notes: string | null;
  executed_techniques: ExecutedTechnique[];
}

interface CoachCritique {
  id: string;
  feedback: string;
  audio_url: string | null;
  created_at: string;
  profiles: {
    id: string;
    name: string;
    username: string;
  } | null;
}

interface TrainingLog {
  id: string;
  created_at: string;
  attire_type: 'Gi' | 'No-Gi';
  notes: string | null;
  rounds: Round[];
  coach_critiques?: CoachCritique[];
}

const getLocalDateKey = (dateString: string) => {
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export default function HistoryPage() {
  const router = useRouter();
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);

  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [hiddenLogsCount, setHiddenLogsCount] = useState(0);
  const [filterAttire, setFilterAttire] = useState<'All' | 'Gi' | 'No-Gi'>('All');
  const [viewMode, setViewMode] = useState<'List' | 'Calendar'>('List');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [editingParentLog, setEditingParentLog] = useState<TrainingLog | null>(null);

  // Dictionary state for SearchableDropdown in edit modal
  const [dbPositions, setDbPositions] = useState<string[]>([
    'Closed Guard', 'Open Guard', 'Half Guard', 'Side Control', 'Mount', 'Back Control', 'Turtle'
  ]);
  const [dbTechniques, setDbTechniques] = useState<string[]>([
    'Kimura', 'Armbar', 'Triangle Choke', 'Guillotine',
    'Scissor Sweep', 'Hip Bump Sweep', 'Knee Slide Pass',
    'Rear Naked Choke', 'Ankle Lock', 'De La Riva Sweep'
  ]);
  const [personalPositions, setPersonalPositions] = useState<string[]>([]);
  const [personalTechniques, setPersonalTechniques] = useState<string[]>([]);
  // Per-technique custom text state: keyed by `${roundIdx}-${techIdx}`
  const [customTechNames, setCustomTechNames] = useState<Record<string, string>>({});
  const [customTechPositions, setCustomTechPositions] = useState<Record<string, string>>({});
  // Track custom terms to be saved to the personal dictionary on save
  const [pendingCustomTerms, setPendingCustomTerms] = useState<{ term_name: string; term_type: 'Position' | 'Technique' }[]>([]);

  const loadDictionaryTerms = async (userId?: string) => {
    try {
      const { data: officialData, error: officialError } = await supabase
        .from('official_dictionary')
        .select('term_name, term_type');

      let officialTermsList: { term_name: string; term_type: string }[] = [];
      if (!officialError && officialData) {
        officialTermsList = officialData;
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
        if (term.term_type === 'Position') officialPositionsSet.add(name);
        else if (term.term_type === 'Technique') officialTechniquesSet.add(name);
      });

      personalTermsList.forEach(term => {
        const name = term.term_name.trim();
        if (!name) return;
        if (term.term_type === 'Position') personalPositionsSet.add(name);
        else if (term.term_type === 'Technique') personalTechniquesSet.add(name);
      });

      personalPositionsSet.forEach(pos => { if (officialPositionsSet.has(pos)) personalPositionsSet.delete(pos); });
      personalTechniquesSet.forEach(tech => { if (officialTechniquesSet.has(tech)) personalTechniquesSet.delete(tech); });

      setDbPositions(Array.from(officialPositionsSet).sort((a, b) => a.localeCompare(b)));
      setDbTechniques(Array.from(officialTechniquesSet).sort((a, b) => a.localeCompare(b)));
      setPersonalPositions(Array.from(personalPositionsSet).sort((a, b) => a.localeCompare(b)));
      setPersonalTechniques(Array.from(personalTechniquesSet).sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error('[GrappleTracker] Error loading dictionary terms:', err);
    }
  };

  // Initial Logs check when auth is resolved
  useEffect(() => {
    if (authLoading) return;

    if (session) {
      fetchLogs(session.user.id);
      loadDictionaryTerms(session.user.id);
    } else {
      setLogs([]);
      setLoading(false);
    }
  }, [session, authLoading]);

  const fetchLogs = async (userId: string) => {
    try {
      setLoading(true);
      // 1) Ensure auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      
      // 2) Fetch user history using the Server Action (Bypasses RLS recursion)
      const { logs: logData, hiddenCount } = await fetchUserHistory(userId);
      setHiddenLogsCount(hiddenCount);

      if (logData && logData.length > 0) {
        const formattedLogs: TrainingLog[] = (logData as any[]).map((log) => ({
          id: log.id,
          created_at: log.created_at,
          attire_type: log.attire_type,
          notes: log.notes,
          coach_critiques: log.coach_critiques,
          rounds: (log.rounds || []).sort((a: any, b: any) => a.round_index - b.round_index),
        }));
        setLogs(formattedLogs);
      } else {
        setLogs([]);
      }
    } catch (err: any) {
      // Re-throw the explicit text error straight into the Next.js Red Screen Overlay
      throw new Error(err?.message || 'Unknown processing error inside history ledger loop.');
    } finally {
      setLoading(false);
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
        await refreshProfile();
        fetchLogs(session.user.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLogExpand = (logId: string) => {
    setExpandedLogs((prev) => ({ ...prev, [logId]: !prev[logId] }));
  };

  const getYouTubeEmbedUrl = (url: string | null): string | null => {
    if (!url) return null;
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        return `https://www.youtube-nocookie.com/embed/${match[2]}`;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const handleSaveVideoUrl = async (techId: string) => {
    setUploadError(null);
    if (!videoUrlInput) return;

    try {
      if (session) {
        const { error } = await supabase
          .from('executed_techniques')
          .update({ match_video_url: videoUrlInput })
          .eq('id', techId);

        if (error) throw error;
      }

      setLogs((prevLogs) =>
        prevLogs.map((log) => ({
          ...log,
          rounds: log.rounds.map((round) => ({
            ...round,
            executed_techniques: round.executed_techniques.map((tech) => {
              if (tech.id === techId) {
                return { ...tech, match_video_url: videoUrlInput };
              }
              return tech;
            }),
          })),
        }))
      );

      setEditingTechId(null);
      setVideoUrlInput('');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to update video link.');
    }
  };

  const handleRemoveLog = async (logId: string) => {
    const confirmed = window.confirm('Are you sure you want to permanently delete this training log session?');
    if (!confirmed) return;

    try {
      if (session && !logId.startsWith('mock-')) {
        const { error } = await supabase
          .from('training_logs')
          .delete()
          .eq('id', logId);

        if (error) throw error;
      }
      
      // Update local state
      setLogs((prev) => prev.filter((log) => log.id !== logId));
    } catch (err: any) {
      alert(`Failed to delete training log: ${err.message}`);
    }
  };

  const handleRemoveRound = async (logId: string, roundId: string) => {
    const confirmed = window.confirm('Are you sure you want to permanently delete this training round?');
    if (!confirmed) return;

    try {
      if (session && !logId.startsWith('mock-')) {
        const res = await deleteTrainingRound(session.user.id, logId, roundId);
        if (!res.success) {
          throw new Error(res.error || 'Failed to delete round from database.');
        }
        await fetchLogs(session.user.id);
      } else {
        // Mock fallback
        setLogs((prev) =>
          prev
            .map((log) => {
              if (log.id === logId) {
                const updatedRounds = log.rounds
                  .filter((r) => r.id !== roundId)
                  .map((r, idx) => ({ ...r, round_index: idx + 1 }));
                return { ...log, rounds: updatedRounds };
              }
              return log;
            })
            .filter((log) => log.rounds.length > 0)
        );
      }
    } catch (err: any) {
      alert(`Failed to delete round: ${err.message}`);
    }
  };

  const startEditRound = (log: TrainingLog, round: Round) => {
    setEditingParentLog(JSON.parse(JSON.stringify(log)));
    setEditingRound(JSON.parse(JSON.stringify(round)));
    setCustomTechNames({});
    setCustomTechPositions({});
    setPendingCustomTerms([]);
  };

  const handleUpdateLog = async () => {
    if (!editingParentLog || !editingRound) return;
    try {
      // Resolve any "Other" values to their custom text in the single editingRound
      const resolvedRound = JSON.parse(JSON.stringify(editingRound)) as Round;
      resolvedRound.executed_techniques.forEach((tech) => {
        const key = tech.id;
        if (tech.technique_name === 'Other') {
          const custom = (customTechNames[key] || '').trim();
          if (custom) tech.technique_name = custom;
        }
        if (tech.starting_position === 'Other') {
          const custom = (customTechPositions[key] || '').trim();
          if (custom) tech.starting_position = custom;
          else tech.starting_position = null;
        }
      });

      // Construct a TrainingLog payload containing only this round
      const resolvedLog = {
        id: editingParentLog.id,
        created_at: editingParentLog.created_at,
        attire_type: editingParentLog.attire_type,
        notes: editingParentLog.notes,
        rounds: [resolvedRound],
      };

      if (session && !resolvedLog.id.startsWith('mock-')) {
        // Save any pending custom terms to the personal dictionary
        for (const ct of pendingCustomTerms) {
          await savePersonalTerm(session.user.id, { term_name: ct.term_name, term_type: ct.term_type });
        }

        const res = await updateTrainingLog(session.user.id, resolvedLog as any);
        if (!res.success) {
          throw new Error(res.error || 'Failed to update database.');
        }
        await fetchLogs(session.user.id);
        await loadDictionaryTerms(session.user.id);
      } else {
        // Update local mock state
        setLogs((prev) =>
          prev.map((log) => {
            if (log.id === resolvedLog.id) {
              return {
                ...log,
                created_at: resolvedLog.created_at,
                attire_type: resolvedLog.attire_type,
                notes: resolvedLog.notes,
                rounds: log.rounds.map((r) => (r.id === resolvedRound.id ? resolvedRound : r)),
              };
            }
            return log;
          })
        );
      }
      setEditingRound(null);
      setEditingParentLog(null);
      setCustomTechNames({});
      setCustomTechPositions({});
      setPendingCustomTerms([]);
    } catch (err: any) {
      alert(`Failed to save changes: ${err.message}`);
    }
  };

  const isPremium = (profile?.access_role && profile.access_role !== 'User-Free') || !!profile?.beta_code;

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));

  const filteredLogs = logs.filter((log) => {
    if (filterAttire !== 'All' && log.attire_type !== filterAttire) return false;
    return true;
  });

  const visibleLogs = filteredLogs;

  const logsGroupedByDate = useMemo(() => {
    const groups: { [key: string]: TrainingLog[] } = {};
    visibleLogs.forEach((log) => {
      const dateKey = getLocalDateKey(log.created_at);

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    return Object.keys(groups)
      .map((dateKey) => {
        const dateString = new Date(dateKey + 'T00:00:00').toLocaleDateString(undefined, {
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        });
        return {
          dateKey,
          dateString,
          logsList: groups[dateKey],
        };
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [visibleLogs]);

  const toggleDateExpand = (dateKey: string) => {
    setExpandedLogs((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  return (
    <div className="space-y-8">
      {/* Sticky Header Filters */}
      <div className="sticky top-0 bg-main/80 backdrop-blur-md pt-2 pb-4 z-40 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary">TRAINING LOGS</h1>
            <p className="text-sm text-secondary mt-1">Browse and review your historical training cards and video replays.</p>
          </div>
          <button
            onClick={() => router.push('/dashboard?log=true')}
            className="bg-neon hover:bg-neon/90 text-main font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-neon/5 active:scale-95 flex items-center gap-1.5 self-start sm:self-auto uppercase tracking-wider"
          >
            🥋 Log a Round
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-surface border border-gray-800/80 rounded-xl p-3 flex items-center justify-between shadow-lg flex-1">
            <span className="text-xs font-semibold text-secondary uppercase tracking-widest pl-2">Filter Attire</span>
            <div className="flex gap-1">
            {['All', 'Gi', 'No-Gi'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterAttire(type as any)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${filterAttire === type ? 'bg-neon/10 border border-neon/30 text-neon' : 'bg-transparent text-secondary hover:text-primary'
                  }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        
        <div className="bg-surface border border-gray-800/80 rounded-xl p-3 flex items-center shadow-lg">
          <div className="flex gap-1 w-full">
            <button onClick={() => setViewMode('List')} className={`flex-1 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'List' ? 'bg-neon/10 border border-neon/30 text-neon' : 'bg-transparent text-secondary hover:text-primary'}`}>List View</button>
            <button onClick={() => setViewMode('Calendar')} className={`flex-1 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'Calendar' ? 'bg-neon/10 border border-neon/30 text-neon' : 'bg-transparent text-secondary hover:text-primary'}`}>Calendar View</button>
          </div>
        </div>
      </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
          <div className="w-8 h-8 rounded-full border-2 border-neon border-t-transparent animate-spin" />
          <p className="text-secondary text-sm">Parsing training ledger...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === 'Calendar' ? (
            <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <button onClick={prevMonth} className="p-2 bg-main border border-gray-800 rounded-lg text-secondary hover:text-neon transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
                <h2 className="text-lg font-bold text-primary tracking-wider uppercase">
                  {calendarDate.toLocaleString('default', { month: 'long' })} {calendarDate.getFullYear()}
                </h2>
                <button onClick={nextMonth} className="p-2 bg-main border border-gray-800 rounded-lg text-secondary hover:text-neon transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-[10px] font-bold text-secondary uppercase tracking-widest">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: getFirstDayOfMonth(calendarDate.getFullYear(), calendarDate.getMonth()) }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square rounded-lg bg-main/30 border border-transparent"></div>
                ))}
                {Array.from({ length: getDaysInMonth(calendarDate.getFullYear(), calendarDate.getMonth()) }).map((_, i) => {
                  const dateNum = i + 1;
                  const monthStr = String(calendarDate.getMonth() + 1).padStart(2, '0');
                  const dayStr = String(dateNum).padStart(2, '0');
                  const dateStr = `${calendarDate.getFullYear()}-${monthStr}-${dayStr}`;
                  
                  // Find logs for this specific date
                  const dayLogs = visibleLogs.filter(log => getLocalDateKey(log.created_at) === dateStr);
                  const hasGi = dayLogs.some(log => log.attire_type === 'Gi');
                  const hasNoGi = dayLogs.some(log => log.attire_type === 'No-Gi');
                  const isSelected = selectedCalendarDate === dateStr;
                  
                  return (
                    <button
                      key={dateNum}
                      onClick={() => setSelectedCalendarDate(isSelected ? null : dateStr)}
                      className={`relative aspect-square rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${isSelected ? 'bg-neon/10 border-neon text-neon' : dayLogs.length > 0 ? 'bg-main border-gray-700 hover:border-neon text-primary shadow-lg shadow-neon/5' : 'bg-main/50 border-gray-800/50 text-secondary/50 hover:bg-main/80'}`}
                    >
                      <span className="text-sm font-semibold">{dateNum}</span>
                      {dayLogs.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {hasGi && <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>}
                          {hasNoGi && <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {selectedCalendarDate && (
                <div className="mt-8 pt-6 border-t border-gray-800 space-y-4">
                  <h3 className="text-sm font-bold text-primary uppercase tracking-wider">
                    Sessions on {new Date(selectedCalendarDate + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </h3>
                  {visibleLogs.filter(log => getLocalDateKey(log.created_at) === selectedCalendarDate).length === 0 ? (
                    <p className="text-xs text-secondary italic">No sessions logged on this date.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* We duplicate the log card renderer logic here for the selected day */}
                      {visibleLogs.filter(log => getLocalDateKey(log.created_at) === selectedCalendarDate).map((log) => {
                        const isExpanded = !!expandedLogs[log.id];
                        return (
                          <div key={log.id} className="bg-main border border-gray-800/80 rounded-xl overflow-hidden shadow-md">
                            <button onClick={() => toggleLogExpand(log.id)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/20 transition-colors">
                              <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${log.attire_type === 'Gi' ? 'bg-blue-950/30 text-blue-400 border border-blue-900/40' : 'bg-orange-950/30 text-orange-400 border border-orange-900/40'}`}>{log.attire_type}</span>
                                  <span className="text-xs font-semibold text-primary">{log.notes || 'Independent training session'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-neon bg-neon/5 border border-neon/20 px-2.5 py-1 rounded-full font-semibold">{log.rounds.length} {log.rounds.length === 1 ? 'Round' : 'Rounds'}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={`w-4 h-4 text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                              </div>
                            </button>

                            {isExpanded && (
                               <div className="px-4 pb-4 border-t border-gray-800 bg-surface/30 space-y-4 pt-4">
                                 <div className="flex justify-between items-center bg-gray-950/10 border border-gray-900/25 p-2 rounded-lg mb-2">
                                   <span className="text-[9px] text-secondary">Actions:</span>
                                   <div className="flex gap-2">
                                     <button onClick={() => handleRemoveLog(log.id)} className="text-[9px] font-bold text-red-400 hover:bg-red-950/20 px-2.5 py-1 rounded border border-red-900/40 transition-colors">Remove Log</button>
                                   </div>
                                 </div>
                                 {log.rounds.map((round) => (
                                   <div key={round.id} className="bg-surface border border-gray-800 p-3 rounded-xl space-y-2">
                                     <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-2 gap-1">
                                       <span className="text-xs font-bold text-primary">Round #{round.round_index} ({round.modality}) — {round.duration_minutes} Mins</span>
                                       <div className="flex items-center gap-2">
                                         <span className="text-[10px] text-neon font-bold uppercase">Partner: {round.partner_name}</span>
                                         <button
                                           onClick={() => startEditRound(log, round)}
                                           className="text-[9px] font-bold text-neon hover:bg-neon/10 px-2 py-1 rounded border border-neon/30 transition-colors"
                                         >
                                           Edit Round
                                         </button>
                                         <button
                                           onClick={() => handleRemoveRound(log.id, round.id)}
                                           className="text-[9px] font-bold text-red-400 hover:bg-red-950/20 px-2 py-1 rounded border border-red-900/40 transition-colors"
                                         >
                                           Remove Round
                                         </button>
                                       </div>
                                     </div>
                                     <div className="text-[10px] text-secondary">
                                       {round.executed_techniques.length} Techniques Logged
                                     </div>
                                   </div>
                                 ))}

                                {/* Verified Critique Loop */}
                                {((profile?.access_role === 'User-Student') || (log.coach_critiques && log.coach_critiques.length > 0)) && (
                                  <div className="pt-4 border-t border-gray-800 space-y-3">
                                    <span className="text-xs font-bold text-neon uppercase tracking-wider block">Coach/Teacher Feedback</span>
                                    {!log.coach_critiques || log.coach_critiques.length === 0 ? (
                                      <p className="text-xs text-secondary italic">No feedback from your coaches yet.</p>
                                    ) : (
                                      <div className="space-y-3">
                                        {log.coach_critiques.map((critique) => (
                                          <div key={critique.id} className="p-3 bg-neon/5 border border-neon/20 rounded-xl space-y-2">
                                            <div className="flex justify-between items-center text-[10px]">
                                              <span className="text-primary font-bold">{critique.profiles?.name || critique.profiles?.username || 'Coach'}</span>
                                              <span className="text-secondary">{new Date(critique.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-secondary leading-relaxed">"{critique.feedback}"</p>
                                            {critique.audio_url && (
                                              <div className="pt-1.5 flex items-center gap-2">
                                                <span className="text-[9px] text-neon uppercase font-semibold">Voice critique:</span>
                                                <audio src={critique.audio_url} controls className="h-6 w-full max-w-[240px]" />
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-surface border border-gray-800/80 rounded-2xl shadow-xl text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-neon/10 border border-neon/30 flex items-center justify-center text-neon text-2xl font-bold animate-pulse">
                🥋
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-primary uppercase tracking-widest">
                  Start Training Intentionally
                </h3>
                <p className="text-xs text-secondary leading-relaxed max-w-sm mx-auto">
                  You haven't logged any training sessions yet. Track your positions, partner profiles, and technique success rates to start analyzing your game.
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard?log=true')}
                className="bg-neon hover:bg-neon/90 text-main font-extrabold text-xs px-6 py-3 rounded-xl shadow-md shadow-neon/5 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                LOG A SESSION
              </button>
            </div>
          ) : visibleLogs.length === 0 ? (
            <div className="text-center py-12 bg-surface border border-gray-800/80 rounded-2xl">
              <p className="text-sm text-secondary">No sessions match your filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logsGroupedByDate.map((group) => {
                const isExpanded = !!expandedLogs[group.dateKey];
                const totalRounds = group.logsList.reduce((sum, l) => sum + l.rounds.length, 0);

                return (
                  <div key={group.dateKey} className="bg-surface border border-gray-800/80 rounded-xl overflow-hidden shadow-md">
                    <button onClick={() => toggleDateExpand(group.dateKey)} className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/20 transition-colors">
                      <div className="space-y-1">
                        <span className="text-[10px] text-neon font-bold uppercase tracking-wider block">Training Date</span>
                        <span className="text-sm font-bold text-primary">{group.dateString}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-secondary bg-gray-800/40 border border-gray-800/80 px-2.5 py-1 rounded-full font-semibold">
                          {group.logsList.length} {group.logsList.length === 1 ? 'Session' : 'Sessions'} • {totalRounds} {totalRounds === 1 ? 'Round' : 'Rounds'}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={`w-4 h-4 text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-6 border-t border-gray-800 bg-main/5 space-y-6 pt-5">
                        {group.logsList.map((log, idx) => (
                          <div key={log.id} className={`space-y-6 ${idx > 0 ? 'pt-6 border-t border-gray-800/60' : ''}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-main/20 p-3 rounded-lg border border-gray-800/50">
                              <div className="flex items-center gap-3">
                                {group.logsList.length > 1 && (
                                  <span className="text-xs font-bold text-neon uppercase tracking-widest">Session #{idx + 1}</span>
                                )}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${log.attire_type === 'Gi' ? 'bg-blue-950/30 text-blue-400 border border-blue-900/40' : 'bg-orange-950/30 text-orange-400 border border-orange-900/40'}`}>{log.attire_type}</span>
                                <span className="text-xs font-semibold text-primary">{log.notes || 'Independent training session'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleRemoveLog(log.id)} className="text-[10px] font-bold text-red-400 hover:bg-red-950/20 px-2.5 py-1.5 rounded border border-red-900/40 transition-colors">Remove Log</button>
                              </div>
                            </div>

                            <div className="space-y-4 pl-0 sm:pl-3">
                              {log.rounds.map((round) => (
                                <div key={round.id} className="bg-surface border border-gray-800 p-4 rounded-xl space-y-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-2.5 gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs font-bold text-primary">Round #{round.round_index} ({round.modality}) — {round.duration_minutes} Mins</span>
                                      <span className="text-[10px] text-neon font-bold uppercase bg-neon/5 border border-neon/20 px-2 py-0.5 rounded">
                                        Partner: {round.partner_name} ({round.partner_belt} Belt • {round.partner_weight} Weight • {round.partner_height || 'Same'} Height{round.partner_gender && round.partner_gender !== 'N/A' && round.partner_gender !== 'Unknown' ? ` • ${round.partner_gender}` : ''})
                                      </span>
                                    </div>
                                    <div className="flex gap-2 self-end sm:self-auto">
                                      <button
                                        onClick={() => startEditRound(log, round)}
                                        className="text-[10px] font-bold text-neon hover:bg-neon/10 px-2.5 py-1.5 rounded border border-neon/30 transition-colors"
                                      >
                                        Edit Round
                                      </button>
                                      <button
                                        onClick={() => handleRemoveRound(log.id, round.id)}
                                        className="text-[10px] font-bold text-red-400 hover:bg-red-950/20 px-2.5 py-1.5 rounded border border-red-900/40 transition-colors"
                                      >
                                        Remove Round
                                      </button>
                                    </div>
                                  </div>

                                  {round.starting_position && (
                                    <div className="text-xs text-secondary"><span className="font-bold text-primary">Start: </span>{round.starting_position}</div>
                                  )}

                                  {round.notes && (
                                    <p className="text-xs text-secondary leading-relaxed italic bg-main/20 p-2.5 rounded border border-gray-800">"{round.notes}"</p>
                                  )}

                                  {round.executed_techniques.length > 0 ? (
                                    <div className="space-y-3 pt-2">
                                      <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">Executed Techniques Focus</span>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {round.executed_techniques.map((tech) => (
                                          <div key={tech.id} className="bg-main/30 border border-gray-800 p-3 rounded-lg space-y-3">
                                            <div className="flex items-center justify-between">
                                              <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-primary">
                                                  {tech.starting_position ? `[${tech.starting_position}] ${tech.technique_name}` : tech.technique_name}
                                                </span>
                                                {tech.technique_type && (
                                                  <span className="text-[9px] font-semibold text-neon uppercase tracking-wider mt-0.5">
                                                    {tech.technique_type}
                                                  </span>
                                                )}
                                              </div>
                                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tech.is_successful ? 'bg-emerald-950/40 text-neon border border-emerald-900/30' : 'bg-red-950/40 text-red-400 border border-red-900/30'}`}>{tech.is_successful ? 'SUCCESS: YES' : 'SUCCESS: NO'}</span>
                                            </div>
                                            {tech.is_successful && tech.resistance_level && (
                                              <div className="text-[10px] text-secondary">Resistance: {tech.resistance_level}</div>
                                            )}

                                            <div className="pt-2 border-t border-gray-800">
                                              {getYouTubeEmbedUrl(tech.match_video_url) ? (
                                                <div className="space-y-2">
                                                  <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-gray-800">
                                                    <iframe src={getYouTubeEmbedUrl(tech.match_video_url)!} title={`Replay: ${tech.technique_name}`} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" className="absolute inset-0 w-full h-full" />
                                                  </div>
                                                  {isPremium && (
                                                    <button onClick={() => { setEditingTechId(tech.id); setVideoUrlInput(tech.match_video_url || ''); }} className="text-[10px] text-secondary hover:text-neon">Edit Video Link</button>
                                                  )}
                                                </div>
                                              ) : (
                                                <div>
                                                  {editingTechId === tech.id ? (
                                                    <div className="space-y-2">
                                                      <input type="text" value={videoUrlInput} onChange={(e) => setVideoUrlInput(e.target.value)} className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary placeholder-gray-650 focus:outline-none focus:border-neon/80" placeholder="YouTube Video URL..." />
                                                      {uploadError && <p className="text-[10px] text-red-400">{uploadError}</p>}
                                                      <div className="flex gap-2">
                                                        <button onClick={() => handleSaveVideoUrl(tech.id)} className="bg-neon text-main text-[10px] font-bold px-3 py-1 rounded">Save</button>
                                                        <button onClick={() => { setEditingTechId(null); setVideoUrlInput(''); }} className="text-secondary text-[10px] font-bold px-3 py-1 rounded hover:text-primary">Cancel</button>
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center justify-between">
                                                      {isPremium ? (
                                                        <button onClick={() => setEditingTechId(tech.id)} className="text-[10px] text-neon hover:underline">🔗 Attach Match Video Link</button>
                                                      ) : (
                                                        <span className="text-[9px] text-secondary bg-gray-800/40 px-2 py-0.5 rounded border border-gray-800 flex items-center gap-1">🔒 Attach Replay (Premium)</span>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-secondary italic">No focus techniques logged for this round.</div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Verified Critique Loop */}
                            {((profile?.access_role === 'User-Student') || (log.coach_critiques && log.coach_critiques.length > 0)) && (
                              <div className="pt-4 border-t border-gray-800 space-y-3 pl-0 sm:pl-3">
                                <span className="text-xs font-bold text-neon uppercase tracking-wider block">Coach/Teacher Feedback</span>
                                {!log.coach_critiques || log.coach_critiques.length === 0 ? (
                                  <p className="text-xs text-secondary italic">No feedback from your coaches yet.</p>
                                ) : (
                                  <div className="space-y-3">
                                    {log.coach_critiques.map((critique) => (
                                      <div key={critique.id} className="p-3 bg-neon/5 border border-neon/20 rounded-xl space-y-2">
                                        <div className="flex justify-between items-center text-[10px]">
                                          <span className="text-primary font-bold">{critique.profiles?.name || critique.profiles?.username || 'Coach'}</span>
                                          <span className="text-secondary">{new Date(critique.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-xs text-secondary leading-relaxed">"{critique.feedback}"</p>
                                        {critique.audio_url && (
                                          <div className="pt-1.5 flex items-center gap-2">
                                            <span className="text-[9px] text-neon uppercase font-semibold">Voice critique:</span>
                                            <audio src={critique.audio_url} controls className="h-6 w-full max-w-[240px]" />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Premium History Restriction Banner */}
          {hiddenLogsCount > 0 && (
            <div className="relative bg-surface/40 border border-gray-800/80 rounded-2xl p-8 text-center overflow-hidden shadow-xl">
              <div className="absolute inset-0 bg-surface/20 backdrop-blur-xs pointer-events-none" />
              <div className="relative z-10 space-y-4 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-neon/10 border border-neon/30 flex items-center justify-center mx-auto text-neon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <h3 className="text-md font-bold text-primary tracking-wider uppercase">TRAINING HISTORY LOCK</h3>
                <p className="text-xs text-secondary leading-relaxed">You have <span className="text-neon font-bold text-sm">{hiddenLogsCount}</span> older logs remaining on your timeline. Upgrade to Premium to unlock your full lifetime training log history.</p>
                {session ? (
                  <button onClick={handleSimulatedUpgrade} className="bg-neon text-main font-bold text-xs px-6 py-2.5 rounded-lg shadow-lg">Unlock History (Simulated)</button>
                ) : (
                  <p className="text-[10px] text-secondary italic">Log in under your Profile to access premium configuration settings.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Round Modal */}
      {editingRound && editingParentLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-surface border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => {
                setEditingRound(null);
                setEditingParentLog(null);
              }}
              className="absolute top-4 right-4 text-secondary hover:text-primary transition-colors text-lg"
            >
              &times;
            </button>

            <div>
              <h2 className="text-lg font-bold text-primary uppercase tracking-wider">Edit Training Round</h2>
              <p className="text-xs text-secondary mt-1">
                Logged on: {new Date(editingParentLog.created_at).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Session Header Fields */}
            <div className="space-y-4 border-b border-gray-800 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Attire Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-primary cursor-pointer">
                      <input
                        type="radio"
                        name="edit-attire"
                        checked={editingParentLog.attire_type === 'Gi'}
                        onChange={() => setEditingParentLog({ ...editingParentLog, attire_type: 'Gi' })}
                        className="accent-neon w-4 h-4 bg-main"
                      />
                      Gi
                    </label>
                    <label className="flex items-center gap-2 text-xs text-primary cursor-pointer">
                      <input
                        type="radio"
                        name="edit-attire"
                        checked={editingParentLog.attire_type === 'No-Gi'}
                        onChange={() => setEditingParentLog({ ...editingParentLog, attire_type: 'No-Gi' })}
                        className="accent-neon w-4 h-4 bg-main"
                      />
                      No-Gi
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Session Date</label>
                  <input
                    type="date"
                    value={getLocalDateKey(editingParentLog.created_at)}
                    onChange={(e) => {
                      if (e.target.value) {
                        const newDateStr = new Date(`${e.target.value}T12:00:00`).toISOString();
                        setEditingParentLog({ ...editingParentLog, created_at: newDateStr });
                      }
                    }}
                    className="w-full bg-main border border-gray-800 rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-neon"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Session Notes (Overall Summary)</label>
                <textarea
                  rows={2}
                  value={editingParentLog.notes || ''}
                  onChange={(e) => setEditingParentLog({ ...editingParentLog, notes: e.target.value })}
                  className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-xs text-primary placeholder-gray-650 focus:outline-none focus:border-neon/80"
                  placeholder="Enter overall mat notes..."
                />
              </div>
            </div>

            {/* Single Round Editor */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-neon uppercase tracking-widest">Round Details</h3>
              <div className="bg-main/30 border border-gray-800 p-4 rounded-xl space-y-4">
                <span className="text-xs font-bold text-primary">Round #{editingRound.round_index}</span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Round Modality</label>
                    <select
                      value={editingRound.modality}
                      onChange={(e) => {
                        setEditingRound({ ...editingRound, modality: e.target.value as 'Positional' | 'Full Roll' });
                      }}
                      className="w-full bg-main border border-gray-800 rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-neon"
                    >
                      <option value="Positional">Positional Roll</option>
                      <option value="Full Roll">Full Roll</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Duration (Mins)</label>
                    <input
                      type="number"
                      value={editingRound.duration_minutes}
                      onChange={(e) => {
                        setEditingRound({ ...editingRound, duration_minutes: Number(e.target.value) });
                      }}
                      className="w-full bg-main border border-gray-800 rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-neon"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Partner Name</label>
                  <input
                    type="text"
                    value={editingRound.partner_name}
                    onChange={(e) => {
                      setEditingRound({ ...editingRound, partner_name: e.target.value });
                    }}
                    placeholder="Partner name..."
                    className="w-full bg-main border border-gray-800 rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-neon"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Belt</label>
                    <select
                      value={editingRound.partner_belt}
                      onChange={(e) => {
                        setEditingRound({ ...editingRound, partner_belt: e.target.value });
                      }}
                      className="w-full bg-main border border-gray-800 rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-neon"
                    >
                      {['Unknown', 'White', 'Blue', 'Purple', 'Brown', 'Black'].map((belt) => (
                        <option key={belt} value={belt}>{belt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Weight Class</label>
                    <select
                      value={editingRound.partner_weight}
                      onChange={(e) => {
                        setEditingRound({ ...editingRound, partner_weight: e.target.value });
                      }}
                      className="w-full bg-main border border-gray-800 rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-neon"
                    >
                      {['Unknown', 'Lighter', 'Similar', 'Heavier'].map((weight) => (
                        <option key={weight} value={weight}>{weight}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Height Class</label>
                    <select
                      value={editingRound.partner_height || 'Unknown'}
                      onChange={(e) => {
                        setEditingRound({ ...editingRound, partner_height: e.target.value === 'Unknown' ? null : e.target.value });
                      }}
                      className="w-full bg-main border border-gray-800 rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-neon"
                    >
                      {['Unknown', 'Shorter', 'Same', 'Taller'].map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Round Notes</label>
                  <textarea
                    rows={2}
                    value={editingRound.notes || ''}
                    onChange={(e) => {
                      setEditingRound({ ...editingRound, notes: e.target.value || null });
                    }}
                    placeholder="Notes for this round..."
                    className="w-full bg-main border border-gray-800 rounded-lg px-3 py-2 text-xs text-primary placeholder-gray-650 focus:outline-none focus:border-neon"
                  />
                </div>

                {/* Executed Techniques Focus */}
                <div className="space-y-4 pt-2 border-t border-gray-800">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">
                      {getTechniqueLimit(profile?.current_rank) === Infinity
                        ? `Executed Techniques (${editingRound.executed_techniques.length} logged)`
                        : `Executed Techniques (${editingRound.executed_techniques.length} / ${getTechniqueLimit(profile?.current_rank)} max for ${profile?.current_rank || 'White'} belt)`}
                    </span>
                    {editingRound.executed_techniques.length < getTechniqueLimit(profile?.current_rank) && (
                      <button
                        type="button"
                        onClick={() => {
                          const newTech = {
                            id: `temp-${Date.now()}-${Math.random()}`,
                            technique_name: '',
                            is_successful: false,
                            resistance_level: null,
                            match_video_url: null,
                            starting_position: null,
                            technique_type: null,
                          };
                          setEditingRound({
                            ...editingRound,
                            executed_techniques: [...editingRound.executed_techniques, newTech as any],
                          });
                        }}
                        className="text-[10px] text-neon hover:underline font-bold"
                      >
                        + Add Technique
                      </button>
                    )}
                  </div>

                  {editingRound.executed_techniques.length === 0 ? (
                    <p className="text-xs text-secondary italic">No focus techniques logged for this round.</p>
                  ) : (
                    <div className="space-y-4">
                      {editingRound.executed_techniques.map((tech, tIdx) => (
                        <div key={tech.id} className="bg-surface/50 border border-gray-800 p-3 rounded-lg space-y-3 relative">
                          {/* Remove Technique Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const updatedTechs = editingRound.executed_techniques.filter((_, i) => i !== tIdx);
                              setEditingRound({ ...editingRound, executed_techniques: updatedTechs });
                            }}
                            className="absolute top-2.5 right-2.5 text-[10px] text-red-400 hover:text-red-300 font-bold hover:underline"
                          >
                            Remove
                          </button>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-secondary uppercase tracking-wider mb-1">Technique Name</label>
                              <SearchableDropdown
                                compact
                                value={tech.technique_name}
                                onChange={(val) => {
                                  const key = tech.id;
                                  if (val === 'Other') {
                                    const updatedTechs = [...editingRound.executed_techniques];
                                    updatedTechs[tIdx] = { ...tech, technique_name: 'Other' };
                                    setEditingRound({ ...editingRound, executed_techniques: updatedTechs });
                                  } else {
                                    const updatedTechs = [...editingRound.executed_techniques];
                                    updatedTechs[tIdx] = { ...tech, technique_name: val };
                                    setEditingRound({ ...editingRound, executed_techniques: updatedTechs });
                                    setCustomTechNames(prev => { const n = { ...prev }; delete n[key]; return n; });
                                  }
                                }}
                                options={dbTechniques}
                                personalOptions={personalTechniques}
                                placeholder="-- Select Technique --"
                                otherLabel="Other (Custom Technique)"
                              />
                              {tech.technique_name === 'Other' && (
                                <input
                                  type="text"
                                  value={customTechNames[tech.id] || ''}
                                  onChange={(e) => {
                                    const key = tech.id;
                                    setCustomTechNames(prev => ({ ...prev, [key]: e.target.value }));
                                    const trimmed = e.target.value.trim();
                                    if (trimmed) {
                                      setPendingCustomTerms(prev => {
                                        const filtered = prev.filter(t => !(t.term_name === trimmed && t.term_type === 'Technique'));
                                        return [...filtered, { term_name: trimmed, term_type: 'Technique' }];
                                      });
                                    }
                                  }}
                                  className="w-full mt-1.5 bg-main border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-primary placeholder-gray-650 focus:outline-none focus:border-neon"
                                  placeholder="Type custom technique name..."
                                />
                              )}
                            </div>

                            <div>
                              <label className="block text-[9px] font-bold text-secondary uppercase tracking-wider mb-1">Technique Type</label>
                              <select
                                value={tech.technique_type || ''}
                                onChange={(e) => {
                                  const updatedTechs = [...editingRound.executed_techniques];
                                  updatedTechs[tIdx] = { ...tech, technique_type: (e.target.value || null) as any };
                                  setEditingRound({ ...editingRound, executed_techniques: updatedTechs });
                                }}
                                className="w-full bg-main border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-primary focus:outline-none"
                              >
                                <option value="">-- None --</option>
                                <option value="Takedown">Takedown</option>
                                <option value="Sweep">Sweep</option>
                                <option value="Submission">Submission</option>
                                <option value="Escape">Escape</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-secondary uppercase tracking-wider mb-1">Starting Position (Optional)</label>
                              <SearchableDropdown
                                compact
                                value={tech.starting_position || ''}
                                onChange={(val) => {
                                  const key = tech.id;
                                  if (val === 'Other') {
                                    const updatedTechs = [...editingRound.executed_techniques];
                                    updatedTechs[tIdx] = { ...tech, starting_position: 'Other' };
                                    setEditingRound({ ...editingRound, executed_techniques: updatedTechs });
                                  } else {
                                    const updatedTechs = [...editingRound.executed_techniques];
                                    updatedTechs[tIdx] = { ...tech, starting_position: val || null };
                                    setEditingRound({ ...editingRound, executed_techniques: updatedTechs });
                                    setCustomTechPositions(prev => { const n = { ...prev }; delete n[key]; return n; });
                                  }
                                }}
                                options={dbPositions}
                                personalOptions={personalPositions}
                                placeholder="-- No Position --"
                                allowEmpty={true}
                                emptyLabel="-- No Position --"
                                otherLabel="Other (Custom Position)"
                              />
                              {tech.starting_position === 'Other' && (
                                <input
                                  type="text"
                                  value={customTechPositions[tech.id] || ''}
                                  onChange={(e) => {
                                    const key = tech.id;
                                    setCustomTechPositions(prev => ({ ...prev, [key]: e.target.value }));
                                    const trimmed = e.target.value.trim();
                                    if (trimmed) {
                                      setPendingCustomTerms(prev => {
                                        const filtered = prev.filter(t => !(t.term_name === trimmed && t.term_type === 'Position'));
                                        return [...filtered, { term_name: trimmed, term_type: 'Position' }];
                                      });
                                    }
                                  }}
                                  className="w-full mt-1.5 bg-main border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-primary placeholder-gray-650 focus:outline-none focus:border-neon"
                                  placeholder="Type custom position..."
                                />
                              )}
                            </div>

                            <div>
                              <label className="block text-[9px] font-bold text-secondary uppercase tracking-wider mb-1">Resistance Level</label>
                              <select
                                value={tech.resistance_level || ''}
                                onChange={(e) => {
                                  const updatedTechs = [...editingRound.executed_techniques];
                                  updatedTechs[tIdx] = { ...tech, resistance_level: (e.target.value || null) as any };
                                  setEditingRound({ ...editingRound, executed_techniques: updatedTechs });
                                }}
                                className="w-full bg-main border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-primary focus:outline-none"
                              >
                                <option value="">-- None --</option>
                                <option value="Easy">Easy</option>
                                <option value="Moderate">Moderate</option>
                                <option value="Difficult">Difficult</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                            <div>
                              <label className="block text-[9px] font-bold text-secondary uppercase tracking-wider mb-1">Success Status</label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`success-${tech.id}`}
                                    checked={tech.is_successful === true}
                                    onChange={() => {
                                      const updatedTechs = [...editingRound.executed_techniques];
                                      updatedTechs[tIdx] = { ...tech, is_successful: true };
                                      setEditingRound({ ...editingRound, executed_techniques: updatedTechs });
                                    }}
                                    className="accent-neon w-3.5 h-3.5"
                                  />
                                  Yes
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`success-${tech.id}`}
                                    checked={tech.is_successful === false}
                                    onChange={() => {
                                      const updatedTechs = [...editingRound.executed_techniques];
                                      updatedTechs[tIdx] = { ...tech, is_successful: false };
                                      setEditingRound({ ...editingRound, executed_techniques: updatedTechs });
                                    }}
                                    className="accent-neon w-3.5 h-3.5"
                                  />
                                  No
                                </label>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[9px] font-bold text-secondary uppercase tracking-wider mb-1">Replay Video URL</label>
                              <input
                                type="text"
                                value={tech.match_video_url || ''}
                                onChange={(e) => {
                                  const updatedTechs = [...editingRound.executed_techniques];
                                  updatedTechs[tIdx] = { ...tech, match_video_url: e.target.value || null };
                                  setEditingRound({ ...editingRound, executed_techniques: updatedTechs });
                                }}
                                placeholder="YouTube Video URL..."
                                className="w-full bg-main border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-primary focus:outline-none focus:border-neon"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex gap-3 pt-4 border-t border-gray-800 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditingRound(null);
                  setEditingParentLog(null);
                }}
                className="bg-main hover:bg-zinc-800 text-secondary border border-gray-800 text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateLog}
                className="bg-neon hover:bg-neon/90 text-main font-bold text-xs px-6 py-2.5 rounded-lg shadow-md transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}