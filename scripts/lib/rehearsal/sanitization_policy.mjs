/**
 * Purpose: Define and compile BlendCalc's deny-by-default Rehearsal sanitization
 * policy without reading row data. Do not run directly; this module is project-owned
 * privacy policy.
 */

import { createHash } from "node:crypto";

export const SANITIZATION_ACTIONS = Object.freeze({
	KEEP_EXACTLY: "KEEP EXACTLY",
	PSEUDONYMIZE: "PSEUDONYMIZE",
	REPLACE_WITH_SYNTHETIC: "REPLACE WITH SYNTHETIC",
	EXCLUDE: "EXCLUDE",
	DERIVE: "DERIVE",
});

const tableGroups = Object.freeze({
	reference: Object.freeze([
		"app_delight_messages",
		"app_issue_codes",
		"app_role_permissions",
		"blendcalc_api_publication_profiles",
		"blendcalc_api_scope_policies",
		"blendcalc_api_scopes",
		"compatibility_tags",
		"custom_food_category_options",
		"food_allergen_regulatory_profile_tags",
		"food_allergen_regulatory_profiles",
		"food_category_resolution_guidance",
		"food_compatibility_policy_conflicts",
		"food_compatibility_policy_exemptions",
		"food_compatibility_policy_ingredient_aliases",
		"food_compatibility_policy_ingredient_relationships",
		"food_compatibility_policy_match_rules",
		"food_compatibility_policy_preference_term_mappings",
		"food_compatibility_policy_versions",
		"food_preference_option_catalog",
		"food_symbol_category_rules",
		"food_symbol_definitions",
		"generic_food_datasets",
		"ingredient_provenance_options",
		"ingredient_terms",
		"marketing_email_topics",
		"mix_goal_template_targets",
		"mix_goal_template_versions",
		"mix_goal_templates",
		"mix_runtime_configuration",
		"nutrient_definitions",
		"nutrient_display_profile_fields",
		"nutrient_display_profiles",
		"nutrient_equivalences",
		"nutrient_manual_entry_fields",
		"nutrient_manual_entry_groups",
		"nutrient_manual_entry_required_nutrients",
		"nutrient_mapping_deterministic_rules",
		"nutrient_relationship_rules",
		"nutrient_source_mapping_observations",
		"nutrient_source_mappings",
		"nutrient_unit_conversions",
		"nutrition_completeness_profile_nutrients",
		"nutrition_completeness_profiles",
		"product_data_sources",
		"product_regulatory_disclosure_profiles",
		"product_resolution_difference_thresholds",
		"product_resolution_ignored_terms",
		"product_resolution_policy_versions",
		"product_resolution_rank_values",
		"product_resolution_scoring_weights",
		"product_source_field_coverage_policies",
		"product_source_request_budgets",
		"serving_measure_aliases",
		"serving_measure_units",
		"shared_product_mass_volume_conversion_policies",
	]),
	catalog: Object.freeze([
		"catalog_provider_product_snapshots",
		"food_nutrient_measurements",
		"food_nutrient_qualitative_evidence",
		"food_nutrients",
		"food_servings",
		"generic_food_dataset_reference_rows",
		"generic_food_measures",
		"generic_food_nutrients",
		"generic_food_records",
		"generic_food_source_identifiers",
		"official_food_safety_alert_identifiers",
		"official_food_safety_alert_matches",
		"official_food_safety_alert_revisions",
		"official_food_safety_alerts",
		"product_compatibility_facts",
		"product_ingredient_components",
		"product_ingredient_statements",
		"product_precautionary_statements",
		"shared_product_conflicts",
		"shared_product_field_provenance",
		"shared_product_observations",
		"shared_product_revision_changes",
		"shared_product_revisions",
		"shared_products",
	]),
	privateTopology: Object.freeze([
		"account_moderation",
		"app_role_assignments",
		"blendcalc_api_clients",
		"blendcalc_api_publication_concerns",
		"blendcalc_api_publication_holds",
		"catalog_conflict_review_dispositions",
		"catalog_correction_origins",
		"catalog_health_repair_run_items",
		"catalog_health_repair_runs",
		"catalog_health_review_dispositions",
		"catalog_intake_requests",
		"catalog_product_purge_audit",
		"catalog_provider_change_reviews",
		"custom_food_category_mappings",
		"custom_food_category_observations",
		"custom_foods",
		"food_compatibility_feedback",
		"food_preference_api_observations",
		"food_preference_mapping_requests",
		"food_warning_policy_review_cases",
		"generic_food_dataset_import_evidence_runs",
		"marketing_email_preference_events",
		"mix_preferences",
		"moderation_actions",
		"nutrient_manual_entry_observations",
		"nutrient_mapping_deterministic_backfill_results",
		"nutrient_mapping_deterministic_backfill_runs",
		"nutrient_mapping_review_decisions",
		"privileged_queue_admission_decisions",
		"product_source_evaluations",
		"product_source_field_coverage",
		"product_submission_blocks",
		"profile_image_policy_acceptances",
		"profile_image_reports",
		"profiles",
		"saved_drinks",
		"shared_product_submission_field_evidence",
		"shared_product_submissions",
		"user_catalog_submission_enforcement",
		"user_compatibility_rules",
		"user_food_list_items",
		"user_food_preferences",
		"user_marketing_email_preferences",
		"user_mix_goal_template_targets",
		"user_mix_goal_templates",
		"user_mix_nutrient_goals",
		"user_tutorial_preferences",
	]),
	excludedRuntime: Object.freeze([
		"app_interaction_daily_metrics",
		"blendcalc_api_keys",
		"blocked_signup_emails",
		"catalog_monitor_runs",
		"catalog_monitor_settings",
		"catalog_revalidation_queue",
		"catalog_safety_alert_ingestion_cursors",
		"external_provider_request_budgets",
		"moderation_email_deliveries",
		"nutrition_label_ocr_jobs",
		"product_api_cache",
		"product_api_request_leases",
		"product_safety_alert_notifications",
		"product_source_daily_metrics",
		"product_source_field_daily_metrics",
		"request_rate_limits",
	]),
	imageMetadata: Object.freeze(["food_image_assets"]),
});

