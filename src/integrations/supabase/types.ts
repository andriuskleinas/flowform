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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      form_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      form_events: {
        Row: {
          form_id: string
          form_version: number
          id: number
          ip_hash: string
          kind: string
          occurred_at: string
          question_id: string | null
        }
        Insert: {
          form_id: string
          form_version?: number
          id?: number
          ip_hash: string
          kind: string
          occurred_at?: string
          question_id?: string | null
        }
        Update: {
          form_id?: string
          form_version?: number
          id?: number
          ip_hash?: string
          kind?: string
          occurred_at?: string
          question_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_events_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_events_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_versions: {
        Row: {
          description: string | null
          display_mode: string
          form_id: string
          id: string
          questions: Json
          retired_at: string
          retired_by: string | null
          thank_you_message: string | null
          title: string
          version: number
        }
        Insert: {
          description?: string | null
          display_mode: string
          form_id: string
          id?: string
          questions: Json
          retired_at?: string
          retired_by?: string | null
          thank_you_message?: string | null
          title: string
          version: number
        }
        Update: {
          description?: string | null
          display_mode?: string
          form_id?: string
          id?: string
          questions?: Json
          retired_at?: string
          retired_by?: string | null
          thank_you_message?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          category_id: string | null
          copied_from: string | null
          created_at: string
          description: string | null
          display_mode: string
          id: string
          status: string
          thank_you_message: string | null
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          category_id?: string | null
          copied_from?: string | null
          created_at?: string
          description?: string | null
          display_mode?: string
          id?: string
          status?: string
          thank_you_message?: string | null
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          category_id?: string | null
          copied_from?: string | null
          created_at?: string
          description?: string | null
          display_mode?: string
          id?: string
          status?: string
          thank_you_message?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "forms_category_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "form_categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          ai_follow_up: boolean
          created_at: string
          form_id: string
          id: string
          label: string
          logic: Json | null
          options: Json | null
          position: number
          required: boolean
          type: string
        }
        Insert: {
          ai_follow_up?: boolean
          created_at?: string
          form_id: string
          id?: string
          label: string
          logic?: Json | null
          options?: Json | null
          position: number
          required?: boolean
          type: string
        }
        Update: {
          ai_follow_up?: boolean
          created_at?: string
          form_id?: string
          id?: string
          label?: string
          logic?: Json | null
          options?: Json | null
          position?: number
          required?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      response_submission_log: {
        Row: {
          form_id: string
          id: number
          ip_hash: string
          submitted_at: string
        }
        Insert: {
          form_id: string
          id?: number
          ip_hash: string
          submitted_at?: string
        }
        Update: {
          form_id?: string
          id?: number
          ip_hash?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_submission_log_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          answers: Json
          follow_ups: Json | null
          form_id: string
          form_version: number
          id: string
          started_at: string | null
          submitted_at: string
        }
        Insert: {
          answers: Json
          follow_ups?: Json | null
          form_id: string
          form_version?: number
          id?: string
          started_at?: string | null
          submitted_at?: string
        }
        Update: {
          answers?: Json
          follow_ups?: Json | null
          form_id?: string
          form_version?: number
          id?: string
          started_at?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          owner_id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          owner_id: string
          role: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          owner_id?: string
          role?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          invited_by: string | null
          member_id: string
          owner_id: string
          role: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          member_id: string
          owner_id: string
          role: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          member_id?: string
          owner_id?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_keepalive_ping: { Args: never; Returns: undefined }
      accept_workspace_invite: {
        Args: { p_invite_id: string }
        Returns: string
      }
      copy_form: { Args: { p_form_id: string }; Returns: string }
      consume_ai_follow_up: {
        Args: { p_ticket: string }
        Returns: {
          form_description: string
          form_title: string
          question_label: string
        }[]
      }
      delete_my_account: { Args: never; Returns: undefined }
      get_my_invites: {
        Args: never
        Returns: {
          created_at: string
          id: string
          owner_email: string
          owner_id: string
          owner_name: string | null
          role: string
        }[]
      }
      get_my_workspaces: {
        Args: never
        Returns: {
          form_count: number
          member_count: number
          owner_email: string
          owner_id: string
          owner_name: string | null
          role: string
        }[]
      }
      get_workspace_members: {
        Args: { p_owner: string }
        Returns: {
          email: string
          joined_at: string
          name: string | null
          role: string
          user_id: string
        }[]
      }
      get_dashboard_forms: {
        Args: { p_owner?: string }
        Returns: {
          category: string | null
          category_color: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          last_response_at: string | null
          question_count: number
          response_count: number
          responses_7d: number
          responses_90d: number
          status: string
          title: string
          updated_at: string
          views_90d: number
        }[]
      }
      get_dashboard_summary: {
        Args: { p_days?: number; p_owner?: string }
        Returns: Json
      }
      get_form_versions: { Args: { p_form_id: string }; Returns: Json }
      get_form_analytics: {
        Args: { p_days?: number; p_form_id: string; p_version?: number }
        Returns: Json
      }
      request_ai_follow_up: {
        Args: { p_form_id: string; p_question_id: string }
        Returns: string
      }
      record_form_event: {
        Args: { p_form_id: string; p_kind: string; p_question_id?: string }
        Returns: undefined
      }
      start_new_form_version: { Args: { p_form_id: string }; Returns: number }
      save_form_editor: {
        Args: { p_form: Json; p_form_id: string; p_questions: Json }
        Returns: undefined
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
