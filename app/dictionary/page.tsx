'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchPersonalDictionary, savePersonalTerm, deletePersonalTerm } from '../actions/personalDictionary';

interface Technique {
  id: string;
  name: string;
  position: string;
  tier: 1 | 2 | 3; // Tier 1: Private Pending, Tier 2: Gym Local Vetted, Tier 3: Global Official Master
  description: string;
  video_url: string;
  term_type: 'Position' | 'Technique';
}

export default function DictionaryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string>('');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Personal Dictionary state
  const [officialTerms, setOfficialTerms] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [personalTerms, setPersonalTerms] = useState<any[]>([]);
  const [isPersonalDictOpen, setIsPersonalDictOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Personal Dictionary Form state
  const [termName, setTermName] = useState('');
  const [termType, setTermType] = useState<'Position' | 'Technique'>('Technique');
  const [termDescription, setTermDescription] = useState('');
  const [editingTermId, setEditingTermId] = useState<string | null>(null);

  // New Technique suggestion modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [newTechPosition, setNewTechPosition] = useState('Guard');
  const [newTechDescription, setNewTechDescription] = useState('');
  const [newTechVideo, setNewTechVideo] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  useEffect(() => {
    loadOfficialTerms();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
        loadPersonalTerms(session.user.id);
      }
    });
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  const loadOfficialTerms = async () => {
    try {
      console.log('[GrappleTracker] Fetching official terms...');
      const { data, error } = await supabase.from('official_dictionary').select('*');
      if (error) {
        console.error('[GrappleTracker] Error fetching official terms:', error);
      } else {
        console.log('[GrappleTracker] Fetched official terms successfully. Count:', data?.length);
        setOfficialTerms(data || []);
      }
    } catch (err) {
      console.error('[GrappleTracker] Catch error fetching official terms:', err);
    }
  };

  const loadPersonalTerms = async (userId: string) => {
    const res = await fetchPersonalDictionary(userId);
    if (res.success && res.terms) {
      setPersonalTerms(res.terms);
    }
  };

  const handleSaveTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termName.trim() || !session) return;
    
    const res = await savePersonalTerm(session.user.id, {
      id: editingTermId || undefined,
      term_name: termName.trim(),
      term_type: termType,
      description: termDescription.trim()
    });

    if (res.success) {
      loadPersonalTerms(session.user.id);
      setTermName('');
      setTermDescription('');
      setTermType('Technique');
      setEditingTermId(null);
    } else {
      alert(`Error saving term: ${res.error}`);
    }
  };

  const startEditTerm = (term: any) => {
    setEditingTermId(term.id);
    setTermName(term.term_name);
    setTermType(term.term_type);
    setTermDescription(term.description || '');
  };

  const cancelEditTerm = () => {
    setEditingTermId(null);
    setTermName('');
    setTermDescription('');
    setTermType('Technique');
  };

  const handleDeleteTerm = async (termId: string) => {
    if (!session) return;
    const res = await deletePersonalTerm(session.user.id, termId);
    if (res.success) {
      loadPersonalTerms(session.user.id);
      if (editingTermId === termId) {
        cancelEditTerm();
      }
    } else {
      alert(`Error deleting term: ${res.error}`);
    }
  };



  // Position Macro buttons list
  const positionMacros = ['Guard', 'Half Guard', 'Side Control', 'Mount', 'Back'];

  // Levenshtein Distance Algorithm for fuzzy matching
  const getLevenshteinDistance = (a: string, b: string): number => {
    const tmp: number[][] = [];
    const aLen = a.length;
    const bLen = b.length;

    if (aLen === 0) return bLen;
    if (bLen === 0) return aLen;

    for (let i = 0; i <= aLen; i++) tmp[i] = [i];
    for (let j = 0; j <= bLen; j++) tmp[0][j] = j;

    for (let i = 1; i <= aLen; i++) {
      for (let j = 1; j <= bLen; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1, // insertion
          tmp[i][j - 1] + 1, // deletion
          tmp[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1) // substitution
        );
      }
    }
    return tmp[aLen][bLen];
  };

  // Fuzzy search ranking function
  const getSearchScore = (query: string, item: any): number => {
    const q = query.toLowerCase().trim();
    if (!q) return 100; // Perfect match if empty

    const name = item.name.toLowerCase();
    const position = item.position.toLowerCase();
    const description = item.description.toLowerCase();

    // 1. Direct match boosts
    if (name.includes(q)) return 100;
    if (position.includes(q)) return 90;
    if (description.includes(q)) return 70;

    // 2. Word-level fuzzy matches
    const qWords = q.split(/\s+/);
    const nameWords = name.split(/\s+/);

    let totalScore = 0;
    for (const qw of qWords) {
      let minWordDist = 999;
      for (const nw of nameWords) {
        const dist = getLevenshteinDistance(qw, nw);
        if (dist < minWordDist) minWordDist = dist;
      }
      
      // Calculate word similarity percentage
      const maxLen = Math.max(qw.length, 3);
      const similarity = Math.max(0, 100 - (minWordDist / maxLen) * 100);
      totalScore += similarity;
    }

    return totalScore / qWords.length;
  };

  // Combine official techniques and personal terms
  const allDictTerms = useMemo(() => {
    const official = officialTerms.map(t => ({
      id: t.id,
      name: t.term_name || t.name || '',
      position: t.term_type === 'Position' ? 'Official Position' : 'Official Technique',
      tier: 3,
      description: t.description || '',
      video_url: t.video_url || '',
      isPersonal: false,
      term_type: t.term_type as 'Position' | 'Technique'
    }));

    const personal = personalTerms.map(pt => ({
      id: pt.id,
      name: pt.term_name,
      position: pt.term_type === 'Position' ? 'Personal Position' : 'Personal Technique',
      tier: 3,
      description: pt.description || 'Added to Personal Dictionary.',
      video_url: '',
      isPersonal: true,
      term_type: pt.term_type as 'Position' | 'Technique'
    }));

    return [...official, ...personal];
  }, [officialTerms, personalTerms]);

  // Position/Technique Filter options
  const filterOptions = [
    { label: 'Positions Only', value: 'Positions Only' },
    { label: 'Techniques Only', value: 'Techniques Only' }
  ];

  const filteredTerms = useMemo(() => {
    return allDictTerms.filter(item => {
      // Filter by selected start letter
      if (selectedLetter && !item.name.toLowerCase().startsWith(selectedLetter.toLowerCase())) {
        return false;
      }
      if (activeFilter === 'Positions Only') {
        return item.term_type === 'Position';
      }
      if (activeFilter === 'Techniques Only') {
        return item.term_type === 'Technique';
      }
      return true;
    });
  }, [allDictTerms, activeFilter, selectedLetter]);

  // Scored results matching search query
  const scoredTerms = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredTerms;
    }
    return filteredTerms
      .map((item) => ({
        item,
        score: getSearchScore(searchQuery, item),
      }))
      .filter((entry) => entry.score > 40)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
  }, [filteredTerms, searchQuery]);

  // Sort alphabetically A-Z
  const sortedTerms = useMemo(() => {
    return [...scoredTerms].sort((a, b) => a.name.localeCompare(b.name));
  }, [scoredTerms]);

  // Handle New Submission suggest modal
  const handleSuggestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTechName || !newTechDescription) return;

    const newTechnique = {
      id: `tech-${Date.now()}`,
      term_name: newTechName,
      term_type: 'Technique' as const,
      description: newTechDescription,
      video_url: '',
    };

    setOfficialTerms([newTechnique, ...officialTerms]);
    setIsModalOpen(false);

    // Reset fields
    setNewTechName('');
    setNewTechDescription('');
  };



  return (
    <div className="space-y-8">
      {/* Header & CTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">TERMINOLOGY DICTIONARY</h1>
          <p className="text-sm text-text-secondary mt-1">
            Search techniques fuzzy-matched system-wide, and suggest new moves.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              if (!profile?.is_premium_tier) {
                setShowUpgradeModal(true);
                return;
              }
              setIsPersonalDictOpen(true);
            }}
            className="bg-bg-surface hover:bg-bg-surface/80 border border-gray-800 text-text-primary font-bold text-xs px-5 py-3 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-1.5"
          >
            📚 My Personal Dictionary
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-neon hover:bg-brand-neon/90 text-bg-main font-bold text-xs px-5 py-3 rounded-lg shadow-lg shadow-brand-neon/5 transition-all duration-200"
          >
            + Suggest New Technique
          </button>
        </div>
      </div>

      {/* Search Input Bar (bg-surface & text-primary) */}
      <div className="bg-bg-surface border border-gray-800/80 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-main border border-gray-800/80 rounded-xl pl-11 pr-4 py-3.5 text-sm text-text-primary placeholder-gray-600 focus:outline-none focus:border-brand-neon/80 transition-colors"
            placeholder="Search techniques fuzzy-matched (e.g. 'omaplata', 'kimura', 'pass')..."
          />
          <div className="absolute left-4 top-4.5 text-text-secondary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.604 10.604z"
              />
            </svg>
          </div>
        </div>

        {/* Touch-Grid Macro Position/Technique Filter */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
            Filter: Position/Technique:
          </span>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (activeFilter === opt.value) {
                    setActiveFilter('');
                  } else {
                    setActiveFilter(opt.value);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  activeFilter === opt.value
                    ? 'bg-brand-neon/15 border-brand-neon text-brand-neon'
                    : 'bg-bg-main border-gray-800 text-text-secondary hover:text-text-primary hover:border-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {activeFilter && (
              <button
                type="button"
                onClick={() => setActiveFilter('')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-950/20 bg-red-950/10 text-red-400 hover:bg-red-950/20 transition-all"
              >
                Clear [x]
              </button>
            )}
          </div>
        </div>

        {/* Alphabet Navigation Bar */}
        <div className="space-y-2 pt-3 border-t border-gray-800/60">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
            Browse by Letter:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedLetter('')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                !selectedLetter
                  ? 'bg-brand-neon text-bg-main font-bold'
                  : 'bg-bg-main border border-gray-800 text-text-secondary hover:text-text-primary hover:border-gray-700'
              }`}
            >
              ALL
            </button>
            {alphabet.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => {
                  if (selectedLetter === letter) {
                    setSelectedLetter('');
                  } else {
                    setSelectedLetter(letter);
                  }
                }}
                className={`w-7 h-7 text-xs font-semibold rounded transition-all flex items-center justify-center ${
                  selectedLetter === letter
                    ? 'bg-brand-neon text-bg-main font-bold'
                    : 'bg-bg-main border border-gray-800 text-text-secondary hover:text-text-primary hover:border-gray-700'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fuzzy Matches Results Cards Stack */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedTerms.length === 0 ? (
          <div className="md:col-span-2 text-center py-12 bg-bg-surface border border-gray-800/80 rounded-2xl">
            <p className="text-sm text-text-secondary">No techniques resolved via fuzzy match scores.</p>
          </div>
        ) : (
          sortedTerms.map((tech) => {
            return (
              <div
                key={tech.id}
                className="bg-bg-surface border border-gray-800/80 rounded-xl p-5 md:p-6 shadow-md flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Title & Badge Row */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-md font-bold text-text-primary">{tech.name}</h2>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          tech.isPersonal
                            ? 'bg-brand-neon text-white border-brand-neon'
                            : 'bg-white text-brand-neon border-white'
                        }`}
                      >
                        {tech.isPersonal ? 'Personal' : 'Official'}
                      </span>
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded border bg-white text-black border-white"
                      >
                        {tech.term_type}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-secondary leading-relaxed">{tech.description}</p>
                </div>

                {/* Video Demonstration Link */}
                {tech.video_url && tech.video_url.trim() !== '' && (
                  <div className="pt-2 border-t border-gray-850">
                    <a
                      href={tech.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand-neon hover:underline flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
                      Watch Demonstration Video
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* =========================================================================
          SUGGEST NEW TECHNIQUE SUBMISSION MODAL
          ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-bg-main/90 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-850 pb-3">
              <h3 className="font-bold text-text-primary text-sm uppercase tracking-wider">
                SUGGEST NEW TECHNIQUE
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSuggestSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Technique Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Worm Guard Sweeper"
                  value={newTechName}
                  onChange={(e) => setNewTechName(e.target.value)}
                  className="w-full bg-bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-xs text-text-primary placeholder-gray-600 focus:outline-none focus:border-brand-neon/80 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Category / Position
                </label>
                <select
                  value={newTechPosition}
                  onChange={(e) => setNewTechPosition(e.target.value)}
                  className="w-full bg-bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-brand-neon/80 transition-colors appearance-none"
                >
                  {positionMacros.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Description / Mechanics
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Break down the mechanics of the sweep or lock here..."
                  value={newTechDescription}
                  onChange={(e) => setNewTechDescription(e.target.value)}
                  className="w-full bg-bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-xs text-text-primary placeholder-gray-600 focus:outline-none focus:border-brand-neon/80 transition-colors"
                />
              </div>

              <div className="bg-bg-main/50 border border-gray-850 p-3 rounded-lg text-[10px] text-text-secondary leading-relaxed">
                ℹ️ Suggested techniques will be created in <span className="text-amber-400 font-bold">Tier 1: Private Pending</span> mode. They are immediately visible to you.
              </div>

              <div className="pt-2 border-t border-gray-850 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-bg-main hover:bg-brand-neon/20 text-text-secondary hover:text-text-primary text-xs font-semibold py-2.5 rounded-lg border border-text-secondary/20 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand-neon hover:bg-brand-neon/90 text-bg-main text-xs font-bold py-2.5 rounded-lg shadow-lg shadow-brand-neon/5"
                >
                  Save Suggestion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPersonalDictOpen && (
        <div className="fixed inset-0 bg-bg-main/90 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 text-left animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-850 pb-3">
              <h3 className="font-bold text-text-primary text-sm uppercase tracking-wider">
                MY PERSONAL DICTIONARY
              </h3>
              <button
                onClick={() => {
                  setIsPersonalDictOpen(false);
                  cancelEditTerm();
                }}
                className="text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Term Creation / Editing Form */}
            <form onSubmit={handleSaveTerm} className="bg-bg-main/40 border border-gray-800 p-4 rounded-xl space-y-4">
              <span className="text-[10px] font-bold text-brand-neon uppercase tracking-wider block border-b border-gray-800 pb-2">
                {editingTermId ? 'Edit Dictionary Term' : 'Add Custom Term'}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Term Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rubber Guard"
                    value={termName}
                    onChange={(e) => setTermName(e.target.value)}
                    className="w-full bg-bg-main border border-gray-850 rounded-lg px-3 py-2 text-xs text-text-primary placeholder-gray-650 focus:outline-none focus:border-brand-neon/80"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Term Type</label>
                  <select
                    value={termType}
                    onChange={(e) => setTermType(e.target.value as 'Position' | 'Technique')}
                    className="w-full bg-bg-main border border-gray-850 rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-neon/80"
                  >
                    <option value="Technique">Technique</option>
                    <option value="Position">Position</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Description / Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Explain the position structure or technique mechanics..."
                  value={termDescription}
                  onChange={(e) => setTermDescription(e.target.value)}
                  className="w-full bg-bg-main border border-gray-850 rounded-lg px-3 py-2 text-xs text-text-primary placeholder-gray-650 focus:outline-none focus:border-brand-neon/80"
                />
              </div>

              <div className="flex gap-2 justify-end">
                {editingTermId && (
                  <button
                    type="button"
                    onClick={cancelEditTerm}
                    className="bg-bg-main hover:bg-zinc-800 border border-gray-800 text-text-secondary hover:text-text-primary text-xs font-semibold px-4 py-2 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-brand-neon hover:bg-brand-neon/90 text-bg-main text-xs font-bold px-5 py-2 rounded-lg shadow-md"
                >
                  {editingTermId ? 'Update Term' : 'Add Term'}
                </button>
              </div>
            </form>

            {/* List of Custom Terms */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
                Saved Personal Terms ({personalTerms.length})
              </span>
              
              {personalTerms.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-gray-800 rounded-xl">
                  <p className="text-xs text-text-secondary">No custom terms added to your Personal Dictionary yet.</p>
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-2.5 pr-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                  {personalTerms.map((term) => (
                    <div key={term.id} className="bg-bg-main/20 border border-gray-850 p-3 rounded-lg flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-primary">{term.term_name}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/30 uppercase">
                            {term.term_type}
                          </span>
                        </div>
                        {term.description && (
                          <p className="text-[11px] text-text-secondary leading-relaxed">{term.description}</p>
                        )}
                      </div>
                      
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditTerm(term)}
                          className="p-1.5 text-text-secondary hover:text-brand-neon bg-bg-main border border-gray-800 rounded hover:border-brand-neon/20 transition-all"
                          title="Edit term"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTerm(term.id)}
                          className="p-1.5 text-text-secondary hover:text-red-400 bg-bg-main border border-gray-800 rounded hover:border-red-950/20 transition-all"
                          title="Delete term"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-bg-main/90 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-bg-surface border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-brand-neon/10 text-brand-neon rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">👑</div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Upgrade to Premium</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Managing a Personal Dictionary of custom BJJ techniques and positions is exclusive to Premium members. Upgrade to unlock customizable tracking, advanced opponent analytics, and coach critiques.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  if (session) {
                    const { error } = await supabase
                      .from('profiles')
                      .update({ access_role: 'User-Premium', is_premium_tier: true })
                      .eq('id', session.user.id);
                    if (!error) {
                      setProfile((prev: any) => prev ? { ...prev, access_role: 'User-Premium', is_premium_tier: true } : null);
                      setShowUpgradeModal(false);
                      setIsPersonalDictOpen(true);
                      loadPersonalTerms(session.user.id);
                    }
                  }
                }}
                className="w-full bg-brand-neon hover:bg-brand-neon/90 text-bg-main font-bold text-xs py-3 rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Simulate Premium Upgrade
              </button>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="w-full bg-bg-main hover:bg-zinc-800 text-text-secondary hover:text-text-primary border border-gray-800 text-xs font-semibold py-3 rounded-lg transition-all duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
