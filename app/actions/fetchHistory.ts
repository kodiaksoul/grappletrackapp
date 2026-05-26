'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function fetchUserHistory(userId: string) {
  try {
    // 1. Fetch user role to determine limits
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('access_role')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error(`Profile Fetch Error: ${profileError.message}`);
    }

    const accessRole = profile?.access_role || 'User-Free';
    const isFree = accessRole === 'User-Free';
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    // 2. Fetch logs with optional 10-day rolling window filter
    let query = supabaseAdmin
      .from('training_logs')
      .select(`
        id,
        created_at,
        attire_type,
        notes,
        coach_critiques (
          id,
          feedback,
          audio_url,
          created_at,
          profiles:coach_id (
            id,
            name,
            username
          )
        ),
        rounds (
          id,
          round_index,
          modality,
          starting_position,
          duration_minutes,
          partner_name,
          partner_belt,
          partner_weight,
          partner_gender,
          partner_height,
          notes,
          executed_techniques (
            id,
            technique_name,
            is_successful,
            resistance_level,
            match_video_url
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (isFree) {
      query = query.gte('created_at', tenDaysAgo);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database Fetch Error: ${error.message}`);
    }

    // 3. Count hidden logs if user is on Free tier
    let hiddenCount = 0;
    if (isFree) {
      const { count, error: countError } = await supabaseAdmin
        .from('training_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lt('created_at', tenDaysAgo);

      if (!countError && count !== null) {
        hiddenCount = count;
      }
    }

    return { logs: data || [], hiddenCount };
  } catch (err: any) {
    console.error("SERVER ACTION FETCH ERROR:", err);
    throw new Error(err.message || 'Unknown server error during fetch');
  }
}
