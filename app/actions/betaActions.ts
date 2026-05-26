'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function verifyBetaAccess(email: string, code: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('beta_access_requests')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('code', code.trim().toUpperCase())
      .eq('status', 'approved')
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function requestBetaAccess(email: string) {
  try {
    const { error } = await supabaseAdmin
      .from('beta_access_requests')
      .insert({
        email: email.trim().toLowerCase(),
        status: 'pending'
      });

    if (error) {
      if (error.code === '23505') {
        throw new Error('A request has already been submitted for this email.');
      }
      throw error;
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit request.' };
  }
}

export async function getBetaSettings() {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'beta_mode_enabled')
      .maybeSingle();

    if (error || !data) return false;
    return data.value === 'true';
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function toggleBetaMode(adminId: string, enabled: boolean) {
  try {
    // Auth check
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('access_role')
      .eq('id', adminId)
      .single();

    if (!profile || profile.access_role !== 'Admin') {
      throw new Error('Unauthorized.');
    }

    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert({ key: 'beta_mode_enabled', value: enabled ? 'true' : 'false' });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getBetaRequests(adminId: string) {
  try {
    // Auth check
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('access_role')
      .eq('id', adminId)
      .single();

    if (!profile || profile.access_role !== 'Admin') {
      throw new Error('Unauthorized.');
    }

    const { data, error } = await supabaseAdmin
      .from('beta_access_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, requests: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, requests: [] };
  }
}

export async function approveBetaRequest(adminId: string, requestId: string) {
  try {
    // Auth check
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('access_role')
      .eq('id', adminId)
      .single();

    if (!profile || profile.access_role !== 'Admin') {
      throw new Error('Unauthorized.');
    }

    const code = `BETA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const { error } = await supabaseAdmin
      .from('beta_access_requests')
      .update({
        status: 'approved',
        code: code,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (error) throw error;
    return { success: true, code };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
