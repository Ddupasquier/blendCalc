import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database } from "$lib/types/database.types";
import {
	getBarcodeLookupCandidates,
	normalizeBarcode,
} from "$lib/utils/barcode/barcode";
import type {
	FoodSafetyAlert,
	FoodSafetyAlertCheck,
} from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyDatabaseQueryAbortSignal } from "$lib/utils/storage/supabase/databaseQueryAbortSignal";

type SafetyAlertMatchRow = {
	id: string;
	alert_id: string;
	shared_product_id: string;
	match_type: "exact_gtin" | "probable_identity" | "manual";
	requires_package_check: boolean;
	detected_at: string;
};

type SafetyAlertRow = {
	id: string;
	provider_key: string;
	alert_type: "recall" | "public_health_alert";
	classification: string | null;
	status: string;
	product_description: string;
	reason: string | null;
	recalling_organization: string | null;
	package_description: string | null;
	code_information: string | null;
	source_url: string;
	report_date: string | null;
	recall_initiated_at: string | null;
};

type SafetyAlertSourceRow = {
	key: string;
	display_name: string;
	attribution_text: string | null;
};

type SafetyAlertIdentifierRow = {
	alert_id: string;
	created_at: string;
	normalized_value: string;
};

type SafetyAlertBarcodeLookupRow = SafetyAlertRow & {
	last_seen_at: string;
};

export type FoodSafetyAlertsByBarcodeResult = {
	status: FoodSafetyAlertCheck["status"];
	alertsByBarcode: Map<string, FoodSafetyAlert[]>;
};

const SAFETY_ALERT_SEARCH_LIMIT = 100;

const getClassificationPriority = (classification?: string) => {
	if (/class\s*i\b/i.test(classification ?? "")) return 0;
	if (/class\s*ii\b/i.test(classification ?? "")) return 1;
	if (/class\s*iii\b/i.test(classification ?? "")) return 2;
	return 3;
};

export const isCatalogSafetyMonitoringSchemaUnavailable = (
	error: { code?: string; message?: string } | null | undefined,
) => {
	const message = error?.message?.toLowerCase() ?? "";
	const namesSafetyMonitoringTable =
		message.includes("official_food_safety_alert_matches") ||
		message.includes("official_food_safety_alert_identifiers") ||
		message.includes("official_food_safety_alerts");

	return (
		namesSafetyMonitoringTable &&
		(error?.code === "42P01" ||
			error?.code === "PGRST205" ||
			message.includes("does not exist") ||
			message.includes("could not find the table"))
	);
};

const sortFoodSafetyAlerts = (alerts: FoodSafetyAlert[]) =>
	alerts.sort(
		(left, right) =>
			getClassificationPriority(left.classification) -
				getClassificationPriority(right.classification) ||
			right.detectedAt.localeCompare(left.detectedAt),
	);

const readSafetyAlertSources = async (
	alerts: SafetyAlertRow[],
	supabase: SupabaseClient<Database>,
	databaseAbortSignal?: AbortSignal,
) => {
	const sourceKeys = [...new Set(alerts.map((alert) => alert.provider_key))];
	if (sourceKeys.length === 0) return new Map<string, SafetyAlertSourceRow>();

	const databaseQuery = supabase
		.from("product_data_sources")
		.select("key, display_name, attribution_text")
		.in("key", sourceKeys);
	const { data, error } = await applyDatabaseQueryAbortSignal(
		databaseQuery,
		databaseAbortSignal,
	);
	if (error) throw error;

	return new Map(
		((data ?? []) as SafetyAlertSourceRow[]).map((source) => [
			source.key,
			source,
		]),
	);
};

const toFoodSafetyAlert = ({
	alert,
	source,
	matchType,
	requiresPackageCheck,
	detectedAt,
}: {
	alert: SafetyAlertRow;
	source?: SafetyAlertSourceRow;
	matchType: FoodSafetyAlert["matchType"];
	requiresPackageCheck: boolean;
	detectedAt: string;
}): FoodSafetyAlert => ({
	id: alert.id,
	providerKey: alert.provider_key,
	sourceName: source?.display_name ?? alert.provider_key,
	sourceAttribution:
		source?.attribution_text ?? source?.display_name ?? alert.provider_key,
	alertType: alert.alert_type,
	classification: alert.classification ?? undefined,
	status: alert.status,
	productDescription: alert.product_description,
	reason: alert.reason ?? undefined,
	recallingOrganization: alert.recalling_organization ?? undefined,
	packageDescription: alert.package_description ?? undefined,
	codeInformation: alert.code_information ?? undefined,
	sourceUrl: alert.source_url,
	reportDate: alert.report_date ?? undefined,
	recallInitiatedAt: alert.recall_initiated_at ?? undefined,
	matchType,
	requiresPackageCheck,
	detectedAt,
});

