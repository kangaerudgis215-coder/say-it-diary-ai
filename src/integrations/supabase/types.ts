export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          date: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          date: string
          full_diary_challenge_completed: boolean
          id: string
          important_sentences: Json | null
          japanese_summary: string | null
          next_review_date: string | null
          review_count: number | null
          sentences_review_completed: boolean
          updated_at: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          date: string
          full_diary_challenge_completed?: boolean
          id?: string
          important_sentences?: Json | null
          japanese_summary?: string | null
          next_review_date?: string | null
          review_count?: number | null
          sentences_review_completed?: boolean
          updated_at?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          date?: string
          full_diary_challenge_completed?: boolean
          id?: string
          important_sentences?: Json | null
          japanese_summary?: string | null
          next_review_date?: string | null
          review_count?: number | null
          sentences_review_completed?: boolean
          updated_at?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_sentences: {
        Row: {
          created_at: string
          diary_entry_id: string
          english_sentence: string
          id: string
          japanese_sentence: string
          key_expressions: string[]
          sentence_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          diary_entry_id: string
          english_sentence: string
          id?: string
          japanese_sentence?: string
          key_expressions?: string[]
          sentence_index: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          diary_entry_id?: string
          english_sentence?: string
          id?: string
          japanese_sentence?: string
          key_expressions?: string[]
          sentence_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expressions: {
        Row: {
          created_at: string
          diary_entry_id: string | null
          example_sentence: string | null
          expression: string
          id: string
          is_user_added: boolean
          mastery_level: number | null
          meaning: string | null
          pos_or_type: string | null
          scene_or_context: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          diary_entry_id?: string | null
          example_sentence?: string | null
          expression: string
          id?: string
          is_user_added?: boolean
          mastery_level?: number | null
          meaning?: string | null
          pos_or_type?: string | null
          scene_or_context?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          diary_entry_id?: string | null
          example_sentence?: string | null
          expression?: string
          id?: string
          is_user_added?: boolean
          mastery_level?: number | null
          meaning?: string | null
          pos_or_type?: string | null
          scene_or_context?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expressions_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      full_diary_attempts: {
        Row: {
          created_at: string
          diary_entry_id: string
          id: string
          rating: string
          total_expressions_count: number
          used_expressions_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          diary_entry_id: string
          id?: string
          rating?: string
          total_expressions_count?: number
          used_expressions_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          diary_entry_id?: string
          id?: string
          rating?: string
          total_expressions_count?: number
          used_expressions_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "full_diary_attempts_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_composition_attempts: {
        Row: {
          created_at: string
          diary_entry_id: string
          fluency_grade: string | null
          id: string
          meaning_grade: string | null
          passed: boolean | null
          sentence_index: number
          structure_grade: string | null
          user_answer: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          diary_entry_id: string
          fluency_grade?: string | null
          id?: string
          meaning_grade?: string | null
          passed?: boolean | null
          sentence_index: number
          structure_grade?: string | null
          user_answer?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          diary_entry_id?: string
          fluency_grade?: string | null
          id?: string
          meaning_grade?: string | null
          passed?: boolean | null
          sentence_index?: number
          structure_grade?: string | null
          user_answer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_composition_attempts_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          current_streak: number | null
          display_name: string | null
          id: string
          last_diary_date: string | null
          longest_streak: number | null
          total_diary_entries: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number | null
          display_name?: string | null
          id?: string
          last_diary_date?: string | null
          longest_streak?: number | null
          total_diary_entries?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number | null
          display_name?: string | null
          id?: string
          last_diary_date?: string | null
          longest_streak?: number | null
          total_diary_entries?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recall_sessions: {
        Row: {
          completed: boolean | null
          created_at: string
          diary_entry_id: string
          hints_used: string[] | null
          id: string
          missed_expressions: string[] | null
          score: number | null
          used_expressions: string[] | null
          user_attempt: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          diary_entry_id: string
          hints_used?: string[] | null
          id?: string
          missed_expressions?: string[] | null
          score?: number | null
          used_expressions?: string[] | null
          user_attempt?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          diary_entry_id?: string
          hints_used?: string[] | null
          id?: string
          missed_expressions?: string[] | null
          score?: number | null
          used_expressions?: string[] | null
          user_attempt?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recall_sessions_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      spoken_vocabulary_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          unique_words: string[] | null
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          unique_words?: string[] | null
          updated_at?: string
          user_id: string
          word_count?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          unique_words?: string[] | null
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_user_streak: {
        Args: { p_user_id: string }
        Returns: {
          current_streak: number
          longest_streak: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
