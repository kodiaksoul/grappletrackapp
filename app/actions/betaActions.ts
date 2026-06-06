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

export async function getAllowedBetaRoles() {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'allowed_beta_roles')
      .maybeSingle();

    if (error || !data) {
      // By default all are allowed
      return ['User-Free', 'User-Premium', 'User-Student', 'Teacher', 'Admin'];
    }
    return JSON.parse(data.value);
  } catch (e) {
    console.error(e);
    return ['User-Free', 'User-Premium', 'User-Student', 'Teacher', 'Admin'];
  }
}

export async function updateAllowedBetaRoles(adminId: string, roles: string[]) {
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
      .upsert({ key: 'allowed_beta_roles', value: JSON.stringify(roles) });

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

export async function handleInvitedUserSignUp(email: string, password: string, metadata: any) {
  try {
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
    if (existingUser) {
      const isInvited = !existingUser.email_confirmed_at && !existingUser.last_sign_in_at;
      if (isInvited) {
        // Update their password and metadata using service role admin client
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password: password,
          user_metadata: {
            ...metadata,
            beta_code: existingUser.user_metadata?.beta_code || metadata.beta_code
          }
        });
        if (updateError) throw updateError;
        return { success: true, updated: true };
      }
    }
    return { success: true, updated: false };
  } catch (err: any) {
    console.error('Error in handleInvitedUserSignUp:', err);
    return { success: false, error: err.message || 'Failed to check user invitation status.' };
  }
}