const sourceExcludedTables = new Set([
	"app_role_assignments",
	...tableGroups.excludedRuntime,
]);

// These columns identify rows that belong to the one explicitly approved source
// account. The refresh credential fixes that source identity; callers may not choose
// an arbitrary account at extraction time. Non-secret values on these rows are kept
// production-faithful while every other user's private values remain sanitized.
const ownerIdentityColumnsByTable = new Map(
	Object.entries({
		account_moderation: ["user_id"],
		blendcalc_api_clients: ["owner_user_id"],
		custom_foods: ["user_id"],
		food_compatibility_feedback: ["reported_by"],
		food_nutrient_measurements: ["owner_user_id"],
		food_nutrient_qualitative_evidence: ["owner_user_id"],
		food_nutrients: ["owner_user_id"],
		food_servings: ["owner_user_id"],
		marketing_email_preference_events: ["user_id"],
		mix_preferences: ["user_id"],
		moderation_actions: ["target_user_id", "actor_user_id"],
		product_submission_blocks: ["user_id"],
		profile_image_policy_acceptances: ["user_id"],
		profile_image_reports: ["reported_profile_user_id", "reported_by"],
		profiles: ["user_id"],
		saved_drinks: ["user_id"],
		shared_product_submissions: ["submitted_by"],
		user_catalog_submission_enforcement: ["user_id"],
		user_compatibility_rules: ["user_id"],
		user_food_list_items: ["user_id"],
		user_food_preferences: ["user_id"],
		user_marketing_email_preferences: ["user_id"],
		user_mix_goal_templates: ["user_id"],
		user_mix_nutrient_goals: ["user_id"],
		user_tutorial_preferences: ["user_id"],
	}),
);
const tableGroupByName = new Map();
for (const [group, tables] of Object.entries(tableGroups)) {
	for (const table of tables) {
		if (tableGroupByName.has(table)) {
			throw new Error(`Duplicate Rehearsal table policy for ${table}.`);
		}
		tableGroupByName.set(table, group);
	}
}

