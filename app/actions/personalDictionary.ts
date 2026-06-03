'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function fetchPersonalDictionary(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('personal_dictionary')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, terms: data || [] };
  } catch (err: any) {
    console.error("fetchPersonalDictionary Error:", err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function savePersonalTerm(
  userId: string,
  term: { id?: string; term_name: string; term_type: 'Position' | 'Technique'; description?: string }
) {
  try {
    const payload: any = {
      user_id: userId,
      term_name: term.term_name,
      term_type: term.term_type,
      description: term.description || null
    };

    if (term.id) {
      payload.id = term.id;
    }

    const { data, error } = await supabaseAdmin
      .from('personal_dictionary')
      .upsert(payload, { onConflict: 'user_id,term_name,term_type' })
      .select()
      .single();

    if (error) throw error;
    return { success: true, term: data };
  } catch (err: any) {
    console.error("savePersonalTerm Error:", err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function deletePersonalTerm(userId: string, termId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('personal_dictionary')
      .delete()
      .eq('id', termId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("deletePersonalTerm Error:", err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}
