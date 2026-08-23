const CATALOG_HEALTH_LABELS: Record<string, string> = {
	active: "Active",
	approved: "Approved",
	blocked: "Blocked",
	completed: "Completed",
	dismissed: "Dismissed",
	high: "High priority",
	incomplete: "Incomplete",
	low: "Low priority",
	medium: "Needs attention",
	missing_revision: "Revision history is missing",
	pending: "Waiting for review",
	policy_review_missing: "Policy review is missing",
	rejected: "Rejected",
	retrying: "Retrying",
	under_review: "Waiting for review",
	unexplained_revision: "Revision changes need evidence",
	verified: "Verified",
};

const CATALOG_ISSUE_REASON_LABELS: Record<string, string> = {
	api_redistribution_not_approved: "API redistribution approval is missing",
	checksum_missing: "Import checksum evidence is missing",
	derived_nutrient_missing_method: "A calculated nutrient is missing its calculation method",
	field_source_not_redistributable: "A selected field source cannot be redistributed through API v1",
	import_evidence_missing: "Import evidence is missing",
	insufficient_allergen_evidence: "Allergen evidence is incomplete",
	invalid_gtin: "The GTIN is invalid",
	license_metadata_missing: "License or attribution details are missing",
	license_review_missing: "License review is missing",
	missing_current_revision: "The current catalog revision is missing",
	missing_evidence_backed_primary_serving: "An evidence-backed primary serving is missing",
	missing_field_provenance: "Selected product information is missing source evidence",
	missing_normalized_nutrients: "Normalized nutrition is missing",
	missing_nutrient_provenance: "Selected nutrition is missing source evidence",
	missing_publication_profile: "The API publication profile is missing",
	missing_required_field: "Required product information is missing",
	missing_required_nutrient: "A required nutrient is missing",
	missing_serving_provenance: "The selected serving is missing source evidence",
	missing_verification_timestamp: "Current verification evidence is missing",
	nutrient_source_not_redistributable: "A selected nutrient source cannot be redistributed through API v1",
	policy_review_missing: "Source policy review is missing",
	serving_source_not_redistributable: "A selected serving source cannot be redistributed through API v1",
	unsupported_nutrient_value_state: "A nutrient value has an unsupported reporting state",
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
	nutrients: "Nutrition",
	package: "Package information",
	productName: "Product name",
	serving: "Serving",
	servingWeightGrams: "Serving weight",
	sourceMetadata: "Source details",
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