export async function updateMasterAdminEmail(adminId: string, contactEmail: string) {
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
      .from('profiles')
      .update({ contact_email: contactEmail.trim().toLowerCase() })
      .eq('id', adminId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitFeedback(userEmail: string, description: string, pathname: string) {
  try {
    // 1. Fetch Master Admin's contact email
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('contact_email')
      .eq('access_role', 'Master Admin')
      .maybeSingle();

    const targetEmail = adminProfile?.contact_email || 'kodiaksoul@grappletrack.com';

    // 2. Check Brevo API Key
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@grappletrackapp.com';
    const senderName = process.env.BREVO_SENDER_NAME || 'GrappleTracker Feedback';

    if (!apiKey) {
      console.warn('⚠️ BREVO_API_KEY is not configured in .env.local. Feedback content:', {
        userEmail,
        description,
        pathname,
        targetEmail
      });
      return { success: true, simulated: true };
    }

    // 3. Send email via Brevo REST API
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail
        },
        to: [
          {
            email: targetEmail
          }
        ],
        subject: `[GrappleTracker Feedback] Issue reported on ${pathname}`,
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #121214; color: #f5f5f5; border: 1px solid #1e1e24; border-radius: 8px;">
            <h2 style="color: #deff9a; border-bottom: 1px solid #1e1e24; padding-bottom: 10px; margin-top: 0;">New User Suggestion/Issue</h2>
            <p style="margin: 15px 0;">A user has submitted an issue or suggestion from the application.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="border-bottom: 1px solid #1e1e24;">
                <td style="padding: 8px 0; font-weight: bold; color: #c2d6c4; width: 120px;">User Email:</td>
                <td style="padding: 8px 0; color: #f5f5f5;">${userEmail || 'Anonymous'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e1e24;">
                <td style="padding: 8px 0; font-weight: bold; color: #c2d6c4;">Location URL:</td>
                <td style="padding: 8px 0; color: #deff9a; font-family: monospace;">${pathname}</td>
              </tr>
            </table>

            <div style="background-color: #1e1e24; border-left: 3px solid #deff9a; padding: 15px; border-radius: 4px; margin-top: 20px;">
              <h3 style="color: #deff9a; margin-top: 0; font-size: 14px; text-transform: uppercase; tracking-wider;">Description:</h3>
              <p style="margin: 0; white-space: pre-wrap; font-size: 13px; line-height: 1.6;">${description}</p>
            </div>
            
            <p style="font-size: 11px; color: #c2d6c4; margin-top: 30px; border-top: 1px solid #1e1e24; padding-top: 15px;">
              This is an automated message sent from GrappleTracker Beta Feedback system.
            </p>
          </div>
        `
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || 'Failed to send email via Brevo');
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error submitting feedback email:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteUserAccount(adminId: string, userId: string) {
  try {
    // Auth check: user can delete their own account, or a Master Admin can delete it.
    if (adminId !== userId) {
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('access_role')
        .eq('id', adminId)
        .single();
      if (!adminProfile || adminProfile.access_role !== 'Master Admin') {
        throw new Error('Unauthorized deletion attempt.');
      }
    }

    // 1. Remove references where this user is logged as a sparring partner
    await supabaseAdmin
      .from('rounds')
      .update({ partner_id: null })
      .eq('partner_id', userId);

    // 2. Remove references where this user verified competition matches
    await supabaseAdmin
      .from('competition_matches')
      .update({ verified_by: null })
      .eq('verified_by', userId);

    // 3. Delete user-owned locations (Gym locations), clean up gym memberships/requests/lessons/invitations first
    const { data: ownedGyms } = await supabaseAdmin
      .from('gym_locations')
      .select('id')
      .eq('owner_id', userId);

    if (ownedGyms && ownedGyms.length > 0) {
      const gymIds = ownedGyms.map(g => g.id);
      await supabaseAdmin.from('gym_memberships').delete().in('gym_id', gymIds);
      await supabaseAdmin.from('gym_access_requests').delete().in('gym_id', gymIds);
      await supabaseAdmin.from('curriculum_lessons').delete().in('gym_id', gymIds);
      await supabaseAdmin.from('gym_invitations').delete().in('gym_id', gymIds);
      await supabaseAdmin.from('gym_locations').delete().in('id', gymIds);
    }

    // 4. Delete friends relations
    await supabaseAdmin
      .from('friends')
      .delete()
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    // 5. Delete direct gym memberships & requests
    await supabaseAdmin.from('gym_memberships').delete().eq('user_id', userId);
    await supabaseAdmin.from('gym_access_requests').delete().eq('user_id', userId);

    // 6. Delete direct curriculum lessons created by this user
    await supabaseAdmin.from('curriculum_lessons').delete().eq('created_by', userId);

    // 7. Delete coach critiques left by this user or written on user's logs
    await supabaseAdmin.from('coach_critiques').delete().eq('coach_id', userId);

    // 8. Find all training logs for user to clear nested round techniques/rounds
    const { data: logs } = await supabaseAdmin
      .from('training_logs')
      .select('id')
      .eq('user_id', userId);

    if (logs && logs.length > 0) {
      const logIds = logs.map(l => l.id);

      const { data: rounds } = await supabaseAdmin
        .from('rounds')
        .select('id')
        .in('log_id', logIds);

      if (rounds && rounds.length > 0) {
        const roundIds = rounds.map(r => r.id);
        // Delete executed techniques under user's rounds
        await supabaseAdmin.from('executed_techniques').delete().in('round_id', roundIds);
        // Delete rounds
        await supabaseAdmin.from('rounds').delete().in('id', roundIds);
      }

      // Delete critiques targeting user's logs
      await supabaseAdmin.from('coach_critiques').delete().in('log_id', logIds);
      // Delete training logs
      await supabaseAdmin.from('training_logs').delete().eq('user_id', userId);
    }

    // 9. Delete personal dictionary custom terms
    await supabaseAdmin.from('personal_dictionary').delete().eq('user_id', userId);

    // 10. Delete competition events & matches
    const { data: compEvents } = await supabaseAdmin
      .from('competition_events')
      .select('id')
      .eq('user_id', userId);

    if (compEvents && compEvents.length > 0) {
      const eventIds = compEvents.map(e => e.id);
      await supabaseAdmin.from('competition_matches').delete().in('event_id', eventIds);
      await supabaseAdmin.from('competition_events').delete().eq('user_id', userId);
    }

    // 11. Delete profile row
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // 12. Delete user from Supabase Auth
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) throw deleteUserError;

    return { success: true };
  } catch (err: any) {
    console.error('Error deleting account:', err);
    return { success: false, error: err.message || 'Failed to delete account.' };
  }
}

export async function searchUserActivity(adminId: string, emailQuery: string) {
  try {
    // 1. Auth check: verify adminId belongs to Master Admin
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('access_role')
      .eq('id', adminId)
      .single();

    if (!adminProfile || adminProfile.access_role !== 'Master Admin') {
      throw new Error('Unauthorized.');
    }

    if (!emailQuery || !emailQuery.trim()) {
      throw new Error('Email query is required.');
    }

    // 2. Search Supabase Auth users list
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000
    });

    if (listError) throw listError;

    const targetUser = users.find(u => 
      u.email?.toLowerCase().includes(emailQuery.trim().toLowerCase())
    );

    if (!targetUser) {
      return { success: true, found: false };
    }

    // 3. Fetch matching profile details
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetUser.id)
      .maybeSingle();

    // 4. Query training logs
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('training_logs')
      .select('id, created_at, date, attire_type, notes')
      .eq('user_id', targetUser.id)
      .order('date', { ascending: false });

    if (logsError) throw logsError;

    // Calculate metrics
    const logCount = logs ? logs.length : 0;
    
    // Distinct training days
    const uniqueDates = new Set(logs ? logs.map(l => l.date || new Date(l.created_at).toISOString().split('T')[0]) : []);
    const activeDays = uniqueDates.size;

    let roundCount = 0;
    let totalMatTime = 0;
    const recentLogsFeed: any[] = [];

    if (logs && logs.length > 0) {
      const logIds = logs.map(l => l.id);
      const { data: rounds, error: roundsError } = await supabaseAdmin
        .from('rounds')
        .select('id, duration_minutes, log_id')
        .in('log_id', logIds);

      if (roundsError) throw roundsError;

      if (rounds) {
        roundCount = rounds.length;
        totalMatTime = rounds.reduce((acc, r) => acc + (r.duration_minutes || 0), 0);

        // Map log IDs to round counts for the recent logs feed
        const roundsByLog = rounds.reduce((acc: Record<string, number>, r) => {
          acc[r.log_id] = (acc[r.log_id] || 0) + 1;
          return acc;
        }, {});

        // Build recent logs (up to 5)
        for (const log of logs.slice(0, 5)) {
          recentLogsFeed.push({
            id: log.id,
            date: log.date || log.created_at,
            attire_type: log.attire_type,
            notes: log.notes,
            roundsCount: roundsByLog[log.id] || 0
          });
        }
      }
    }

    return {
      success: true,
      found: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        created_at: targetUser.created_at,
        last_sign_in_at: targetUser.last_sign_in_at,
        name: profile?.name || 'New Grappler',
        username: profile?.username || 'grappler',
        access_role: profile?.access_role || 'User-Free',
        current_rank: profile?.current_rank || 'White',
        stripes: profile?.stripes || 0
      },
      activity: {
        logCount,
        activeDays,
        roundCount,
        totalMatTime,
        recentLogs: recentLogsFeed
      }
    };
  } catch (err: any) {
    console.error('Error in searchUserActivity:', err);
    return { success: false, error: err.message || 'An error occurred while fetching user activity.' };
  }
}
