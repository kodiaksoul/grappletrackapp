'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface ParsedLesson {
  weekTopic: string;
  lesson: string;
}

export default function GymDeskPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isInstructor, setIsInstructor] = useState(false);
  const [instructorGymName, setInstructorGymName] = useState('');
  
  // Simulation toggle for testing
  const [simulateMode, setSimulateMode] = useState(false);

  // Conversion screen state
  const [coachEmail, setCoachEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Curriculum bulk loader states
  const [curriculumText, setCurriculumText] = useState(
    `[Week 1: Half Guard] - Monday: Kimura Cross-Face\n` +
    `[Week 1: Half Guard] - Wednesday: Knee Shield Pass\n` +
    `[Week 2: Mount Control] - Monday: Head & Arm Control\n` +
    `[Week 2: Mount Control] - Wednesday: Ezekiel Choke`
  );
  const [parsedLessons, setParsedLessons] = useState<ParsedLesson[]>([]);

  // Web Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingAvailable, setRecordingAvailable] = useState(true);

  // Refs for audio media recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const safetyTimeoutRef = useRef<any>(null);

  // Initial Auth & Membership check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkMembershipRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkMembershipRole(session.user.id);
      } else {
        setIsInstructor(false);
        setLoading(false);
      }
    });

    // Check media support
    if (typeof window !== 'undefined') {
      const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      setRecordingAvailable(hasMedia);
    }

    return () => {
      subscription.unsubscribe();
      clearInterval(timerIntervalRef.current);
      clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  const checkMembershipRole = async (userId: string) => {
    try {
      setLoading(true);
      // Query memberships matching Teacher or Admin
      const { data, error } = await supabase
        .from('gym_memberships')
        .select('role_token, gym_id')
        .eq('user_id', userId)
        .in('role_token', ['Teacher', 'Admin']);

      if (!error && data && data.length > 0) {
        setIsInstructor(true);
        setInstructorGymName(`Gym Ref: ${data[0].gym_id.substring(0, 8)}`);
      } else {
        setIsInstructor(false);
      }
    } catch (err) {
      console.error(err);
      setIsInstructor(false);
    } finally {
      setLoading(false);
    }
  };

  // Run bulk parser when text changes or on page load
  useEffect(() => {
    handleParseCurriculum();
  }, [curriculumText]);

  const handleParseCurriculum = () => {
    const lines = curriculumText.split('\n');
    const parsed: ParsedLesson[] = lines
      .map((line) => {
        const cleanLine = line.trim();
        if (!cleanLine) return null;

        // Try regex match for pattern [Week topic] - Day: Lesson
        const match = cleanLine.match(/^\[(.*?)\]\s*-\s*(.*?)$/);
        if (match) {
          return {
            weekTopic: match[1].trim(),
            lesson: match[2].trim(),
          };
        }

        // Fallback split on first dash
        if (cleanLine.includes('-')) {
          const firstDashIdx = cleanLine.indexOf('-');
          const topic = cleanLine.substring(0, firstDashIdx).trim();
          const lesson = cleanLine.substring(firstDashIdx + 1).trim();
          return {
            weekTopic: topic.replace(/[\[\]]/g, ''),
            lesson: lesson,
          };
        }

        return {
          weekTopic: 'General Curriculum',
          lesson: cleanLine,
        };
      })
      .filter((item): item is ParsedLesson => item !== null);

    setParsedLessons(parsed);
  };

  // Invite head coach handler
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachEmail) return;
    setInviteSuccess(true);
    setTimeout(() => {
      setInviteSuccess(false);
      setCoachEmail('');
    }, 4000);
  };

  // --- Web Audio Recording capture script ---
  const startRecording = async () => {
    if (!recordingAvailable) return;
    setAudioUrl(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm;codecs=opus' };
      
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        // Fallback if specific codec is not supported by browsers (e.g. safari)
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const blobUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(blobUrl);
        setIsRecording(false);
        clearInterval(timerIntervalRef.current);
        clearTimeout(safetyTimeoutRef.current);
        
        // Stop all audio tracks in active media stream
        stream.getTracks().forEach((track) => track.stop());
      };

      // Start capture
      recorder.start();
      setIsRecording(true);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Hard safety cutoff threshold at 10 seconds
      safetyTimeoutRef.current = setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 10000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-brand-neon border-t-transparent animate-spin" />
        <p className="text-text-secondary text-sm">Evaluating instructor credentials...</p>
      </div>
    );
  }

  const activeInstructorState = isInstructor || simulateMode;

  return (
    <div className="space-y-8">
      {/* Header and Simulator Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">GYM DESK</h1>
          <p className="text-sm text-text-secondary mt-1">
            {activeInstructorState
              ? `Academy Control Deck - ${instructorGymName || 'Academy Staff Dev Mode'}`
              : 'Bring GrappleTrack to your home academy.'}
          </p>
        </div>
        <button
          onClick={() => setSimulateMode(!simulateMode)}
          className={`text-xs px-3 py-1.5 rounded border transition-all duration-200 ${
            simulateMode
              ? 'bg-brand-neon/15 border-brand-neon text-brand-neon font-bold'
              : 'bg-surface border border-secondary/20 text-secondary hover:bg-main hover:text-primary'
          }`}
        >
          {simulateMode ? 'Disable Simulator' : 'Simulate Staff Mode'}
        </button>
      </div>

      {/* RENDER CONVERSION SCREEN (EMPTY STATE) IF NOT STAFF */}
      {!activeInstructorState ? (
        <div className="max-w-2xl mx-auto my-8">
          <div className="bg-bg-surface border border-gray-800/80 rounded-2xl p-8 md:p-10 shadow-2xl text-center space-y-6 relative overflow-hidden group">
            {/* Visual corner effects */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-neon/5 rounded-bl-full pointer-events-none transition-all group-hover:scale-110" />

            <div className="w-16 h-16 rounded-full bg-brand-neon/15 border border-brand-neon/30 flex items-center justify-center mx-auto text-brand-neon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-8 h-8"
              >
                <path d="M22 10v6M2 10v6M12 2v20M2 10h20M2 16h20" />
              </svg>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold text-text-primary tracking-wide">
                BRING GRAPPLETRACK TO YOUR ACADEMY
              </h2>
              <p className="text-xs text-text-secondary leading-relaxed max-w-lg mx-auto">
                Unlock direct curriculum integration, custom training logs for your roster, and hands-free voice notes from your head coach to lock details instantly.
              </p>
            </div>

            {inviteSuccess ? (
              <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-brand-neon text-xs max-w-md mx-auto animate-in fade-in duration-200">
                🚀 Invitation dispatched successfully! We will coordinate with your head coach.
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3 pt-2">
                <input
                  type="email"
                  required
                  value={coachEmail}
                  onChange={(e) => setCoachEmail(e.target.value)}
                  placeholder="Coach's Email Address (e.g. coach@academy.com)"
                  className="flex-1 bg-bg-main border border-gray-800/80 rounded-lg px-4 py-2.5 text-xs text-text-primary placeholder-gray-600 focus:outline-none focus:border-brand-neon/80 transition-colors"
                />
                <button
                  type="submit"
                  className="bg-brand-neon hover:bg-brand-neon/90 text-bg-main font-bold text-xs px-6 py-2.5 rounded-lg shadow-lg shadow-brand-neon/5 transition-colors"
                >
                  Send Academy Invitation
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        /* RENDER INSTRUCTOR COMMAND ARRAY (STAFF AUTHENTICATED) */
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* CURRICULUM BULK LOADER */}
          <div className="bg-bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-neon" />
              CURRICULUM BULK PARSER
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Dump your academy's weekly schedule or specific lesson focuses directly. Use the partition format `[Week topic] - Day: Lesson` to cleanly generate card previews for your students.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Textarea Input */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
                  Bulk Data Input
                </span>
                <textarea
                  rows={8}
                  value={curriculumText}
                  onChange={(e) => setCurriculumText(e.target.value)}
                  className="w-full bg-bg-main border border-gray-800/80 rounded-xl p-4 text-xs text-text-secondary font-mono leading-relaxed focus:outline-none focus:border-brand-neon/80 transition-colors"
                  placeholder="Paste schedule lines..."
                />
              </div>

              {/* Parsing Output Preview */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
                   Roster Template Preview ({parsedLessons.length} entries parsed)
                </span>
                
                <div className="bg-bg-main/50 border border-gray-850 rounded-xl p-4 max-h-[195px] overflow-y-auto space-y-3">
                  {parsedLessons.length === 0 ? (
                    <p className="text-xs text-text-secondary italic">Enter data to preview formatting.</p>
                  ) : (
                    parsedLessons.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-bg-surface/60 border border-gray-850 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-brand-neon font-bold uppercase tracking-wider block">
                            {item.weekTopic}
                          </span>
                          <span className="text-xs font-semibold text-text-primary">
                            {item.lesson}
                          </span>
                        </div>
                        <span className="text-[9px] text-text-secondary uppercase bg-bg-main border border-gray-800 px-2 py-0.5 rounded self-start sm:self-auto">
                          Active Template
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* INSTRUCTOR AUDIO Q&A RESPONSE DESK */}
          <div className="bg-bg-surface border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-neon" />
                COACH AUDIO RESPONSE DESK
              </h2>
              <span className="text-[9px] bg-brand-neon/10 text-brand-neon border border-brand-neon/20 px-2 py-0.5 rounded font-bold uppercase">
                Opus WebM Output
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Record voice feedback for student technique critiques. Standardized capture limits recording to a hard safety threshold of **10 seconds** to keep reviews concise and performant.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Record Action Panel */}
              <div className="md:col-span-1 bg-bg-main/50 border border-gray-850 rounded-xl p-5 flex flex-col items-center justify-center space-y-4 text-center">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                  Critique Microphone
                </span>

                <button
                  type="button"
                  disabled={!recordingAvailable}
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                    !recordingAvailable
                      ? 'bg-gray-800 text-text-secondary cursor-not-allowed border border-gray-700'
                      : isRecording
                      ? 'bg-red-600 hover:bg-red-700 text-text-primary animate-pulse scale-105 border-2 border-red-500/50'
                      : 'bg-brand-neon hover:bg-brand-neon/90 text-bg-main hover:scale-105 active:scale-95'
                  }`}
                >
                  {isRecording ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="1.5" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                    </svg>
                  )}
                </button>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-text-primary">
                    {isRecording ? 'RECORDING CRITIQUE' : 'TAP TO RECORD'}
                  </span>
                  <span className="text-[10px] text-text-secondary block">
                    {isRecording ? `Timer: ${recordingSeconds}s / 10s Max` : 'Requires microphone permissions'}
                  </span>
                </div>
              </div>

              {/* Recording Outputs / Audio Player Panel */}
              <div className="md:col-span-2 space-y-4">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
                  Voice Note Playback Critique
                </span>

                <div className="bg-bg-main/30 border border-gray-850 p-6 rounded-xl flex flex-col justify-center min-h-[146px] space-y-4">
                  {audioUrl ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-brand-neon font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-ping" />
                          Critique_Draft.webm
                        </span>
                        <button
                          onClick={() => setAudioUrl(null)}
                          className="text-[10px] text-red-400 hover:underline"
                        >
                          Delete Draft [x]
                        </button>
                      </div>

                      {/* Native HTML5 Audio Playback Box */}
                      <audio src={audioUrl} controls className="w-full focus:outline-none" />

                      <button
                        type="button"
                        onClick={() => {
                          alert('Voicenote sent successfully to student critique terminal!');
                          setAudioUrl(null);
                        }}
                        className="bg-brand-neon hover:bg-brand-neon/90 text-bg-main font-bold text-xs py-2 px-4 rounded-lg self-start shadow-md shadow-brand-neon/5"
                      >
                        Publish Voice Critique
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-text-secondary">
                        {isRecording
                          ? 'Capturing audio stream...'
                          : 'No audio feedback recorded yet. Tap the microphone to begin.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
