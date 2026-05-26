'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function fetchUserHistory(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('training_logs')
      .select(`
        id,
        created_at,
        attire_type,
        notes,
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

    if (error) {
      throw new Error(`Database Fetch Error: ${error.message}`);
    }

    return data;
  } catch (err: any) {
    console.error("SERVER ACTION FETCH ERROR:", err);
    throw new Error(err.message || 'Unknown server error during fetch');
  }
}