export const readActiveProductSafetyAlertsByBarcodes = async (
	barcodes: string[],
	supabase: SupabaseClient<Database> = getSupabaseAdminClient(),
): Promise<FoodSafetyAlertsByBarcodeResult> => {
	const canonicalBarcodes = [
		...new Set(
			barcodes.map((barcode) => normalizeBarcode(barcode)).filter(Boolean),
		),
	] as string[];
	const alertsByBarcode = new Map<string, FoodSafetyAlert[]>();
	if (canonicalBarcodes.length === 0) {
		return { status: "checked", alertsByBarcode };
	}

	const canonicalBarcodesByCandidate = new Map<string, Set<string>>();
	for (const canonicalBarcode of canonicalBarcodes) {
		for (const candidate of getBarcodeLookupCandidates(canonicalBarcode)) {
			const matchingBarcodes =
				canonicalBarcodesByCandidate.get(candidate) ?? new Set<string>();
			matchingBarcodes.add(canonicalBarcode);
			canonicalBarcodesByCandidate.set(candidate, matchingBarcodes);
		}
	}

	const { data: identifierData, error: identifierError } = await supabase
		.from("official_food_safety_alert_identifiers")
		.select("alert_id, created_at, normalized_value")
		.in("identifier_type", ["gtin", "upc"])
		.in("normalized_value", [...canonicalBarcodesByCandidate.keys()]);
	if (isCatalogSafetyMonitoringSchemaUnavailable(identifierError)) {
		return { status: "unavailable", alertsByBarcode };
	}
	if (identifierError) throw identifierError;

	const identifiers = (identifierData ?? []) as SafetyAlertIdentifierRow[];
	if (identifiers.length === 0) {
		return { status: "checked", alertsByBarcode };
	}

	const alertIds = [
		...new Set(identifiers.map((identifier) => identifier.alert_id)),
	];
	const { data: alertData, error: alertError } = await supabase
		.from("official_food_safety_alerts")
		.select(
			"id, provider_key, alert_type, classification, status, product_description, reason, recalling_organization, source_url, report_date, recall_initiated_at, code_information, package_description, last_seen_at",
		)
		.in("id", alertIds)
		.eq("is_active", true);
	if (isCatalogSafetyMonitoringSchemaUnavailable(alertError)) {
		return { status: "unavailable", alertsByBarcode };
	}
	if (alertError) throw alertError;

	const alerts = (alertData ?? []) as SafetyAlertBarcodeLookupRow[];
	const alertsById = new Map(alerts.map((alert) => [alert.id, alert]));
	const sourcesByKey = await readSafetyAlertSources(alerts, supabase);
	for (const identifier of identifiers) {
		const alert = alertsById.get(identifier.alert_id);
		if (!alert) continue;
		const matchingBarcodes = canonicalBarcodesByCandidate.get(
			identifier.normalized_value,
		);
		if (!matchingBarcodes) continue;

		for (const canonicalBarcode of matchingBarcodes) {
			const productAlerts = alertsByBarcode.get(canonicalBarcode) ?? [];
			if (productAlerts.some((productAlert) => productAlert.id === alert.id)) {
				continue;
			}
			productAlerts.push(
				toFoodSafetyAlert({
					alert,
					source: sourcesByKey.get(alert.provider_key),
					matchType: "exact_gtin",
					requiresPackageCheck: Boolean(
						alert.code_information || alert.package_description,
					),
					detectedAt: identifier.created_at || alert.last_seen_at,
				}),
			);
			alertsByBarcode.set(canonicalBarcode, productAlerts);
		}
	}
	for (const productAlerts of alertsByBarcode.values()) {
		sortFoodSafetyAlerts(productAlerts);
	}

	return { status: "checked", alertsByBarcode };
};

export const readActiveProductSafetyAlertsByBarcode = async (
	barcode: string,
	supabase: SupabaseClient<Database> = getSupabaseAdminClient(),
): Promise<FoodSafetyAlertCheck> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return { status: "checked", alerts: [] };

	const result = await readActiveProductSafetyAlertsByBarcodes(
		[canonicalBarcode],
		supabase,
	);
	return {
		status: result.status,
		alerts: result.alertsByBarcode.get(canonicalBarcode) ?? [],
	};
};

