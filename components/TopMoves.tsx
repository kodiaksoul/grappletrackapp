'use client';

import { useMemo } from 'react';

interface TopMovesProps {
  logs: any[];
  isPremium: boolean;
  handleUpgrade: () => void;
}

interface TechniqueMetric {
  name: string;
  successes: number;
  failures: number;
  attempts: number;
  successRate: number;
}

export default function TopMoves({ logs, isPremium, handleUpgrade }: TopMovesProps) {
  // Aggregate technique metrics
  const techniqueMetrics = useMemo(() => {
    const metricsMap: Record<string, { successes: number; failures: number }> = {};

    if (logs) {
      logs.forEach(log => {
        if (log.rounds) {
          log.rounds.forEach((round: any) => {
            if (round.executed_techniques) {
              round.executed_techniques.forEach((tech: any) => {
                if (tech.technique_name) {
                  const name = tech.technique_name.trim();
                  if (!name) return;

                  // Normalize name to Title Case matching TechniqueMirror
                  const titleCased = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

                  if (!metricsMap[titleCased]) {
                    metricsMap[titleCased] = { successes: 0, failures: 0 };
                  }

                  const isSuccessful = tech.is_successful === true;
                  if (isSuccessful) {
                    metricsMap[titleCased].successes += 1;
                  } else {
                    metricsMap[titleCased].failures += 1;
                  }
                }
              });
            }
          });
        }
      });
    }

    // Convert map to array and calculate rates
    const list: TechniqueMetric[] = Object.keys(metricsMap).map(name => {
      const { successes, failures } = metricsMap[name];
      const attempts = successes + failures;
      const successRate = attempts > 0 ? (successes / attempts) * 100 : 0;
      return { name, successes, failures, attempts, successRate };
    });

    return list.filter(item => item.attempts > 0);
  }, [logs]);

  // Extract Top 3 Successful Moves
  const topSuccessful = useMemo(() => {
    return [...techniqueMetrics]
      .sort((a, b) => {
        if (b.successRate !== a.successRate) {
          return b.successRate - a.successRate; // Higher success rate first
        }
        if (b.successes !== a.successes) {
          return b.successes - a.successes; // More successes first
        }
        return a.name.localeCompare(b.name); // Alphabetical fallback
      })
      .slice(0, 3);
  }, [techniqueMetrics]);

  // Extract Top 3 Focus Moves (Worst success rates)
  const topFocus = useMemo(() => {
    return [...techniqueMetrics]
      .sort((a, b) => {
        if (a.successRate !== b.successRate) {
          return a.successRate - b.successRate; // Lower success rate first
        }
        if (b.failures !== a.failures) {
          return b.failures - a.failures; // More failures first (higher priority focus)
        }
        return a.name.localeCompare(b.name); // Alphabetical fallback
      })
      .slice(0, 3);
  }, [techniqueMetrics]);

  const hasData = techniqueMetrics.length > 0;

  // Render dummy data when not premium for the locked preview background
  const renderList = (isTop: boolean) => {
    if (!isPremium) {
      if (isTop) {
        return [
          { name: 'Kimura', successes: 14, failures: 2, attempts: 16, successRate: 87.5 },
          { name: 'Scissor Sweep', successes: 8, failures: 1, attempts: 9, successRate: 88.8 },
          { name: 'RNC', successes: 5, failures: 1, attempts: 6, successRate: 83.3 },
        ];
      } else {
        return [
          { name: 'Guillotine Choke', successes: 1, failures: 7, attempts: 8, successRate: 12.5 },
          { name: 'De la Riva Sweep', successes: 2, failures: 5, attempts: 7, successRate: 28.5 },
          { name: 'Triangle Choke', successes: 3, failures: 6, attempts: 9, successRate: 33.3 },
        ];
      }
    }
    return isTop ? topSuccessful : topFocus;
  };

  return (
    <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group min-h-[300px]">
      <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-105" />

      {/* Paywall Overlay for Free Tier */}
      {!isPremium && (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-[3px] z-20 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-surface border border-gray-800 p-6 rounded-2xl max-w-sm space-y-4 shadow-2xl relative">
            <div className="absolute top-0 right-0 w-16 h-16 bg-neon/5 rounded-bl-full pointer-events-none" />
            <div className="w-12 h-12 rounded-full bg-neon/10 border border-neon/30 flex items-center justify-center mx-auto text-neon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-neon uppercase tracking-widest bg-neon/10 px-2 py-0.5 rounded">Premium Feature</span>
              <h4 className="text-sm font-bold text-primary uppercase tracking-wider pt-2">Technique Performance Summary</h4>
              <p className="text-xs text-secondary leading-relaxed">
                Unlock lists of your top 3 successful moves and top 3 focus techniques calculated from your rolling sessions.
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              className="w-full bg-neon hover:bg-neon/90 text-main font-bold text-xs py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-neon/5 active:scale-95 flex items-center justify-center gap-1.5"
            >
              Unlock Analytics
            </button>
          </div>
        </div>
      )}

      {/* Main Container (Will be blurred if Free) */}
      <div className={`relative z-10 space-y-6 ${!isPremium ? 'blur-[4px] select-none pointer-events-none' : ''}`}>
        {/* Header */}
        <div className="border-b border-gray-800/60 pb-4">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Technique Performance Summary</h3>
          <p className="text-[10px] text-secondary mt-1">
            Sparring performance highlights mapped from your logged training rounds
          </p>
        </div>

        {/* Check for Zero State */}
        {isPremium && !hasData ? (
          <div className="text-center py-8 space-y-2">
            <span className="text-2xl select-none">🥋</span>
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">No Sparring Data Available</h4>
            <p className="text-[10px] text-secondary max-w-sm mx-auto leading-relaxed">
              Log rounds containing positions and technique focus metrics to compute your sparring highlights.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Top 3 Successful Moves */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Top 3 Successful Moves
              </h4>
              <div className="space-y-3.5">
                {renderList(true).map((item, idx) => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-primary">
                        {idx + 1}. {item.name}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-emerald-400 font-bold">{item.successRate.toFixed(0)}% SR</span>
                        <span className="text-secondary">({item.successes}/{item.attempts} rolls)</span>
                      </div>
                    </div>
                    {/* Success Rate Bar */}
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${item.successRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 3 Moves to Focus On (Worst success rates) */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Moves to Focus On
              </h4>
              <div className="space-y-3.5">
                {renderList(false).map((item, idx) => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-primary">
                        {idx + 1}. {item.name}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-red-400 font-bold">{item.successRate.toFixed(0)}% SR</span>
                        <span className="text-secondary">({item.failures} failures)</span>
                      </div>
                    </div>
                    {/* Success Rate Bar (Red representing low success / high focus priority) */}
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${item.successRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
