import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nsmtbievhawicvccnuvh.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbXRiaWV2aGF3aWN2Y2NudXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MDkyOTYsImV4cCI6MjA5OTQ4NTI5Nn0.Boal-dz0iPZKRJ9InpaDh6Vwn1Tun3OfBQFI05VMYxE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
