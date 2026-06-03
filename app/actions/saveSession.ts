'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize a Server-Side ONLY Supabase Client using the Service Role Key
// This completely bypasses all RLS policies (including the infinite recursion loop)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TechniqueEntry {
  name: string;
  isSuccessful: boolean;
  resistanceLevel: 'Easy' | 'Moderate' | 'Difficult' | null;
  startingPosition?: string | null;
  type?: 'Takedown' | 'Sweep' | 'Submission' | 'Escape' | null;
}

interface RoundEntry {
  roundIndex: number;
  modality: 'Positional' | 'Full Roll';
  startingPosition: string | null;
  durationMinutes: number;
  partnerName: string;
  partnerBelt: string;
  partnerWeight: string;
  partnerGender?: string;
  partnerHeight?: string;
  techniques: TechniqueEntry[];
  notes: string | null;
}

export async function saveTrainingSession(
  userId: string,
  attireType: string,
  sessionNotes: string,
  allRounds: RoundEntry[],
  createdAt?: string,
  customTerms?: { term_name: string; term_type: 'Position' | 'Technique' }[]
) {
  try {
    if (customTerms && customTerms.length > 0) {
      const inserts = customTerms.map(ct => ({
        user_id: userId,
        term_name: ct.term_name,
        term_type: ct.term_type,
        description: 'Added via training log session focus.'
      }));
      
      const { error: dictError } = await supabaseAdmin
        .from('personal_dictionary')
        .upsert(inserts, { onConflict: 'user_id,term_name,term_type' });
        
      if (dictError) {
        console.error("🔴 PERSONAL DICTIONARY INSERTION REJECTED:", dictError);
      }
    }

    // 1. Insert into training_logs
    const insertPayload: any = {
      user_id: userId,
      attire_type: attireType,
      notes: sessionNotes,
    };
    if (createdAt) {
      insertPayload.created_at = createdAt;
    }

    const { data: logData, error: logError } = await supabaseAdmin
      .from('training_logs')
      .insert(insertPayload)
      .select()
      .single();

    if (logError) {
      console.error("🔴 LOG HEADER INSERTION REJECTED:", logError);
      throw new Error(`Log Header Error: ${logError.message}`);
    }

    const logId = logData.id;

    // 2. Insert rounds sequentially
    for (const round of allRounds) {
      const { data: roundData, error: roundError } = await supabaseAdmin
        .from('rounds')
        .insert({
          log_id: logId,
          round_index: round.roundIndex,
          modality: round.modality,
          starting_position: round.startingPosition || null,
          duration_minutes: round.durationMinutes,
          partner_name: round.partnerName,
          partner_belt: round.partnerBelt,
          partner_weight: round.partnerWeight,
          partner_gender: round.partnerGender || null,
          partner_height: round.partnerHeight || null,
          notes: round.notes || null,
        })
        .select()
        .single();

      if (roundError) {
        console.error("🔴 ROUND CARD INSERTION REJECTED:", roundError);
        throw new Error(`Round Insertion Error: ${roundError.message}`);
      }

      const roundId = roundData.id;

      // 3. Insert executed techniques
      if (round.techniques.length > 0) {
        const techInserts = round.techniques.map((t) => ({
          round_id: roundId,
          technique_name: t.name,
          is_successful: t.isSuccessful,
          resistance_level: t.resistanceLevel,
          starting_position: t.startingPosition || null,
          technique_type: t.type || null,
        }));

        const { error: techError } = await supabaseAdmin
          .from('executed_techniques')
          .insert(techInserts);

        if (techError) {
          console.error("🔴 TECHNIQUE TAGS INSERTION REJECTED:", techError);
          throw new Error(`Technique Insertion Error: ${techError.message}`);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("SERVER ACTION ERROR:", err);
    throw new Error(err.message || 'Unknown server error during save');
  }
}

export async function updateTrainingLog(
  userId: string,
  log: {
    id: string;
    attire_type: 'Gi' | 'No-Gi';
    notes: string | null;
    rounds: {
      id: string;
      modality: 'Positional' | 'Full Roll';
      starting_position: string | null;
      duration_minutes: number;
      partner_name: string;
      partner_belt: string;
      partner_weight: string;
      partner_gender: string | null;
      partner_height: string | null;
      notes: string | null;
      executed_techniques: {
        id: string;
        technique_name: string;
        is_successful: boolean;
        resistance_level: 'Easy' | 'Moderate' | 'Difficult' | null;
        technique_type?: 'Takedown' | 'Sweep' | 'Submission' | 'Escape' | null;
        match_video_url?: string | null;
        starting_position?: string | null;
      }[];
    }[];
  }
) {
  try {
    // 1. Update training_logs header
    const { error: logError } = await supabaseAdmin
      .from('training_logs')
      .update({
        attire_type: log.attire_type,
        notes: log.notes,
      })
      .eq('id', log.id)
      .eq('user_id', userId);

    if (logError) throw logError;

    // 2. Loop through rounds and update each
    for (const round of log.rounds) {
      const { error: roundError } = await supabaseAdmin
        .from('rounds')
        .update({
          modality: round.modality,
          starting_position: round.starting_position,
          duration_minutes: round.duration_minutes,
          partner_name: round.partner_name,
          partner_belt: round.partner_belt,
          partner_weight: round.partner_weight,
          partner_gender: round.partner_gender,
          partner_height: round.partner_height,
          notes: round.notes,
        })
        .eq('id', round.id)
        .eq('log_id', log.id);

      if (roundError) throw roundError;

      // 3. Loop through techniques and update each
      for (const tech of round.executed_techniques) {
        const { error: techError } = await supabaseAdmin
          .from('executed_techniques')
          .update({
            technique_name: tech.technique_name,
            is_successful: tech.is_successful,
            resistance_level: tech.resistance_level,
            technique_type: tech.technique_type || null,
            match_video_url: tech.match_video_url || null,
            starting_position: tech.starting_position || null,
          })
          .eq('id', tech.id)
          .eq('round_id', round.id);

        if (techError) throw techError;
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("updateTrainingLog Error:", err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}
