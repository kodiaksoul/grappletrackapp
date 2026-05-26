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

    if (!profile || profile.access_role !== 'Master Admin') {
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

    if (!profile || profile.access_role !== 'Master Admin') {
      throw new Error('Unauthorized.');
    }

    // --- 24-Hour Auto-Cleanup ---
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredRequests } = await supabaseAdmin
      .from('beta_access_requests')
      .select('*')
      .eq('status', 'approved')
      .lt('updated_at', twentyFourHoursAgo);

    if (expiredRequests && expiredRequests.length > 0) {
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const users = usersData?.users || [];

        for (const req of expiredRequests) {
          const user = users.find(u => u.email?.toLowerCase() === req.email.toLowerCase());
          if (user) {
            if (!user.last_sign_in_at) {
              // User exists in auth but hasn't logged in -> delete user and request
              await supabaseAdmin.auth.admin.deleteUser(user.id);
              await supabaseAdmin.from('beta_access_requests').delete().eq('id', req.id);
            }
          } else {
            // User does not exist in auth -> just delete the request
            await supabaseAdmin.from('beta_access_requests').delete().eq('id', req.id);
          }
        }
      } catch (err) {
        console.error('Error during auto-cleanup listUsers:', err);
      }
    }
    // -----------------------------

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

    if (!profile || profile.access_role !== 'Master Admin') {
      throw new Error('Unauthorized.');
    }

    // Fetch email of the request
    const { data: requestData, error: fetchReqError } = await supabaseAdmin
      .from('beta_access_requests')
      .select('email')
      .eq('id', requestId)
      .single();

    if (fetchReqError || !requestData) {
      throw new Error('Beta request not found.');
    }

    const email = requestData.email;
    const code = `BETA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Update status and code
    const { error } = await supabaseAdmin
      .from('beta_access_requests')
      .update({
        status: 'approved',
        code: code,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (error) throw error;

    // Trigger Supabase Invite email (uses the Brevo SMTP server configured inside Supabase)
    try {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/profile?beta_code=${code}`,
        data: {
          beta_code: code
        }
      });
    } catch (inviteErr: any) {
      console.error('Failed to send Supabase Auth invite email:', inviteErr);
      return { 
        success: false, 
        error: `Database approved, but invite email failed: ${inviteErr.message || JSON.stringify(inviteErr)}. ` +
               `Please make sure the 'Sender email' in your Supabase Auth settings is verified in your Brevo account.`
      };
    }

    return { success: true, code };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteBetaRequest(adminId: string, requestId: string) {
  try {
    // Auth check
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('access_role')
      .eq('id', adminId)
      .single();

    if (!profile || profile.access_role !== 'Master Admin') {
      throw new Error('Unauthorized.');
    }

    // Delete the request
    const { error } = await supabaseAdmin
      .from('beta_access_requests')
      .delete()
      .eq('id', requestId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
