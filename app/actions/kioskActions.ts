'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize a Server-Side ONLY Supabase Client using the Service Role Key
// This bypasses RLS policies to allow smooth kiosk operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Fetches all gyms where the user is an authorized staff member (Teacher or Admin).
 */
export async function fetchStaffGyms(userId: string) {
  try {
    // Check if user is a Master Admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('access_role')
      .eq('id', userId)
      .single();

    if (!profileError && profile?.access_role === 'Master Admin') {
      const { data: allGyms, error: allGymsError } = await supabaseAdmin
        .from('gym_locations')
        .select('id, name, address');

      if (allGymsError) throw allGymsError;

      return {
        success: true,
        gyms: (allGyms || []).map((g: any) => ({
          gym_id: g.id,
          role_token: 'Master Admin',
          name: g.name,
          address: g.address || '',
        })),
      };
    }

    const { data, error } = await supabaseAdmin
      .from('gym_memberships')
      .select('gym_id, role_token, gym_locations ( id, name, address )')
      .eq('user_id', userId)
      .in('role_token', ['Teacher', 'Admin']);

    if (error) throw error;

    return {
      success: true,
      gyms: data.map((item: any) => ({
        gym_id: item.gym_id,
        role_token: item.role_token,
        name: item.gym_locations?.name || 'Unknown Gym',
        address: item.gym_locations?.address || '',
      })),
    };
  } catch (err: any) {
    console.error('fetchStaffGyms error:', err);
    return { success: false, error: err.message || 'Failed to fetch staff gyms' };
  }
}

/**
 * Fetches all data needed for the kiosk screen:
 * 1. Roster of students registered at this gym.
 * 2. Active curriculum focus lessons.
 * 3. Today's check-ins so far.
 */
export async function fetchKioskData(gymId: string) {
  try {
    // 1. Fetch student roster
    const { data: memberships, error: rosterError } = await supabaseAdmin
      .from('gym_memberships')
      .select('user_id, profiles:user_id ( id, name, username, current_rank )')
      .eq('gym_id', gymId)
      .eq('role_token', 'Student');

    if (rosterError) throw rosterError;

    const roster = memberships
      .map((m: any) => m.profiles)
      .filter(Boolean);

    // 2. Fetch active curriculum lessons
    const { data: curriculum, error: currError } = await supabaseAdmin
      .from('curriculum_lessons')
      .select('*')
      .eq('gym_id', gymId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (currError) throw currError;

    // 3. Fetch today's checkins
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data: checkins, error: checkinError } = await supabaseAdmin
      .from('gym_checkins')
      .select('id, gym_id, user_id, class_name, week_topic, lesson_topic, created_at, profiles:user_id ( id, name, username, current_rank )')
      .eq('gym_id', gymId)
      .gte('created_at', startOfToday.toISOString())
      .order('created_at', { ascending: false });

    if (checkinError) throw checkinError;

    return {
      success: true,
      roster,
      curriculum: curriculum || [],
      checkins: (checkins || []).map((c: any) => ({
        id: c.id,
        gym_id: c.gym_id,
        user_id: c.user_id,
        class_name: c.class_name,
        week_topic: c.week_topic,
        lesson_topic: c.lesson_topic,
        created_at: c.created_at,
        student: c.profiles || { name: 'Unknown Student', username: 'unknown', current_rank: 'White' },
      })),
    };
  } catch (err: any) {
    console.error('fetchKioskData error:', err);
    return { success: false, error: err.message || 'Failed to fetch kiosk data' };
  }
}

/**
 * Creates a new student check-in event.
 */
export async function createCheckIn(
  gymId: string,
  studentId: string,
  className: string,
  weekTopic: string | null,
  lessonTopic: string | null
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('gym_checkins')
      .insert({
        gym_id: gymId,
        user_id: studentId,
        class_name: className,
        week_topic: weekTopic,
        lesson_topic: lessonTopic,
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, checkInId: data.id };
  } catch (err: any) {
    console.error('createCheckIn error:', err);
    return { success: false, error: err.message || 'Failed to check in student' };
  }
}

/**
 * Deletes a check-in event.
 */
export async function deleteCheckIn(checkInId: string, gymId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('gym_checkins')
      .delete()
      .eq('id', checkInId)
      .eq('gym_id', gymId);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('deleteCheckIn error:', err);
    return { success: false, error: err.message || 'Failed to delete check-in' };
  }
}
