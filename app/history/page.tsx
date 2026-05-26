'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { fetchUserHistory } from '../actions/fetchHistory';

interface ExecutedTechnique {
  id: string;
  technique_name: string;
  is_successful: boolean;
  resistance_level: 'Easy' | 'Moderate' | 'Difficult' | null;
  match_video_url: string | null;
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

export default function HistoryPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        loadMockData();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        loadMockData();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error) {
        setProfile(data);
        fetchLogs(userId);
      } else {
        loadMockData();
      }
    } catch (err) {
      console.error(err);
      loadMockData();
    }
  };

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
        loadMockData();
      }
    } catch (err: any) {
      // Re-throw the explicit text error straight into the Next.js Red Screen Overlay
      throw new Error(err?.message || 'Unknown processing error inside history ledger loop.');
    } finally {
      setLoading(false);
    }
  };

  const loadMockData = () => {
    setLoading(true);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const mockLogs: TrainingLog[] = [
      {
        id: 'mock-log-1',
        created_at: yesterday.toISOString(),
        attire_type: 'Gi',
        notes: 'Great focus on guard sweeps today. Felt fast.',
        rounds: [
          {
            id: 'mock-round-1',
            round_index: 1,
            modality: 'Positional',
            starting_position: 'Closed Guard',
            duration_minutes: 5,
            partner_name: 'John Doe',
            partner_belt: 'Blue',
            partner_weight: 'Similar',
            partner_gender: 'Male',
            partner_height: 'Same',
            notes: 'Managed to sweep with scissor sweep. Resistance was light.',
            executed_techniques: [
              {
                id: 'mock-tech-1',
                technique_name: 'Scissor Sweep',
                is_successful: true,
                resistance_level: 'Moderate',
                match_video_url: null,
              },
            ],
          },
        ],
      },
    ];

    setLogs(mockLogs);
    setLoading(false);
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

  const isPremium = profile?.access_role && profile.access_role !== 'User-Free';

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));

  const filteredLogs = logs.filter((log) => {
    if (filterAttire !== 'All' && log.attire_type !== filterAttire) return false;
    return true;
  });

  const visibleLogs = filteredLogs;

  return (
    <div className="space-y-8">
      {/* Sticky Header Filters */}
      <div className="sticky top-0 bg-main/80 backdrop-blur-md pt-2 pb-4 z-40 space-y-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">HISTORY LEDGER</h1>
          <p className="text-sm text-secondary mt-1">Browse and review your historical training cards and video replays.</p>
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
                  const dateStr = new Date(Date.UTC(calendarDate.getFullYear(), calendarDate.getMonth(), dateNum)).toISOString().split('T')[0];
                  
                  // Find logs for this specific date
                  const dayLogs = visibleLogs.filter(log => new Date(log.created_at).toISOString().split('T')[0] === dateStr);
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
                  {visibleLogs.filter(log => new Date(log.created_at).toISOString().split('T')[0] === selectedCalendarDate).length === 0 ? (
                    <p className="text-xs text-secondary italic">No sessions logged on this date.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* We duplicate the log card renderer logic here for the selected day */}
                      {visibleLogs.filter(log => new Date(log.created_at).toISOString().split('T')[0] === selectedCalendarDate).map((log) => {
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
                                <div className="flex justify-between items-center bg-red-950/10 border border-red-900/25 p-2 rounded-lg mb-2">
                                  <span className="text-[9px] text-secondary">Delete this session:</span>
                                  <button onClick={() => handleRemoveLog(log.id)} className="text-[9px] font-bold text-red-400 hover:bg-red-950/20 px-2.5 py-1 rounded border border-red-900/40 transition-colors">Remove Log</button>
                                </div>
                                {log.rounds.map((round) => (
                                  <div key={round.id} className="bg-surface border border-gray-800 p-3 rounded-xl space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-2 gap-1">
                                      <span className="text-xs font-bold text-primary">Round #{round.round_index} ({round.modality}) — {round.duration_minutes} Mins</span>
                                      <span className="text-[10px] text-neon font-bold uppercase">Partner: {round.partner_name}</span>
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
          ) : visibleLogs.length === 0 ? (
            <div className="text-center py-12 bg-surface border border-gray-800/80 rounded-2xl">
              <p className="text-sm text-secondary">No sessions match your filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleLogs.map((log) => {
                const isExpanded = !!expandedLogs[log.id];
                const dateString = new Date(log.created_at).toLocaleDateString(undefined, {
                  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                });

                return (
                  <div key={log.id} className="bg-surface border border-gray-800/80 rounded-xl overflow-hidden shadow-md">
                    <button onClick={() => toggleLogExpand(log.id)} className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/20 transition-colors">
                      <div className="space-y-1">
                        <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">{dateString}</span>
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
                      <div className="px-5 pb-6 border-t border-gray-800 bg-main/10 space-y-6 pt-5">
                        <div className="flex justify-between items-center bg-red-950/10 border border-red-900/25 p-3 rounded-lg mb-2">
                          <span className="text-[10px] text-secondary">Made a mistake? You can delete this log session.</span>
                          <button onClick={() => handleRemoveLog(log.id)} className="text-[10px] font-bold text-red-400 hover:bg-red-950/20 px-3 py-1.5 rounded border border-red-900/40 transition-colors">Remove Log</button>
                        </div>
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Round Ledger Details:</h3>
                          {log.rounds.map((round) => (
                            <div key={round.id} className="bg-surface border border-gray-800 p-4 rounded-xl space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-2.5 gap-1">
                                <span className="text-xs font-bold text-primary">Round #{round.round_index} ({round.modality}) — {round.duration_minutes} Mins</span>
                                <span className="text-[10px] text-neon font-bold uppercase bg-neon/5 border border-neon/20 px-2 py-0.5 rounded">
                                  Partner: {round.partner_name} ({round.partner_belt} Belt • {round.partner_weight} Weight • {round.partner_height || 'Same'} Height{round.partner_gender && round.partner_gender !== 'N/A' ? ` • ${round.partner_gender}` : ''})
                                </span>
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
                                          <span className="text-xs font-semibold text-primary">{tech.technique_name}</span>
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
                                                  <input type="text" value={videoUrlInput} onChange={(e) => setVideoUrlInput(e.target.value)} className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary placeholder-gray-600 focus:outline-none focus:border-neon/80" placeholder="YouTube Video URL..." />
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
    </div>
  );
}