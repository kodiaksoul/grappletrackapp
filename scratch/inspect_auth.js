const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ybfyfoyhapyqsboffrfe.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZnlmb3loYXB5cXNib2ZmcmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY2NjI4NywiZXhwIjoyMDk1MjQyMjg3fQ.9xHCyynFwmuJxEoBtbCLbtNDKGQuBtQ0OxLnfx_6xKQ';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  try {
    console.log('1. Fetching users from auth.users...');
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
      console.error('Failed to list auth users:', authError);
      return;
    }

    console.log(`Found ${users.length} users in auth.`);
    users.forEach((user, idx) => {
      console.log(`\nUser #${idx + 1}:`);
      console.log(`- ID: ${user.id}`);
      console.log(`- Email: ${user.email}`);
      console.log(`- Status: ${user.email_confirmed_at ? 'Confirmed' : 'Unconfirmed'} (Confirmed At: ${user.email_confirmed_at})`);
      console.log(`- Created At: ${user.created_at}`);
      console.log(`- User Metadata:`, JSON.stringify(user.user_metadata, null, 2));
    });

    console.log('\n2. Fetching rows from public.profiles...');
    const { data: profiles, error: profileError } = await supabaseAdmin.from('profiles').select('*');
    if (profileError) {
      console.error('Failed to list profiles:', profileError);
      return;
    }

    console.log(`Found ${profiles.length} profiles in public.profiles.`);
    profiles.forEach((profile, idx) => {
      console.log(`\nProfile #${idx + 1}:`);
      console.log(`- ID: ${profile.id}`);
      console.log(`- Name: ${profile.name}`);
      console.log(`- Username: ${profile.username}`);
      console.log(`- Access Role: ${profile.access_role}`);
      console.log(`- Created At: ${profile.created_at}`);
    });

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

run();
