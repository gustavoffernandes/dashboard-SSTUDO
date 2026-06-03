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
      action_plan_tasks: {
        Row: {
          action_plan_id: string
          created_at: string
          description: string | null
          id: string
          is_completed: boolean
          observation: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_plan_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          observation?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_plan_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          observation?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_tasks_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plans: {
        Row: {
          company_config_id: string
          completed_at: string | null
          created_at: string
          deadline_days: number
          description: string | null
          factor_id: string
          id: string
          owner_admin_id: string | null
          risk_level: string
          risk_score: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_config_id: string
          completed_at?: string | null
          created_at?: string
          deadline_days?: number
          description?: string | null
          factor_id?: string
          id?: string
          owner_admin_id?: string | null
          risk_level?: string
          risk_score?: number
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_config_id?: string
          completed_at?: string | null
          created_at?: string
          deadline_days?: number
          description?: string | null
          factor_id?: string
          id?: string
          owner_admin_id?: string | null
          risk_level?: string
          risk_score?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      company_notes: {
        Row: {
          company_config_id: string
          content: string
          created_at: string
          id: string
          owner_admin_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_config_id: string
          content?: string
          created_at?: string
          id?: string
          owner_admin_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_config_id?: string
          content?: string
          created_at?: string
          id?: string
          owner_admin_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          ip_address: string | null
          message: string
          phone: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          ip_address?: string | null
          message: string
          phone?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          ip_address?: string | null
          message?: string
          phone?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      google_forms_config: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          cnpj: string
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          employee_count: number | null
          end_date: string | null
          form_status: string
          form_title: string | null
          form_url: string | null
          id: string
          instructions: string | null
          is_active: boolean
          is_anonymous: boolean | null
          last_sync_at: string | null
          link_token: string | null
          owner_admin_id: string | null
          require_consent: boolean | null
          require_password: boolean | null
          sector: string | null
          sectors: Json
          sheet_name: string
          spreadsheet_id: string
          start_date: string | null
          survey_password: string | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          cnpj: string
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          employee_count?: number | null
          end_date?: string | null
          form_status?: string
          form_title?: string | null
          form_url?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_anonymous?: boolean | null
          last_sync_at?: string | null
          link_token?: string | null
          owner_admin_id?: string | null
          require_consent?: boolean | null
          require_password?: boolean | null
          sector?: string | null
          sectors?: Json
          sheet_name?: string
          spreadsheet_id: string
          start_date?: string | null
          survey_password?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          cnpj?: string
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          employee_count?: number | null
          end_date?: string | null
          form_status?: string
          form_title?: string | null
          form_url?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_anonymous?: boolean | null
          last_sync_at?: string | null
          link_token?: string | null
          owner_admin_id?: string | null
          require_consent?: boolean | null
          require_password?: boolean | null
          sector?: string | null
          sectors?: Json
          sheet_name?: string
          spreadsheet_id?: string
          start_date?: string | null
          survey_password?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          features: Json
          id: string
          max_companies: number
          max_respondents: number
          max_surveys_per_month: number
          max_users: number
          name: string
          price_annual: number
          price_monthly: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          features?: Json
          id: string
          max_companies?: number
          max_respondents?: number
          max_surveys_per_month?: number
          max_users?: number
          name: string
          price_annual?: number
          price_monthly?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          max_companies?: number
          max_respondents?: number
          max_surveys_per_month?: number
          max_users?: number
          name?: string
          price_annual?: number
          price_monthly?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          cycle: Database["public"]["Enums"]["billing_cycle"]
          id: string
          metadata: Json
          mp_external_reference: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          plan_id: string
          provisioned_at: string | null
          provisioned_user_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          temp_password_sent_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          cycle: Database["public"]["Enums"]["billing_cycle"]
          id?: string
          metadata?: Json
          mp_external_reference?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          plan_id: string
          provisioned_at?: string | null
          provisioned_user_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          temp_password_sent_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          cycle?: Database["public"]["Enums"]["billing_cycle"]
          id?: string
          metadata?: Json
          mp_external_reference?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          plan_id?: string
          provisioned_at?: string | null
          provisioned_user_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          temp_password_sent_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          age: number | null
          answers: Json
          cargo: string | null
          config_id: string
          created_at: string
          escolaridade: string | null
          estado_civil: string | null
          ghe: string | null
          id: string
          open_answers: Json | null
          respondent_name: string | null
          response_timestamp: string | null
          sector: string | null
          sex: string | null
          tempo_empresa: string | null
        }
        Insert: {
          age?: number | null
          answers?: Json
          cargo?: string | null
          config_id: string
          created_at?: string
          escolaridade?: string | null
          estado_civil?: string | null
          ghe?: string | null
          id?: string
          open_answers?: Json | null
          respondent_name?: string | null
          response_timestamp?: string | null
          sector?: string | null
          sex?: string | null
          tempo_empresa?: string | null
        }
        Update: {
          age?: number | null
          answers?: Json
          cargo?: string | null
          config_id?: string
          created_at?: string
          escolaridade?: string | null
          estado_civil?: string | null
          ghe?: string | null
          id?: string
          open_answers?: Json | null
          respondent_name?: string | null
          response_timestamp?: string | null
          sector?: string | null
          sex?: string | null
          tempo_empresa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "google_forms_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "public_form_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_sessions: {
        Row: {
          completed_at: string | null
          config_id: string
          id: string
          last_activity_at: string
          respondent_name: string | null
          sector: string | null
          session_token: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          config_id: string
          id?: string
          last_activity_at?: string
          respondent_name?: string | null
          sector?: string | null
          session_token: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          config_id?: string
          id?: string
          last_activity_at?: string
          respondent_name?: string | null
          sector?: string | null
          session_token?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_sessions_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "google_forms_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sessions_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "public_form_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          config_id: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          rows_synced: number | null
          started_at: string
          status: string
        }
        Insert: {
          config_id?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_synced?: number | null
          started_at?: string
          status: string
        }
        Update: {
          config_id?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_synced?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "google_forms_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "public_form_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      system_accounts: {
        Row: {
          activated_at: string
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_accounts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          id: string
          parent_admin_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          parent_admin_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          id?: string
          parent_admin_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "google_forms_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_form_configs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_form_configs: {
        Row: {
          cnpj: string | null
          company_name: string | null
          description: string | null
          end_date: string | null
          form_status: string | null
          form_title: string | null
          id: string | null
          instructions: string | null
          is_active: boolean | null
          is_anonymous: boolean | null
          require_consent: boolean | null
          require_password: boolean | null
          sector: string | null
          sectors: Json | null
          start_date: string | null
          survey_password: string | null
        }
        Insert: {
          cnpj?: string | null
          company_name?: string | null
          description?: string | null
          end_date?: string | null
          form_status?: string | null
          form_title?: string | null
          id?: string | null
          instructions?: string | null
          is_active?: boolean | null
          is_anonymous?: boolean | null
          require_consent?: boolean | null
          require_password?: boolean | null
          sector?: string | null
          sectors?: Json | null
          start_date?: string | null
          survey_password?: string | null
        }
        Update: {
          cnpj?: string | null
          company_name?: string | null
          description?: string | null
          end_date?: string | null
          form_status?: string | null
          form_title?: string | null
          id?: string | null
          instructions?: string | null
          is_active?: boolean | null
          is_anonymous?: boolean | null
          require_consent?: boolean | null
          require_password?: boolean | null
          sector?: string | null
          sectors?: Json | null
          start_date?: string | null
          survey_password?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      action_plan_owner_admin: { Args: { _plan_id: string }; Returns: string }
      config_owner_admin: { Args: { _config_id: string }; Returns: string }
      config_owner_admin_text: { Args: { _config_id: string }; Returns: string }
      get_account_owner: { Args: { _user_id: string }; Returns: string }
      get_effective_subscription: {
        Args: { _user_id: string }
        Returns: {
          expires_at: string
          features: Json
          max_companies: number
          max_responses_per_month: number
          max_surveys: number
          max_users: number
          owner_user_id: string
          plan_id: string
          plan_name: string
          status: string
          subscription_id: string
        }[]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_config_active: { Args: { _config_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      promote_to_admin: { Args: { _user_id: string }; Returns: undefined }
      provision_subscription_admin: {
        Args: { _subscription_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "company_user" | "super_admin"
      billing_cycle: "monthly" | "annual"
      subscription_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "refunded"
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
    Enums: {
      app_role: ["admin", "user", "company_user", "super_admin"],
      billing_cycle: ["monthly", "annual"],
      subscription_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "refunded",
      ],
    },
  },
} as const
