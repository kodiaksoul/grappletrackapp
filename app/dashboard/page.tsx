'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { saveTrainingSession } from '../actions/saveSession';

interface TechniqueEntry {
  name: string;
  isSuccessful: boolean;
  resistanceLevel: 'Easy' | 'Moderate' | 'Difficult' | null;
}

interface RoundEntry {
  roundIndex: number;
  modality: 'Positional' | 'Full Roll';
  startingPosition: string;
  durationMinutes: number;
  partnerName: string;
  partnerBelt: string;
  partnerWeight: string;
  techniques: TechniqueEntry[];
  notes: string;
}

export default function DashboardPage() {
  // Auth & Profile states
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');

  // Global Session Header Parameters
  const [attireType, setAttireType] = useState<'Gi' | 'No-Gi'>('Gi');
  const [sessionContext, setSessionContext] = useState<'Class Focus' | 'Independent'>('Class Focus');
  const [curriculumFocus, setCurriculumFocus] = useState('Closed Guard Kimura');

  // Progressive Wizard States
  const [roundCounter, setRoundCounter] = useState(1);
  const [roundsList, setRoundsList] = useState<RoundEntry[]>([]);

  // Current Card State
  const [currentModality, setCurrentModality] = useState<'Positional' | 'Full Roll'>('Positional');
  const [currentPosition, setCurrentPosition] = useState('Closed Guard');
  const [currentDuration, setCurrentDuration] = useState<number>(5);
  const [currentPartner, setCurrentPartner] = useState<string>('');
  const [currentPartnerBelt, setCurrentPartnerBelt] = useState<string>('White');
  const [currentPartnerWeight, setCurrentPartnerWeight] = useState<string>('Similar');
  const [currentTechniques, setCurrentTechniques] = useState<TechniqueEntry[]>([]);
  const [currentRoundNotes, setCurrentRoundNotes] = useState('');

  const availableTechniques = [
    'Kimura', 'Armbar', 'Triangle Choke', 'Guillotine',
    'Scissor Sweep', 'Hip Bump Sweep', 'Knee Slide Pass',
    'Rear Naked Choke', 'Ankle Lock', 'De La Riva Sweep'
  ];

  const [techInput, setTechInput] = useState('');
  const [isAdTimerActive, setIsAdTimerActive] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [saveProgressMessage, setSaveProgressMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      const { data, error = null } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error) setProfile(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatedUpgrade = async () => {
    if (!session) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_premium_tier: true })
        .eq('id', session.user.id);
      if (!error) {
        setProfile({ ...profile, is_premium_tier: true });
        setShowUpgradeModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTechnique = (techName: string) => {
    if (!techName) return;
    if (currentTechniques.length >= 3) return;
    if (currentTechniques.some((t) => t.name === techName)) return;

    setCurrentTechniques([
      ...currentTechniques,
      { name: techName, isSuccessful: false, resistanceLevel: null },
    ]);
    setTechInput('');
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

  const commitCurrentCard = (): RoundEntry => {
    return {
      roundIndex: roundCounter,
      modality: currentModality,
      startingPosition: currentModality === 'Positional' ? currentPosition : 'Neutral Start',
      durationMinutes: currentDuration,
      partnerName: currentPartner.trim() || 'Anonymous Partner',
      partnerBelt: currentPartnerBelt,
      partnerWeight: currentPartnerWeight,
      techniques: currentTechniques,
      notes: currentRoundNotes,
    };
  };

  const resetCardState = () => {
    setCurrentTechniques([]);
    setCurrentRoundNotes('');
    setCurrentDuration(5);
    setCurrentPartner('');
    setCurrentPartnerBelt('White');
    setCurrentPartnerWeight('Similar');
  };

  const handleSaveAndExit = async () => {
    const finalRound = commitCurrentCard();
    const allRounds = [...roundsList, finalRound];
    setSaveProgressMessage('Preparing database write...');

    if (session) await saveSessionToSupabase(allRounds);

    if (profile?.is_premium_tier) {
      resetSessionWizard();
    } else {
      setIsAdTimerActive(true);
      setAdCountdown(5);
    }
  };

  const handleSaveAndNewBlank = () => {
    const committed = commitCurrentCard();
    setRoundsList([...roundsList, committed]);
    setRoundCounter((prev) => prev + 1);
    resetCardState();
  };

  const handleSaveAndDuplicateClone = () => {
    if (!profile?.is_premium_tier) {
      setShowUpgradeModal(true);
      return;
    }
    const committed = commitCurrentCard();
    setRoundsList([...roundsList, committed]);
    setRoundCounter((prev) => prev + 1);
  };

  const resetSessionWizard = () => {
    setIsModalOpen(false);
    setIsAdTimerActive(false);
    setRoundsList([]);
    setRoundCounter(1);
    resetCardState();
    setSessionNotes('');
  };

  // DIAGNOSTIC DATABASE SAVE PIPELINE
  const saveSessionToSupabase = async (allRounds: RoundEntry[]) => {
    try {
      const finalNotes = sessionNotes || (sessionContext === 'Class Focus' ? `Curriculum: ${curriculumFocus}` : 'Independent session');
      
      // CALL SERVER ACTION TO BYPASS RLS
      await saveTrainingSession(session.user.id, attireType, finalNotes, allRounds);
      
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
              <span className="text-xs text-secondary">Premium Tier:</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${profile?.is_premium_tier ? 'bg-neon/15 text-neon border border-neon/30' : 'bg-gray-800 text-secondary'}`}>
                {profile?.is_premium_tier ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
          ) : (
            <span className="text-xs text-secondary">Demo Mode (Log in under Profile to save logs)</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <p className="text-xs font-semibold text-secondary uppercase tracking-widest mb-1">Mat Time (Total)</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-4xl font-extrabold text-primary">24.5</span>
            <span className="text-sm font-semibold text-secondary">Hours</span>
          </div>
        </div>
        <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <p className="text-xs font-semibold text-secondary uppercase tracking-widest mb-1">Attendance Rate</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-4xl font-extrabold text-primary">85</span>
            <span className="text-sm font-semibold text-secondary">% (Last 30 Days)</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center py-12">
        <button onClick={() => setIsModalOpen(true)} className="bg-neon hover:bg-neon/90 text-main font-bold text-md px-10 py-5 rounded-2xl shadow-xl shadow-neon/10 transition-all duration-300 hover:scale-105 flex items-center gap-3">
          LOG SESSION
        </button>
      </div>

      {/* OVERLAY WIZARD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-main/95 z-50 flex items-center justify-center p-4 md:p-8 overflow-y-auto">
          <div className="w-full max-w-2xl bg-surface border border-gray-800/80 rounded-2xl flex flex-col max-h-[92vh] shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-gray-800/80 flex items-center justify-between bg-surface/50">
              <h2 className="font-bold text-primary text-sm tracking-widest uppercase">PROGRESSIVE BATCH LOG (Rounds: {roundCounter})</h2>
              <button onClick={resetSessionWizard} className="text-secondary hover:text-primary"><svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-800">
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
                    <button type="button" onClick={() => setSessionContext('Class Focus')} className={`py-2 text-xs font-semibold rounded-lg border ${sessionContext === 'Class Focus' ? 'bg-neon/10 border-neon text-neon' : 'bg-main border-gray-800 text-secondary'}`}>Class Focus</button>
                    <button type="button" onClick={() => setSessionContext('Independent')} className={`py-2 text-xs font-semibold rounded-lg border ${sessionContext === 'Independent' ? 'bg-neon/10 border-neon text-neon' : 'bg-main border-gray-800 text-secondary'}`}>Independent</button>
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
                    <div className="flex gap-4 py-2.5">
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

                {/* Partner Profile UI Blocks */}
                <div className="p-4 bg-main/40 border border-gray-800 rounded-xl space-y-4">
                  <span className="text-[10px] font-bold text-neon uppercase tracking-wider block border-b border-gray-800 pb-2">Opponent / Partner Profile</span>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Partner Identity</label>
                    <input type="text" value={currentPartner} onChange={(e) => setCurrentPartner(e.target.value)} className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary focus:outline-none" placeholder="Manual Name Input (Optional)" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Opponent Belt Rank</label>
                      <div className="flex flex-wrap gap-1">
                        {['White', 'Blue', 'Purple', 'Brown', 'Black'].map((belt) => (
                          <button key={belt} type="button" onClick={() => setCurrentPartnerBelt(belt)} className={`px-2.5 py-1 text-[10px] font-semibold rounded border transition-all ${currentPartnerBelt === belt ? 'bg-neon text-main border-neon' : 'bg-main border-gray-800 text-secondary'}`}>{belt}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Relative Weight Class</label>
                      <div className="flex gap-1">
                        {['Lighter', 'Similar', 'Heavier'].map((weight) => (
                          <button key={weight} type="button" onClick={() => setCurrentPartnerWeight(weight)} className={`flex-1 py-1 text-[10px] font-semibold rounded border transition-all ${currentPartnerWeight === weight ? 'bg-neon text-main border-neon' : 'bg-main border-gray-800 text-secondary'}`}>{weight}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {currentModality === 'Positional' && (
                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">Starting Position</label>
                    <select value={currentPosition} onChange={(e) => setCurrentPosition(e.target.value)} className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-xs text-primary focus:outline-none">
                      {['Closed Guard', 'Open Guard', 'Half Guard', 'Side Control', 'Mount', 'Back Control', 'Turtle'].map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider">Targeted Technique Focus</label>
                  <select value={techInput} onChange={(e) => handleAddTechnique(e.target.value)} className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2.5 text-xs text-primary focus:outline-none">
                    <option value="">-- Add Technique Focus --</option>
                    {availableTechniques.map((tech) => <option key={tech} value={tech}>{tech}</option>)}
                  </select>
                </div>

                {currentTechniques.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-gray-800">
                    {currentTechniques.map((tech, idx) => (
                      <div key={idx} className="bg-surface/50 border border-gray-800 p-4 rounded-lg space-y-4 relative">
                        <button type="button" onClick={() => handleRemoveTechnique(idx)} className="absolute top-3 right-3 text-secondary hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        <span className="text-xs font-bold text-primary block">{tech.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-secondary">Did you hit the move?</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleTechniqueSuccessToggle(idx, true)} className={`px-4 py-1.5 text-[10px] font-bold rounded border ${tech.isSuccessful ? 'bg-neon text-main border-neon' : 'bg-main border-gray-800 text-secondary'}`}>YES</button>
                            <button type="button" onClick={() => handleTechniqueSuccessToggle(idx, false)} className={`px-4 py-1.5 text-[10px] font-bold rounded border ${!tech.isSuccessful ? 'bg-red-500/10 border-red-500/40 text-red-400' : 'bg-main border-gray-800 text-secondary'}`}>NO</button>
                          </div>
                        </div>
                        {tech.isSuccessful && (
                          <div className="pt-3 border-t border-gray-800">
                            <span className="text-[10px] text-secondary uppercase tracking-wider block mb-2">Resistance Level</span>
                            <div className="flex gap-4">
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
            <div className="p-4 bg-surface border-t border-gray-800/80 flex items-center justify-between gap-3">
              <button type="button" onClick={handleSaveAndExit} className="flex-1 bg-gray-800 hover:bg-neon active:bg-neon text-primary hover:text-main active:text-main font-bold text-xs py-3 rounded-lg border border-gray-750 transition-all duration-200 text-center">Save & Exit</button>
              <button type="button" onClick={handleSaveAndNewBlank} className="flex-1 bg-gray-800 hover:bg-neon active:bg-neon text-primary hover:text-main active:text-main font-bold text-xs py-3 rounded-lg border border-gray-750 transition-all duration-200 text-center">Save & New</button>
              <button type="button" onClick={handleSaveAndDuplicateClone} className="flex-1 bg-gray-800 hover:bg-neon active:bg-neon text-primary hover:text-main active:text-main font-bold text-xs py-3 rounded-lg border border-gray-750 transition-all duration-200 text-center">Clone Card</button>
            </div>

            {/* Simulated Ads */}
            {isAdTimerActive && (
              <div className="absolute inset-0 bg-main/95 z-50 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-full border-4 border-neon/20 border-t-neon animate-spin mb-6" />
                <h3 className="text-lg font-bold text-primary tracking-widest">SIMULATED REWARDED AD TIMER</h3>
                <p className="text-xs text-secondary mt-2">Ad loading verification check... Skipping and wrapping logs in <span className="text-neon font-bold text-sm">{adCountdown}s</span>.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}