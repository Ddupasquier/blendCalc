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
      food_nutrients: {
        Row: {
          amount_per_100g: number
          confidence: string
          created_at: string
          custom_food_id: string | null
          id: number
          nutrient_id: number
          owner_user_id: string | null
          shared_product_id: string | null
          shared_product_observation_id: string | null
          shared_product_revision_id: string | null
          shared_product_submission_id: string | null
          source: string
          source_observation_id: string | null
          source_reference: string | null
          unit_name: string
          updated_at: string
          user_food_list_item_id: string | null
          value_origin: string
        }
        Insert: {
          amount_per_100g: number
          confidence: string
          created_at?: string
          custom_food_id?: string | null
          id?: never
          nutrient_id: number
          owner_user_id?: string | null
          shared_product_id?: string | null
          shared_product_observation_id?: string | null
          shared_product_revision_id?: string | null
          shared_product_submission_id?: string | null
          source: string
          source_observation_id?: string | null
          source_reference?: string | null
          unit_name: string
          updated_at?: string
          user_food_list_item_id?: string | null
          value_origin: string
        }
        Update: {
          amount_per_100g?: number
          confidence?: string
          created_at?: string
          custom_food_id?: string | null
          id?: never
          nutrient_id?: number
          owner_user_id?: string | null
          shared_product_id?: string | null
          shared_product_observation_id?: string | null
          shared_product_revision_id?: string | null
          shared_product_submission_id?: string | null
          source?: string
          source_observation_id?: string | null
          source_reference?: string | null
          unit_name?: string
          updated_at?: string
          user_food_list_item_id?: string | null
          value_origin?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_nutrients_custom_food_id_fkey"
            columns: ["custom_food_id"]
            isOneToOne: false
            referencedRelation: "custom_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrients_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
          {
            foreignKeyName: "food_nutrients_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrients_shared_product_observation_id_fkey"
            columns: ["shared_product_observation_id"]
            isOneToOne: false
            referencedRelation: "shared_product_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrients_shared_product_revision_id_fkey"
            columns: ["shared_product_revision_id"]
            isOneToOne: false
            referencedRelation: "shared_product_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrients_shared_product_submission_id_fkey"
            columns: ["shared_product_submission_id"]
            isOneToOne: false
            referencedRelation: "shared_product_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrients_source_observation_id_fkey"
            columns: ["source_observation_id"]
            isOneToOne: false
            referencedRelation: "shared_product_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrients_user_food_list_item_id_fkey"
            columns: ["user_food_list_item_id"]
            isOneToOne: false
            referencedRelation: "user_food_list_items"
            referencedColumns: ["id"]
          },
        ]
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
      nutrient_definitions: {
        Row: {
          created_at: string
          default_unit_name: string
          nutrient_id: number
          nutrient_name: string
          nutrient_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_unit_name: string
          nutrient_id: number
          nutrient_name: string
          nutrient_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_unit_name?: string
          nutrient_id?: number
          nutrient_name?: string
          nutrient_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_api_cache: {
        Row: {
          cache_key: string
          etag: string | null
          expires_at: string
          fetched_at: string
          provider: string
          request_kind: string
          response: Json
          status_code: number
        }
        Insert: {
          cache_key: string
          etag?: string | null
          expires_at: string
          fetched_at?: string
          provider: string
          request_kind: string
          response: Json
          status_code: number
        }
        Update: {
          cache_key?: string
          etag?: string | null
          expires_at?: string
          fetched_at?: string
          provider?: string
          request_kind?: string
          response?: Json
          status_code?: number
        }
        Relationships: []
      }
      product_submission_blocks: {
        Row: {
          blocked_until: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          reason: string
          rejection_count: number
          source_submission_id: string | null
          user_id: string
          window_ended_at: string
          window_started_at: string
        }
        Insert: {
          blocked_until: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reason?: string
          rejection_count: number
          source_submission_id?: string | null
          user_id: string
          window_ended_at: string
          window_started_at: string
        }
        Update: {
          blocked_until?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reason?: string
          rejection_count?: number
          source_submission_id?: string | null
          user_id?: string
          window_ended_at?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_submission_blocks_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "shared_product_submissions"
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
          display_name: string
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
          display_name: string
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
          display_name?: string
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
      shared_product_conflicts: {
        Row: {
          barcode: string
          created_at: string
          field_path: string
          id: string
          observed_values: Json
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          shared_product_id: string
          status: string
        }
        Insert: {
          barcode: string
          created_at?: string
          field_path: string
          id?: string
          observed_values: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          shared_product_id: string
          status?: string
        }
        Update: {
          barcode?: string
          created_at?: string
          field_path?: string
          id?: string
          observed_values?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shared_product_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_product_conflicts_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_product_field_provenance: {
        Row: {
          confidence: string
          created_at: string
          field_path: string
          id: string
          normalized_value: Json
          observation_id: string
          selected: boolean
          shared_product_id: string
          source_value: Json
          verification_method: string
        }
        Insert: {
          confidence: string
          created_at?: string
          field_path: string
          id?: string
          normalized_value: Json
          observation_id: string
          selected?: boolean
          shared_product_id: string
          source_value: Json
          verification_method: string
        }
        Update: {
          confidence?: string
          created_at?: string
          field_path?: string
          id?: string
          normalized_value?: Json
          observation_id?: string
          selected?: boolean
          shared_product_id?: string
          source_value?: Json
          verification_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_product_field_provenance_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "shared_product_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_product_field_provenance_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_product_observations: {
        Row: {
          barcode: string
          content_hash: string
          created_at: string
          expires_at: string | null
          id: string
          normalized_food: Json | null
          observed_at: string
          raw_payload: Json
          source: string
          source_license: string
          source_reference: string | null
          submission_id: string | null
          submitted_by: string | null
        }
        Insert: {
          barcode: string
          content_hash: string
          created_at?: string
          expires_at?: string | null
          id?: string
          normalized_food?: Json | null
          observed_at?: string
          raw_payload: Json
          source: string
          source_license: string
          source_reference?: string | null
          submission_id?: string | null
          submitted_by?: string | null
        }
        Update: {
          barcode?: string
          content_hash?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          normalized_food?: Json | null
          observed_at?: string
          raw_payload?: Json
          source?: string
          source_license?: string
          source_reference?: string | null
          submission_id?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_product_observations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "shared_product_submissions"
            referencedColumns: ["id"]
          },
        ]
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
          evidence_complete: boolean
          evidence_paths: Json
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
          evidence_complete?: boolean
          evidence_paths?: Json
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
          evidence_complete?: boolean
          evidence_paths?: Json
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
          canonical_provenance: Json
          confidence: string
          created_at: string
          food: Json
          id: string
          last_verified_at: string | null
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
          canonical_provenance?: Json
          confidence: string
          created_at?: string
          food: Json
          id?: string
          last_verified_at?: string | null
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
          canonical_provenance?: Json
          confidence?: string
          created_at?: string
          food?: Json
          id?: string
          last_verified_at?: string | null
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
      user_food_preferences: {
        Row: {
          allergens: string[]
          created_at: string
          default_smoothie_serving_grams: number | null
          dietary_restrictions: string[]
          food_preferences: string[]
          ingredients_to_avoid: string[]
          prioritized_nutrient_ids: number[]
          sensitive_acknowledged_at: string | null
          unit_system: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergens?: string[]
          created_at?: string
          default_smoothie_serving_grams?: number | null
          dietary_restrictions?: string[]
          food_preferences?: string[]
          ingredients_to_avoid?: string[]
          prioritized_nutrient_ids?: number[]
          sensitive_acknowledged_at?: string | null
          unit_system?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergens?: string[]
          created_at?: string
          default_smoothie_serving_grams?: number | null
          dietary_restrictions?: string[]
          food_preferences?: string[]
          ingredients_to_avoid?: string[]
          prioritized_nutrient_ids?: number[]
          sensitive_acknowledged_at?: string | null
          unit_system?: string | null
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
      default_profile_display_name: {
        Args: { p_user_id: string }
        Returns: string
      }
      food_metadata_search_text: { Args: { p_food: Json }; Returns: string }
      jsonb_text_array_search_text: { Args: { p_value: Json }; Returns: string }
      publish_shared_product_submission: {
        Args: {
          p_approved_by?: string
          p_brand_owner: string
          p_confidence: string
          p_conflicts?: Json
          p_food: Json
          p_observations?: Json
          p_product_name: string
          p_provenance?: Json
          p_source: string
          p_source_reference: string
          p_submission_id: string
        }
        Returns: string
      }
      reject_blocked_signup: { Args: { event: Json }; Returns: Json }
      replace_food_nutrients: {
        Args: {
          p_custom_food_id: string
          p_default_confidence: string
          p_default_source: string
          p_default_source_reference: string
          p_food: Json
          p_owner_user_id: string
          p_shared_product_id: string
          p_shared_product_observation_id: string
          p_shared_product_revision_id: string
          p_shared_product_submission_id: string
          p_user_food_list_item_id: string
        }
        Returns: undefined
      }
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
