const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ybfyfoyhapyqsboffrfe.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZnlmb3loYXB5cXNib2ZmcmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY2NjI4NywiZXhwIjoyMDk1MjQyMjg3fQ.9xHCyynFwmuJxEoBtbCLbtNDKGQuBtQ0OxLnfx_6xKQ';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZnlmb3loYXB5cXNib2ZmcmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjYyODcsImV4cCI6MjA5NTI0MjI4N30.rq97pc1OTslycNC1D4WaSWpJWqpyzc0D_neQ9n2UP4s';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  const testEmail = `test_invite_${Date.now()}@grappletrack.com`;
  const testPassword = 'testPassword123!';
  
  try {
    console.log(`1. Inviting user ${testEmail}...`);
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(testEmail, {
      redirectTo: 'http://localhost:3000/profile',
      data: { beta_code: 'TEST-BETA' }
    });

    if (inviteError) {
      console.error('Invite failed:', inviteError);
      return;
    }
    console.log('Invite succeeded. User status in auth is invited.');

    console.log(`\n2. Attempting to sign up the invited user ${testEmail} using client signUp...`);
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: { name: 'Test Invited User', access_role: 'User-Premium' }
      }
    });

    if (signUpError) {
      console.log('signUp returned an error:', signUpError.status, signUpError.message);
    } else {
      console.log('signUp succeeded!', JSON.stringify(signUpData, null, 2));
    }

    // Cleanup
    if (inviteData && inviteData.user) {
      console.log('\n3. Cleaning up test user...');
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

run();
