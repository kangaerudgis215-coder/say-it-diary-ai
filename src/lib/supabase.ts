import { supabase } from "@/integrations/supabase/client";

export { supabase };

// Helper types for database operations
export type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  current_streak: number;
  longest_streak: number;
  total_diary_entries: number;
  last_diary_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  date: string;
  status: 'active' | 'completed';
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type DiaryEntry = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  date: string;
  content: string;
  japanese_summary: string | null;
  word_count: number;
  next_review_date: string | null;
  review_count: number;
  created_at: string;
  updated_at: string;
};

export type Expression = {
  id: string;
  user_id: string;
  diary_entry_id: string | null;
  expression: string;
  meaning: string | null;
  example_sentence: string | null;
  mastery_level: number;
  created_at: string;
};

export type RecallSession = {
  id: string;
  user_id: string;
  diary_entry_id: string;
  user_attempt: string | null;
  hints_used: string[];
  completed: boolean;
  created_at: string;
};
