'use client';

import { useState } from 'react';

interface Technique {
  id: string;
  name: string;
  position: string;
  tier: 1 | 2 | 3; // Tier 1: Private Pending, Tier 2: Gym Local Vetted, Tier 3: Global Official Master
  description: string;
  video_url: string;
}

export default function DictionaryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Technique suggestion modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [newTechPosition, setNewTechPosition] = useState('Guard');
  const [newTechDescription, setNewTechDescription] = useState('');
  const [newTechVideo, setNewTechVideo] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  // Hardcoded master lists of initial techniques with the three tiers
  const [techniques, setTechniques] = useState<Technique[]>([
    {
      id: 'tech-1',
      name: 'Omoplata',
      position: 'Guard',
      tier: 3,
      description: 'A highly effective shoulder lock utilizing the legs to trap and leverage the opponent\'s arm.',
      video_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    },
    {
      id: 'tech-2',
      name: 'Kimura',
      position: 'Side Control',
      tier: 3,
      description: 'A classic double wrist lock submission targeting the shoulder rotation joint.',
      video_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    },
    {
      id: 'tech-3',
      name: 'Knee Slide Pass',
      position: 'Half Guard',
      tier: 3,
      description: 'A fundamental pass slicing the knee across the opponent\'s thigh to clear their guard structure.',
      video_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    },
    {
      id: 'tech-4',
      name: 'Bow and Arrow Choke',
      position: 'Back',
      tier: 2,
      description: 'A high-percentage collar choke from back control gripping the collar and leg to pivot.',
      video_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    },
    {
      id: 'tech-5',
      name: 'Ezekiel Choke',
      position: 'Mount',
      tier: 3,
      description: 'A quick choke executed by wrapping one arm behind the neck and choking with the opposite sleeve hand.',
      video_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    },
    {
      id: 'tech-6',
      name: 'Berimbolo',
      position: 'Guard',
      tier: 2,
      description: 'A modern, rolling sweep to transition directly from De La Riva Guard to the opponent\'s back.',
      video_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    },
    {
      id: 'tech-7',
      name: 'Baratoplata',
      position: 'Guard',
      tier: 1,
      description: 'A deceptive armlock setup trapping the opponent\'s wrist under the armpit, rolling to isolate the shoulder.',
      video_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    },
  ]);

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
  const getSearchScore = (query: string, item: Technique): number => {
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

  // Filter and sort techniques based on fuzzy matching score
  const scoredTechniques = techniques
    .map((tech) => ({
      tech,
      score: getSearchScore(searchQuery, tech),
    }))
    .filter((entry) => entry.score > 40) // Threshold filter for fuzzy matching
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.tech);

  // Handle New Submission suggest modal
  const handleSuggestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTechName || !newTechDescription) return;

    const newTechnique: Technique = {
      id: `tech-${Date.now()}`,
      name: newTechName,
      position: newTechPosition,
      tier: 1, // All community submissions go to Tier 1: Private Pending
      description: newTechDescription,
      video_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', // default placeholder
    };

    setTechniques([newTechnique, ...techniques]);
    setIsModalOpen(false);

    // Reset fields
    setNewTechName('');
    setNewTechDescription('');
  };

  // Format Helper for Tier Badge
  const getTierDetails = (tier: number) => {
    switch (tier) {
      case 3:
        return {
          label: 'Tier 3: Official Master',
          color: 'bg-emerald-950/40 text-brand-neon border-emerald-900/30',
        };
      case 2:
        return {
          label: 'Tier 2: Gym Local Vetted',
          color: 'bg-blue-950/40 text-blue-400 border-blue-900/30',
        };
      case 1:
      default:
        return {
          label: 'Tier 1: Private Pending',
          color: 'bg-amber-950/40 text-amber-400 border-amber-900/30',
        };
    }
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
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-neon hover:bg-brand-neon/90 text-bg-main font-bold text-xs px-5 py-3 rounded-lg shadow-lg shadow-brand-neon/5 transition-all duration-200 self-start md:self-auto"
        >
          + Suggest New Technique
        </button>
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

        {/* Touch-Grid Macro Positions */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
            Filter Positions:
          </span>
          <div className="flex flex-wrap gap-2">
            {positionMacros.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setSearchQuery(pos)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  searchQuery.toLowerCase() === pos.toLowerCase()
                    ? 'bg-brand-neon/15 border-brand-neon text-brand-neon'
                    : 'bg-bg-main border-gray-800 text-text-secondary hover:text-text-primary hover:border-gray-700'
                }`}
              >
                {pos}
              </button>
            ))}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-950/20 bg-red-950/10 text-red-400 hover:bg-red-950/20 transition-all"
              >
                Clear [x]
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fuzzy Matches Results Cards Stack */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {scoredTechniques.length === 0 ? (
          <div className="md:col-span-2 text-center py-12 bg-bg-surface border border-gray-800/80 rounded-2xl">
            <p className="text-sm text-text-secondary">No techniques resolved via fuzzy match scores.</p>
          </div>
        ) : (
          scoredTechniques.map((tech) => {
            const tierDetails = getTierDetails(tech.tier);
            return (
              <div
                key={tech.id}
                className="bg-bg-surface border border-gray-800/80 rounded-xl p-5 md:p-6 shadow-md flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Title & Badge Row */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-md font-bold text-text-primary">{tech.name}</h2>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded border ${tierDetails.color}`}
                    >
                      {tierDetails.label}
                    </span>
                  </div>

                  {/* Position Tag */}
                  <span className="text-[10px] text-brand-neon font-semibold bg-brand-neon/5 border border-brand-neon/10 px-2 py-0.5 rounded-full inline-block">
                    Position: {tech.position}
                  </span>

                  {/* Description */}
                  <p className="text-xs text-text-secondary leading-relaxed">{tech.description}</p>
                </div>

                {/* Video Critique Box / Iframe Placeholder */}
                <div className="pt-3 border-t border-gray-850">
                  <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-gray-800 bg-bg-main flex items-center justify-center group">
                    {/* Visual accent */}
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand-neon/80" />
                    
                    {/* Mock Video Critique Frame with YouTube Placeholder embed */}
                    <iframe
                      src={tech.video_url}
                      title={`Critique video for ${tech.name}`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      className="absolute inset-0 w-full h-full opacity-60 group-hover:opacity-90 transition-opacity"
                    />
                    
                    <div className="relative z-10 pointer-events-none text-center bg-bg-main/60 px-3 py-1.5 rounded-lg border border-gray-800">
                      <span className="text-[9px] font-bold text-brand-neon uppercase tracking-wider">
                        CRITIQUE REPLAY
                      </span>
                    </div>
                  </div>
                </div>
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
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-text-secondary text-xs font-semibold py-2.5 rounded-lg border border-gray-750"
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
    </div>
  );
}
