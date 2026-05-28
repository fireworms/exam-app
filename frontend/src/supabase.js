import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ksqrnzhdkgpmnahnfzas.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzcXJuemhka2dwbW5haG5memFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTQ3NjIsImV4cCI6MjA5NDc5MDc2Mn0.nh122PaP4mjCNRjqGMum8A9CmVC4Lek-e1hI18GPO38'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  }
})
