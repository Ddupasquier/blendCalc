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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_moderation: {
        Row: {
          created_at: string
          expires_at: string | null
          moderated_by: string | null
          public_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          moderated_by?: string | null
          public_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          moderated_by?: string | null
          public_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_role_assignments: {
        Row: {
          created_at: string
          granted_by: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_signup_emails: {
        Row: {
          blocked_by: string | null
          created_at: string
          email_hash: string
          expires_at: string | null
          reason: string
          source_user_id: string | null
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          email_hash: string
          expires_at?: string | null
          reason: string
          source_user_id?: string | null
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          email_hash?: string
          expires_at?: string | null
          reason?: string
          source_user_id?: string | null
        }
        Relationships: []
      }
      custom_foods: {
        Row: {
          barcode: string | null
          created_at: string
          fdc_id: number
          food: Json
          id: string
          name_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          fdc_id: number
          food: Json
          id?: string
          name_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          fdc_id?: number
          food?: Json
          id?: string
          name_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mix_preferences: {
        Row: {
          created_at: string
          mix_state: Json
          nutrient_goals: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          mix_state?: Json
          nutrient_goals?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          mix_state?: Json
          nutrient_goals?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          internal_note: string | null
          reason_code: string
          target_user_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          reason_code: string
          target_user_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          reason_code?: string
          target_user_id?: string
        }
        Relationships: []
      }
      moderation_email_deliveries: {
        Row: {
          attempted_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          moderation_action_id: string
          provider: string
          provider_message_id: string | null
          recipient_email_hash: string
          sent_at: string | null
          status: string
          target_user_id: string
          template: string
        }
        Insert: {
          attempted_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          moderation_action_id: string
          provider?: string
          provider_message_id?: string | null
          recipient_email_hash: string
          sent_at?: string | null
          status?: string
          target_user_id: string
          template: string
        }
        Update: {
          attempted_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          moderation_action_id?: string
          provider?: string
          provider_message_id?: string | null
          recipient_email_hash?: string
          sent_at?: string | null
          status?: string
          target_user_id?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_email_deliveries_moderation_action_id_fkey"
            columns: ["moderation_action_id"]
            isOneToOne: true
            referencedRelation: "moderation_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_image_policy_acceptances: {
        Row: {
          accepted_at: string
          avatar_path: string
          file_sha256: string
          id: string
          policy_items: Json
          policy_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          avatar_path: string
          file_sha256: string
          id?: string
          policy_items: Json
          policy_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          avatar_path?: string
          file_sha256?: string
          id?: string
          policy_items?: Json
          policy_version?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_alt_text: string | null
          avatar_moderation_status: string
          avatar_path: string | null
          avatar_policy_acknowledged_at: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_alt_text?: string | null
          avatar_moderation_status?: string
          avatar_path?: string | null
          avatar_policy_acknowledged_at?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_alt_text?: string | null
          avatar_moderation_status?: string
          avatar_path?: string | null
          avatar_policy_acknowledged_at?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_drinks: {
        Row: {
          created_at: string
          drink: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drink: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drink?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_product_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          food: Json
          id: string
          revision_number: number
          shared_product_id: string
          source: string
          source_reference: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          food: Json
          id?: string
          revision_number: number
          shared_product_id: string
          source: string
          source_reference?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          food?: Json
          id?: string
          revision_number?: number
          shared_product_id?: string
          source?: string
          source_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_product_revisions_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_product_submissions: {
        Row: {
          barcode: string
          brand_owner: string | null
          consent_to_share: boolean
          created_at: string
          food: Json
          id: string
          matched_reference: string | null
          matched_source: string | null
          product_name: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          updated_at: string
          validation_report: Json
          verification_status: string
        }
        Insert: {
          barcode: string
          brand_owner?: string | null
          consent_to_share: boolean
          created_at?: string
          food: Json
          id?: string
          matched_reference?: string | null
          matched_source?: string | null
          product_name: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          updated_at?: string
          validation_report?: Json
          verification_status?: string
        }
        Update: {
          barcode?: string
          brand_owner?: string | null
          consent_to_share?: boolean
          created_at?: string
          food?: Json
          id?: string
          matched_reference?: string | null
          matched_source?: string | null
          product_name?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          updated_at?: string
          validation_report?: Json
          verification_status?: string
        }
        Relationships: []
      }
      shared_products: {
        Row: {
          approved_by: string | null
          approved_submission_id: string | null
          barcode: string
          brand_owner: string | null
          confidence: string
          created_at: string
          food: Json
          id: string
          product_name: string
          search_text: string
          source: string
          source_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          approved_submission_id?: string | null
          barcode: string
          brand_owner?: string | null
          confidence: string
          created_at?: string
          food: Json
          id?: string
          product_name: string
          search_text: string
          source: string
          source_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          approved_submission_id?: string | null
          barcode?: string
          brand_owner?: string | null
          confidence?: string
          created_at?: string
          food?: Json
          id?: string
          product_name?: string
          search_text?: string
          source?: string
          source_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_products_approved_submission_id_fkey"
            columns: ["approved_submission_id"]
            isOneToOne: false
            referencedRelation: "shared_product_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_food_list_items: {
        Row: {
          created_at: string
          fdc_id: number
          food: Json
          id: string
          list_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fdc_id: number
          food: Json
          id?: string
          list_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fdc_id?: number
          food?: Json
          id?: string
          list_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_tutorial_preferences: {
        Row: {
          completed_at: string | null
          created_at: string
          do_not_show_again: boolean
          last_seen_at: string
          remind_after: string | null
          tutorial_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          do_not_show_again?: boolean
          last_seen_at?: string
          remind_after?: string | null
          tutorial_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          do_not_show_again?: boolean
          last_seen_at?: string
          remind_after?: string | null
          tutorial_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      publish_shared_product_submission: {
        Args: {
          p_approved_by?: string
          p_brand_owner: string
          p_confidence: string
          p_food: Json
          p_product_name: string
          p_source: string
          p_source_reference: string
          p_submission_id: string
        }
        Returns: string
      }
      reject_blocked_signup: { Args: { event: Json }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