const secretColumnPattern =
	/(?:secret|password|access_token|refresh_token|session_token|authorization|mfa|recovery|private_key|api_key)(?:_|$)/iu;
const emailColumnPattern = /(?:^|_)email(?:_|$)|recipient/iu;
const derivedColumnPattern =
	/(?:hash|checksum|normalized|search_vector|search_text|comparison_key|fingerprint|dedupe_key|occurrence_key|subject_key|name_key|food_identity_key)/iu;
const locationColumnPattern =
	/(?:url|uri|path|filename|file_name|storage|image_location)/iu;
const privateTextColumnPattern =
	/(?:note|reason|detail|description|report|evidence|review|rationale|comment|message|request_body|raw_text|ocr)/iu;
const externalIdentityColumns = new Set([
	"barcode",
	"cache_key",
	"external_id",
	"external_key",
	"fdc_id",
	"gtin",
	"idempotency_key",
	"provider_id",
	"source_record_id",
	"source_reference",
	"upc",
]);
const privateStructuralTextColumns = new Set([
	"action",
	"appearance_theme",
	"avatar_moderation_status",
	"case_type",
	"category",
	"category_id",
	"category_option_id",
	"classification_method",
	"concern_type",
	"confidence",
	"consent_copy_version",
	"coverage_status",
	"dataset_key",
	"decision",
	"decision_method",
	"decision_origin",
	"entry_step",
	"evaluation_kind",
	"fact_type",
	"feedback_type",
	"field_path",
	"follow_up_status",
	"goal_basis",
	"goal_type",
	"group_id",
	"issue_code",
	"item_key",
	"language_code",
	"list_type",
	"matched_source",
	"mode",
	"minimum_allergen_evidence",
	"nutrient_number",
	"nutrient_type",
	"origin_type",
	"outcome",
	"policy_key",
	"policy_version",
	"preference_rule_type",
	"preference_type",
	"previous_mapping_method",
	"queue_name",
	"queue_resolution",
	"reason_code",
	"regulatory_region_code",
	"regulatory_region_source",
	"recommended_field_paths",
	"release_version",
	"repair_key",
	"reporter_type",
	"request_source",
	"required_field_paths",
	"resolution_action",
	"resolution_language_code",
	"resolution_method",
	"resolution_status",
	"responsible_group",
	"result",
	"rule_type",
	"severity",
	"source",
	"source_data_type",
	"source_field",
	"source_key",
	"source_unit_name",
	"status",
	"subject_type",
	"submission_intent",
	"submission_kind",
	"topic_key",
	"trust_status",
	"unit",
	"unit_name",
	"unit_system",
	"urgency",
	"verification_status",
	"warning_id",
]);
const exactStructuralColumns = new Set([
	"catalog_correction_origins.affected_field_paths",
	"catalog_provider_change_reviews.material_field_paths",
	"custom_food_category_mappings.source_fields",
	"mix_preferences.section_order",
	"product_ingredient_components.source_path",
	"product_precautionary_statements.normalized_allergens",
]);
const syntheticFormatByColumn = new Map([
	["generic_food_dataset_import_evidence_runs.evidence_reference", "url"],
]);

