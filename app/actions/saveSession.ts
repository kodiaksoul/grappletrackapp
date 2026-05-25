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
}

interface RoundEntry {
  roundIndex: number;
  modality: 'Positional' | 'Full Roll';
  startingPosition: string | null;
  durationMinutes: number;
  partnerName: string;
  partnerBelt: string;
  partnerWeight: string;
  techniques: TechniqueEntry[];
  notes: string | null;
}

export async function saveTrainingSession(
  userId: string,
  attireType: string,
  sessionNotes: string,
  allRounds: RoundEntry[]
) {
  try {
    // 1. Insert into training_logs
    const { data: logData, error: logError } = await supabaseAdmin
      .from('training_logs')
      .insert({
        user_id: userId,
        attire_type: attireType,
        notes: sessionNotes,
      })
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
