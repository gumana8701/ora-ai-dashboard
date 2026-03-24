import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type MessageQueue = {
  id: string
  contact_id: string
  message: string
  contact_name: string | null
  ai_response: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  tokens_used: number
  cost_usd: number
  created_at: string
  processed_at: string | null
}

export type Chat = {
  id: number
  session_id: string
  message: { type: string; content: string }
  created_at: string
}