const foodItemJsonPolicy = Object.freeze({
	keepExactKeys: Object.freeze([
		"barcodeSource",
		"calculationBasis",
		"categoryOptionId",
		"confidence",
		"customDensityConfidence",
		"customFood",
		"dataType",
		"derivationCode",
		"derivationMethod",
		"evidenceStatus",
		"foodIdentityType",
		"gramWeightMethod",
		"language",
		"languages",
		"mappingMethod",
		"mappingReviewReference",
		"mappingStatus",
		"measureType",
		"nameProvenance",
		"nutrientName",
		"nutrientNumber",
		"origin",
		"profileKey",
		"qualityErrorTags",
		"qualityTags",
		"qualityWarningTags",
		"sharedProductConfidence",
		"sharedProductId",
		"sharedProductSubmissionId",
		"source",
		"sourceDataType",
		"sourceKey",
		"sourceLabel",
		"sourceMeasureKey",
		"sourceNutrientCode",
		"sourceNutrientKey",
		"symbolKey",
		"trustStatus",
		"unit",
		"unitKey",
		"unitName",
		"valueOrigin",
		"valueQualifier",
		"valueStatus",
	]),
	humanReadableKeys: Object.freeze({
		additives: "Rehearsal additive",
		allergens: "Rehearsal allergen",
		alternateDescription: "Rehearsal description",
		brandOwner: "Rehearsal brand",
		brandedFoodCategory: "Rehearsal category",
		canonicalDescription: "Rehearsal food",
		categories: "Rehearsal category",
		customDensityLabel: "Rehearsal density",
		customServingLabel: "Rehearsal serving",
		description: "Rehearsal food",
		dietaryTags: "Rehearsal dietary tag",
		foodCategory: "Rehearsal category",
		householdServingFullText: "Rehearsal serving",
		ingredientList: "Rehearsal ingredient",
		ingredients: "Rehearsal ingredient statement",
		label: "Rehearsal serving",
		labels: "Rehearsal label",
		packageWeight: "Rehearsal package",
		preparation: "Rehearsal preparation",
		scientificName: "Rehearsal food",
		text: "Rehearsal ingredient",
		traces: "Rehearsal trace",
	}),
	timestampKeys: Object.freeze([
		"approvedAt",
		"availableAt",
		"canonicalSelectedAt",
		"createdAt",
		"discontinuedAt",
		"discontinuedDate",
		"fetchedAt",
		"labelObservedAt",
		"modifiedAt",
		"modifiedDate",
		"observedAt",
		"publicationDate",
		"publishedAt",
		"publishedDate",
		"recordCreatedAt",
		"recordUpdatedAt",
		"reportDate",
		"sourceModifiedDate",
		"sourcePublishedDate",
		"suggestionAcceptedAt",
		"updatedAt",
	]),
});

const jsonPolicyByColumn = new Map(
	[
		"catalog_correction_origins.prefilled_food",
		"custom_foods.food",
		"mix_preferences.mix_state",
		"saved_drinks.drink",
		"shared_product_observations.normalized_food",
		"shared_product_revisions.food",
		"shared_product_submissions.food",
		"shared_products.food",
		"user_food_list_items.food",
	].map((key) => [key, foodItemJsonPolicy]),
);

