export type JsonObject = Record<string, unknown>;

export type CatalogRevalidationJob = {
	id: string;
	shared_product_id: string;
	provider_key: "open-food-facts" | "usda";
	source_reference: string;
	barcode: string;
	product_name: string;
	brand_owner: string | null;
	food: JsonObject;
	claim_token: string;
};

export type SafetyAlertIngestionClaim = {
	provider_key: "open-fda-food-enforcement" | "usda-fsis-recalls";
	cursor_value: JsonObject;
	last_successful_at: string | null;
	claim_token: string;
};

export type CatalogMonitorSettings = {
	enabled: boolean;
	product_batch_size: number;
	safety_alert_page_size: number;
};

export type NormalizedProviderSnapshot = {
	productName: string | null;
	brandOwner: string | null;
	serving: JsonObject | null;
	nutrition: unknown[];
	ingredients: JsonObject | null;
	allergens: string[];
	traces: string[];
	precautionaryStatements: string[];
	categories: string[];
	package: JsonObject | null;
	alcoholByVolume: JsonObject | null;
	sourceMetadata: JsonObject;
};

export type ProviderSnapshotResult = {
	rawPayload: JsonObject;
	normalizedSnapshot: NormalizedProviderSnapshot;
	contentHash: string;
	providerRevision: string | null;
	providerUpdatedAt: string | null;
};

export type ProviderSnapshotChange = {
	field: string;
	label: string;
	severity: "low" | "medium" | "high";
	previousValue: unknown;
	observedValue: unknown;
};

export type OfficialSafetyAlertIdentifier = {
	type: "gtin" | "upc" | "lot_code" | "use_by_date" | "package_code";
	normalizedValue: string;
	sourceText?: string;
};

export type NormalizedOfficialSafetyAlert = {
	externalAlertId: string;
	recallNumber: string | null;
	eventId: string | null;
	alertType: "recall" | "public_health_alert";
	classification: string | null;
	status: string;
	productDescription: string;
	reason: string | null;
	recallingOrganization: string | null;
	distributionPattern: string | null;
	packageDescription: string | null;
	codeInformation: string | null;
	sourceUrl: string;
	reportDate: string | null;
	recallInitiatedAt: string | null;
	terminatedAt: string | null;
	sourceUpdatedAt: string | null;
	isActive: boolean;
	brandNames: string[];
	identifiers: OfficialSafetyAlertIdentifier[];
};

export type CatalogSafetyMatchCandidate = {
	id: string;
	barcode: string;
	product_name: string;
	brand_owner: string | null;
	food: JsonObject;
};

export type ProbableSafetyAlertMatch = {
	sharedProductId: string;
	evidence: JsonObject;
};

export type SafetyAlertErrorCode =
	| "rate_limited"
	| "provider_unavailable"
	| "access_denied"
	| "request_timed_out"
	| "invalid_response";

export type SafetyAlertPage = {
	providerKey: SafetyAlertIngestionClaim["provider_key"];
	alerts: Array<{
		rawPayload: JsonObject;
		normalizedAlert: NormalizedOfficialSafetyAlert;
		contentHash: string;
	}>;
	nextCursor: JsonObject;
	sourceUpdatedAt: string | null;
	sourceErrors?: Array<{
		source: string;
		code: SafetyAlertErrorCode;
	}>;
};

export type CatalogMonitorRunSummary = {
	productJobsClaimed: number;
	productJobsUnchanged: number;
	productJobsChanged: number;
	productJobsFailed: number;
	safetyAlertsObserved: number;
	safetyAlertsChanged: number;
	safetyMatchesActivated: number;
	errors: Array<{ scope: string; code: string }>;
};
