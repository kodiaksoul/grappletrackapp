'use client';

import { useState, useMemo } from 'react';

interface MatTimeVolumeReportProps {
  logs: any[];
}

interface CleanLog {
  date: Date;
  durationHours: number;
}

export default function MatTimeVolumeReport({ logs }: MatTimeVolumeReportProps) {
  const [range, setRange] = useState<string>('Last 7 Days');

  // 1. Map logs to simplified structures
  const cleanLogs = useMemo<CleanLog[]>(() => {
    if (!logs) return [];
    return logs.map((log: any) => {
      let totalMinutes = 0;
      if (log.rounds) {
        log.rounds.forEach((r: any) => {
          totalMinutes += r.duration_minutes || 0;
        });
      }
      return {
        date: new Date(log.created_at),
        durationHours: totalMinutes / 60,
      };
    });
  }, [logs]);

  // 2. Generate filtered logs and X-Axis data based on range
  const { chartData, totalHours, triggerAlert } = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let filtered: CleanLog[] = [];
    let labels: string[] = [];
    let buckets: number[] = [];

    // Helper: Reset time part for date calculations
    const getMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (range === 'Last 7 Days') {
      // Days 0-6 ago
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayStart);
        d.setDate(todayStart.getDate() - i);
        labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
        buckets.push(0);
      }

      cleanLogs.forEach((log) => {
        const logMid = getMidnight(log.date);
        const diffTime = todayStart.getTime() - logMid.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 6) {
          filtered.push(log);
          const bucketIndex = 6 - diffDays;
          if (bucketIndex >= 0 && bucketIndex < 7) {
            buckets[bucketIndex] += log.durationHours;
          }
        }
      });
    } else if (range === 'Current Month') {
      // Group current month into 4 weeks: W1 (1-7), W2 (8-14), W3 (15-21), W4 (22+)
      labels = ['W1', 'W2', 'W3', 'W4'];
      buckets = [0, 0, 0, 0];

      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      cleanLogs.forEach((log) => {
        if (log.date.getFullYear() === currentYear && log.date.getMonth() === currentMonth) {
          filtered.push(log);
          const dayNum = log.date.getDate();
          if (dayNum <= 7) {
            buckets[0] += log.durationHours;
          } else if (dayNum <= 14) {
            buckets[1] += log.durationHours;
          } else if (dayNum <= 21) {
            buckets[2] += log.durationHours;
          } else {
            buckets[3] += log.durationHours;
          }
        }
      });
    } else if (range === 'Last 30 Days') {
      // Last 30 days grouped into 4 weeks counting backward
      labels = ['W1', 'W2', 'W3', 'W4']; // W4 is the latest week, W1 is the oldest
      buckets = [0, 0, 0, 0];

      cleanLogs.forEach((log) => {
        const logMid = getMidnight(log.date);
        const diffTime = todayStart.getTime() - logMid.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 29) {
          filtered.push(log);
          if (diffDays <= 6) {
            buckets[3] += log.durationHours; // W4
          } else if (diffDays <= 13) {
            buckets[2] += log.durationHours; // W3
          } else if (diffDays <= 20) {
            buckets[1] += log.durationHours; // W2
          } else {
            buckets[0] += log.durationHours; // W1
          }
        }
      });
    } else if (range === 'Last 90 Days') {
      // Last 90 days grouped into 12 weeks counting backward (W12 is latest)
      labels = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
      buckets = Array.from({ length: 12 }, () => 0);

      cleanLogs.forEach((log) => {
        const logMid = getMidnight(log.date);
        const diffTime = todayStart.getTime() - logMid.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 89) {
          filtered.push(log);
          // Determine week index
          const weekOffset = Math.floor(diffDays / 7);
          const bucketIndex = 11 - weekOffset;
          if (bucketIndex >= 0 && bucketIndex < 12) {
            buckets[bucketIndex] += log.durationHours;
          } else if (bucketIndex < 0) {
            // Put remaining days in W1
            buckets[0] += log.durationHours;
          }
        }
      });
    } else if (range === 'Year to Date' || range === 'Current Year') {
      // Group by calendar months (Jan to Dec)
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      buckets = Array.from({ length: 12 }, () => 0);

      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      cleanLogs.forEach((log) => {
        if (log.date.getFullYear() === currentYear) {
          if (range === 'Current Year' || log.date.getMonth() <= currentMonth) {
            filtered.push(log);
            const m = log.date.getMonth();
            if (m >= 0 && m < 12) {
              buckets[m] += log.durationHours;
            }
          }
        }
      });

      // Filter labels for Year to Date so we don't render future empty months
      if (range === 'Year to Date') {
        labels = labels.slice(0, currentMonth + 1);
        buckets = buckets.slice(0, currentMonth + 1);
      }
    }

    const calculatedTotalHours = filtered.reduce((acc, log) => acc + log.durationHours, 0);

    // Calculate volume spikes for Cognitive Recovery alert
    let currentVolume = 0;
    let previousVolume = 0;

    if (range === 'Last 7 Days') {
      cleanLogs.forEach((log) => {
        const logMid = getMidnight(log.date);
        const diffTime = todayStart.getTime() - logMid.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 3) {
          currentVolume += log.durationHours;
        } else if (diffDays >= 4 && diffDays <= 7) {
          previousVolume += log.durationHours;
        }
      });
    } else if (range === 'Last 30 Days') {
      cleanLogs.forEach((log) => {
        const logMid = getMidnight(log.date);
        const diffTime = todayStart.getTime() - logMid.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 14) {
          currentVolume += log.durationHours;
        } else if (diffDays >= 15 && diffDays <= 29) {
          previousVolume += log.durationHours;
        }
      });
    } else if (range === 'Current Month') {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      cleanLogs.forEach((log) => {
        if (log.date.getFullYear() === currentYear && log.date.getMonth() === currentMonth) {
          if (log.date.getDate() >= 16) {
            currentVolume += log.durationHours;
          } else {
            previousVolume += log.durationHours;
          }
        }
      });
    } else if (range === 'Last 90 Days') {
      cleanLogs.forEach((log) => {
        const logMid = getMidnight(log.date);
        const diffTime = todayStart.getTime() - logMid.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 44) {
          currentVolume += log.durationHours;
        } else if (diffDays >= 45 && diffDays <= 89) {
          previousVolume += log.durationHours;
        }
      });
    } else if (range === 'Year to Date' || range === 'Current Year') {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      cleanLogs.forEach((log) => {
        const logYear = log.date.getFullYear();
        const logMonth = log.date.getMonth();
        if (logYear === currentYear) {
          if (logMonth === currentMonth) {
            currentVolume += log.durationHours;
          } else if (logMonth === currentMonth - 1) {
            previousVolume += log.durationHours;
          }
        }
      });
    }

    let isSpike = false;
    if (previousVolume > 0) {
      const pctIncrease = (currentVolume - previousVolume) / previousVolume;
      isSpike = pctIncrease >= 0.30;
    } else if (previousVolume === 0 && currentVolume >= 2.0) {
      isSpike = true;
    }

    // Prepare chart data format
    const chart = labels.map((label, index) => ({
      label,
      hours: buckets[index],
    }));

    return {
      chartData: chart,
      totalHours: calculatedTotalHours,
      triggerAlert: isSpike,
    };
  }, [range, cleanLogs]);

  const maxHours = useMemo(() => {
    return Math.max(...chartData.map((d) => d.hours), 1);
  }, [chartData]);

  return (
    <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group flex flex-col gap-6">
      <div className="absolute top-0 right-0 w-24 h-24 bg-neon/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div>
          <h3 className="text-md font-bold text-primary tracking-wide uppercase">Mat Time Volume Report</h3>
          <p className="text-[10px] text-secondary mt-0.5">Visualize training volume distribution and recovery margins.</p>
        </div>

        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="bg-main border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-primary focus:outline-none focus:border-neon/80"
        >
          <option value="Last 7 Days">Last 7 Days</option>
          <option value="Current Month">Current Month</option>
          <option value="Last 30 Days">Last 30 Days</option>
          <option value="Last 90 Days">Last 90 Days</option>
          <option value="Year to Date">Year to Date</option>
          <option value="Current Year">Current Year</option>
        </select>
      </div>

      {/* Metric Display */}
      <div className="bg-main/30 border border-gray-800/50 rounded-xl p-4 flex flex-col justify-center">
        <span className="text-[9px] font-bold text-secondary uppercase tracking-widest">Dynamic Volume</span>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-xs font-bold text-secondary">TOTAL MAT TIME:</span>
          <span className="text-2xl font-extrabold text-neon">{totalHours.toFixed(1)}</span>
          <span className="text-xs font-bold text-primary">Hours</span>
        </div>
      </div>

      {/* Custom HTML/Tailwind CSS Flex-Bar Chart */}
      <div className="h-44 border border-gray-800/50 bg-main/20 rounded-xl p-4 flex items-end gap-3 justify-around relative">
        {/* Subtle Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-4 opacity-5">
          <div className="border-b border-white w-full" />
          <div className="border-b border-white w-full" />
          <div className="border-b border-white w-full" />
          <div className="border-b border-white w-full" />
        </div>

        {chartData.map((d, index) => {
          const heightPct = (d.hours / maxHours) * 80; // limit to 80% to leave room for label
          return (
            <div key={index} className="relative group/bar flex flex-col items-center flex-1 h-full justify-end z-10">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 bg-main border border-gray-850 text-[9px] font-mono text-primary px-2 py-0.5 rounded shadow-xl opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                {d.hours.toFixed(1)} Hours
              </div>

              {/* Bar */}
              <div
                style={{ height: `${Math.max(heightPct, 3)}%` }}
                className={`w-full max-w-[20px] rounded-t transition-all duration-300 ${
                  d.hours > 0 ? 'bg-secondary/40 hover:bg-neon/80' : 'bg-gray-800/20'
                }`}
              />

              {/* Label */}
              <span className="text-[9px] font-semibold text-secondary mt-2 select-none uppercase tracking-wider">{d.label}</span>
            </div>
          );
        })}
      </div>

      {/* Cognitive Recovery Summary & Alerts */}
      <div className="space-y-3 relative z-10">
        <span className="text-[9px] font-bold text-secondary uppercase tracking-widest block">Cognitive Recovery Summary</span>
        
        {triggerAlert ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-xs text-yellow-500/90 leading-relaxed font-semibold">
              Your mat time increased significantly. Ensure your sleep and nutrition are matching your output to prevent unnecessary plateaus or injury.
            </p>
          </div>
        ) : (
          <div className="bg-main/30 border border-gray-800/40 rounded-xl p-4">
            <p className="text-[11px] text-secondary leading-relaxed">
              Your training volume trends look stable and within safe recovery parameters. Maintain steady output.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
