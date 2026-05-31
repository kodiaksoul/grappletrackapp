'use client';

import { useState, useMemo } from 'react';

interface TechniqueMirrorProps {
  logs: any[];
  currentRank: string;
}

const BELT_COLORS = ['White', 'Blue', 'Purple', 'Brown', 'Black'] as const;
type BeltColor = typeof BELT_COLORS[number];

const BELT_EMOJIS: Record<BeltColor, string> = {
  White: '⚪',
  Blue: '🔵',
  Purple: '🟣',
  Brown: '🟤',
  Black: '⚫',
};

const RANK_ORDER: Record<string, number> = {
  White: 1,
  Blue: 2,
  Purple: 3,
  Brown: 4,
  Black: 5,
};

export default function TechniqueMirror({ logs, currentRank }: TechniqueMirrorProps) {
  // Normalize user's belt rank to Title Case
  const userRankNormalized = useMemo(() => {
    const formatted = currentRank?.trim();
    if (!formatted) return 'White';
    // Match against standard belt names
    const found = BELT_COLORS.find(b => b.toLowerCase() === formatted.toLowerCase());
    return found || 'White';
  }, [currentRank]);

  // Extract all distinct techniques from history
  const distinctTechniques = useMemo(() => {
    const names = new Set<string>();
    if (!logs) return [];

    logs.forEach(log => {
      if (log.rounds) {
        log.rounds.forEach((round: any) => {
          if (round.executed_techniques) {
            round.executed_techniques.forEach((tech: any) => {
              if (tech.technique_name) {
                // Normalize to Title Case
                const name = tech.technique_name.trim();
                const titleCased = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
                names.add(titleCased);
              }
            });
          }
        });
      }
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  // Active technique selection state
  const [selectedTechnique, setSelectedTechnique] = useState<string>('');

  // Auto-select first technique if available and none selected
  useMemo(() => {
    if (distinctTechniques.length > 0 && !selectedTechnique) {
      setSelectedTechnique(distinctTechniques[0]);
    }
  }, [distinctTechniques, selectedTechnique]);

  // Process data for the selected technique
  const analysisData = useMemo(() => {
    // Initialize results structure
    const results = BELT_COLORS.reduce((acc, belt) => {
      acc[belt] = {
        successCount: 0,
        failureCount: 0,
        difficultyScores: [] as number[],
      };
      return acc;
    }, {} as Record<BeltColor, { successCount: number; failureCount: number; difficultyScores: number[] }>);

    if (!selectedTechnique || !logs) {
      return { results, hasData: false };
    }

    let hasData = false;

    logs.forEach(log => {
      if (log.rounds) {
        log.rounds.forEach((round: any) => {
          // Normalize partner belt
          const partnerBeltRaw = round.partner_belt?.trim();
          if (!partnerBeltRaw) return;
          
          const opponentBelt = BELT_COLORS.find(
            b => b.toLowerCase() === partnerBeltRaw.toLowerCase()
          );
          
          if (!opponentBelt) return; // Skip "Unknown" or invalid belts

          if (round.executed_techniques) {
            round.executed_techniques.forEach((tech: any) => {
              if (!tech.technique_name) return;

              // Compare technique name case-insensitively
              const techName = tech.technique_name.trim();
              const formattedName = techName.charAt(0).toUpperCase() + techName.slice(1).toLowerCase();

              if (formattedName === selectedTechnique) {
                hasData = true;
                const isSuccessful = tech.is_successful === true;
                
                if (isSuccessful) {
                  results[opponentBelt].successCount += 1;
                } else {
                  results[opponentBelt].failureCount += 1;
                }

                // Collect difficulty numerical score for average
                if (tech.resistance_level) {
                  const level = tech.resistance_level.trim().toLowerCase();
                  if (level === 'easy') results[opponentBelt].difficultyScores.push(1);
                  else if (level === 'moderate') results[opponentBelt].difficultyScores.push(2);
                  else if (level === 'difficult') results[opponentBelt].difficultyScores.push(3);
                }
              }
            });
          }
        });
      }
    });

    return { results, hasData };
  }, [selectedTechnique, logs]);

  // Calculate difficulty badges and sums
  const processedRanks = useMemo(() => {
    const userRankValue = RANK_ORDER[userRankNormalized] || 1;
    let successesLower = 0;
    let failuresLower = 0;
    let successesSame = 0;
    let failuresSame = 0;
    let successesHigher = 0;
    let failuresHigher = 0;

    const rows = BELT_COLORS.map(belt => {
      const data = analysisData.results[belt];
      const rankVal = RANK_ORDER[belt];

      // Sum metrics based on rank relations
      if (rankVal < userRankValue) {
        successesLower += data.successCount;
        failuresLower += data.failureCount;
      } else if (rankVal === userRankValue) {
        successesSame += data.successCount;
        failuresSame += data.failureCount;
      } else {
        successesHigher += data.successCount;
        failuresHigher += data.failureCount;
      }

      // Calculate difficulty label using actual scores
      let diffLabel = 'Diff: —';
      if (data.difficultyScores.length > 0) {
        const sum = data.difficultyScores.reduce((a, b) => a + b, 0);
        const avg = sum / data.difficultyScores.length;
        if (avg <= 1.5) diffLabel = 'Diff: Low';
        else if (avg <= 2.2) diffLabel = 'Diff: Med';
        else if (avg <= 2.7) diffLabel = 'Diff: High';
        else diffLabel = 'Diff: Extreme';
      }

      return {
        belt,
        emoji: BELT_EMOJIS[belt],
        successes: data.successCount,
        failures: data.failureCount,
        diffLabel,
      };
    });

    return {
      rows,
      successesLower,
      failuresLower,
      successesSame,
      failuresSame,
      successesHigher,
      failuresHigher,
      userRankValue,
    };
  }, [analysisData, userRankNormalized]);

  // Determine Focus Card State using priority hierarchy
  const focusState = useMemo(() => {
    const {
      successesLower,
      failuresLower,
      successesSame,
      failuresSame,
      successesHigher,
      failuresHigher,
    } = processedRanks;

    const totalHigher = successesHigher + failuresHigher;
    const totalSame = successesSame + failuresSame;
    const totalLower = successesLower + failuresLower;

    // 1. HIGHER-BELT OVERRIDE
    if (totalHigher > 0) {
      if (successesHigher > failuresHigher) {
        return {
          type: 'GREEN',
          cardEmoji: '🟩',
          title: '🟩 GREEN CARD: NO IMMEDIATE FOCUS NEEDED',
          message: 'Your execution rates against higher-rank opponents are optimal. Keep maintaining your leverage!',
          borderColor: 'border-l-green-500 bg-green-950/15 border-green-900/30',
        };
      } else {
        return {
          type: 'RED',
          cardEmoji: '🟥',
          title: '🟥 RED CARD: FOCUS RECOMMENDED',
          message: 'You have ease against lower belts, but same or higher needs practice. Focus on this during live rolls.',
          borderColor: 'border-l-red-500 bg-red-950/15 border-red-900/30',
        };
      }
    }

    // 2. SAME-BELT BASELINE
    if (totalSame > 0) {
      if (successesSame > failuresSame) {
        return {
          type: 'GREEN',
          cardEmoji: '🟩',
          title: '🟩 GREEN CARD: NO IMMEDIATE FOCUS NEEDED',
          message: `Your execution rates against same-rank opponents (${userRankNormalized} belts) are optimal. Keep maintaining your leverage!`,
          borderColor: 'border-l-green-500 bg-green-950/15 border-green-900/30',
        };
      } else if (successesSame === failuresSame) {
        return {
          type: 'YELLOW',
          cardEmoji: '🟨',
          title: '🟨 YELLOW CARD: MODERATE FOCUS RECOMMENDED',
          message: `Your execution rates against same-rank opponents (${userRankNormalized} belts) are neutral. Standardize your setup to break the tie.`,
          borderColor: 'border-l-yellow-500 bg-yellow-950/15 border-yellow-900/30',
        };
      } else {
        return {
          type: 'RED',
          cardEmoji: '🟥',
          title: '🟥 RED CARD: FOCUS RECOMMENDED',
          message: 'You have ease against lower belts, but same or higher needs practice. Focus on this during live rolls.',
          borderColor: 'border-l-red-500 bg-red-950/15 border-red-900/30',
        };
      }
    }

    // 3. UNTESTED ILLUSION CHECK
    if (totalLower > 0) {
      return {
        type: 'YELLOW',
        cardEmoji: '🟨',
        title: '🟨 YELLOW CARD: MODERATE FOCUS RECOMMENDED',
        message: 'Untested at your current rank. Attempt this move against equal or higher belts to map your true performance.',
        borderColor: 'border-l-yellow-500 bg-yellow-950/15 border-yellow-900/30',
      };
    }

    // 4. ZERO STATE
    return {
      type: 'YELLOW',
      cardEmoji: '🟨',
      title: '🟨 YELLOW CARD: MODERATE FOCUS RECOMMENDED',
      message: 'No training data logged for this technique yet.',
      borderColor: 'border-l-yellow-500 bg-yellow-950/15 border-yellow-900/30',
    };
  }, [processedRanks, userRankNormalized]);

  return (
    <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4" />
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/60 pb-5 relative z-10">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Technique Performance Mirror</h3>
          <p className="text-[10px] text-secondary">
            User Belt Rank: <strong className="text-neon">{userRankNormalized} Belt</strong>
          </p>
        </div>

        <div className="w-full sm:w-64">
          <label className="block text-[9px] font-bold text-secondary uppercase tracking-widest mb-1.5">
            Select a move to analyze
          </label>
          {distinctTechniques.length > 0 ? (
            <select
              value={selectedTechnique}
              onChange={e => setSelectedTechnique(e.target.value)}
              className="w-full bg-main border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-primary focus:outline-none focus:border-neon transition-colors"
            >
              {distinctTechniques.map(tech => (
                <option key={tech} value={tech}>
                  {tech}
                </option>
              ))}
            </select>
          ) : (
            <select
              disabled
              className="w-full bg-main/50 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-secondary cursor-not-allowed"
            >
              <option>No techniques logged yet</option>
            </select>
          )}
        </div>
      </div>

      {/* Stacked Ranks List */}
      <div className="py-6 space-y-3 relative z-10">
        {processedRanks.rows.map(row => {
          const isUserRank = row.belt === userRankNormalized;
          return (
            <div
              key={row.belt}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                isUserRank
                  ? 'bg-neon/5 border-neon/30 shadow-md shadow-neon/5'
                  : 'bg-main/40 border-gray-800/50 hover:bg-main/60'
              }`}
            >
              {/* Opponent belt color indicator */}
              <div className="flex items-center gap-2.5">
                <span className="text-base leading-none select-none">{row.emoji}</span>
                <span className="text-xs font-semibold text-primary">
                  {row.belt} Opponents
                  {isUserRank && <span className="text-[9px] font-bold text-neon ml-2 bg-neon/15 px-1.5 py-0.5 rounded uppercase tracking-wider">Same</span>}
                </span>
              </div>

              {/* Outcomes Status Counts & Subjective Difficulty Badge */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="flex items-center gap-1">
                    <span className="select-none text-[10px]">🟢</span>
                    <strong className="text-primary">{row.successes}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="select-none text-[10px]">🔴</span>
                    <strong className="text-primary">{row.failures}</strong>
                  </span>
                </div>
                
                <span className="bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap">
                  {row.diffLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Focus Status Indicator Container */}
      <div
        className={`border-l-4 p-4 rounded-xl shadow-lg transition-all duration-300 relative overflow-hidden ${focusState.borderColor}`}
      >
        <div className="relative z-10 space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-black">
            {focusState.title}
          </h4>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {focusState.message}
          </p>
        </div>
      </div>
    </div>
  );
}