export const readActiveProductIdsMatchingSafetyAlertMetadata = async (
	searchTerms: string[],
	supabase: SupabaseClient<Database> = getSupabaseAdminClient(),
	matchMode: "all" | "any" = "all",
) => {
	const terms = [
		...new Set(searchTerms.map((term) => term.trim()).filter(Boolean)),
	];
	if (terms.length === 0) return [];

	let alertRequest = supabase
		.from("official_food_safety_alerts")
		.select("id")
		.eq("is_active", true)
		.limit(SAFETY_ALERT_SEARCH_LIMIT);
	const searchExpressions = terms.flatMap((term) => [
		`recalling_organization.ilike.%${term}%`,
		`product_description.ilike.%${term}%`,
		`reason.ilike.%${term}%`,
	]);
	if (matchMode === "all") {
		for (const term of terms) {
			alertRequest = alertRequest.or(
				[
					`recalling_organization.ilike.%${term}%`,
					`product_description.ilike.%${term}%`,
					`reason.ilike.%${term}%`,
				].join(","),
			);
		}
	} else {
		alertRequest = alertRequest.or(searchExpressions.join(","));
	}
	const { data: alertData, error: alertError } = await alertRequest;
	if (isCatalogSafetyMonitoringSchemaUnavailable(alertError)) return [];
	if (alertError) throw alertError;
	const alertIds = (alertData ?? []).map((alert) => alert.id);
	if (alertIds.length === 0) return [];

	const { data: matchData, error: matchError } = await supabase
		.from("official_food_safety_alert_matches")
		.select("shared_product_id")
		.in("alert_id", alertIds)
		.in("status", ["active", "confirmed"])
		.limit(SAFETY_ALERT_SEARCH_LIMIT);
	if (isCatalogSafetyMonitoringSchemaUnavailable(matchError)) return [];
	if (matchError) throw matchError;
	return [
		...new Set((matchData ?? []).map((match) => match.shared_product_id)),
	];
};

export const readActiveProductSafetyAlertsByProduct = async (
	sharedProductIds: string[],
	supabase: SupabaseClient<Database> = getSupabaseAdminClient(),
	databaseAbortSignal?: AbortSignal,
) => {
	const uniqueProductIds = [...new Set(sharedProductIds.filter(Boolean))];
	if (uniqueProductIds.length === 0) {
		return new Map<string, FoodSafetyAlert[]>();
	}

	const matchQuery = supabase
		.from("official_food_safety_alert_matches")
		.select(
			"id, alert_id, shared_product_id, match_type, requires_package_check, detected_at",
		)
		.in("shared_product_id", uniqueProductIds)
		.in("status", ["active", "confirmed"]);
	const { data: matchData, error: matchError } =
		await applyDatabaseQueryAbortSignal(matchQuery, databaseAbortSignal);
	if (isCatalogSafetyMonitoringSchemaUnavailable(matchError)) {
		return new Map<string, FoodSafetyAlert[]>();
	}
	if (matchError) throw matchError;
	const matches = (matchData ?? []) as SafetyAlertMatchRow[];
	if (matches.length === 0) return new Map<string, FoodSafetyAlert[]>();

	const alertIds = [...new Set(matches.map((match) => match.alert_id))];
	const alertQuery = supabase
		.from("official_food_safety_alerts")
		.select(
			"id, provider_key, alert_type, classification, status, product_description, reason, recalling_organization, package_description, code_information, source_url, report_date, recall_initiated_at",
		)
		.in("id", alertIds)
		.eq("is_active", true);
	const { data: alertData, error: alertError } =
		await applyDatabaseQueryAbortSignal(alertQuery, databaseAbortSignal);
	if (alertError) throw alertError;
	const alerts = (alertData ?? []) as SafetyAlertRow[];
	const alertsById = new Map(alerts.map((alert) => [alert.id, alert]));
	const sourcesByKey = await readSafetyAlertSources(
		alerts,
		supabase,
		databaseAbortSignal,
	);
	const alertsByProduct = new Map<string, FoodSafetyAlert[]>();
	for (const match of matches) {
		const alert = alertsById.get(match.alert_id);
		if (!alert) continue;
		const source = sourcesByKey.get(alert.provider_key);
		const productAlerts = alertsByProduct.get(match.shared_product_id) ?? [];
		productAlerts.push(
			toFoodSafetyAlert({
				alert,
				source,
				matchType: match.match_type,
				requiresPackageCheck: match.requires_package_check,
				detectedAt: match.detected_at,
			}),
		);
		alertsByProduct.set(match.shared_product_id, productAlerts);
	}
	for (const productAlerts of alertsByProduct.values()) {
		sortFoodSafetyAlerts(productAlerts);
	}
	return alertsByProduct;
};
