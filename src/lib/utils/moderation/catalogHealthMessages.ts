const CATALOG_HEALTH_LABELS: Record<string, string> = {
	active: "Active",
	attention: "Needs attention",
	approved: "Approved",
	blocked: "Blocked",
	blocking: "Blocking",
	completed: "Completed",
	critical: "Critical",
	dismissed: "Dismissed",
	deferred: "Deferred",
	high: "High priority",
	incomplete: "Incomplete",
	low: "Low priority",
	medium: "Needs attention",
	missing_revision: "Revision history is missing",
	pending: "Waiting for review",
	open: "Open",
	policy_review_missing: "Policy review is missing",
	rejected: "Rejected",
	ready: "Ready",
	retrying: "Retrying",
	under_review: "Waiting for review",
	waiting_for_review: "Waiting for review",
	withheld: "Withheld",
	unexplained_revision: "Revision changes need evidence",
	verified: "Verified",
};

const CATALOG_ISSUE_REASON_LABELS: Record<string, string> = {
	api_redistribution_not_approved: "API redistribution approval is missing",
	checksum_missing: "Import checksum evidence is missing",
	derived_nutrient_missing_method:
		"A calculated nutrient is missing its calculation method",
	field_source_not_redistributable:
		"A selected field source cannot be redistributed through blendCalcAPI v1",
	import_evidence_missing: "Import evidence is missing",
	insufficient_allergen_evidence: "Allergen evidence is incomplete",
	invalid_gtin: "The GTIN is invalid",
	license_metadata_missing: "License or attribution details are missing",
	license_review_missing: "License review is missing",
	missing_current_revision: "The current catalog revision is missing",
	missing_evidence_backed_primary_serving:
		"An evidence-backed primary serving is missing",
	missing_field_provenance:
		"Selected product information is missing source evidence",
	missing_normalized_nutrients: "Normalized nutrition is missing",
	missing_nutrient_provenance: "Selected nutrition is missing source evidence",
	missing_publication_profile:
		"The blendCalcAPI publication profile is missing",
	missing_required_field: "Required product information is missing",
	missing_required_nutrient: "A required nutrient is missing",
	missing_serving_provenance: "The selected serving is missing source evidence",
	missing_verification_timestamp: "Current verification evidence is missing",
	nutrient_source_not_redistributable:
		"A selected nutrient source cannot be redistributed through blendCalcAPI v1",
	policy_review_missing: "Source policy review is missing",
	serving_source_not_redistributable:
		"A selected serving source cannot be redistributed through blendCalcAPI v1",
	unsupported_nutrient_value_state:
		"A nutrient value has an unsupported reporting state",
	unexplained_revision: "Revision changes need evidence",
	unresolved_material_conflict: "A material product conflict is unresolved",
	unreviewed_nutrient_mapping: "A nutrient mapping still needs review",
	verification_expired: "Product verification has expired",
};

const CATALOG_FIELD_LABELS: Record<string, string> = {
	allergens: "Allergen declaration",
	brandOwner: "Brand",
	categories: "Category",
	ingredients: "Ingredients",
	dietaryTags: "Dietary classifications",
	nutrients: "Nutrition",
	package: "Package information",
	precautionaryStatements: "Precautionary statements",
	productName: "Product name",
	serving: "Serving",
	servingWeightGrams: "Serving weight",
	sourceMetadata: "Source details",
	traces: "Possible traces",
};