const finiteTextConstraintPattern = /(?:=\s*ANY\s*\(\s*ARRAY\[|\bIN\s*\()/iu;

const hasFiniteTextConstraint = (column) =>
	/(?:text|character|citext)/iu.test(`${column.dataType} ${column.udtName}`) &&
	Array.isArray(column.checkConstraints) &&
	column.checkConstraints.some(
		(constraint) =>
			typeof constraint === "string" &&
			finiteTextConstraintPattern.test(constraint),
	);

const classifyColumn = (table, group, column, identityDomain) => {
	const name = column.name;
	const type = `${column.dataType} ${column.udtName}`;
	if (sourceExcludedTables.has(table)) {
		return [SANITIZATION_ACTIONS.EXCLUDE, "source rows are excluded"];
	}
	if (secretColumnPattern.test(name) || column.udtName === "bytea") {
		return [SANITIZATION_ACTIONS.EXCLUDE, "secret or opaque binary material"];
	}
	if (emailColumnPattern.test(name)) {
		return [
			SANITIZATION_ACTIONS.REPLACE_WITH_SYNTHETIC,
			"private contact identity",
		];
	}
	if (identityDomain === "auth.users.id") {
		return [
			SANITIZATION_ACTIONS.PSEUDONYMIZE,
			"person or Auth identity relationship",
		];
	}
	if (group === "catalog" || group === "imageMetadata") {
		return [
			SANITIZATION_ACTIONS.KEEP_EXACTLY,
			"production-faithful public catalog or image metadata",
		];
	}
	if (column.foreignKey?.schema === "public") {
		return [
			SANITIZATION_ACTIONS.KEEP_EXACTLY,
			"non-personal relational topology",
		];
	}
	if (syntheticFormatByColumn.has(`${table}.${name}`)) {
		return [
			SANITIZATION_ACTIONS.REPLACE_WITH_SYNTHETIC,
			"format-constrained private location",
		];
	}
	if (exactStructuralColumns.has(`${table}.${name}`)) {
		return [
			SANITIZATION_ACTIONS.KEEP_EXACTLY,
			"constraint-driving structural value",
		];
	}
	if (hasFiniteTextConstraint(column)) {
		return [
			SANITIZATION_ACTIONS.KEEP_EXACTLY,
			"database-constrained finite vocabulary",
		];
	}
	if (group === "reference") {
		return [
			SANITIZATION_ACTIONS.KEEP_EXACTLY,
			"reviewed reference or policy value",
		];
	}
	if (/json/iu.test(type)) {
		return [
			SANITIZATION_ACTIONS.DERIVE,
			"structured values require recursive sanitation",
		];
	}
	if (derivedColumnPattern.test(name)) {
		return [
			SANITIZATION_ACTIONS.DERIVE,
			"value must be recomputed after sanitation",
		];
	}
	if (privateStructuralTextColumns.has(name)) {
		return [
			SANITIZATION_ACTIONS.KEEP_EXACTLY,
			"constraint or state-machine value",
		];
	}
	if (locationColumnPattern.test(name)) {
		return [
			SANITIZATION_ACTIONS.REPLACE_WITH_SYNTHETIC,
			"source or object location",
		];
	}
	if (externalIdentityColumns.has(name)) {
		return [
			SANITIZATION_ACTIONS.PSEUDONYMIZE,
			"external identifier requires source-policy approval",
		];
	}
	if (group === "privateTopology") {
		if (/timestamp|date/iu.test(type)) {
			return [
				SANITIZATION_ACTIONS.DERIVE,
				"private event time is order-preserving and coarsened",
			];
		}
		if (/(?:text|character|citext)/iu.test(type)) {
			return [
				SANITIZATION_ACTIONS.REPLACE_WITH_SYNTHETIC,
				"private or externally identifying value",
			];
		}
		return [
			SANITIZATION_ACTIONS.KEEP_EXACTLY,
			"non-identifying relational topology",
		];
	}
	if (privateTextColumnPattern.test(name)) {
		return [
			SANITIZATION_ACTIONS.REPLACE_WITH_SYNTHETIC,
			"free-form observation text",
		];
	}
	return [
		SANITIZATION_ACTIONS.KEEP_EXACTLY,
		"reviewed reference or policy value",
	];
};

const canonicalJson = (value) => `${JSON.stringify(value, null, "\t")}\n`;

export const compileSanitizationManifest = ({ tables, migrationCutoff }) => {
	if (!Array.isArray(tables) || tables.length === 0) {
		throw new Error("The Rehearsal schema inventory is empty.");
	}
	const liveNames = new Set(tables.map((table) => table.name));
	const configuredNames = new Set(tableGroupByName.keys());
	const unclassified = [...liveNames].filter(
		(name) => !configuredNames.has(name),
	);
	const obsolete = [...configuredNames].filter((name) => !liveNames.has(name));
	if (unclassified.length || obsolete.length) {
		throw new Error(
			`Rehearsal table policy mismatch. Unclassified: ${unclassified.join(", ") || "none"}. Obsolete: ${obsolete.join(", ") || "none"}.`,
		);
	}
	const publicColumnIndex = new Map(
		tables.flatMap((table) =>
			table.columns.map((column) => [
				`public.${table.name}.${column.name}`,
				column,
			]),
		),
	);
	const resolveIdentityDomain = (
		tableName,
		columnName,
		visited = new Set(),
	) => {
		const key = `public.${tableName}.${columnName}`;
		if (visited.has(key)) {
			throw new Error(
				`Cyclic Rehearsal foreign-key identity domain at ${key}.`,
			);
		}
		const column = publicColumnIndex.get(key);
		const foreignKey = column?.foreignKey;
		if (!foreignKey) return null;
		const target = `${foreignKey.schema}.${foreignKey.table}.${foreignKey.column}`;
		if (target === "auth.users.id") return target;
		if (foreignKey.schema !== "public" || !publicColumnIndex.has(target)) {
			return null;
		}
		return resolveIdentityDomain(
			foreignKey.table,
			foreignKey.column,
			new Set([...visited, key]),
		);
	};

	const manifestTables = [...tables]
		.sort((left, right) => left.name.localeCompare(right.name))
		.map((table) => {
			if (!Array.isArray(table.columns) || table.columns.length === 0) {
				throw new Error(
					`Rehearsal table ${table.name} has no column inventory.`,
				);
			}
			const group = tableGroupByName.get(table.name);
			const ownerIdentityColumns =
				ownerIdentityColumnsByTable.get(table.name) ?? [];
			for (const ownerColumn of ownerIdentityColumns) {
				if (!table.columns.some((column) => column.name === ownerColumn)) {
					throw new Error(
						`Rehearsal owner policy references missing column ${table.name}.${ownerColumn}.`,
					);
				}
			}
			const columns = [...table.columns]
				.sort((left, right) => left.ordinal - right.ordinal)
				.map((column) => {
					const identityDomain = resolveIdentityDomain(table.name, column.name);
					const [action, reason] = classifyColumn(
						table.name,
						group,
						column,
						identityDomain,
					);
					const mappingDomain =
						action === SANITIZATION_ACTIONS.PSEUDONYMIZE
							? identityDomain
								? `identity:${identityDomain}`
								: new Set(["barcode", "gtin", "upc"]).has(column.name)
									? "external:gtin"
									: `external:${column.name}`
							: null;
					const jsonPolicy = jsonPolicyByColumn.get(
						`${table.name}.${column.name}`,
					);
					const syntheticFormat = syntheticFormatByColumn.get(
						`${table.name}.${column.name}`,
					);
					return {
						name: column.name,
						dataType: column.dataType,
						udtName: column.udtName,
						nullable: column.nullable,
						hasDefault: column.hasDefault,
						identity: column.identity,
						generated: column.generated,
						primaryKey: column.primaryKey,
						characterMaximumLength: column.characterMaximumLength,
						numericPrecision: column.numericPrecision,
						numericScale: column.numericScale,
						foreignKey: column.foreignKey ?? null,
						checkConstraints: column.checkConstraints ?? [],
						action,
						reason,
						mappingDomain,
						...(jsonPolicy ? { jsonPolicy } : {}),
						...(syntheticFormat ? { syntheticFormat } : {}),
					};
				});
			return {
				name: table.name,
				group,
				ownerIdentityColumns,
				sourceRows: sourceExcludedTables.has(table.name)
					? "EXCLUDE"
					: "STREAM AND SANITIZE",
				columns,
			};
		});

	const schemaShape = manifestTables.map(({ name, columns }) => ({
		name,
		columns: columns.map(
			({
				name: columnName,
				dataType,
				udtName,
				nullable,
				hasDefault,
				identity,
				generated,
				primaryKey,
				characterMaximumLength,
				numericPrecision,
				numericScale,
				foreignKey,
				checkConstraints,
			}) => ({
				name: columnName,
				dataType,
				udtName,
				nullable,
				hasDefault,
				identity,
				generated,
				primaryKey,
				characterMaximumLength,
				numericPrecision,
				numericScale,
				foreignKey,
				checkConstraints,
			}),
		),
	}));
	const schemaSha256 = createHash("sha256")
		.update(canonicalJson(schemaShape))
		.digest("hex");

	return {
		policyVersion: 1,
		migrationCutoff,
		schemaSha256,
		allowedActions: Object.values(SANITIZATION_ACTIONS),
		tableCount: manifestTables.length,
		columnCount: manifestTables.reduce(
			(sum, table) => sum + table.columns.length,
			0,
		),
		tables: manifestTables,
	};
};

export const serializeSanitizationManifest = canonicalJson;
