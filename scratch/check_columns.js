const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ybfyfoyhapyqsboffrfe.supabase.co';
// Using the anon key to check table definition (or we can just query a single profile row)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZnlmb3loYXB5cXNib2ZmcmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjYyODcsImV4cCI6MjA5NTI0MjI4N30.rq97pc1OTslycNC1D4WaSWpJWqpyzc0D_neQ9n2UP4s';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    console.log('Querying profiles columns...');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying profiles:', error);
    } else {
      console.log('Query succeeded. Column names in returned data:', Object.keys(data[0] || {}));
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

run();
