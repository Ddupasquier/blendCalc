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
      app_interaction_daily_metrics: {
        Row: {
          created_at: string
          dimension_key: string
          dimension_value: string
          environment: string
          event_count: number
          metric_date: string
          metric_key: string
          metric_source: string
          source_query_version: number
          synced_at: string
          visitor_count: number | null
        }
        Insert: {
          created_at?: string
          dimension_key?: string
          dimension_value?: string
          environment?: string
          event_count: number
          metric_date: string
          metric_key: string
          metric_source?: string
          source_query_version?: number
          synced_at?: string
          visitor_count?: number | null
        }
        Update: {
          created_at?: string
          dimension_key?: string
          dimension_value?: string
          environment?: string
          event_count?: number
          metric_date?: string
          metric_key?: string
          metric_source?: string
          source_query_version?: number
          synced_at?: string
          visitor_count?: number | null
        }
        Relationships: []
      }
      app_issue_codes: {
        Row: {
          code: string
          created_at: string
          description: string
          domain: string
          enabled: boolean
          kind: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          domain: string
          enabled?: boolean
          kind: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          domain?: string
          enabled?: boolean
          kind?: string
          updated_at?: string
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
      compatibility_tags: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          slug: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          label: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_food_category_mappings: {
        Row: {
          category_option_id: string
          category_option_label: string
          confidence: string
          created_at: string
          first_seen_at: string
          last_seen_at: string
          match_reason: string
          observation_count: number
          source_count: number
          source_fields: string[]
          source_normalized_value: string
          source_value: string
          source_values: string[]
          sources: string[]
          updated_at: string
        }
        Insert: {
          category_option_id: string
          category_option_label: string
          confidence?: string
          created_at?: string
          first_seen_at?: string
          last_seen_at?: string
          match_reason: string
          observation_count?: number
          source_count?: number
          source_fields?: string[]
          source_normalized_value: string
          source_value: string
          source_values?: string[]
          sources?: string[]
          updated_at?: string
        }
        Update: {
          category_option_id?: string
          category_option_label?: string
          confidence?: string
          created_at?: string
          first_seen_at?: string
          last_seen_at?: string
          match_reason?: string
          observation_count?: number
          source_count?: number
          source_fields?: string[]
          source_normalized_value?: string
          source_value?: string
          source_values?: string[]
          sources?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_food_category_mappings_category_option_id_fkey"
            columns: ["category_option_id"]
            isOneToOne: false
            referencedRelation: "custom_food_category_options"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_food_category_observations: {
        Row: {
          category_id: string
          created_at: string
          first_seen_at: string
          id: number
          label: string
          last_seen_at: string
          normalized_value: string
          observation_count: number
          query: string
          source: string
          source_field: string
          source_payload: Json
          source_reference: string | null
          source_value: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          first_seen_at?: string
          id?: never
          label: string
          last_seen_at?: string
          normalized_value: string
          observation_count?: number
          query: string
          source: string
          source_field: string
          source_payload?: Json
          source_reference?: string | null
          source_value: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          first_seen_at?: string
          id?: never
          label?: string
          last_seen_at?: string
          normalized_value?: string
          observation_count?: number
          query?: string
          source?: string
          source_field?: string
          source_payload?: Json
          source_reference?: string | null
          source_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_food_category_options: {
        Row: {
          created_at: string
          enabled: boolean
          first_seen_at: string
          id: string
          label: string
          last_seen_at: string
          normalized_value: string
          observation_count: number
          source_count: number
          sources: string[]
          symbol_key: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          first_seen_at?: string
          id: string
          label: string
          last_seen_at?: string
          normalized_value: string
          observation_count?: number
          source_count?: number
          sources?: string[]
          symbol_key?: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          first_seen_at?: string
          id?: string
          label?: string
          last_seen_at?: string
          normalized_value?: string
          observation_count?: number
          source_count?: number
          sources?: string[]
          symbol_key?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_food_category_options_symbol_key_fkey"
            columns: ["symbol_key"]
            isOneToOne: false
            referencedRelation: "food_symbol_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
      custom_foods: {
        Row: {
          barcode: string | null
          category_option_id: string | null
          created_at: string
          fdc_id: number
          food: Json
          id: string
          name_key: string | null
          search_text: string
          source_key: string | null
          trust_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          category_option_id?: string | null
          created_at?: string
          fdc_id: number
          food: Json
          id?: string
          name_key?: string | null
          search_text?: string
          source_key?: string | null
          trust_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          category_option_id?: string | null
          created_at?: string
          fdc_id?: number
          food?: Json
          id?: string
          name_key?: string | null
          search_text?: string
          source_key?: string | null
          trust_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_foods_category_option_id_fkey"
            columns: ["category_option_id"]
            isOneToOne: false
            referencedRelation: "custom_food_category_options"
            referencedColumns: ["id"]
          },
        ]
      }
      food_allergen_regulatory_profile_tags: {
        Row: {
          classification: string
          created_at: string
          profile_id: string
          source_label: string
          tag_id: string
        }
        Insert: {
          classification: string
          created_at?: string
          profile_id: string
          source_label: string
          tag_id: string
        }
        Update: {
          classification?: string
          created_at?: string
          profile_id?: string
          source_label?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_allergen_regulatory_profile_tags_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "food_allergen_regulatory_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_allergen_regulatory_profile_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_allergen_regulatory_profile_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      food_allergen_regulatory_profiles: {
        Row: {
          active: boolean
          authority: string
          created_at: string
          display_name: string
          id: string
          policy_reference: string
          policy_version_id: string
          profile_key: string
          region_code: string
          reviewed_at: string
          source_url: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          authority: string
          created_at?: string
          display_name: string
          id?: string
          policy_reference: string
          policy_version_id: string
          profile_key: string
          region_code: string
          reviewed_at: string
          source_url: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          authority?: string
          created_at?: string
          display_name?: string
          id?: string
          policy_reference?: string
          policy_version_id?: string
          profile_key?: string
          region_code?: string
          reviewed_at?: string
          source_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_allergen_regulatory_profiles_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      food_compatibility_feedback: {
        Row: {
          barcode: string | null
          created_at: string
          fact_snapshot: Json
          food_description: string
          id: string
          issue_code: string
          issue_params: Json
          policy_version_id: string
          report_details: string | null
          report_fingerprint: string
          report_reason: string
          reported_by: string
          resolution_action: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shared_product_id: string | null
          source_id: string | null
          source_key: string | null
          status: string
          updated_at: string
          warning_id: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          fact_snapshot?: Json
          food_description: string
          id?: string
          issue_code: string
          issue_params?: Json
          policy_version_id?: string
          report_details?: string | null
          report_fingerprint: string
          report_reason: string
          reported_by: string
          resolution_action?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shared_product_id?: string | null
          source_id?: string | null
          source_key?: string | null
          status?: string
          updated_at?: string
          warning_id: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          fact_snapshot?: Json
          food_description?: string
          id?: string
          issue_code?: string
          issue_params?: Json
          policy_version_id?: string
          report_details?: string | null
          report_fingerprint?: string
          report_reason?: string
          reported_by?: string
          resolution_action?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shared_product_id?: string | null
          source_id?: string | null
          source_key?: string | null
          status?: string
          updated_at?: string
          warning_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_compatibility_feedback_issue_code_fkey"
            columns: ["issue_code"]
            isOneToOne: false
            referencedRelation: "app_issue_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "food_compatibility_feedback_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_feedback_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
          },
          {
            foreignKeyName: "food_compatibility_feedback_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
        ]
      }
      food_compatibility_policy_conflicts: {
        Row: {
          created_at: string
          fact_tag_id: string
          policy_version_id: string
          preference_tag_id: string
          priority: number
          severity: string
          updated_at: string
          warning_code: string
        }
        Insert: {
          created_at?: string
          fact_tag_id: string
          policy_version_id: string
          preference_tag_id: string
          priority?: number
          severity: string
          updated_at?: string
          warning_code: string
        }
        Update: {
          created_at?: string
          fact_tag_id?: string
          policy_version_id?: string
          preference_tag_id?: string
          priority?: number
          severity?: string
          updated_at?: string
          warning_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "compatibility_rule_conflicts_fact_tag_id_fkey"
            columns: ["fact_tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibility_rule_conflicts_fact_tag_id_fkey"
            columns: ["fact_tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "compatibility_rule_conflicts_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibility_rule_conflicts_preference_tag_id_fkey"
            columns: ["preference_tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibility_rule_conflicts_preference_tag_id_fkey"
            columns: ["preference_tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "compatibility_rule_conflicts_warning_code_fkey"
            columns: ["warning_code"]
            isOneToOne: false
            referencedRelation: "app_issue_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      food_compatibility_policy_exemptions: {
        Row: {
          created_at: string
          exemption_type: string
          fact_tag_id: string | null
          id: string
          ingredient_term_id: string | null
          jurisdiction_code: string
          parent_term_id: string | null
          policy_version_id: string
          processing_state: string | null
          reviewed_at: string
          source_reference: string
          updated_at: string
          warning_behavior: string
        }
        Insert: {
          created_at?: string
          exemption_type: string
          fact_tag_id?: string | null
          id?: string
          ingredient_term_id?: string | null
          jurisdiction_code: string
          parent_term_id?: string | null
          policy_version_id: string
          processing_state?: string | null
          reviewed_at: string
          source_reference: string
          updated_at?: string
          warning_behavior?: string
        }
        Update: {
          created_at?: string
          exemption_type?: string
          fact_tag_id?: string | null
          id?: string
          ingredient_term_id?: string | null
          jurisdiction_code?: string
          parent_term_id?: string | null
          policy_version_id?: string
          processing_state?: string | null
          reviewed_at?: string
          source_reference?: string
          updated_at?: string
          warning_behavior?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_compatibility_policy_exemptions_fact_tag_id_fkey"
            columns: ["fact_tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_policy_exemptions_fact_tag_id_fkey"
            columns: ["fact_tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "food_compatibility_policy_exemptions_ingredient_term_id_fkey"
            columns: ["ingredient_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_policy_exemptions_parent_term_id_fkey"
            columns: ["parent_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_policy_exemptions_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      food_compatibility_policy_ingredient_aliases: {
        Row: {
          alias: string
          alias_type: string
          created_at: string
          id: string
          ingredient_term_id: string
          language_code: string | null
          normalized_alias: string | null
          policy_version_id: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_key: string | null
          source_reference: string | null
          updated_at: string
        }
        Insert: {
          alias: string
          alias_type?: string
          created_at?: string
          id?: string
          ingredient_term_id: string
          language_code?: string | null
          normalized_alias?: string | null
          policy_version_id: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string | null
          source_reference?: string | null
          updated_at?: string
        }
        Update: {
          alias?: string
          alias_type?: string
          created_at?: string
          id?: string
          ingredient_term_id?: string
          language_code?: string | null
          normalized_alias?: string | null
          policy_version_id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string | null
          source_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_term_aliases_ingredient_term_id_fkey"
            columns: ["ingredient_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_term_aliases_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_term_aliases_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      food_compatibility_policy_ingredient_relationships: {
        Row: {
          child_term_id: string
          conflict_inheritance: string
          created_at: string
          id: string
          jurisdiction_code: string | null
          parent_term_id: string
          policy_version_id: string
          processing_state: string | null
          relationship_type: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_key: string | null
          source_reference: string | null
          updated_at: string
        }
        Insert: {
          child_term_id: string
          conflict_inheritance?: string
          created_at?: string
          id?: string
          jurisdiction_code?: string | null
          parent_term_id: string
          policy_version_id: string
          processing_state?: string | null
          relationship_type: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string | null
          source_reference?: string | null
          updated_at?: string
        }
        Update: {
          child_term_id?: string
          conflict_inheritance?: string
          created_at?: string
          id?: string
          jurisdiction_code?: string | null
          parent_term_id?: string
          policy_version_id?: string
          processing_state?: string | null
          relationship_type?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string | null
          source_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_term_relationships_child_term_id_fkey"
            columns: ["child_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_term_relationships_parent_term_id_fkey"
            columns: ["parent_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_term_relationships_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_term_relationships_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      food_compatibility_policy_match_rules: {
        Row: {
          confidence: string
          created_at: string
          enabled: boolean
          exclude_pattern: string | null
          fact_type: string
          field_name: string
          id: string
          match_pattern: string
          policy_version_id: string
          priority: number
          source_key: string | null
          source_type: string
          tag_id: string
          updated_at: string
        }
        Insert: {
          confidence: string
          created_at?: string
          enabled?: boolean
          exclude_pattern?: string | null
          fact_type: string
          field_name: string
          id?: string
          match_pattern: string
          policy_version_id: string
          priority?: number
          source_key?: string | null
          source_type: string
          tag_id: string
          updated_at?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          enabled?: boolean
          exclude_pattern?: string | null
          fact_type?: string
          field_name?: string
          id?: string
          match_pattern?: string
          policy_version_id?: string
          priority?: number
          source_key?: string | null
          source_type?: string
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_compatibility_match_rules_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_match_rules_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_match_rules_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      food_compatibility_policy_preference_term_mappings: {
        Row: {
          created_at: string
          id: string
          ingredient_term_id: string
          policy_version_id: string
          preference_rule_type: string
          preference_tag_id: string
          reviewed_at: string
          reviewed_by: string | null
          source_reference: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_term_id: string
          policy_version_id: string
          preference_rule_type: string
          preference_tag_id: string
          reviewed_at: string
          reviewed_by?: string | null
          source_reference: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_term_id?: string
          policy_version_id?: string
          preference_rule_type?: string
          preference_tag_id?: string
          reviewed_at?: string
          reviewed_by?: string | null
          source_reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_compatibility_policy_preference_te_ingredient_term_id_fkey"
            columns: ["ingredient_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_policy_preference_ter_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_policy_preference_ter_preference_tag_id_fkey"
            columns: ["preference_tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_policy_preference_ter_preference_tag_id_fkey"
            columns: ["preference_tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      food_compatibility_policy_versions: {
        Row: {
          alias_snapshot: Json
          bundle_content_hash: string | null
          change_summary: string
          conflict_rule_snapshot: Json
          created_at: string
          effective_at: string
          exemption_snapshot: Json
          id: string
          match_rule_snapshot: Json
          preference_mapping_snapshot: Json
          regional_profile_snapshot: Json
          relationship_snapshot: Json
          reviewed_at: string
          source_references: Json
          status: string
          updated_at: string
          version_number: number
        }
        Insert: {
          alias_snapshot?: Json
          bundle_content_hash?: string | null
          change_summary: string
          conflict_rule_snapshot?: Json
          created_at?: string
          effective_at: string
          exemption_snapshot?: Json
          id?: string
          match_rule_snapshot?: Json
          preference_mapping_snapshot?: Json
          regional_profile_snapshot?: Json
          relationship_snapshot?: Json
          reviewed_at: string
          source_references?: Json
          status: string
          updated_at?: string
          version_number: number
        }
        Update: {
          alias_snapshot?: Json
          bundle_content_hash?: string | null
          change_summary?: string
          conflict_rule_snapshot?: Json
          created_at?: string
          effective_at?: string
          exemption_snapshot?: Json
          id?: string
          match_rule_snapshot?: Json
          preference_mapping_snapshot?: Json
          regional_profile_snapshot?: Json
          relationship_snapshot?: Json
          reviewed_at?: string
          source_references?: Json
          status?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: []
      }
      food_image_assets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attribution_text: string | null
          barcode: string | null
          confidence: string
          created_at: string
          crop_source: string
          crop_x: number
          crop_y: number
          crop_zoom: number
          fetched_at: string
          fit_mode: string
          id: string
          image_role: string
          image_url: string
          license_name: string
          license_url: string | null
          placement_method: string
          placement_suggestion_accepted_at: string | null
          placement_suggestion_confidence: number | null
          placement_suggestion_version: string | null
          placement_version: number
          rotation_degrees: number
          shared_product_id: string | null
          source: string
          source_reference: string | null
          status: string
          storage_path: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attribution_text?: string | null
          barcode?: string | null
          confidence?: string
          created_at?: string
          crop_source?: string
          crop_x?: number
          crop_y?: number
          crop_zoom?: number
          fetched_at?: string
          fit_mode?: string
          id?: string
          image_role: string
          image_url: string
          license_name: string
          license_url?: string | null
          placement_method?: string
          placement_suggestion_accepted_at?: string | null
          placement_suggestion_confidence?: number | null
          placement_suggestion_version?: string | null
          placement_version?: number
          rotation_degrees?: number
          shared_product_id?: string | null
          source: string
          source_reference?: string | null
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attribution_text?: string | null
          barcode?: string | null
          confidence?: string
          created_at?: string
          crop_source?: string
          crop_x?: number
          crop_y?: number
          crop_zoom?: number
          fetched_at?: string
          fit_mode?: string
          id?: string
          image_role?: string
          image_url?: string
          license_name?: string
          license_url?: string | null
          placement_method?: string
          placement_suggestion_accepted_at?: string | null
          placement_suggestion_confidence?: number | null
          placement_suggestion_version?: string | null
          placement_version?: number
          rotation_degrees?: number
          shared_product_id?: string | null
          source?: string
          source_reference?: string | null
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_image_assets_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
          },
          {
            foreignKeyName: "food_image_assets_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
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
      food_preference_api_observations: {
        Row: {
          brand_owner: string | null
          category: string
          fact_type: string
          first_seen_at: string
          id: string
          label: string
          last_seen_at: string
          matched_name: string | null
          normalized_value: string
          observation_count: number
          query: string
          source: string
          source_field: string
          source_payload: Json
          source_reference: string | null
          source_value: string
        }
        Insert: {
          brand_owner?: string | null
          category: string
          fact_type: string
          first_seen_at?: string
          id?: string
          label: string
          last_seen_at?: string
          matched_name?: string | null
          normalized_value: string
          observation_count?: number
          query: string
          source: string
          source_field: string
          source_payload?: Json
          source_reference?: string | null
          source_value: string
        }
        Update: {
          brand_owner?: string | null
          category?: string
          fact_type?: string
          first_seen_at?: string
          id?: string
          label?: string
          last_seen_at?: string
          matched_name?: string | null
          normalized_value?: string
          observation_count?: number
          query?: string
          source?: string
          source_field?: string
          source_payload?: Json
          source_reference?: string | null
          source_value?: string
        }
        Relationships: []
      }
      food_preference_mapping_requests: {
        Row: {
          created_at: string
          first_seen_at: string
          id: string
          language_code: string
          last_seen_at: string
          normalized_value: string
          occurrence_count: number
          preference_rule_type: string
          resolved_ingredient_term_id: string | null
          resolved_mapping_id: string | null
          resolved_preference_tag_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_seen_at?: string
          id?: string
          language_code?: string
          last_seen_at?: string
          normalized_value: string
          occurrence_count?: number
          preference_rule_type: string
          resolved_ingredient_term_id?: string | null
          resolved_mapping_id?: string | null
          resolved_preference_tag_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_seen_at?: string
          id?: string
          language_code?: string
          last_seen_at?: string
          normalized_value?: string
          occurrence_count?: number
          preference_rule_type?: string
          resolved_ingredient_term_id?: string | null
          resolved_mapping_id?: string | null
          resolved_preference_tag_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_preference_mapping_reques_resolved_ingredient_term_id_fkey"
            columns: ["resolved_ingredient_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_preference_mapping_request_resolved_preference_tag_id_fkey"
            columns: ["resolved_preference_tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_preference_mapping_request_resolved_preference_tag_id_fkey"
            columns: ["resolved_preference_tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "food_preference_mapping_requests_resolved_mapping_id_fkey"
            columns: ["resolved_mapping_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_preference_term_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_preference_mapping_requests_resolved_mapping_id_fkey"
            columns: ["resolved_mapping_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_preference_term_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      food_preference_option_catalog: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          normalized_value: string
          source_type: string
          source_values: string[]
          tag_id: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          label: string
          normalized_value: string
          source_type: string
          source_values?: string[]
          tag_id?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          normalized_value?: string
          source_type?: string
          source_values?: string[]
          tag_id?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_preference_option_catalog_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_preference_option_catalog_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      food_servings: {
        Row: {
          amount: number | null
          confidence: string
          created_at: string
          custom_food_id: string | null
          gram_weight: number
          id: number
          is_primary: boolean
          label: string
          owner_user_id: string | null
          serving_order: number
          shared_product_id: string | null
          shared_product_observation_id: string | null
          shared_product_revision_id: string | null
          shared_product_submission_id: string | null
          source: string
          source_observation_id: string | null
          source_reference: string | null
          unit_key: string | null
          updated_at: string
          user_food_list_item_id: string | null
        }
        Insert: {
          amount?: number | null
          confidence: string
          created_at?: string
          custom_food_id?: string | null
          gram_weight: number
          id?: never
          is_primary?: boolean
          label: string
          owner_user_id?: string | null
          serving_order: number
          shared_product_id?: string | null
          shared_product_observation_id?: string | null
          shared_product_revision_id?: string | null
          shared_product_submission_id?: string | null
          source: string
          source_observation_id?: string | null
          source_reference?: string | null
          unit_key?: string | null
          updated_at?: string
          user_food_list_item_id?: string | null
        }
        Update: {
          amount?: number | null
          confidence?: string
          created_at?: string
          custom_food_id?: string | null
          gram_weight?: number
          id?: never
          is_primary?: boolean
          label?: string
          owner_user_id?: string | null
          serving_order?: number
          shared_product_id?: string | null
          shared_product_observation_id?: string | null
          shared_product_revision_id?: string | null
          shared_product_submission_id?: string | null
          source?: string
          source_observation_id?: string | null
          source_reference?: string | null
          unit_key?: string | null
          updated_at?: string
          user_food_list_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_servings_custom_food_id_fkey"
            columns: ["custom_food_id"]
            isOneToOne: false
            referencedRelation: "custom_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_servings_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
          },
          {
            foreignKeyName: "food_servings_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_servings_shared_product_observation_id_fkey"
            columns: ["shared_product_observation_id"]
            isOneToOne: false
            referencedRelation: "shared_product_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_servings_shared_product_revision_id_fkey"
            columns: ["shared_product_revision_id"]
            isOneToOne: false
            referencedRelation: "shared_product_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_servings_shared_product_submission_id_fkey"
            columns: ["shared_product_submission_id"]
            isOneToOne: false
            referencedRelation: "shared_product_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_servings_source_observation_id_fkey"
            columns: ["source_observation_id"]
            isOneToOne: false
            referencedRelation: "shared_product_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_servings_unit_key_fkey"
            columns: ["unit_key"]
            isOneToOne: false
            referencedRelation: "serving_measure_units"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "food_servings_user_food_list_item_id_fkey"
            columns: ["user_food_list_item_id"]
            isOneToOne: false
            referencedRelation: "user_food_list_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_symbol_category_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: number
          match_pattern: string
          priority: number
          source_key: string
          source_reference: string
          symbol_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: never
          match_pattern: string
          priority: number
          source_key: string
          source_reference: string
          symbol_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: never
          match_pattern?: string
          priority?: number
          source_key?: string
          source_reference?: string
          symbol_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_symbol_category_rules_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "food_symbol_category_rules_symbol_key_fkey"
            columns: ["symbol_key"]
            isOneToOne: false
            referencedRelation: "food_symbol_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
      food_symbol_definitions: {
        Row: {
          created_at: string
          display_name: string
          emoji: string
          enabled: boolean
          key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          emoji: string
          enabled?: boolean
          key: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          emoji?: string
          enabled?: boolean
          key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      generic_food_dataset_reference_rows: {
        Row: {
          created_at: string
          dataset_key: string
          payload: Json
          reference_type: string
          source_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dataset_key: string
          payload: Json
          reference_type: string
          source_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dataset_key?: string
          payload?: Json
          reference_type?: string
          source_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generic_food_dataset_reference_rows_dataset_key_fkey"
            columns: ["dataset_key"]
            isOneToOne: false
            referencedRelation: "generic_food_datasets"
            referencedColumns: ["key"]
          },
        ]
      }
      generic_food_datasets: {
        Row: {
          active: boolean
          attribution_text: string
          created_at: string
          display_name: string
          download_url: string
          food_count: number
          import_enabled: boolean
          imported_at: string | null
          key: string
          license_name: string
          license_review_status: string
          license_url: string
          measure_count: number
          metadata: Json
          nutrient_value_count: number
          region_code: string
          source_file_sha256: string | null
          source_key: string
          source_url: string
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          attribution_text: string
          created_at?: string
          display_name: string
          download_url: string
          food_count?: number
          import_enabled?: boolean
          imported_at?: string | null
          key: string
          license_name: string
          license_review_status: string
          license_url: string
          measure_count?: number
          metadata?: Json
          nutrient_value_count?: number
          region_code: string
          source_file_sha256?: string | null
          source_key: string
          source_url: string
          updated_at?: string
          version: string
        }
        Update: {
          active?: boolean
          attribution_text?: string
          created_at?: string
          display_name?: string
          download_url?: string
          food_count?: number
          import_enabled?: boolean
          imported_at?: string | null
          key?: string
          license_name?: string
          license_review_status?: string
          license_url?: string
          measure_count?: number
          metadata?: Json
          nutrient_value_count?: number
          region_code?: string
          source_file_sha256?: string | null
          source_key?: string
          source_url?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "generic_food_datasets_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      generic_food_measures: {
        Row: {
          created_at: string
          dataset_key: string
          description: string
          gram_weight: number
          is_household_measure: boolean
          measure_type: string
          metadata: Json
          source_food_key: string
          source_measure_key: string
          source_updated_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dataset_key: string
          description: string
          gram_weight: number
          is_household_measure?: boolean
          measure_type: string
          metadata?: Json
          source_food_key: string
          source_measure_key: string
          source_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dataset_key?: string
          description?: string
          gram_weight?: number
          is_household_measure?: boolean
          measure_type?: string
          metadata?: Json
          source_food_key?: string
          source_measure_key?: string
          source_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generic_food_measures_dataset_key_source_food_key_fkey"
            columns: ["dataset_key", "source_food_key"]
            isOneToOne: false
            referencedRelation: "generic_food_records"
            referencedColumns: ["dataset_key", "source_food_key"]
          },
        ]
      }
      generic_food_nutrients: {
        Row: {
          amount_per_100g: number | null
          created_at: string
          dataset_key: string
          mapping_status: string
          metadata: Json
          nutrient_id: number | null
          nutrient_source_code: string | null
          observation_count: number | null
          source_food_key: string
          source_nutrient_key: string
          source_nutrient_name: string
          source_updated_at: string | null
          standard_error: number | null
          unit_name: string
          updated_at: string
          value_status: string
        }
        Insert: {
          amount_per_100g?: number | null
          created_at?: string
          dataset_key: string
          mapping_status: string
          metadata?: Json
          nutrient_id?: number | null
          nutrient_source_code?: string | null
          observation_count?: number | null
          source_food_key: string
          source_nutrient_key: string
          source_nutrient_name: string
          source_updated_at?: string | null
          standard_error?: number | null
          unit_name: string
          updated_at?: string
          value_status?: string
        }
        Update: {
          amount_per_100g?: number | null
          created_at?: string
          dataset_key?: string
          mapping_status?: string
          metadata?: Json
          nutrient_id?: number | null
          nutrient_source_code?: string | null
          observation_count?: number | null
          source_food_key?: string
          source_nutrient_key?: string
          source_nutrient_name?: string
          source_updated_at?: string | null
          standard_error?: number | null
          unit_name?: string
          updated_at?: string
          value_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "generic_food_nutrients_dataset_key_source_food_key_fkey"
            columns: ["dataset_key", "source_food_key"]
            isOneToOne: false
            referencedRelation: "generic_food_records"
            referencedColumns: ["dataset_key", "source_food_key"]
          },
          {
            foreignKeyName: "generic_food_nutrients_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
        ]
      }
      generic_food_records: {
        Row: {
          alternate_description: string | null
          application_food_id: number | null
          created_at: string
          dataset_key: string
          description: string
          external_reference: string | null
          food_group_key: string | null
          food_group_name: string | null
          measurement_basis: string
          metadata: Json
          preparation: string | null
          scientific_name: string | null
          search_text: string
          search_vector: unknown
          source_food_code: string | null
          source_food_key: string
          source_updated_at: string | null
          updated_at: string
        }
        Insert: {
          alternate_description?: string | null
          application_food_id?: number | null
          created_at?: string
          dataset_key: string
          description: string
          external_reference?: string | null
          food_group_key?: string | null
          food_group_name?: string | null
          measurement_basis?: string
          metadata?: Json
          preparation?: string | null
          scientific_name?: string | null
          search_text: string
          search_vector?: unknown
          source_food_code?: string | null
          source_food_key: string
          source_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          alternate_description?: string | null
          application_food_id?: number | null
          created_at?: string
          dataset_key?: string
          description?: string
          external_reference?: string | null
          food_group_key?: string | null
          food_group_name?: string | null
          measurement_basis?: string
          metadata?: Json
          preparation?: string | null
          scientific_name?: string | null
          search_text?: string
          search_vector?: unknown
          source_food_code?: string | null
          source_food_key?: string
          source_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generic_food_records_dataset_key_fkey"
            columns: ["dataset_key"]
            isOneToOne: false
            referencedRelation: "generic_food_datasets"
            referencedColumns: ["key"]
          },
        ]
      }
      generic_food_source_identifiers: {
        Row: {
          created_at: string
          dataset_key: string
          identifier_type: string
          identifier_value: string
          metadata: Json
          source_field: string
          source_food_key: string
          source_key: string
          updated_at: string
          verification_method: string
        }
        Insert: {
          created_at?: string
          dataset_key: string
          identifier_type: string
          identifier_value: string
          metadata?: Json
          source_field: string
          source_food_key: string
          source_key: string
          updated_at?: string
          verification_method?: string
        }
        Update: {
          created_at?: string
          dataset_key?: string
          identifier_type?: string
          identifier_value?: string
          metadata?: Json
          source_field?: string
          source_food_key?: string
          source_key?: string
          updated_at?: string
          verification_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "generic_food_source_identifier_dataset_key_source_food_key_fkey"
            columns: ["dataset_key", "source_food_key"]
            isOneToOne: false
            referencedRelation: "generic_food_records"
            referencedColumns: ["dataset_key", "source_food_key"]
          },
          {
            foreignKeyName: "generic_food_source_identifiers_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      ingredient_provenance_options: {
        Row: {
          badge_enabled: boolean
          badge_label: string | null
          badge_tone: string
          created_at: string
          description: string
          dimension: string
          display_order: number
          filter_enabled: boolean
          filter_label: string
          updated_at: string
          value: string
        }
        Insert: {
          badge_enabled?: boolean
          badge_label?: string | null
          badge_tone?: string
          created_at?: string
          description?: string
          dimension: string
          display_order: number
          filter_enabled?: boolean
          filter_label: string
          updated_at?: string
          value: string
        }
        Update: {
          badge_enabled?: boolean
          badge_label?: string | null
          badge_tone?: string
          created_at?: string
          description?: string
          dimension?: string
          display_order?: number
          filter_enabled?: boolean
          filter_label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      ingredient_terms: {
        Row: {
          canonical_key: string
          created_at: string
          default_language_code: string | null
          display_name: string
          id: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_key: string | null
          source_reference: string | null
          updated_at: string
        }
        Insert: {
          canonical_key: string
          created_at?: string
          default_language_code?: string | null
          display_name: string
          id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string | null
          source_reference?: string | null
          updated_at?: string
        }
        Update: {
          canonical_key?: string
          created_at?: string
          default_language_code?: string | null
          display_name?: string
          id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string | null
          source_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_terms_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      mix_goal_template_targets: {
        Row: {
          nutrient_id: number
          target_amount: number
          template_key: string
        }
        Insert: {
          nutrient_id: number
          target_amount: number
          template_key: string
        }
        Update: {
          nutrient_id?: number
          target_amount?: number
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "mix_goal_template_targets_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
          {
            foreignKeyName: "mix_goal_template_targets_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "mix_goal_templates"
            referencedColumns: ["key"]
          },
        ]
      }
      mix_goal_templates: {
        Row: {
          created_at: string
          description: string
          display_name: string
          enabled: boolean
          key: string
          sort_order: number
          source_key: string
          source_reference: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description: string
          display_name: string
          enabled?: boolean
          key: string
          sort_order: number
          source_key: string
          source_reference: string
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          description?: string
          display_name?: string
          enabled?: boolean
          key?: string
          sort_order?: number
          source_key?: string
          source_reference?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "mix_goal_templates_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
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
      mix_runtime_configuration: {
        Row: {
          created_at: string
          enabled: boolean
          key: string
          source_key: string
          source_reference: string
          updated_at: string
          value: Json
          version: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          key: string
          source_key: string
          source_reference: string
          updated_at?: string
          value: Json
          version: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          key?: string
          source_key?: string
          source_reference?: string
          updated_at?: string
          value?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "mix_runtime_configuration_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
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
      nutrient_display_profile_fields: {
        Row: {
          default_goal: number | null
          display_label: string | null
          display_unit: string | null
          highlight: boolean
          nutrient_id: number
          profile_key: string
          sort_order: number
        }
        Insert: {
          default_goal?: number | null
          display_label?: string | null
          display_unit?: string | null
          highlight?: boolean
          nutrient_id: number
          profile_key: string
          sort_order: number
        }
        Update: {
          default_goal?: number | null
          display_label?: string | null
          display_unit?: string | null
          highlight?: boolean
          nutrient_id?: number
          profile_key?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_display_profile_fields_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
          {
            foreignKeyName: "nutrient_display_profile_fields_profile_key_fkey"
            columns: ["profile_key"]
            isOneToOne: false
            referencedRelation: "nutrient_display_profiles"
            referencedColumns: ["key"]
          },
        ]
      }
      nutrient_display_profiles: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          key: string
          purpose: string
          source_key: string
          source_reference: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          key: string
          purpose: string
          source_key: string
          source_reference: string
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          key?: string
          purpose?: string
          source_key?: string
          source_reference?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_display_profiles_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      nutrient_equivalences: {
        Row: {
          canonical_nutrient_id: number
          created_at: string
          enabled: boolean
          id: number
          relation: string
          source_key: string
          source_nutrient_id: number | null
          source_nutrient_number: string | null
          source_reference: string
          updated_at: string
        }
        Insert: {
          canonical_nutrient_id: number
          created_at?: string
          enabled?: boolean
          id?: never
          relation: string
          source_key: string
          source_nutrient_id?: number | null
          source_nutrient_number?: string | null
          source_reference: string
          updated_at?: string
        }
        Update: {
          canonical_nutrient_id?: number
          created_at?: string
          enabled?: boolean
          id?: never
          relation?: string
          source_key?: string
          source_nutrient_id?: number | null
          source_nutrient_number?: string | null
          source_reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_equivalences_canonical_nutrient_id_fkey"
            columns: ["canonical_nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
          {
            foreignKeyName: "nutrient_equivalences_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      nutrient_manual_entry_fields: {
        Row: {
          classification_notes: string | null
          classification_reference: string
          classification_source_key: string
          classification_status: string
          classification_version: number
          created_at: string
          dedupe_key: string
          display_label: string | null
          enabled: boolean
          group_id: string
          last_observed_at: string | null
          nutrient_id: number
          nutrient_type: string
          observation_count: number
          replacement_nutrient_id: number | null
          required_for_manual_entry: boolean
          reviewed_at: string | null
          sort_order: number
          source_count: number
          sources: string[]
          updated_at: string
          verification_status: string
        }
        Insert: {
          classification_notes?: string | null
          classification_reference?: string
          classification_source_key?: string
          classification_status?: string
          classification_version?: number
          created_at?: string
          dedupe_key: string
          display_label?: string | null
          enabled?: boolean
          group_id: string
          last_observed_at?: string | null
          nutrient_id: number
          nutrient_type: string
          observation_count?: number
          replacement_nutrient_id?: number | null
          required_for_manual_entry?: boolean
          reviewed_at?: string | null
          sort_order: number
          source_count?: number
          sources?: string[]
          updated_at?: string
          verification_status?: string
        }
        Update: {
          classification_notes?: string | null
          classification_reference?: string
          classification_source_key?: string
          classification_status?: string
          classification_version?: number
          created_at?: string
          dedupe_key?: string
          display_label?: string | null
          enabled?: boolean
          group_id?: string
          last_observed_at?: string | null
          nutrient_id?: number
          nutrient_type?: string
          observation_count?: number
          replacement_nutrient_id?: number | null
          required_for_manual_entry?: boolean
          reviewed_at?: string | null
          sort_order?: number
          source_count?: number
          sources?: string[]
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_manual_entry_fields_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "nutrient_manual_entry_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrient_manual_entry_fields_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: true
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
          {
            foreignKeyName: "nutrient_manual_entry_fields_replacement_nutrient_id_fkey"
            columns: ["replacement_nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
        ]
      }
      nutrient_manual_entry_groups: {
        Row: {
          created_at: string
          enabled: boolean
          entry_step: string
          group_role: string
          id: string
          last_observed_at: string | null
          observation_count: number
          sort_order: number
          source_count: number
          sources: string[]
          title: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          entry_step: string
          group_role?: string
          id: string
          last_observed_at?: string | null
          observation_count?: number
          sort_order: number
          source_count?: number
          sources?: string[]
          title: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          entry_step?: string
          group_role?: string
          id?: string
          last_observed_at?: string | null
          observation_count?: number
          sort_order?: number
          source_count?: number
          sources?: string[]
          title?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      nutrient_manual_entry_observations: {
        Row: {
          canonical_nutrient_id: number
          classification_method: string
          created_at: string
          dedupe_key: string
          display_label: string
          entry_step: string
          field_sort_order: number
          group_id: string
          group_sort_order: number
          group_title: string
          id: string
          nutrient_id: number
          nutrient_name: string
          nutrient_number: string | null
          nutrient_type: string
          observed_at: string
          query: string
          source: string
          source_data_type: string | null
          source_food_name: string | null
          source_payload: Json
          source_reference: string
          unit_name: string
          updated_at: string
        }
        Insert: {
          canonical_nutrient_id: number
          classification_method: string
          created_at?: string
          dedupe_key: string
          display_label: string
          entry_step: string
          field_sort_order: number
          group_id: string
          group_sort_order: number
          group_title: string
          id?: string
          nutrient_id: number
          nutrient_name: string
          nutrient_number?: string | null
          nutrient_type: string
          observed_at?: string
          query: string
          source: string
          source_data_type?: string | null
          source_food_name?: string | null
          source_payload?: Json
          source_reference: string
          unit_name: string
          updated_at?: string
        }
        Update: {
          canonical_nutrient_id?: number
          classification_method?: string
          created_at?: string
          dedupe_key?: string
          display_label?: string
          entry_step?: string
          field_sort_order?: number
          group_id?: string
          group_sort_order?: number
          group_title?: string
          id?: string
          nutrient_id?: number
          nutrient_name?: string
          nutrient_number?: string | null
          nutrient_type?: string
          observed_at?: string
          query?: string
          source?: string
          source_data_type?: string | null
          source_food_name?: string | null
          source_payload?: Json
          source_reference?: string
          unit_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_manual_entry_observations_canonical_nutrient_id_fkey"
            columns: ["canonical_nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
          {
            foreignKeyName: "nutrient_manual_entry_observations_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
        ]
      }
      nutrient_manual_entry_required_nutrients: {
        Row: {
          created_at: string
          enabled: boolean
          field_sort_order: number
          group_id: string
          nutrient_id: number
          observation_count: number
          provenance: Json
          reason: string
          requirement_key: string
          source: string
          source_count: number
          sources: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          field_sort_order: number
          group_id: string
          nutrient_id: number
          observation_count?: number
          provenance?: Json
          reason: string
          requirement_key: string
          source: string
          source_count?: number
          sources?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          field_sort_order?: number
          group_id?: string
          nutrient_id?: number
          observation_count?: number
          provenance?: Json
          reason?: string
          requirement_key?: string
          source?: string
          source_count?: number
          sources?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_manual_entry_required_nutrients_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "nutrient_manual_entry_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrient_manual_entry_required_nutrients_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: true
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
        ]
      }
      nutrient_relationship_rules: {
        Row: {
          child_nutrient_id: number
          created_at: string
          enabled: boolean
          id: string
          issue_code: string
          observation_count: number
          parent_nutrient_id: number
          provenance: Json
          relationship: string
          requires_parent: boolean
          severity: string
          sort_order: number
          source: string
          source_count: number
          sources: string[]
          tolerance: number
          updated_at: string
        }
        Insert: {
          child_nutrient_id: number
          created_at?: string
          enabled?: boolean
          id: string
          issue_code: string
          observation_count?: number
          parent_nutrient_id: number
          provenance?: Json
          relationship: string
          requires_parent?: boolean
          severity?: string
          sort_order: number
          source: string
          source_count?: number
          sources?: string[]
          tolerance?: number
          updated_at?: string
        }
        Update: {
          child_nutrient_id?: number
          created_at?: string
          enabled?: boolean
          id?: string
          issue_code?: string
          observation_count?: number
          parent_nutrient_id?: number
          provenance?: Json
          relationship?: string
          requires_parent?: boolean
          severity?: string
          sort_order?: number
          source?: string
          source_count?: number
          sources?: string[]
          tolerance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_relationship_rules_child_nutrient_id_fkey"
            columns: ["child_nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
          {
            foreignKeyName: "nutrient_relationship_rules_issue_code_fkey"
            columns: ["issue_code"]
            isOneToOne: false
            referencedRelation: "app_issue_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "nutrient_relationship_rules_parent_nutrient_id_fkey"
            columns: ["parent_nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
        ]
      }
      nutrient_source_mappings: {
        Row: {
          confidence: number
          created_at: string
          enabled: boolean
          first_observed_at: string | null
          last_observed_at: string | null
          mapping_method: string
          nutrient_id: number
          observation_count: number
          priority: number
          provenance: Json
          review_reference: string | null
          review_status: string
          reviewed_at: string | null
          source_key: string
          source_nutrient_key: string
          source_nutrient_name: string | null
          source_unit_name: string
          updated_at: string
        }
        Insert: {
          confidence: number
          created_at?: string
          enabled?: boolean
          first_observed_at?: string | null
          last_observed_at?: string | null
          mapping_method: string
          nutrient_id: number
          observation_count?: number
          priority?: number
          provenance?: Json
          review_reference?: string | null
          review_status?: string
          reviewed_at?: string | null
          source_key: string
          source_nutrient_key: string
          source_nutrient_name?: string | null
          source_unit_name?: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          enabled?: boolean
          first_observed_at?: string | null
          last_observed_at?: string | null
          mapping_method?: string
          nutrient_id?: number
          observation_count?: number
          priority?: number
          provenance?: Json
          review_reference?: string | null
          review_status?: string
          reviewed_at?: string | null
          source_key?: string
          source_nutrient_key?: string
          source_nutrient_name?: string | null
          source_unit_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_source_mappings_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
          {
            foreignKeyName: "nutrient_source_mappings_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      nutrient_unit_conversions: {
        Row: {
          confidence: number
          conversion_method: string
          created_at: string
          from_unit_name: string
          multiplier: number
          nutrient_id: number
          observation_count: number
          provenance: Json
          source_key: string
          to_unit_name: string
          updated_at: string
        }
        Insert: {
          confidence: number
          conversion_method: string
          created_at?: string
          from_unit_name: string
          multiplier: number
          nutrient_id: number
          observation_count?: number
          provenance?: Json
          source_key: string
          to_unit_name: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          conversion_method?: string
          created_at?: string
          from_unit_name?: string
          multiplier?: number
          nutrient_id?: number
          observation_count?: number
          provenance?: Json
          source_key?: string
          to_unit_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_unit_conversions_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
          {
            foreignKeyName: "nutrient_unit_conversions_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      nutrition_completeness_profile_nutrients: {
        Row: {
          created_at: string
          display_order: number
          nutrient_id: number
          profile_key: string
          reason: string
          requirement_level: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order: number
          nutrient_id: number
          profile_key: string
          reason: string
          requirement_level: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          nutrient_id?: number
          profile_key?: string
          reason?: string
          requirement_level?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_completeness_profile_nutrients_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient_definitions"
            referencedColumns: ["nutrient_id"]
          },
          {
            foreignKeyName: "nutrition_completeness_profile_nutrients_profile_key_fkey"
            columns: ["profile_key"]
            isOneToOne: false
            referencedRelation: "nutrition_completeness_profiles"
            referencedColumns: ["key"]
          },
        ]
      }
      nutrition_completeness_profiles: {
        Row: {
          complete_label: string
          created_at: string
          description: string
          display_name: string
          enabled: boolean
          food_scope: string
          is_default: boolean
          key: string
          limited_label: string
          partial_label: string
          region_code: string
          resolved_label: string
          source_key: string
          source_reference: string
          updated_at: string
        }
        Insert: {
          complete_label: string
          created_at?: string
          description: string
          display_name: string
          enabled?: boolean
          food_scope: string
          is_default?: boolean
          key: string
          limited_label: string
          partial_label: string
          region_code?: string
          resolved_label: string
          source_key: string
          source_reference: string
          updated_at?: string
        }
        Update: {
          complete_label?: string
          created_at?: string
          description?: string
          display_name?: string
          enabled?: boolean
          food_scope?: string
          is_default?: boolean
          key?: string
          limited_label?: string
          partial_label?: string
          region_code?: string
          resolved_label?: string
          source_key?: string
          source_reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_completeness_profiles_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
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
      product_compatibility_facts: {
        Row: {
          confidence: string
          created_at: string
          fact_type: string
          id: string
          ingredient_component_id: string | null
          match_rule_id: string | null
          policy_version_id: string
          precautionary_statement_id: string | null
          shared_product_id: string | null
          shared_product_observation_id: string | null
          shared_product_submission_id: string | null
          source_text: string | null
          source_type: string
          tag_id: string
          updated_at: string
        }
        Insert: {
          confidence: string
          created_at?: string
          fact_type: string
          id?: string
          ingredient_component_id?: string | null
          match_rule_id?: string | null
          policy_version_id?: string
          precautionary_statement_id?: string | null
          shared_product_id?: string | null
          shared_product_observation_id?: string | null
          shared_product_submission_id?: string | null
          source_text?: string | null
          source_type: string
          tag_id: string
          updated_at?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          fact_type?: string
          id?: string
          ingredient_component_id?: string | null
          match_rule_id?: string | null
          policy_version_id?: string
          precautionary_statement_id?: string | null
          shared_product_id?: string | null
          shared_product_observation_id?: string | null
          shared_product_submission_id?: string | null
          source_text?: string | null
          source_type?: string
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_compatibility_facts_ingredient_component_id_fkey"
            columns: ["ingredient_component_id"]
            isOneToOne: false
            referencedRelation: "product_ingredient_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_facts_match_rule_id_fkey"
            columns: ["match_rule_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_match_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_facts_match_rule_id_fkey"
            columns: ["match_rule_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_match_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_facts_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_facts_precautionary_statement_id_fkey"
            columns: ["precautionary_statement_id"]
            isOneToOne: false
            referencedRelation: "product_precautionary_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_facts_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
          },
          {
            foreignKeyName: "product_compatibility_facts_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_facts_shared_product_observation_id_fkey"
            columns: ["shared_product_observation_id"]
            isOneToOne: false
            referencedRelation: "shared_product_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_facts_shared_product_submission_id_fkey"
            columns: ["shared_product_submission_id"]
            isOneToOne: false
            referencedRelation: "shared_product_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_facts_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_facts_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      product_data_sources: {
        Row: {
          api_base_url: string | null
          api_redistribution_allowed: boolean
          attribution_text: string | null
          canonical_license_name: string | null
          canonical_policy_notes: string | null
          canonical_policy_reviewed_at: string | null
          canonical_storage_allowed: boolean
          created_at: string
          display_name: string
          enabled: boolean
          first_observed_at: string | null
          homepage_url: string | null
          key: string
          last_observed_at: string | null
          observation_count: number
          provenance: Json
          source_type: string
          terms_url: string | null
          updated_at: string
        }
        Insert: {
          api_base_url?: string | null
          api_redistribution_allowed?: boolean
          attribution_text?: string | null
          canonical_license_name?: string | null
          canonical_policy_notes?: string | null
          canonical_policy_reviewed_at?: string | null
          canonical_storage_allowed?: boolean
          created_at?: string
          display_name: string
          enabled?: boolean
          first_observed_at?: string | null
          homepage_url?: string | null
          key: string
          last_observed_at?: string | null
          observation_count?: number
          provenance?: Json
          source_type: string
          terms_url?: string | null
          updated_at?: string
        }
        Update: {
          api_base_url?: string | null
          api_redistribution_allowed?: boolean
          attribution_text?: string | null
          canonical_license_name?: string | null
          canonical_policy_notes?: string | null
          canonical_policy_reviewed_at?: string | null
          canonical_storage_allowed?: boolean
          created_at?: string
          display_name?: string
          enabled?: boolean
          first_observed_at?: string | null
          homepage_url?: string | null
          key?: string
          last_observed_at?: string | null
          observation_count?: number
          provenance?: Json
          source_type?: string
          terms_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_ingredient_components: {
        Row: {
          created_at: string
          depth: number
          id: string
          ingredient_term_id: string | null
          language_code: string | null
          normalized_text: string | null
          parent_component_id: string | null
          percent_estimate: number | null
          percent_exact: number | null
          percent_max: number | null
          percent_min: number | null
          processing_state: string | null
          source_component_id: string | null
          source_order: number
          source_path: number[]
          source_payload: Json
          source_text: string
          statement_id: string
          updated_at: string
          vegan_status: string | null
          vegetarian_status: string | null
        }
        Insert: {
          created_at?: string
          depth: number
          id?: string
          ingredient_term_id?: string | null
          language_code?: string | null
          normalized_text?: string | null
          parent_component_id?: string | null
          percent_estimate?: number | null
          percent_exact?: number | null
          percent_max?: number | null
          percent_min?: number | null
          processing_state?: string | null
          source_component_id?: string | null
          source_order: number
          source_path: number[]
          source_payload?: Json
          source_text: string
          statement_id: string
          updated_at?: string
          vegan_status?: string | null
          vegetarian_status?: string | null
        }
        Update: {
          created_at?: string
          depth?: number
          id?: string
          ingredient_term_id?: string | null
          language_code?: string | null
          normalized_text?: string | null
          parent_component_id?: string | null
          percent_estimate?: number | null
          percent_exact?: number | null
          percent_max?: number | null
          percent_min?: number | null
          processing_state?: string | null
          source_component_id?: string | null
          source_order?: number
          source_path?: number[]
          source_payload?: Json
          source_text?: string
          statement_id?: string
          updated_at?: string
          vegan_status?: string | null
          vegetarian_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredient_components_ingredient_term_id_fkey"
            columns: ["ingredient_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_components_parent_fkey"
            columns: ["statement_id", "parent_component_id"]
            isOneToOne: false
            referencedRelation: "product_ingredient_components"
            referencedColumns: ["statement_id", "id"]
          },
          {
            foreignKeyName: "product_ingredient_components_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "product_ingredient_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredient_statements: {
        Row: {
          content_hash: string
          created_at: string
          extraction_method: string
          id: string
          language_code: string | null
          raw_statement: string | null
          shared_product_id: string | null
          shared_product_observation_id: string | null
          shared_product_submission_id: string | null
          source_field: string
          source_key: string | null
          source_observation_id: string | null
          source_value: Json
          updated_at: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          extraction_method: string
          id?: string
          language_code?: string | null
          raw_statement?: string | null
          shared_product_id?: string | null
          shared_product_observation_id?: string | null
          shared_product_submission_id?: string | null
          source_field: string
          source_key?: string | null
          source_observation_id?: string | null
          source_value: Json
          updated_at?: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          extraction_method?: string
          id?: string
          language_code?: string | null
          raw_statement?: string | null
          shared_product_id?: string | null
          shared_product_observation_id?: string | null
          shared_product_submission_id?: string | null
          source_field?: string
          source_key?: string | null
          source_observation_id?: string | null
          source_value?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredient_statements_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
          },
          {
            foreignKeyName: "product_ingredient_statements_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_statements_shared_product_observation_i_fkey"
            columns: ["shared_product_observation_id"]
            isOneToOne: false
            referencedRelation: "shared_product_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_statements_shared_product_submission_id_fkey"
            columns: ["shared_product_submission_id"]
            isOneToOne: false
            referencedRelation: "shared_product_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_statements_source_observation_id_fkey"
            columns: ["source_observation_id"]
            isOneToOne: false
            referencedRelation: "shared_product_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_precautionary_statements: {
        Row: {
          content_hash: string
          created_at: string
          id: string
          label_observed_at: string | null
          language_code: string | null
          normalized_allergens: string[]
          shared_product_id: string | null
          shared_product_observation_id: string | null
          shared_product_revision_id: string | null
          shared_product_submission_id: string | null
          source_field: string
          source_key: string | null
          source_observation_id: string | null
          source_payload: Json
          source_reference: string | null
          statement_text: string
          statement_type: string
          updated_at: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          id?: string
          label_observed_at?: string | null
          language_code?: string | null
          normalized_allergens?: string[]
          shared_product_id?: string | null
          shared_product_observation_id?: string | null
          shared_product_revision_id?: string | null
          shared_product_submission_id?: string | null
          source_field: string
          source_key?: string | null
          source_observation_id?: string | null
          source_payload?: Json
          source_reference?: string | null
          statement_text: string
          statement_type: string
          updated_at?: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          id?: string
          label_observed_at?: string | null
          language_code?: string | null
          normalized_allergens?: string[]
          shared_product_id?: string | null
          shared_product_observation_id?: string | null
          shared_product_revision_id?: string | null
          shared_product_submission_id?: string | null
          source_field?: string
          source_key?: string | null
          source_observation_id?: string | null
          source_payload?: Json
          source_reference?: string | null
          statement_text?: string
          statement_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_precautionary_stateme_shared_product_observation_i_fkey"
            columns: ["shared_product_observation_id"]
            isOneToOne: false
            referencedRelation: "shared_product_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_precautionary_stateme_shared_product_submission_id_fkey"
            columns: ["shared_product_submission_id"]
            isOneToOne: false
            referencedRelation: "shared_product_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_precautionary_statement_shared_product_revision_id_fkey"
            columns: ["shared_product_revision_id"]
            isOneToOne: false
            referencedRelation: "shared_product_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_precautionary_statements_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
          },
          {
            foreignKeyName: "product_precautionary_statements_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_precautionary_statements_source_observation_id_fkey"
            columns: ["source_observation_id"]
            isOneToOne: false
            referencedRelation: "shared_product_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_source_daily_metrics: {
        Row: {
          api_error_count: number
          api_request_count: number
          brand_present_count: number
          cache_hit_count: number
          category_present_count: number
          completed_lookup_count: number
          created_at: string
          error_count: number
          evaluated_product_count: number
          exact_barcode_match_count: number
          image_present_count: number
          ingredients_present_count: number
          lookup_count: number
          lookup_kind: string
          lookup_origin: string
          match_count: number
          metric_date: string
          reported_nutrient_total: number
          response_milliseconds_total: number
          serving_present_count: number
          source_data_type: string
          source_key: string
          updated_at: string
        }
        Insert: {
          api_error_count?: number
          api_request_count?: number
          brand_present_count?: number
          cache_hit_count?: number
          category_present_count?: number
          completed_lookup_count?: number
          created_at?: string
          error_count?: number
          evaluated_product_count?: number
          exact_barcode_match_count?: number
          image_present_count?: number
          ingredients_present_count?: number
          lookup_count?: number
          lookup_kind: string
          lookup_origin?: string
          match_count?: number
          metric_date: string
          reported_nutrient_total?: number
          response_milliseconds_total?: number
          serving_present_count?: number
          source_data_type?: string
          source_key: string
          updated_at?: string
        }
        Update: {
          api_error_count?: number
          api_request_count?: number
          brand_present_count?: number
          cache_hit_count?: number
          category_present_count?: number
          completed_lookup_count?: number
          created_at?: string
          error_count?: number
          evaluated_product_count?: number
          exact_barcode_match_count?: number
          image_present_count?: number
          ingredients_present_count?: number
          lookup_count?: number
          lookup_kind?: string
          lookup_origin?: string
          match_count?: number
          metric_date?: string
          reported_nutrient_total?: number
          response_milliseconds_total?: number
          serving_present_count?: number
          source_data_type?: string
          source_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_source_daily_metrics_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      product_source_evaluations: {
        Row: {
          created_at: string
          decision: string
          details: Json
          evaluated_at: string
          evaluation_kind: string
          evidence_url: string | null
          id: string
          matched_count: number
          sample_size: number
          source_key: string
          summary: string
          usable_count: number
        }
        Insert: {
          created_at?: string
          decision: string
          details?: Json
          evaluated_at?: string
          evaluation_kind: string
          evidence_url?: string | null
          id?: string
          matched_count?: number
          sample_size?: number
          source_key: string
          summary: string
          usable_count?: number
        }
        Update: {
          created_at?: string
          decision?: string
          details?: Json
          evaluated_at?: string
          evaluation_kind?: string
          evidence_url?: string | null
          id?: string
          matched_count?: number
          sample_size?: number
          source_key?: string
          summary?: string
          usable_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_source_evaluations_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
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
          appearance_theme: string
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
          appearance_theme?: string
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
          appearance_theme?: string
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
      request_rate_limits: {
        Row: {
          expires_at: string
          request_count: number
          scope: string
          subject_hash: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          expires_at: string
          request_count: number
          scope: string
          subject_hash: string
          updated_at?: string
          window_started_at: string
        }
        Update: {
          expires_at?: string
          request_count?: number
          scope?: string
          subject_hash?: string
          updated_at?: string
          window_started_at?: string
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
      serving_measure_aliases: {
        Row: {
          alias: string
          created_at: string
          first_observed_at: string | null
          last_observed_at: string | null
          normalized_alias: string
          observation_count: number
          source_key: string
          unit_key: string
          updated_at: string
        }
        Insert: {
          alias: string
          created_at?: string
          first_observed_at?: string | null
          last_observed_at?: string | null
          normalized_alias: string
          observation_count?: number
          source_key: string
          unit_key: string
          updated_at?: string
        }
        Update: {
          alias?: string
          created_at?: string
          first_observed_at?: string | null
          last_observed_at?: string | null
          normalized_alias?: string
          observation_count?: number
          source_key?: string
          unit_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "serving_measure_aliases_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "serving_measure_aliases_unit_key_fkey"
            columns: ["unit_key"]
            isOneToOne: false
            referencedRelation: "serving_measure_units"
            referencedColumns: ["key"]
          },
        ]
      }
      serving_measure_units: {
        Row: {
          base_unit_key: string
          conversion_to_base: number
          created_at: string
          dimension: string
          display_label: string
          display_order: number
          enabled: boolean
          is_default: boolean
          key: string
          observed_at: string
          short_label: string
          source_key: string
          source_reference: string
          standards_code: string
          updated_at: string
        }
        Insert: {
          base_unit_key: string
          conversion_to_base: number
          created_at?: string
          dimension: string
          display_label: string
          display_order: number
          enabled?: boolean
          is_default?: boolean
          key: string
          observed_at: string
          short_label: string
          source_key: string
          source_reference: string
          standards_code: string
          updated_at?: string
        }
        Update: {
          base_unit_key?: string
          conversion_to_base?: number
          created_at?: string
          dimension?: string
          display_label?: string
          display_order?: number
          enabled?: boolean
          is_default?: boolean
          key?: string
          observed_at?: string
          short_label?: string
          source_key?: string
          source_reference?: string
          standards_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "serving_measure_units_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
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
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
          },
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
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
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
      shared_product_revision_changes: {
        Row: {
          change_type: string
          created_at: string
          field_label: string
          field_path: string
          id: string
          new_value: Json | null
          previous_value: Json | null
          revision_id: string
          severity: string
        }
        Insert: {
          change_type: string
          created_at?: string
          field_label: string
          field_path: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          revision_id: string
          severity: string
        }
        Update: {
          change_type?: string
          created_at?: string
          field_label?: string
          field_path?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          revision_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_product_revision_changes_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "shared_product_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_product_revisions: {
        Row: {
          category_option_id: string | null
          change_summary: Json
          created_at: string
          created_by: string | null
          food: Json
          id: string
          label_observed_at: string
          revision_number: number
          shared_product_id: string
          source: string
          source_reference: string | null
          submission_id: string | null
          supersedes_revision_id: string | null
        }
        Insert: {
          category_option_id?: string | null
          change_summary?: Json
          created_at?: string
          created_by?: string | null
          food: Json
          id?: string
          label_observed_at?: string
          revision_number: number
          shared_product_id: string
          source: string
          source_reference?: string | null
          submission_id?: string | null
          supersedes_revision_id?: string | null
        }
        Update: {
          category_option_id?: string | null
          change_summary?: Json
          created_at?: string
          created_by?: string | null
          food?: Json
          id?: string
          label_observed_at?: string
          revision_number?: number
          shared_product_id?: string
          source?: string
          source_reference?: string | null
          submission_id?: string | null
          supersedes_revision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_product_revisions_category_option_id_fkey"
            columns: ["category_option_id"]
            isOneToOne: false
            referencedRelation: "custom_food_category_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_product_revisions_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
          },
          {
            foreignKeyName: "shared_product_revisions_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_product_revisions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "shared_product_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_product_revisions_supersedes_revision_id_fkey"
            columns: ["supersedes_revision_id"]
            isOneToOne: false
            referencedRelation: "shared_product_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_product_submissions: {
        Row: {
          barcode: string
          base_revision_id: string | null
          brand_owner: string | null
          category_option_id: string | null
          change_summary: Json
          consent_to_share: boolean
          created_at: string
          evidence_complete: boolean
          evidence_paths: Json
          food: Json
          id: string
          label_observed_at: string
          matched_reference: string | null
          matched_source: string | null
          product_name: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submission_intent: string
          submission_kind: string
          submitted_by: string
          target_shared_product_id: string | null
          updated_at: string
          validation_report: Json
          verification_status: string
        }
        Insert: {
          barcode: string
          base_revision_id?: string | null
          brand_owner?: string | null
          category_option_id?: string | null
          change_summary?: Json
          consent_to_share: boolean
          created_at?: string
          evidence_complete?: boolean
          evidence_paths?: Json
          food: Json
          id?: string
          label_observed_at?: string
          matched_reference?: string | null
          matched_source?: string | null
          product_name: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_intent?: string
          submission_kind?: string
          submitted_by: string
          target_shared_product_id?: string | null
          updated_at?: string
          validation_report?: Json
          verification_status?: string
        }
        Update: {
          barcode?: string
          base_revision_id?: string | null
          brand_owner?: string | null
          category_option_id?: string | null
          change_summary?: Json
          consent_to_share?: boolean
          created_at?: string
          evidence_complete?: boolean
          evidence_paths?: Json
          food?: Json
          id?: string
          label_observed_at?: string
          matched_reference?: string | null
          matched_source?: string | null
          product_name?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_intent?: string
          submission_kind?: string
          submitted_by?: string
          target_shared_product_id?: string | null
          updated_at?: string
          validation_report?: Json
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_product_submissions_base_revision_id_fkey"
            columns: ["base_revision_id"]
            isOneToOne: false
            referencedRelation: "shared_product_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_product_submissions_category_option_id_fkey"
            columns: ["category_option_id"]
            isOneToOne: false
            referencedRelation: "custom_food_category_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_product_submissions_target_shared_product_id_fkey"
            columns: ["target_shared_product_id"]
            isOneToOne: false
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
          },
          {
            foreignKeyName: "shared_product_submissions_target_shared_product_id_fkey"
            columns: ["target_shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_products: {
        Row: {
          approved_by: string | null
          approved_submission_id: string | null
          barcode: string
          brand_owner: string | null
          canonical_provenance: Json
          category_option_id: string | null
          compatibility_summary: Json
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
          category_option_id?: string | null
          compatibility_summary?: Json
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
          category_option_id?: string | null
          compatibility_summary?: Json
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
          {
            foreignKeyName: "shared_products_category_option_id_fkey"
            columns: ["category_option_id"]
            isOneToOne: false
            referencedRelation: "custom_food_category_options"
            referencedColumns: ["id"]
          },
        ]
      }
      user_compatibility_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          ingredient_alias_id: string | null
          ingredient_term_id: string | null
          normalized_value: string
          preference_term_mapping_id: string | null
          raw_value: string
          resolution_language_code: string
          resolution_method: string
          resolution_policy_version_id: string
          resolution_status: string
          rule_type: string
          severity: string
          tag_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          ingredient_alias_id?: string | null
          ingredient_term_id?: string | null
          normalized_value: string
          preference_term_mapping_id?: string | null
          raw_value: string
          resolution_language_code?: string
          resolution_method?: string
          resolution_policy_version_id: string
          resolution_status?: string
          rule_type: string
          severity: string
          tag_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          ingredient_alias_id?: string | null
          ingredient_term_id?: string | null
          normalized_value?: string
          preference_term_mapping_id?: string | null
          raw_value?: string
          resolution_language_code?: string
          resolution_method?: string
          resolution_policy_version_id?: string
          resolution_status?: string
          rule_type?: string
          severity?: string
          tag_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_compatibility_rules_ingredient_alias_id_fkey"
            columns: ["ingredient_alias_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_ingredient_aliases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compatibility_rules_ingredient_alias_id_fkey"
            columns: ["ingredient_alias_id"]
            isOneToOne: false
            referencedRelation: "ingredient_term_aliases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compatibility_rules_ingredient_term_id_fkey"
            columns: ["ingredient_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compatibility_rules_preference_term_mapping_id_fkey"
            columns: ["preference_term_mapping_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_preference_term_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compatibility_rules_preference_term_mapping_id_fkey"
            columns: ["preference_term_mapping_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_preference_term_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compatibility_rules_resolution_policy_version_id_fkey"
            columns: ["resolution_policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compatibility_rules_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compatibility_rules_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      user_food_list_items: {
        Row: {
          created_at: string
          fdc_id: number
          food: Json
          food_identity_key: string | null
          id: string
          list_type: string
          shared_product_id: string | null
          shared_product_submission_id: string | null
          source_key: string
          trust_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fdc_id: number
          food: Json
          food_identity_key?: string | null
          id?: string
          list_type: string
          shared_product_id?: string | null
          shared_product_submission_id?: string | null
          source_key?: string
          trust_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fdc_id?: number
          food?: Json
          food_identity_key?: string | null
          id?: string
          list_type?: string
          shared_product_id?: string | null
          shared_product_submission_id?: string | null
          source_key?: string
          trust_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_food_list_items_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "blendcalc_api_v1_product_readiness"
            referencedColumns: ["shared_product_id"]
          },
          {
            foreignKeyName: "user_food_list_items_shared_product_id_fkey"
            columns: ["shared_product_id"]
            isOneToOne: false
            referencedRelation: "shared_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_food_list_items_shared_product_submission_id_fkey"
            columns: ["shared_product_submission_id"]
            isOneToOne: false
            referencedRelation: "shared_product_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_food_preferences: {
        Row: {
          allergens: string[]
          created_at: string
          default_smoothie_serving_grams: number | null
          dietary_restrictions: string[]
          prioritized_nutrient_ids: number[]
          regulatory_region_code: string | null
          regulatory_region_source: string | null
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
          prioritized_nutrient_ids?: number[]
          regulatory_region_code?: string | null
          regulatory_region_source?: string | null
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
          prioritized_nutrient_ids?: number[]
          regulatory_region_code?: string | null
          regulatory_region_source?: string | null
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
      blendcalc_api_v1_product_readiness: {
        Row: {
          barcode: string | null
          product_name: string | null
          publishable: boolean | null
          reasons: string[] | null
          shared_product_id: string | null
        }
        Insert: {
          barcode?: string | null
          product_name?: string | null
          publishable?: never
          reasons?: never
          shared_product_id?: string | null
        }
        Update: {
          barcode?: string | null
          product_name?: string | null
          publishable?: never
          reasons?: never
          shared_product_id?: string | null
        }
        Relationships: []
      }
      compatibility_rule_conflicts: {
        Row: {
          created_at: string | null
          fact_tag_id: string | null
          policy_version_id: string | null
          preference_tag_id: string | null
          priority: number | null
          severity: string | null
          updated_at: string | null
          warning_code: string | null
        }
        Insert: {
          created_at?: string | null
          fact_tag_id?: string | null
          policy_version_id?: string | null
          preference_tag_id?: string | null
          priority?: number | null
          severity?: string | null
          updated_at?: string | null
          warning_code?: string | null
        }
        Update: {
          created_at?: string | null
          fact_tag_id?: string | null
          policy_version_id?: string | null
          preference_tag_id?: string | null
          priority?: number | null
          severity?: string | null
          updated_at?: string | null
          warning_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compatibility_rule_conflicts_fact_tag_id_fkey"
            columns: ["fact_tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibility_rule_conflicts_fact_tag_id_fkey"
            columns: ["fact_tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "compatibility_rule_conflicts_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibility_rule_conflicts_preference_tag_id_fkey"
            columns: ["preference_tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibility_rule_conflicts_preference_tag_id_fkey"
            columns: ["preference_tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "compatibility_rule_conflicts_warning_code_fkey"
            columns: ["warning_code"]
            isOneToOne: false
            referencedRelation: "app_issue_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      food_compatibility_match_rules: {
        Row: {
          confidence: string | null
          created_at: string | null
          enabled: boolean | null
          exclude_pattern: string | null
          fact_type: string | null
          field_name: string | null
          id: string | null
          match_pattern: string | null
          policy_version_id: string | null
          priority: number | null
          source_key: string | null
          source_type: string | null
          tag_id: string | null
          updated_at: string | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          enabled?: boolean | null
          exclude_pattern?: string | null
          fact_type?: string | null
          field_name?: string | null
          id?: string | null
          match_pattern?: string | null
          policy_version_id?: string | null
          priority?: number | null
          source_key?: string | null
          source_type?: string | null
          tag_id?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          enabled?: boolean | null
          exclude_pattern?: string | null
          fact_type?: string | null
          field_name?: string | null
          id?: string | null
          match_pattern?: string | null
          policy_version_id?: string | null
          priority?: number | null
          source_key?: string | null
          source_type?: string | null
          tag_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_compatibility_match_rules_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_match_rules_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_match_rules_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      food_compatibility_policy_coverage: {
        Row: {
          category: string | null
          conflict_count: number | null
          evidence_rule_count: number | null
          label: string | null
          selectable: boolean | null
          slug: string | null
          tag_id: string | null
        }
        Insert: {
          category?: string | null
          conflict_count?: never
          evidence_rule_count?: never
          label?: string | null
          selectable?: never
          slug?: string | null
          tag_id?: string | null
        }
        Update: {
          category?: string | null
          conflict_count?: never
          evidence_rule_count?: never
          label?: string | null
          selectable?: never
          slug?: string | null
          tag_id?: string | null
        }
        Relationships: []
      }
      food_compatibility_preference_term_mappings: {
        Row: {
          created_at: string | null
          id: string | null
          ingredient_term_id: string | null
          policy_version_id: string | null
          preference_rule_type: string | null
          preference_tag_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_reference: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          ingredient_term_id?: string | null
          policy_version_id?: string | null
          preference_rule_type?: string | null
          preference_tag_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          ingredient_term_id?: string | null
          policy_version_id?: string | null
          preference_rule_type?: string | null
          preference_tag_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_compatibility_policy_preference_te_ingredient_term_id_fkey"
            columns: ["ingredient_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_policy_preference_ter_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_policy_preference_ter_preference_tag_id_fkey"
            columns: ["preference_tag_id"]
            isOneToOne: false
            referencedRelation: "compatibility_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_compatibility_policy_preference_ter_preference_tag_id_fkey"
            columns: ["preference_tag_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_coverage"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      ingredient_term_aliases: {
        Row: {
          alias: string | null
          alias_type: string | null
          created_at: string | null
          id: string | null
          ingredient_term_id: string | null
          language_code: string | null
          normalized_alias: string | null
          policy_version_id: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_key: string | null
          source_reference: string | null
          updated_at: string | null
        }
        Insert: {
          alias?: string | null
          alias_type?: string | null
          created_at?: string | null
          id?: string | null
          ingredient_term_id?: string | null
          language_code?: string | null
          normalized_alias?: string | null
          policy_version_id?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string | null
          source_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          alias?: string | null
          alias_type?: string | null
          created_at?: string | null
          id?: string | null
          ingredient_term_id?: string | null
          language_code?: string | null
          normalized_alias?: string | null
          policy_version_id?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string | null
          source_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_term_aliases_ingredient_term_id_fkey"
            columns: ["ingredient_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_term_aliases_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_term_aliases_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      ingredient_term_relationships: {
        Row: {
          child_term_id: string | null
          conflict_inheritance: string | null
          created_at: string | null
          id: string | null
          jurisdiction_code: string | null
          parent_term_id: string | null
          policy_version_id: string | null
          processing_state: string | null
          relationship_type: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_key: string | null
          source_reference: string | null
          updated_at: string | null
        }
        Insert: {
          child_term_id?: string | null
          conflict_inheritance?: string | null
          created_at?: string | null
          id?: string | null
          jurisdiction_code?: string | null
          parent_term_id?: string | null
          policy_version_id?: string | null
          processing_state?: string | null
          relationship_type?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string | null
          source_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          child_term_id?: string | null
          conflict_inheritance?: string | null
          created_at?: string | null
          id?: string | null
          jurisdiction_code?: string | null
          parent_term_id?: string | null
          policy_version_id?: string | null
          processing_state?: string | null
          relationship_type?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string | null
          source_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_term_relationships_child_term_id_fkey"
            columns: ["child_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_term_relationships_parent_term_id_fkey"
            columns: ["parent_term_id"]
            isOneToOne: false
            referencedRelation: "ingredient_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_term_relationships_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "food_compatibility_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_term_relationships_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "product_data_sources"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Functions: {
      activate_food_compatibility_policy_version: {
        Args: { p_policy_version_id: string }
        Returns: number
      }
      active_food_compatibility_policy_version_id: {
        Args: never
        Returns: string
      }
      apply_shared_product_external_enrichment: {
        Args: {
          p_barcode: string
          p_candidate_fields?: string[]
          p_category_option_id?: string
          p_enriched_food: Json
          p_observations?: Json
          p_provenance?: Json
          p_shared_product_id: string
        }
        Returns: string[]
      }
      blendcalc_api_v1_product_readiness_reasons: {
        Args: { p_shared_product_id: string }
        Returns: string[]
      }
      blendcalc_api_v1_source_is_eligible: {
        Args: { p_source: string }
        Returns: boolean
      }
      catalog_change_summary_is_valid: {
        Args: { p_require_changes?: boolean; p_summary: Json }
        Returns: boolean
      }
      compatibility_first_regex_match: {
        Args: { p_pattern: string; p_value: string }
        Returns: string
      }
      compatibility_normalize_text: {
        Args: { p_value: string }
        Returns: string
      }
      consume_request_rate_limit: {
        Args: {
          p_limit: number
          p_scope: string
          p_subject_hash: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      create_food_compatibility_policy_draft: {
        Args: {
          p_change_summary: string
          p_effective_at: string
          p_reviewed_at: string
          p_source_references: Json
          p_version_number: number
        }
        Returns: string
      }
      default_profile_display_name: {
        Args: { p_user_id: string }
        Returns: string
      }
      delete_saved_drink: { Args: { p_id: string }; Returns: boolean }
      extract_product_compatibility_facts: {
        Args: {
          p_food?: Json
          p_parent_source?: string
          p_shared_product_id?: string
          p_shared_product_observation_id?: string
          p_shared_product_submission_id?: string
        }
        Returns: undefined
      }
      extract_product_compatibility_facts_base: {
        Args: {
          p_food?: Json
          p_parent_source?: string
          p_shared_product_id?: string
          p_shared_product_observation_id?: string
          p_shared_product_submission_id?: string
        }
        Returns: undefined
      }
      extract_product_compatibility_facts_unlinked: {
        Args: {
          p_food?: Json
          p_parent_source?: string
          p_shared_product_id?: string
          p_shared_product_observation_id?: string
          p_shared_product_submission_id?: string
        }
        Returns: undefined
      }
      food_list_item_identity_key: {
        Args: { p_fdc_id: number; p_food: Json }
        Returns: string
      }
      food_metadata_search_text: { Args: { p_food: Json }; Returns: string }
      food_normalized_barcode: { Args: { p_food: Json }; Returns: string }
      food_source_key: { Args: { p_food: Json }; Returns: string }
      food_trust_status: { Args: { p_food: Json }; Returns: string }
      get_blendcalc_product_revision_history_v1: {
        Args: { p_barcode: string; p_limit?: number; p_offset?: number }
        Returns: {
          changes: Json
          id: string
          label_observed_at: string
          published_at: string
          revision_number: number
          total_count: number
        }[]
      }
      get_blendcalc_product_v1: {
        Args: { p_barcode: string }
        Returns: {
          barcode: string
          brand_owner: string
          canonical_provenance: Json
          category_option_id: string
          compatibility_summary: Json
          confidence: string
          created_at: string
          current_revision_id: string
          current_revision_number: number
          food: Json
          id: string
          label_observed_at: string
          last_verified_at: string
          product_name: string
          revision_created_at: string
          source: string
          source_reference: string
          updated_at: string
        }[]
      }
      is_valid_gtin: { Args: { p_value: string }; Returns: boolean }
      jsonb_text_array_search_text: { Args: { p_value: Json }; Returns: string }
      move_user_food_list_items: {
        Args: {
          p_fdc_ids: number[]
          p_source_list_type: string
          p_target_list_type: string
        }
        Returns: number
      }
      normalize_food_category_value: {
        Args: { p_value: string }
        Returns: string
      }
      place_user_food_list_item: {
        Args: {
          p_allow_move?: boolean
          p_fdc_id: number
          p_food: Json
          p_list_type: string
        }
        Returns: string
      }
      place_user_food_list_items: {
        Args: { p_foods: Json; p_list_type: string }
        Returns: string
      }
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
      rebuild_custom_food_category_options: { Args: never; Returns: undefined }
      rebuild_food_preference_option_catalog: {
        Args: never
        Returns: undefined
      }
      rebuild_shared_product_compatibility_summary: {
        Args: { p_shared_product_id: string }
        Returns: undefined
      }
      record_product_source_daily_metric: {
        Args: {
          p_api_error_count: number
          p_api_request_count: number
          p_brand_present_count: number
          p_cache_hit_count: number
          p_category_present_count: number
          p_completed_lookup_count: number
          p_error_count: number
          p_evaluated_product_count: number
          p_exact_barcode_match_count: number
          p_image_present_count: number
          p_ingredients_present_count: number
          p_lookup_count: number
          p_lookup_kind: string
          p_lookup_origin: string
          p_match_count: number
          p_reported_nutrient_total: number
          p_response_milliseconds_total: number
          p_serving_present_count: number
          p_source_data_type: string
          p_source_key: string
        }
        Returns: undefined
      }
      refresh_food_compatibility_preference_mapping_bundle: {
        Args: { p_policy_version_id: string }
        Returns: undefined
      }
      refresh_nutrient_manual_entry_required_flags: {
        Args: never
        Returns: undefined
      }
      refresh_shared_product_compatibility_match_facts: {
        Args: { p_shared_product_id: string }
        Returns: undefined
      }
      reject_blocked_signup: { Args: { event: Json }; Returns: Json }
      remove_user_food_list_item: {
        Args: { p_fdc_id: number; p_list_type: string }
        Returns: boolean
      }
      rename_user_food_list_item: {
        Args: { p_description: string; p_fdc_id: number; p_list_type: string }
        Returns: string
      }
      replace_app_interaction_daily_metrics: {
        Args: { p_metrics: Json; p_since: string; p_until: string }
        Returns: number
      }
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
      replace_food_servings: {
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
      resolve_custom_food_category_option: {
        Args: { p_source_values: string[] }
        Returns: {
          category_option_id: string
          category_option_label: string
          confidence: string
          source_normalized_value: string
        }[]
      }
      resolve_custom_food_category_option_with_symbol: {
        Args: { p_source_values: string[] }
        Returns: {
          category_option_id: string
          category_option_label: string
          confidence: string
          source_normalized_value: string
          symbol_key: string
        }[]
      }
      resolve_food_symbol_key: {
        Args: { category_value: string }
        Returns: string
      }
      resolve_food_symbol_key_for_food: {
        Args: { p_category_option_id?: string; p_food: Json }
        Returns: string
      }
      save_custom_food: {
        Args: { p_fdc_id: number; p_food: Json }
        Returns: string
      }
      save_mix_preferences: {
        Args: { p_mix_state?: Json; p_nutrient_goals?: Json }
        Returns: boolean
      }
      save_saved_drink: {
        Args: {
          p_created_at: string
          p_drink: Json
          p_id: string
          p_name: string
        }
        Returns: string
      }
      search_blendcalc_products_v1: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query: string
          p_terms: string[]
        }
        Returns: {
          barcode: string
          brand_owner: string
          canonical_provenance: Json
          category_option_id: string
          compatibility_summary: Json
          confidence: string
          created_at: string
          current_revision_id: string
          current_revision_number: number
          food: Json
          id: string
          label_observed_at: string
          last_verified_at: string
          product_name: string
          revision_created_at: string
          source: string
          source_reference: string
          total_count: number
          updated_at: string
        }[]
      }
      search_generic_food_records: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          alternate_description: string
          application_food_id: number
          attribution_text: string
          dataset_display_name: string
          dataset_key: string
          dataset_version: string
          description: string
          external_reference: string
          food_group_name: string
          license_name: string
          license_url: string
          measures: Json
          metadata: Json
          nutrients: Json
          preparation: string
          scientific_name: string
          source_display_name: string
          source_food_key: string
          source_identifiers: Json
          source_key: string
          source_updated_at: string
          source_url: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_nutrient_manual_entry_fields: { Args: never; Returns: undefined }
      sync_product_ingredient_evidence: {
        Args: {
          p_food?: Json
          p_shared_product_id?: string
          p_shared_product_observation_id?: string
          p_shared_product_submission_id?: string
        }
        Returns: undefined
      }
      sync_product_precautionary_statements: {
        Args: {
          p_food?: Json
          p_shared_product_id?: string
          p_shared_product_observation_id?: string
          p_shared_product_submission_id?: string
        }
        Returns: undefined
      }
      sync_user_compatibility_rules: {
        Args: {
          p_allergens?: string[]
          p_dietary_restrictions?: string[]
          p_user_id: string
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
