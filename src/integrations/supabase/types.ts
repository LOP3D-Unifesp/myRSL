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
      articles: {
        Row: {
          abstract: string | null
          age_range: string | null
          amputation_cause: string[] | null
          amputation_level: string[] | null
          author: string | null
          control_strategy: string[] | null
          country: string | null
          created_at: string
          dof: string | null
          doi: string | null
          feedback_modalities: string[] | null
          feedback_modalities_text: string | null
          first_author: string | null
          functional_tests: string[] | null
          gaps: string | null
          growth_accommodation: string | null
          has_pediatric_participants: string | null
          id: string
          is_draft: boolean
          last_author: string | null
          manufacturing_method: string | null
          pdf_url: string | null
          pediatric_approach: string | null
          primary_research_question: string | null
          prosthesis_level: string | null
          prosthesis_name: string | null
          publication_place: string | null
          publication_type: string | null
          q1: string | null
          q2: string | null
          q3: string | null
          q4: string | null
          q5: string | null
          qa_q1: string | null
          qa_q10: string | null
          qa_q2: string | null
          qa_q3: string | null
          qa_q4: string | null
          qa_q5: string | null
          qa_q6: string | null
          qa_q7: string | null
          qa_q8: string | null
          qa_q9: string | null
          qa_score: number | null
          quantitative_results: string | null
          research_questions: string[] | null
          review_status: string
          sample_size: number | null
          sensors: string[] | null
          sensors_used: string | null
          setting: string[] | null
          statistical_tests_performed: string | null
          statistical_tests_specified: string | null
          study_design: string | null
          study_id: string | null
          technical_challenges: string | null
          technical_innovation: string | null
          title: string | null
          universities: string | null
          updated_at: string
          usage_outcomes: string | null
          user_id: string
          verify_peer1: boolean
          verify_peer2: boolean
          verify_qa3: boolean
          verify_qa4: boolean
          year: number | null
        }
        Insert: {
          abstract?: string | null
          age_range?: string | null
          amputation_cause?: string[] | null
          amputation_level?: string[] | null
          author?: string | null
          control_strategy?: string[] | null
          country?: string | null
          created_at?: string
          dof?: string | null
          doi?: string | null
          feedback_modalities?: string[] | null
          feedback_modalities_text?: string | null
          first_author?: string | null
          functional_tests?: string[] | null
          gaps?: string | null
          growth_accommodation?: string | null
          has_pediatric_participants?: string | null
          id?: string
          is_draft?: boolean
          last_author?: string | null
          manufacturing_method?: string | null
          pdf_url?: string | null
          pediatric_approach?: string | null
          primary_research_question?: string | null
          prosthesis_level?: string | null
          prosthesis_name?: string | null
          publication_place?: string | null
          publication_type?: string | null
          q1?: string | null
          q2?: string | null
          q3?: string | null
          q4?: string | null
          q5?: string | null
          qa_q1?: string | null
          qa_q10?: string | null
          qa_q2?: string | null
          qa_q3?: string | null
          qa_q4?: string | null
          qa_q5?: string | null
          qa_q6?: string | null
          qa_q7?: string | null
          qa_q8?: string | null
          qa_q9?: string | null
          qa_score?: number | null
          quantitative_results?: string | null
          research_questions?: string[] | null
          review_status?: string
          sample_size?: number | null
          sensors?: string[] | null
          sensors_used?: string | null
          setting?: string[] | null
          statistical_tests_performed?: string | null
          statistical_tests_specified?: string | null
          study_design?: string | null
          study_id?: string | null
          technical_challenges?: string | null
          technical_innovation?: string | null
          title?: string | null
          universities?: string | null
          updated_at?: string
          usage_outcomes?: string | null
          user_id: string
          verify_peer1?: boolean
          verify_peer2?: boolean
          verify_qa3?: boolean
          verify_qa4?: boolean
          year?: number | null
        }
        Update: {
          abstract?: string | null
          age_range?: string | null
          amputation_cause?: string[] | null
          amputation_level?: string[] | null
          author?: string | null
          control_strategy?: string[] | null
          country?: string | null
          created_at?: string
          dof?: string | null
          doi?: string | null
          feedback_modalities?: string[] | null
          feedback_modalities_text?: string | null
          first_author?: string | null
          functional_tests?: string[] | null
          gaps?: string | null
          growth_accommodation?: string | null
          has_pediatric_participants?: string | null
          id?: string
          is_draft?: boolean
          last_author?: string | null
          manufacturing_method?: string | null
          pdf_url?: string | null
          pediatric_approach?: string | null
          primary_research_question?: string | null
          prosthesis_level?: string | null
          prosthesis_name?: string | null
          publication_place?: string | null
          publication_type?: string | null
          q1?: string | null
          q2?: string | null
          q3?: string | null
          q4?: string | null
          q5?: string | null
          qa_q1?: string | null
          qa_q10?: string | null
          qa_q2?: string | null
          qa_q3?: string | null
          qa_q4?: string | null
          qa_q5?: string | null
          qa_q6?: string | null
          qa_q7?: string | null
          qa_q8?: string | null
          qa_q9?: string | null
          qa_score?: number | null
          quantitative_results?: string | null
          research_questions?: string[] | null
          review_status?: string
          sample_size?: number | null
          sensors?: string[] | null
          sensors_used?: string | null
          setting?: string[] | null
          statistical_tests_performed?: string | null
          statistical_tests_specified?: string | null
          study_design?: string | null
          study_id?: string | null
          technical_challenges?: string | null
          technical_innovation?: string | null
          title?: string | null
          universities?: string | null
          updated_at?: string
          usage_outcomes?: string | null
          user_id?: string
          verify_peer1?: boolean
          verify_peer2?: boolean
          verify_qa3?: boolean
          verify_qa4?: boolean
          year?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