const CATALOG_ISSUE_CODE_LABELS: Record<string, string> = {
	BLENDCALC_API_PUBLICATION_PROFILE_MISSING:
		"blendCalcAPI publication rules are unavailable",
	API_REDISTRIBUTION_REVIEW_REQUIRED: "Redistribution approval is required",
	CATALOG_ALLERGEN_EVIDENCE_INCOMPLETE: "Allergen evidence is incomplete",
	CATALOG_FIELD_PROVENANCE_MISSING:
		"Product information is missing source evidence",
	CATALOG_GTIN_INVALID: "Product GTIN is invalid",
	CATALOG_MATERIAL_CONFLICT: "Product information has an unresolved conflict",
	CATALOG_NUTRIENT_DERIVATION_INCOMPLETE:
		"Calculated nutrition is missing its method",
	CATALOG_NUTRIENT_PROVENANCE_MISSING: "Nutrition is missing source evidence",
	CATALOG_NUTRIENT_VALUE_UNSUPPORTED:
		"A nutrient reporting state is unsupported",
	CATALOG_NUTRITION_INCOMPLETE: "Required nutrition is incomplete",
	CATALOG_PRIMARY_SERVING_MISSING: "An evidence-backed serving is missing",
	CATALOG_REQUIRED_FIELD_MISSING: "Required product information is missing",
	CATALOG_REVISION_EXPLANATION_MISSING: "Revision changes need evidence",
	CATALOG_REVISION_MISSING: "Revision history is missing",
	CATALOG_SERVING_PROVENANCE_MISSING:
		"Serving information is missing source evidence",
	CATALOG_VERIFICATION_REQUIRED: "Current verification evidence is required",
	DATASET_IMPORT_EVIDENCE_MISSING: "Dataset import evidence is incomplete",
	DATASET_LICENSE_REVIEW_REQUIRED: "Dataset license review is required",
	NUTRIENT_MAPPING_GAP: "A nutrient mapping needs review",
	SOURCE_LICENSE_METADATA_MISSING: "Source license details are incomplete",
	SOURCE_POLICY_REVIEW_REQUIRED: "Source policy review is required",
	WARNING_POLICY_COVERAGE_GAP: "Food warning policy coverage is incomplete",
};

const CATALOG_RESPONSIBLE_GROUP_LABELS: Record<string, string> = {
	catalog_review: "Catalog review",
	data_operations: "Data operations",
	external_review: "Source and license review",
	food_policy_review: "Food warning policy review",
	system: "System operations",
};

const CATALOG_RESOLUTION_ACTION_LABELS: Record<string, string> = {
	create_catalog_correction: "Submit an evidence-backed catalog correction",
	inspect_system_issue: "Inspect the system configuration",
	review_catalog_conflict: "Resolve the catalog conflict",
	review_catalog_record: "Review the catalog record",
	review_dataset_import: "Review dataset import evidence",
	review_dataset_license: "Review the dataset license",
	review_food_policy: "Review food warning policy coverage",
	review_nutrient_mapping: "Review the nutrient mapping",
	review_nutrient_value: "Review the normalized nutrient value",
	review_product_evidence: "Review current product evidence",
	review_product_identity: "Review product identity",
	review_publication_profile: "Review the blendCalcAPI publication profile",
	review_revision_history: "Review revision history",
	review_source_policy: "Review source policy",
	review_source_redistribution: "Review source redistribution rights",
	run_nutrient_provenance_repair:
		"Repair nutrient provenance from existing evidence",
	run_provenance_repair: "Repair field provenance from existing evidence",
	run_revision_repair: "Repair revision history from existing evidence",
	run_serving_provenance_repair:
		"Repair serving provenance from existing evidence",
};

export const getCatalogHealthStatusLabel = (value: string) =>
	CATALOG_HEALTH_LABELS[value] ?? "Needs review";

export const getCatalogFieldLabel = (fieldPath: string) =>
	CATALOG_FIELD_LABELS[fieldPath] ?? "Product information";

export const getCatalogIssueReasonLabel = (reason: string) => {
	const [reasonKey, parameter] = reason.split(":", 2);
	const label = CATALOG_ISSUE_REASON_LABELS[reasonKey];
	if (!label) return "Catalog evidence needs review";
	if (!parameter) return label;
	return `${label}: ${getCatalogFieldLabel(parameter)}`;
};

export const getCatalogIssueCodeLabel = (issueCode: string) =>
	CATALOG_ISSUE_CODE_LABELS[issueCode] ?? "Catalog evidence needs attention";

export const getCatalogResponsibleGroupLabel = (responsibleGroup: string) =>
	CATALOG_RESPONSIBLE_GROUP_LABELS[responsibleGroup] ?? "Privileged review";

export const getCatalogResolutionActionLabel = (resolutionAction: string) =>
	CATALOG_RESOLUTION_ACTION_LABELS[resolutionAction] ??
	"Review the available evidence";
