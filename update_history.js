const fs = require('fs');
let content = fs.readFileSync('c:/projects/grappletrackapp/app/history/page.tsx', 'utf8');

// 1. Add state variables
content = content.replace(
  `  const [filterAttire, setFilterAttire] = useState<'All' | 'Gi' | 'No-Gi'>('All');`,
  `  const [filterAttire, setFilterAttire] = useState<'All' | 'Gi' | 'No-Gi'>('All');\n  const [viewMode, setViewMode] = useState<'List' | 'Calendar'>('List');\n  const [calendarDate, setCalendarDate] = useState(new Date());\n  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);`
);

// 2. Add calendar helper functions
content = content.replace(
  `  const filteredLogs = logs.filter((log) => {`,
  `  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));

  const filteredLogs = logs.filter((log) => {`
);

// 3. Add toggle to Header
const headerOld = `<div className="bg-surface border border-gray-800/80 rounded-xl p-3 flex items-center justify-between shadow-lg">
          <span className="text-xs font-semibold text-secondary uppercase tracking-widest pl-2">Filter Attire</span>
          <div className="flex gap-1">`;
          
const headerNew = `<div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-surface border border-gray-800/80 rounded-xl p-3 flex items-center justify-between shadow-lg flex-1">
            <span className="text-xs font-semibold text-secondary uppercase tracking-widest pl-2">Filter Attire</span>
            <div className="flex gap-1">`;
content = content.replace(headerOld, headerNew);

const headerCloseOld = `</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (`;

const headerCloseNew = `</button>
            ))}
          </div>
        </div>
        
        <div className="bg-surface border border-gray-800/80 rounded-xl p-3 flex items-center shadow-lg">
          <div className="flex gap-1 w-full">
            <button onClick={() => setViewMode('List')} className={\`flex-1 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all \${viewMode === 'List' ? 'bg-neon/10 border border-neon/30 text-neon' : 'bg-transparent text-secondary hover:text-primary'}\`}>List View</button>
            <button onClick={() => setViewMode('Calendar')} className={\`flex-1 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all \${viewMode === 'Calendar' ? 'bg-neon/10 border border-neon/30 text-neon' : 'bg-transparent text-secondary hover:text-primary'}\`}>Calendar View</button>
          </div>
        </div>
      </div>
      </div>

      {loading ? (`;
content = content.replace(headerCloseOld, headerCloseNew);

// 4. Wrap List in viewMode === 'List' and add Calendar View
const contentStartOld = `<div className="space-y-6">
          {visibleLogs.length === 0 ? (`;

const contentStartNew = `<div className="space-y-6">
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
                  <div key={\`empty-\${i}\`} className="aspect-square rounded-lg bg-main/30 border border-transparent"></div>
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
                      className={\`relative aspect-square rounded-lg border transition-all flex flex-col items-center justify-center gap-1 \${isSelected ? 'bg-neon/10 border-neon text-neon' : dayLogs.length > 0 ? 'bg-main border-gray-700 hover:border-neon text-primary shadow-lg shadow-neon/5' : 'bg-main/50 border-gray-800/50 text-secondary/50 hover:bg-main/80'}\`}
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
                                  <span className={\`text-[10px] font-bold px-2 py-0.5 rounded \${log.attire_type === 'Gi' ? 'bg-blue-950/30 text-blue-400 border border-blue-900/40' : 'bg-orange-950/30 text-orange-400 border border-orange-900/40'}\`}>{log.attire_type}</span>
                                  <span className="text-xs font-semibold text-primary">{log.notes || 'Independent training session'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-neon bg-neon/5 border border-neon/20 px-2.5 py-1 rounded-full font-semibold">{log.rounds.length} {log.rounds.length === 1 ? 'Round' : 'Rounds'}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={\`w-4 h-4 text-secondary transition-transform duration-200 \${isExpanded ? 'rotate-180' : ''}\`}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-gray-800 bg-surface/30 space-y-4 pt-4">
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
          ) : visibleLogs.length === 0 ? (`;

content = content.replace(contentStartOld, contentStartNew);

fs.writeFileSync('c:/projects/grappletrackapp/app/history/page.tsx', content);
