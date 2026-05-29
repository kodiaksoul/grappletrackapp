'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchUserHistory } from '../actions/fetchHistory';
import { useAuth } from '../AuthGuard';

interface ParsedLesson {
  weekTopic: string;
  lesson: string;
}

export default function GymDeskPage() {
  const { session, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Real DB state
  const [gymRole, setGymRole] = useState<'Teacher' | 'Admin' | null>(null);
  const [currentGymId, setCurrentGymId] = useState<string>('aa000000-0000-0000-0000-000000000001'); // Fallback to Alliance HQ
  const [gymDetails, setGymDetails] = useState<any>(null);

  // Simulation controls for testing
  const [simulateMode, setSimulateMode] = useState(false);
  const [simulateRole, setSimulateRole] = useState<'Teacher' | 'Admin'>('Teacher');

  // Teacher Dashboard States
  const [studentRoster, setStudentRoster] = useState<any[]>([]);
  const [selectedRosterStudent, setSelectedRosterStudent] = useState<any>(null);
  const [selectedStudentLogs, setSelectedStudentLogs] = useState<any[]>([]);
  const [studentLogsLoading, setStudentLogsLoading] = useState(false);
  const [selectedLogForFeedback, setSelectedLogForFeedback] = useState<any>(null);
  const [writtenFeedback, setWrittenFeedback] = useState('');
  const [curriculumLessons, setCurriculumLessons] = useState<any[]>([]);
  const [weekTopic, setWeekTopic] = useState('');
  const [lessonTopic, setLessonTopic] = useState('');
  
  // Admin Dashboard States
  const [gymLocations, setGymLocations] = useState<any[]>([]);
  const [newGymName, setNewGymName] = useState('');
  const [newGymAddress, setNewGymAddress] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'User-Student' | 'Teacher'>('User-Student');
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');
  const [generatedInviteCode, setGeneratedInviteCode] = useState('');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeGymMembers, setActiveGymMembers] = useState<any[]>([]);

  // Curriculum bulk loader states (legacy support)
  const [curriculumText, setCurriculumText] = useState(
    `[Week 1: Half Guard] - Monday: Kimura Cross-Face\n` +
    `[Week 1: Half Guard] - Wednesday: Knee Shield Pass\n` +
    `[Week 2: Mount Control] - Monday: Head & Arm Control\n` +
    `[Week 2: Mount Control] - Wednesday: Ezekiel Choke`
  );
  const [parsedLessons, setParsedLessons] = useState<ParsedLesson[]>([]);

  // Web Audio recording states (feedback review voice capture)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingAvailable, setRecordingAvailable] = useState(true);

  // Refs for audio media recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const safetyTimeoutRef = useRef<any>(null);

  // Initial Membership check when auth is resolved
  useEffect(() => {
    if (authLoading) return;

    if (session) {
      loadData(session.user.id);
    } else {
      setGymRole(null);
      setLoading(false);
    }
  }, [session, authLoading]);

  // Check media support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      setRecordingAvailable(hasMedia);
    }
    return () => {
      clearInterval(timerIntervalRef.current);
      clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  // Run bulk parser when text changes
  useEffect(() => {
    handleParseCurriculum();
  }, [curriculumText]);

  const loadData = async (userId: string) => {
    try {
      setLoading(true);

      // Query memberships matching Teacher or Admin
      const { data: membershipData } = await supabase
        .from('gym_memberships')
        .select('role_token, gym_id')
        .eq('user_id', userId)
        .in('role_token', ['Teacher', 'Admin'])
        .limit(1);

      if (membershipData && membershipData.length > 0) {
        const mem = membershipData[0];
        setGymRole(mem.role_token as any);
        setCurrentGymId(mem.gym_id);

        // Fetch gym details
        const { data: gymLoc } = await supabase
          .from('gym_locations')
          .select('*')
          .eq('id', mem.gym_id)
          .single();
        setGymDetails(gymLoc);
      } else if (profile && (profile.access_role === 'Teacher' || profile.access_role === 'Admin')) {
        setGymRole(profile.access_role as any);
        // Default gym_id if they have role but no membership yet
        const { data: firstGym } = await supabase.from('gym_locations').select('*').limit(1);
        if (firstGym && firstGym.length > 0) {
          setCurrentGymId(firstGym[0].id);
          setGymDetails(firstGym[0]);
        }
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load Dashboards data when gym details are locked in
  useEffect(() => {
    if (session && currentGymId) {
      loadTeacherDashboardData();
      loadAdminDashboardData();
    }
  }, [session, currentGymId, gymRole, simulateMode, simulateRole]);

  // Load Teacher Specific Data
  const loadTeacherDashboardData = async () => {
    try {
      // 1. Fetch Students at this gym
      const { data: memberships, error } = await supabase
        .from('gym_memberships')
        .select('user_id')
        .eq('gym_id', currentGymId)
        .eq('role_token', 'Student');

      if (!error && memberships) {
        const studentIds = memberships.map((m: any) => m.user_id);
        if (studentIds.length > 0) {
          const { data: studentProfiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', studentIds);
          setStudentRoster(studentProfiles || []);
        } else {
          setStudentRoster([]);
        }
      }

      // 2. Fetch gym curriculum lessons
      const { data: lessons } = await supabase
        .from('curriculum_lessons')
        .select('*')
        .eq('gym_id', currentGymId)
        .order('created_at', { ascending: false });
      setCurriculumLessons(lessons || []);

    } catch (e) {
      console.error(e);
    }
  };

  // Load Admin Specific Data
  const loadAdminDashboardData = async () => {
    try {
      // 1. Fetch all Gym locations
      const { data: gyms } = await supabase
        .from('gym_locations')
        .select('*');
      setGymLocations(gyms || []);

      // 2. Fetch pending access requests
      const { data: requests } = await supabase
        .from('gym_access_requests')
        .select('*, profiles:user_id(*)')
        .eq('gym_id', currentGymId)
        .eq('status', 'pending');
      setPendingRequests(requests || []);

      // 3. Fetch active gym members list
      const { data: members } = await supabase
        .from('gym_memberships')
        .select('*, profiles:user_id(*)')
        .eq('gym_id', currentGymId);
      setActiveGymMembers(members || []);

    } catch (e) {
      console.error(e);
    }
  };

  const activeRole = simulateMode ? simulateRole : gymRole;

  // --- Curriculum Broadcast Actions ---
  const handleBroadcastCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weekTopic.trim() || !lessonTopic.trim()) return;

    try {
      // Insert new curriculum focus
      const { error } = await supabase
        .from('curriculum_lessons')
        .insert({
          gym_id: currentGymId,
          week_topic: weekTopic.trim(),
          lesson: lessonTopic.trim(),
          is_active: true,
          created_by: session.user.id
        });

      if (error) throw error;
      alert('Curriculum lesson broadcasted successfully!');
      setWeekTopic('');
      setLessonTopic('');
      loadTeacherDashboardData();
    } catch (e: any) {
      alert(`Failed to broadcast: ${e.message}`);
    }
  };

  const handleToggleCurriculumActive = async (lessonId: string, currentVal: boolean) => {
    try {
      const { error } = await supabase
        .from('curriculum_lessons')
        .update({ is_active: !currentVal })
        .eq('id', lessonId);
      if (error) throw error;
      loadTeacherDashboardData();
    } catch (e: any) {
      alert(`Failed to update: ${e.message}`);
    }
  };

  // --- Scoped Roster Visibility & Critiques ---
  const handleSelectStudent = async (student: any) => {
    setSelectedRosterStudent(student);
    setSelectedStudentLogs([]);
    setSelectedLogForFeedback(null);
    setStudentLogsLoading(true);

    try {
      const { logs } = await fetchUserHistory(student.id);
      setSelectedStudentLogs(logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setStudentLogsLoading(false);
    }
  };

  const handlePublishCritique = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLogForFeedback || (!writtenFeedback.trim() && !audioUrl)) return;

    try {
      const { error } = await supabase
        .from('coach_critiques')
        .upsert({
          log_id: selectedLogForFeedback.id,
          coach_id: session.user.id,
          feedback: writtenFeedback.trim() || 'Voice critique attached',
          audio_url: audioUrl || null
        });

      if (error) throw error;

      alert('Feedback published successfully!');
      setWrittenFeedback('');
      setAudioUrl(null);
      setSelectedLogForFeedback(null);
      
      // Reload logs
      if (selectedRosterStudent) {
        handleSelectStudent(selectedRosterStudent);
      }
    } catch (err: any) {
      alert(`Failed to publish review: ${err.message}`);
    }
  };

  // --- Admin Location Manager Actions ---
  const handleCreateGym = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGymName.trim()) return;

    try {
      const { error } = await supabase
        .from('gym_locations')
        .insert({
          name: newGymName.trim(),
          address: newGymAddress.trim(),
          owner_id: session.user.id
        });

      if (error) throw error;
      alert(`Successfully registered gym location: ${newGymName}`);
      setNewGymName('');
      setNewGymAddress('');
      loadAdminDashboardData();
    } catch (e: any) {
      alert(`Failed to register gym: ${e.message}`);
    }
  };

  // --- Admin Staff Provisioner (Generate Invite) ---
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      const secureCode = `GT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { error } = await supabase
        .from('gym_invitations')
        .insert({
          gym_id: currentGymId,
          email: inviteEmail.trim(),
          code: secureCode,
          role: inviteRole,
          invited_by: session.user.id
        });

      if (error) throw error;

      const fullLink = `${window.location.origin}/invite?code=${secureCode}`;
      setGeneratedInviteCode(secureCode);
      setGeneratedInviteLink(fullLink);
      setInviteEmail('');

    } catch (e: any) {
      alert(`Failed to generate invite: ${e.message}`);
    }
  };

  // --- Admin Roster Requests Approvals ---
  const handleApproveRequest = async (request: any) => {
    try {
      // 1. Update request status to approved
      const { error: reqError } = await supabase
        .from('gym_access_requests')
        .update({ status: 'approved' })
        .eq('id', request.id);

      if (reqError) throw reqError;

      // 2. Add to gym memberships
      const { error: memError } = await supabase
        .from('gym_memberships')
        .upsert({
          user_id: request.user_id,
          gym_id: request.gym_id,
          role_token: 'Student'
        });

      if (memError) throw memError;

      // 3. Promote profile role to Student
      const { error: profError } = await supabase
        .from('profiles')
        .update({ access_role: 'User-Student', is_premium_tier: true })
        .eq('id', request.user_id);

      if (profError) throw profError;

      alert(`Approved request. ${request.profiles?.name} is now a Student at your gym.`);
      loadAdminDashboardData();
    } catch (e: any) {
      alert(`Approval failed: ${e.message}`);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('gym_access_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;
      alert('Access request rejected.');
      loadAdminDashboardData();
    } catch (e: any) {
      alert(`Rejection failed: ${e.message}`);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const confirmed = window.confirm('Are you sure you want to remove this member from the roster?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('gym_memberships')
        .delete()
        .eq('user_id', userId)
        .eq('gym_id', currentGymId);

      if (error) throw error;
      
      // Demote role to Free
      await supabase
        .from('profiles')
        .update({ access_role: 'User-Free', is_premium_tier: false })
        .eq('id', userId);

      alert('Member removed successfully.');
      loadAdminDashboardData();
    } catch (e: any) {
      alert(`Failed to remove member: ${e.message}`);
    }
  };

  // --- Curriculum bulk schedule parser ---
  const handleParseCurriculum = () => {
    const lines = curriculumText.split('\n');
    const parsed: ParsedLesson[] = lines
      .map((line) => {
        const cleanLine = line.trim();
        if (!cleanLine) return null;

        const match = cleanLine.match(/^\[(.*?)\]\s*-\s*(.*?)$/);
        if (match) {
          return {
            weekTopic: match[1].trim(),
            lesson: match[2].trim(),
          };
        }

        if (cleanLine.includes('-')) {
          const firstDashIdx = cleanLine.indexOf('-');
          return {
            weekTopic: cleanLine.substring(0, firstDashIdx).trim().replace(/[\[\]]/g, ''),
            lesson: cleanLine.substring(firstDashIdx + 1).trim(),
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
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

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
        <div className="w-8 h-8 rounded-full border-2 border-neon border-t-transparent animate-spin" />
        <p className="text-secondary text-sm">Evaluating instructor credentials...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header and Simulator Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">GYM DESK</h1>
          <p className="text-sm text-secondary mt-1">
            {activeRole
              ? `Academy Control Deck - ${gymDetails?.name || 'Academy Staff Dev Mode'}`
              : 'Bring GrappleTrack to your home academy.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {simulateMode && (
            <select
              value={simulateRole}
              onChange={(e) => setSimulateRole(e.target.value as any)}
              className="text-xs bg-main border border-gray-800 rounded px-2.5 py-1 text-primary focus:outline-none focus:border-neon"
            >
              <option value="Teacher">Role: Teacher</option>
              <option value="Admin">Role: Admin</option>
            </select>
          )}
          <button
            onClick={() => setSimulateMode(!simulateMode)}
            className={`text-xs px-3 py-1.5 rounded border transition-all duration-200 ${
              simulateMode
                ? 'bg-neon/15 border-neon text-neon font-bold'
                : 'bg-surface border border-secondary/20 text-secondary hover:bg-main hover:text-primary'
            }`}
          >
            {simulateMode ? 'Disable Simulator' : 'Simulate Staff Mode'}
          </button>
        </div>
      </div>

      {/* RENDER CONVERSION SCREEN (EMPTY STATE) IF NOT STAFF */}
      {!activeRole ? (
        <div className="max-w-2xl mx-auto my-8">
          <div className="bg-surface border border-gray-800/80 rounded-2xl p-8 md:p-10 shadow-2xl text-center space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon/5 rounded-bl-full pointer-events-none transition-all group-hover:scale-110" />

            <div className="w-16 h-16 rounded-full bg-neon/15 border border-neon/30 flex items-center justify-center mx-auto text-neon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
                <path d="M22 10v6M2 10v6M12 2v20M2 10h20M2 16h20" />
              </svg>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold text-primary tracking-wide">
                BRING GRAPPLETRACK TO YOUR ACADEMY
              </h2>
              <p className="text-xs text-secondary leading-relaxed max-w-lg mx-auto">
                Unlock direct curriculum integration, custom training logs for your roster, and hands-free voice notes from your head coach to lock details instantly.
              </p>
            </div>
            
            <p className="text-xs text-secondary italic">
              Go to your Profile and register or request access to a gym, or toggle simulator mode above to explore dashboards.
            </p>
          </div>
        </div>
      ) : (
        /* RENDER ROLE SPECIFIC STAFF DASHBOARD */
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* TEACHER DASHBOARD VIEW */}
          {activeRole === 'Teacher' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Left 2 Columns: Roster and Logs feedback */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Gym Student Roster */}
                <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-neon" />
                    ACADEMY ROSTER
                  </h2>
                  <p className="text-xs text-secondary leading-relaxed">
                    Select a student from your gym location roster to view their training history ledger and leave tactical feedback critiques.
                  </p>

                  {studentRoster.length === 0 ? (
                    <div className="p-6 bg-main/30 border border-gray-850 border-dashed rounded-xl text-center">
                      <p className="text-xs text-secondary italic">No students are currently affiliated with your gym.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {studentRoster.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => handleSelectStudent(student)}
                          className={`text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                            selectedRosterStudent?.id === student.id
                              ? 'bg-neon/10 border-neon text-neon'
                              : 'bg-main/30 border-gray-800 text-primary hover:border-gray-700'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-bold block">{student.name || 'Anonymous Student'}</span>
                            <span className="text-[10px] text-secondary">@{student.username}</span>
                          </div>
                          <span className="text-[9px] bg-surface px-2.5 py-0.5 rounded border border-gray-800 text-secondary uppercase font-semibold">
                            {student.current_rank}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Student training logs and reviews */}
                {selectedRosterStudent && (
                  <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                      <h3 className="text-md font-bold text-primary">
                        TRAINING LEDGER: {selectedRosterStudent.name || selectedRosterStudent.username}
                      </h3>
                      <button
                        onClick={() => setSelectedRosterStudent(null)}
                        className="text-xs text-secondary hover:text-primary"
                      >
                        Clear Selection [x]
                      </button>
                    </div>

                    {studentLogsLoading ? (
                      <div className="flex justify-center py-12">
                        <div className="w-8 h-8 rounded-full border-2 border-neon border-t-transparent animate-spin" />
                      </div>
                    ) : selectedStudentLogs.length === 0 ? (
                      <p className="text-xs text-secondary italic text-center py-6">No training logs recorded for this student.</p>
                    ) : (
                      <div className="space-y-6">
                        {selectedStudentLogs.map((log) => (
                          <div key={log.id} className="bg-main/20 border border-gray-850 p-5 rounded-2xl space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-850 pb-2.5 gap-2">
                              <div>
                                <span className="text-[10px] text-secondary block">{new Date(log.created_at).toLocaleDateString()}</span>
                                <span className="text-xs font-bold text-primary">Notes: "{log.notes || 'Independent session'}"</span>
                              </div>
                              <span className="text-[9px] bg-neon/10 border border-neon/30 text-neon px-2.5 py-0.5 rounded uppercase font-bold self-start sm:self-auto">
                                {log.attire_type}
                              </span>
                            </div>

                            {/* Rounds list preview */}
                            <div className="space-y-2">
                              {log.rounds?.map((round: any) => (
                                <div key={round.id} className="bg-surface/50 border border-gray-850 p-3 rounded-lg text-xs flex justify-between gap-4">
                                  <div>
                                    <span className="font-bold text-primary">Round #{round.round_index} ({round.modality})</span>
                                    <span className="text-secondary block mt-0.5">Partner: {round.partner_name} ({round.partner_belt} Belt)</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-secondary block">{round.duration_minutes} Mins</span>
                                    {round.executed_techniques?.map((t: any) => (
                                      <span key={t.id} className="text-[10px] text-neon block mt-0.5">
                                        Focus: {t.starting_position ? `[${t.starting_position}] ${t.technique_name}` : t.technique_name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Critique editor box */}
                            {selectedLogForFeedback?.id === log.id ? (
                              <form onSubmit={handlePublishCritique} className="p-4 bg-main/50 border border-neon/20 rounded-xl space-y-4">
                                <span className="text-[10px] text-neon font-bold uppercase tracking-wider block">Write Coaching Feedback</span>
                                
                                <textarea
                                  rows={3}
                                  value={writtenFeedback}
                                  onChange={(e) => setWrittenFeedback(e.target.value)}
                                  placeholder="Review technique executions, sweeps, posture correction, etc..."
                                  className="w-full bg-main border border-gray-800 rounded-lg p-3 text-xs text-primary focus:outline-none focus:border-neon"
                                />

                                {/* Audio Recorder Loop */}
                                <div className="p-3 bg-surface/50 border border-gray-800 rounded-lg space-y-3">
                                  <span className="text-[9px] text-secondary font-bold uppercase tracking-widest block">Voice Critique (10s max)</span>
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={isRecording ? stopRecording : startRecording}
                                      className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all ${
                                        isRecording
                                          ? 'bg-red-600 text-primary animate-pulse'
                                          : 'bg-neon text-main'
                                      }`}
                                    >
                                      {isRecording ? `Stop (${recordingSeconds}s)` : 'Record Voice'}
                                    </button>
                                    {audioUrl && (
                                      <audio src={audioUrl} controls className="h-6 w-full max-w-[200px]" />
                                    )}
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <button type="submit" className="bg-neon text-main text-xs font-bold px-4 py-2 rounded-lg">Publish</button>
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedLogForFeedback(null); setWrittenFeedback(''); setAudioUrl(null); }}
                                    className="text-secondary text-xs hover:text-primary px-3 py-2"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <button
                                onClick={() => setSelectedLogForFeedback(log)}
                                className="bg-neon/15 border border-neon/30 text-neon hover:bg-neon hover:text-main text-[10px] font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
                              >
                                📝 Append Technical Correction / Critique Review
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Right Column: Curriculum Broadcaster */}
              <div className="space-y-8">
                
                {/* Broadcast form */}
                <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-md font-bold text-primary flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-neon" />
                    CURRICULUM BROADCASTER
                  </h2>
                  <p className="text-xs text-secondary leading-relaxed">
                    Post active lesson topic template. Affiliated students will see this lesson pre-populated when logging sessions.
                  </p>

                  <form onSubmit={handleBroadcastCurriculum} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Week Partition Topic</label>
                      <input
                        type="text"
                        required
                        value={weekTopic}
                        onChange={(e) => setWeekTopic(e.target.value)}
                        placeholder="e.g. Week 1: Half Guard Sweep"
                        className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Lesson Focus</label>
                      <input
                        type="text"
                        required
                        value={lessonTopic}
                        onChange={(e) => setLessonTopic(e.target.value)}
                        placeholder="e.g. Scissor Sweep and Knee Shield"
                        className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary focus:outline-none"
                      />
                    </div>
                    <button type="submit" className="w-full bg-neon text-main font-bold text-xs py-2.5 rounded-lg shadow-lg">
                      Broadcast to Students
                    </button>
                  </form>
                </div>

                {/* Broadcast log list */}
                <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                  <span className="text-xs font-bold text-secondary uppercase tracking-wider block">History Curriculum Broadcasts</span>
                  {curriculumLessons.length === 0 ? (
                    <p className="text-xs text-secondary italic">No curriculum lessons posted yet.</p>
                  ) : (
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                      {curriculumLessons.map((l) => (
                        <div key={l.id} className="p-3 bg-main/50 border border-gray-855 rounded-lg flex items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-neon font-bold block uppercase">{l.week_topic}</span>
                            <span className="font-semibold text-primary">{l.lesson}</span>
                          </div>
                          <button
                            onClick={() => handleToggleCurriculumActive(l.id, l.is_active)}
                            className={`px-2 py-1 text-[9px] font-bold rounded ${
                              l.is_active
                                ? 'bg-emerald-950/40 text-neon border border-emerald-900/30'
                                : 'bg-surface border border-gray-800 text-secondary'
                            }`}
                          >
                            {l.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ADMIN DASHBOARD VIEW */}
          {activeRole === 'Admin' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Left 2 Columns: Roster Requests & Members management */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Roster Marshall Pending Requests */}
                <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-neon" />
                    ROSTER MARSHALL: ACCESS REQUESTS
                  </h2>
                  <p className="text-xs text-secondary leading-relaxed">
                    Approve or reject student affiliation access requests requesting to link up with your academy profile.
                  </p>

                  {pendingRequests.length === 0 ? (
                    <div className="p-6 bg-main/30 border border-gray-850 border-dashed rounded-xl text-center">
                      <p className="text-xs text-secondary italic">No pending gym access requests at this time.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingRequests.map((request) => (
                        <div
                          key={request.id}
                          className="p-4 bg-main/40 border border-gray-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div>
                            <span className="text-xs font-bold text-primary block">
                              {request.profiles?.name || 'New Grappler'}
                            </span>
                            <span className="text-[10px] text-secondary">
                              @{request.profiles?.username} • Rank: {request.profiles?.current_rank}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveRequest(request)}
                              className="bg-neon text-main text-[10px] font-bold px-4.5 py-1.5 rounded-lg"
                            >
                              Approve Student
                            </button>
                            <button
                              onClick={() => handleRejectRequest(request.id)}
                              className="bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/40 text-[10px] font-bold px-4.5 py-1.5 rounded-lg"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active Roster List */}
                <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                  <span className="text-xs font-bold text-secondary uppercase tracking-wider block">Active Roster Members</span>
                  {activeGymMembers.length === 0 ? (
                    <p className="text-xs text-secondary italic">No active memberships on roster.</p>
                  ) : (
                    <div className="border border-gray-850 rounded-xl divide-y divide-gray-850 overflow-hidden bg-main/30">
                      {activeGymMembers.map((member) => (
                        <div key={member.user_id} className="p-4 flex items-center justify-between gap-4">
                          <div>
                            <span className="text-xs font-bold text-primary block">{member.profiles?.name || 'Member'}</span>
                            <span className="text-[10px] text-secondary">@{member.profiles?.username} • Role: {member.role_token}</span>
                          </div>
                          {member.user_id !== session.user.id && (
                            <button
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/40 text-[10px] font-bold px-3 py-1 rounded"
                            >
                              Remove Member
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column: Gym Location and Invite generators */}
              <div className="space-y-8">
                
                {/* Staff Provisioner */}
                <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-md font-bold text-primary flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-neon" />
                    STAFF PROVISIONER
                  </h2>
                  <p className="text-xs text-secondary leading-relaxed">
                    Generate single-use invitation links for new students or teachers. Claiming code promotes role.
                  </p>

                  <form onSubmit={handleGenerateInvite} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Invitee Email</label>
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Assigned Target Role</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as any)}
                        className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary focus:outline-none"
                      >
                        <option value="User-Student">Student Affiliation</option>
                        <option value="Teacher">Teacher operational role</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full bg-neon text-main font-bold text-xs py-2.5 rounded-lg shadow-lg">
                      Generate Code & Link
                    </button>
                  </form>

                  {generatedInviteLink && (
                    <div className="p-4 bg-neon/5 border border-neon/20 rounded-xl space-y-2 mt-4 text-xs font-mono">
                      <div className="flex justify-between font-bold text-neon">
                        <span>Code:</span>
                        <span>{generatedInviteCode}</span>
                      </div>
                      <div className="mt-1 flex flex-col gap-1">
                        <span className="text-[10px] text-secondary uppercase">Link (Click to copy):</span>
                        <span
                          onClick={() => { navigator.clipboard.writeText(generatedInviteLink); alert('Link copied to clipboard!'); }}
                          className="text-[10px] text-primary underline break-all cursor-pointer select-all"
                        >
                          {generatedInviteLink}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Location Manager */}
                <div className="bg-surface border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-md font-bold text-primary flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-neon" />
                    LOCATION MANAGER
                  </h2>
                  <p className="text-xs text-secondary leading-relaxed">
                    Create, modify, or append new Gym Location profiles under your sub-tenant structure.
                  </p>

                  <form onSubmit={handleCreateGym} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Gym Name</label>
                      <input
                        type="text"
                        required
                        value={newGymName}
                        onChange={(e) => setNewGymName(e.target.value)}
                        placeholder="e.g. Gracie Barra South"
                        className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Gym Address</label>
                      <input
                        type="text"
                        value={newGymAddress}
                        onChange={(e) => setNewGymAddress(e.target.value)}
                        placeholder="e.g. 500 South Congress, Austin TX"
                        className="w-full bg-main border border-gray-800 rounded-lg px-4 py-2 text-xs text-primary focus:outline-none"
                      />
                    </div>
                    <button type="submit" className="w-full bg-neon text-main font-bold text-xs py-2.5 rounded-lg shadow-lg">
                      Register Location Profile
                    </button>
                  </form>
                </div>

              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
