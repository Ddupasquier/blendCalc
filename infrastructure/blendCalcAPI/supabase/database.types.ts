export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	blendcalc_api: {
		Tables: {
			api_request_observations: {
				Row: {
					cache_not_modified: boolean;
					cache_validation: boolean;
					database_duration_ms: number | null;
					id: number;
					observed_at: string;
					operation: string;
					read_mode: string;
					response_status: number;
					result_count: number;
					total_duration_ms: number;
				};
				Insert: {
					cache_not_modified?: boolean;
					cache_validation?: boolean;
					database_duration_ms?: number | null;
					id?: never;
					observed_at?: string;
					operation: string;
					read_mode: string;
					response_status: number;
					result_count?: number;
					total_duration_ms: number;
				};
				Update: {
					cache_not_modified?: boolean;
					cache_validation?: boolean;
					database_duration_ms?: number | null;
					id?: never;
					observed_at?: string;
					operation?: string;
					read_mode?: string;
					response_status?: number;
					result_count?: number;
					total_duration_ms?: number;
				};
				Relationships: [];
			};
			api_shadow_parity_observations: {
				Row: {
					failure_code: string | null;
					id: number;
					matches: boolean;
					observed_at: string;
					operation: string;
					source_duration_ms: number;
					source_hash: string;
					target_duration_ms: number | null;
					target_hash: string | null;
				};
				Insert: {
					failure_code?: string | null;
					id?: never;
					matches: boolean;
					observed_at?: string;
					operation: string;
					source_duration_ms: number;
					source_hash: string;
					target_duration_ms?: number | null;
					target_hash?: string | null;
				};
				Update: {
					failure_code?: string | null;
					id?: never;
					matches?: boolean;
					observed_at?: string;
					operation?: string;
					source_duration_ms?: number;
					source_hash?: string;
					target_duration_ms?: number | null;
					target_hash?: string | null;
				};
				Relationships: [];
			};
			publication_categories: {
				Row: {
					category_key: string;
					category_payload: Json;
					content_sha256: string;
					display_name: string;
					generation_id: string;
					sort_order: number;
				};
				Insert: {
					category_key: string;
					category_payload: Json;
					content_sha256: string;
					display_name: string;
					generation_id: string;
					sort_order?: number;
				};
				Update: {
					category_key?: string;
					category_payload?: Json;
					content_sha256?: string;
					display_name?: string;
					generation_id?: string;
					sort_order?: number;
				};
				Relationships: [
					{
						foreignKeyName: "publication_categories_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_categories_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_categories_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
				];
			};
			publication_generation_events: {
				Row: {
					event_at: string;
					event_type: string;
					generation_id: string;
					id: number;
					replaced_generation_id: string | null;
				};
				Insert: {
					event_at?: string;
					event_type: string;
					generation_id: string;
					id?: never;
					replaced_generation_id?: string | null;
				};
				Update: {
					event_at?: string;
					event_type?: string;
					generation_id?: string;
					id?: never;
					replaced_generation_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "publication_generation_events_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_generation_events_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_generation_events_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
					{
						foreignKeyName: "publication_generation_events_replaced_generation_id_fkey";
						columns: ["replaced_generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_generation_events_replaced_generation_id_fkey";
						columns: ["replaced_generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_generation_events_replaced_generation_id_fkey";
						columns: ["replaced_generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
				];
			};
			publication_generations: {
				Row: {
					activated_at: string | null;
					created_at: string;
					expected_attribution_count: number;
					expected_category_count: number;
					expected_product_count: number;
					expected_revision_count: number;
					failed_at: string | null;
					failure_code: string | null;
					id: string;
					ready_at: string | null;
					retired_at: string | null;
					source_catalog_hash: string;
					source_project_ref: string;
					source_snapshot_at: string;
					status: string;
					target_catalog_hash: string | null;
				};
				Insert: {
					activated_at?: string | null;
					created_at?: string;
					expected_attribution_count: number;
					expected_category_count: number;
					expected_product_count: number;
					expected_revision_count: number;
					failed_at?: string | null;
					failure_code?: string | null;
					id?: string;
					ready_at?: string | null;
					retired_at?: string | null;
					source_catalog_hash: string;
					source_project_ref: string;
					source_snapshot_at: string;
					status?: string;
					target_catalog_hash?: string | null;
				};
				Update: {
					activated_at?: string | null;
					created_at?: string;
					expected_attribution_count?: number;
					expected_category_count?: number;
					expected_product_count?: number;
					expected_revision_count?: number;
					failed_at?: string | null;
					failure_code?: string | null;
					id?: string;
					ready_at?: string | null;
					retired_at?: string | null;
					source_catalog_hash?: string;
					source_project_ref?: string;
					source_snapshot_at?: string;
					status?: string;
					target_catalog_hash?: string | null;
				};
				Relationships: [];
			};
			publication_product_revisions: {
				Row: {
					content_sha256: string;
					generation_id: string;
					gtin14: string;
					published_at: string;
					revision_number: number;
					revision_payload: Json;
					source_revision_id: string;
				};
				Insert: {
					content_sha256: string;
					generation_id: string;
					gtin14: string;
					published_at: string;
					revision_number: number;
					revision_payload: Json;
					source_revision_id: string;
				};
				Update: {
					content_sha256?: string;
					generation_id?: string;
					gtin14?: string;
					published_at?: string;
					revision_number?: number;
					revision_payload?: Json;
					source_revision_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "publication_product_revisions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_product_revisions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_product_revisions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
					{
						foreignKeyName: "publication_product_revisions_generation_id_gtin14_fkey";
						columns: ["generation_id", "gtin14"];
						isOneToOne: false;
						referencedRelation: "active_publication_products";
						referencedColumns: ["generation_id", "gtin14"];
					},
					{
						foreignKeyName: "publication_product_revisions_generation_id_gtin14_fkey";
						columns: ["generation_id", "gtin14"];
						isOneToOne: false;
						referencedRelation: "publication_products";
						referencedColumns: ["generation_id", "gtin14"];
					},
				];
			};
			publication_products: {
				Row: {
					brand_owner: string | null;
					category_key: string | null;
					category_search_text: string;
					content_sha256: string;
					detail_payload: Json;
					generation_id: string;
					gtin14: string;
					product_name: string;
					search_payload: Json;
					search_text: string;
					source_product_id: string;
					source_revision_id: string;
					source_updated_at: string;
				};
				Insert: {
					brand_owner?: string | null;
					category_key?: string | null;
					category_search_text?: string;
					content_sha256: string;
					detail_payload: Json;
					generation_id: string;
					gtin14: string;
					product_name: string;
					search_payload: Json;
					search_text: string;
					source_product_id: string;
					source_revision_id: string;
					source_updated_at: string;
				};
				Update: {
					brand_owner?: string | null;
					category_key?: string | null;
					category_search_text?: string;
					content_sha256?: string;
					detail_payload?: Json;
					generation_id?: string;
					gtin14?: string;
					product_name?: string;
					search_payload?: Json;
					search_text?: string;
					source_product_id?: string;
					source_revision_id?: string;
					source_updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "publication_products_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_products_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_products_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
				];
			};
			publication_source_attributions: {
				Row: {
					attribution_payload: Json;
					content_sha256: string;
					generation_id: string;
					source_key: string;
				};
				Insert: {
					attribution_payload: Json;
					content_sha256: string;
					generation_id: string;
					source_key: string;
				};
				Update: {
					attribution_payload?: Json;
					content_sha256?: string;
					generation_id?: string;
					source_key?: string;
				};
				Relationships: [
					{
						foreignKeyName: "publication_source_attributions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_source_attributions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_source_attributions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
				];
			};
			publication_sync_runs: {
				Row: {
					added_product_count: number | null;
					completed_at: string | null;
					duration_ms: number | null;
					failure_code: string | null;
					generation_id: string | null;
					id: string;
					operation: string;
					outcome: string | null;
					read_mode: string;
					removed_product_count: number | null;
					source_catalog_hash: string | null;
					source_product_count: number | null;
					started_at: string;
					status: string;
					target_catalog_hash: string | null;
					target_product_count: number | null;
				};
				Insert: {
					added_product_count?: number | null;
					completed_at?: string | null;
					duration_ms?: number | null;
					failure_code?: string | null;
					generation_id?: string | null;
					id?: string;
					operation: string;
					outcome?: string | null;
					read_mode: string;
					removed_product_count?: number | null;
					source_catalog_hash?: string | null;
					source_product_count?: number | null;
					started_at?: string;
					status?: string;
					target_catalog_hash?: string | null;
					target_product_count?: number | null;
				};
				Update: {
					added_product_count?: number | null;
					completed_at?: string | null;
					duration_ms?: number | null;
					failure_code?: string | null;
					generation_id?: string | null;
					id?: string;
					operation?: string;
					outcome?: string | null;
					read_mode?: string;
					removed_product_count?: number | null;
					source_catalog_hash?: string | null;
					source_product_count?: number | null;
					started_at?: string;
					status?: string;
					target_catalog_hash?: string | null;
					target_product_count?: number | null;
				};
				Relationships: [
					{
						foreignKeyName: "publication_sync_runs_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_sync_runs_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_sync_runs_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
				];
			};
			safe_request_logs: {
				Row: {
					actor_hash: string | null;
					actor_type: string;
					duration_ms: number;
					endpoint: string;
					expires_at: string;
					method: string;
					observed_at: string;
					rate_limit_result: string;
					request_id: string;
					response_status: number;
				};
				Insert: {
					actor_hash?: string | null;
					actor_type: string;
					duration_ms: number;
					endpoint: string;
					expires_at?: string;
					method: string;
					observed_at?: string;
					rate_limit_result: string;
					request_id: string;
					response_status: number;
				};
				Update: {
					actor_hash?: string | null;
					actor_type?: string;
					duration_ms?: number;
					endpoint?: string;
					expires_at?: string;
					method?: string;
					observed_at?: string;
					rate_limit_result?: string;
					request_id?: string;
					response_status?: number;
				};
				Relationships: [];
			};
		};
		Views: {
			active_publication_categories: {
				Row: {
					category_key: string | null;
					category_payload: Json | null;
					content_sha256: string | null;
					display_name: string | null;
					generation_id: string | null;
					sort_order: number | null;
				};
				Relationships: [
					{
						foreignKeyName: "publication_categories_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_categories_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_categories_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
				];
			};
			active_publication_product_revisions: {
				Row: {
					content_sha256: string | null;
					generation_id: string | null;
					gtin14: string | null;
					published_at: string | null;
					revision_number: number | null;
					revision_payload: Json | null;
					source_revision_id: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "publication_product_revisions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_product_revisions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_product_revisions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
					{
						foreignKeyName: "publication_product_revisions_generation_id_gtin14_fkey";
						columns: ["generation_id", "gtin14"];
						isOneToOne: false;
						referencedRelation: "active_publication_products";
						referencedColumns: ["generation_id", "gtin14"];
					},
					{
						foreignKeyName: "publication_product_revisions_generation_id_gtin14_fkey";
						columns: ["generation_id", "gtin14"];
						isOneToOne: false;
						referencedRelation: "publication_products";
						referencedColumns: ["generation_id", "gtin14"];
					},
				];
			};
			active_publication_products: {
				Row: {
					brand_owner: string | null;
					category_key: string | null;
					category_search_text: string | null;
					content_sha256: string | null;
					detail_payload: Json | null;
					generation_id: string | null;
					gtin14: string | null;
					product_name: string | null;
					search_payload: Json | null;
					search_text: string | null;
					source_product_id: string | null;
					source_revision_id: string | null;
					source_updated_at: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "publication_products_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_products_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_products_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
				];
			};
			active_publication_source_attributions: {
				Row: {
					attribution_payload: Json | null;
					content_sha256: string | null;
					generation_id: string | null;
					source_key: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "publication_source_attributions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generation_operations_dashboard";
						referencedColumns: ["generation_id"];
					},
					{
						foreignKeyName: "publication_source_attributions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_generations";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "publication_source_attributions_generation_id_fkey";
						columns: ["generation_id"];
						isOneToOne: false;
						referencedRelation: "publication_operations_dashboard";
						referencedColumns: ["active_generation_id"];
					},
				];
			};
			api_request_operations_dashboard: {
				Row: {
					average_result_count: number | null;
					cache_effectiveness: number | null;
					cache_not_modified_count: number | null;
					cache_validation_count: number | null;
					client_error_count: number | null;
					last_observed_at: string | null;
					max_database_duration_ms: number | null;
					max_result_count: number | null;
					max_total_duration_ms: number | null;
					operation: string | null;
					p50_database_duration_ms: number | null;
					p50_total_duration_ms: number | null;
					p95_database_duration_ms: number | null;
					p95_total_duration_ms: number | null;
					rate_limited_count: number | null;
					read_mode: string | null;
					request_count: number | null;
					server_error_count: number | null;
					total_result_count: number | null;
					window_name: string | null;
				};
				Relationships: [];
			};
			api_shadow_parity_dashboard: {
				Row: {
					comparison_count: number | null;
					failure_count: number | null;
					last_failure_at: string | null;
					last_observed_at: string | null;
					operation: string | null;
					p95_source_duration_ms: number | null;
					p95_target_duration_ms: number | null;
				};
				Relationships: [];
			};
			publication_generation_operations_dashboard: {
				Row: {
					activated_at: string | null;
					activation_duration_ms: number | null;
					build_duration_ms: number | null;
					created_at: string | null;
					expected_attribution_count: number | null;
					expected_category_count: number | null;
					expected_product_count: number | null;
					expected_revision_count: number | null;
					failed_at: string | null;
					failure_code: string | null;
					generation_id: string | null;
					hashes_match: boolean | null;
					ready_at: string | null;
					retired_at: string | null;
					source_catalog_hash: string | null;
					source_project_ref: string | null;
					state_age_seconds: number | null;
					status: string | null;
					target_attribution_count: number | null;
					target_catalog_hash: string | null;
					target_category_count: number | null;
					target_product_count: number | null;
					target_revision_count: number | null;
				};
				Insert: {
					activated_at?: string | null;
					activation_duration_ms?: never;
					build_duration_ms?: never;
					created_at?: string | null;
					expected_attribution_count?: number | null;
					expected_category_count?: number | null;
					expected_product_count?: number | null;
					expected_revision_count?: number | null;
					failed_at?: string | null;
					failure_code?: string | null;
					generation_id?: string | null;
					hashes_match?: never;
					ready_at?: string | null;
					retired_at?: string | null;
					source_catalog_hash?: string | null;
					source_project_ref?: string | null;
					state_age_seconds?: never;
					status?: string | null;
					target_attribution_count?: never;
					target_catalog_hash?: string | null;
					target_category_count?: never;
					target_product_count?: never;
					target_revision_count?: never;
				};
				Update: {
					activated_at?: string | null;
					activation_duration_ms?: never;
					build_duration_ms?: never;
					created_at?: string | null;
					expected_attribution_count?: number | null;
					expected_category_count?: number | null;
					expected_product_count?: number | null;
					expected_revision_count?: number | null;
					failed_at?: string | null;
					failure_code?: string | null;
					generation_id?: string | null;
					hashes_match?: never;
					ready_at?: string | null;
					retired_at?: string | null;
					source_catalog_hash?: string | null;
					source_project_ref?: string | null;
					state_age_seconds?: never;
					status?: string | null;
					target_attribution_count?: never;
					target_catalog_hash?: string | null;
					target_category_count?: never;
					target_product_count?: never;
					target_revision_count?: never;
				};
				Relationships: [];
			};
			publication_operations_dashboard: {
				Row: {
					active_generation_age_seconds: number | null;
					active_generation_id: string | null;
					counts_match: boolean | null;
					failed_generation_count: number | null;
					hashes_match: boolean | null;
					latest_added_product_count: number | null;
					latest_production_read_mode: string | null;
					latest_removed_product_count: number | null;
					latest_request_observed_at: string | null;
					latest_sync_duration_ms: number | null;
					latest_sync_failure_code: string | null;
					latest_sync_outcome: string | null;
					latest_sync_run_id: string | null;
					latest_sync_started_at: string | null;
					latest_sync_status: string | null;
					source_catalog_hash: string | null;
					source_product_count: number | null;
					target_catalog_hash: string | null;
					target_product_count: number | null;
				};
				Relationships: [];
			};
		};
		Functions: {
			activate_publication_generation: {
				Args: { p_generation_id: string };
				Returns: undefined;
			};
			fail_publication_generation: {
				Args: { p_failure_code: string; p_generation_id: string };
				Returns: undefined;
			};
			mark_publication_generation_ready: {
				Args: { p_generation_id: string };
				Returns: undefined;
			};
			record_api_request_observation: {
				Args: {
					p_cache_not_modified?: boolean;
					p_cache_validation?: boolean;
					p_database_duration_ms?: number;
					p_operation: string;
					p_read_mode: string;
					p_response_status: number;
					p_result_count?: number;
					p_total_duration_ms: number;
				};
				Returns: undefined;
			};
			record_api_shadow_parity_observation: {
				Args: {
					p_failure_code?: string;
					p_matches: boolean;
					p_operation: string;
					p_source_duration_ms: number;
					p_source_hash: string;
					p_target_duration_ms?: number;
					p_target_hash?: string;
				};
				Returns: undefined;
			};
			record_publication_generation_verification: {
				Args: { p_generation_id: string; p_target_catalog_hash: string };
				Returns: undefined;
			};
			record_safe_request_log: {
				Args: {
					p_actor_hash?: string;
					p_actor_type: string;
					p_duration_ms: number;
					p_endpoint: string;
					p_method: string;
					p_rate_limit_result?: string;
					p_request_id: string;
					p_response_status: number;
				};
				Returns: undefined;
			};
			search_active_publication_products: {
				Args: {
					p_limit?: number;
					p_offset?: number;
					p_query: string;
					p_terms: string[];
				};
				Returns: {
					search_payload: Json;
					total_count: number;
				}[];
			};
			search_publication_generation_products: {
				Args: {
					p_generation_id: string;
					p_limit?: number;
					p_offset?: number;
					p_query: string;
					p_terms: string[];
				};
				Returns: {
					search_payload: Json;
					total_count: number;
				}[];
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
	keyof Database,
	"public"
>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
				DefaultSchema["Views"])
		? (DefaultSchema["Tables"] &
				DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never) = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	blendcalc_api: {
		Enums: {},
	},
	graphql_public: {
		Enums: {},
	},
	public: {
		Enums: {},
	},
} as const;
