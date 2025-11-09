const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file');
}

// Check if using anon key instead of service_role key
try {
  const decoded = JSON.parse(Buffer.from(supabaseServiceKey.split('.')[1], 'base64').toString());
  if (decoded.role === 'anon') {
    console.warn('⚠️  WARNING: Using ANON key instead of SERVICE_ROLE key!');
    console.warn('⚠️  Write operations (user creation, updates) will fail!');
    console.warn('⚠️  Get your SERVICE_ROLE key from: Supabase Dashboard → Settings → API → service_role key');
  }
} catch (e) {
  // Ignore JWT decode errors
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test connection
supabase
  .from('users')
  .select('count')
  .limit(1)
  .then(() => {
    console.log('✅ Supabase connection successful');
  })
  .catch((error) => {
    console.error('❌ Supabase connection failed:', error.message);
    console.log('⚠️  Make sure your Supabase tables are created');
  });

module.exports = supabase;

