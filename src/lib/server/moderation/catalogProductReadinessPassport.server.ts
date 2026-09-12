import { throwAppError } from "$lib/server/errors/appError.server";
import type { Database } from "$lib/types/database.types";
import {
	parseCatalogProductReadinessPassport,
	parseCatalogProductRevisionHistory,
	type CatalogProductReadinessPassport,
} from "$lib/utils/moderation/catalogProductReadinessPassport";
import { getCatalogIssueReasonLabel } from "$lib/utils/moderation/catalogHealthMessages";
import type { SupabaseClient } from "@supabase/supabase-js";

const isRevisionContextSchemaUnavailable = (error: {
	code?: string;
	message?: string;
}) =>
	["42883", "PGRST202"].includes(error.code ?? "") ||
	(error.message ?? "").includes("get_catalog_product_revision_context");

const isWithholdingReasonsSchemaUnavailable = (error: {
	code?: string;
	message?: string;
}) =>
	["42883", "PGRST202"].includes(error.code ?? "") ||
	(error.message ?? "").includes("get_catalog_product_api_withholding_reasons");

const deriveWithholdingReasons = (
	passport: CatalogProductReadinessPassport,
): string[] => {
	const reasons = passport.issues
		.filter((issue) => issue.impact === "blocks_publication")
		.map((issue) =>
			getCatalogIssueReasonLabel(issue.sourceReason, issue.parameters),
		);
	if (passport.product.openMaterialConflictCount > 0) {
		reasons.push(
			`${passport.product.openMaterialConflictCount} stored ${passport.product.openMaterialConflictCount === 1 ? "field has" : "fields have"} conflicting source values.`,
		);
	}
	return [...new Set(reasons)];
};

export const readCatalogProductReadinessPassport = async (
	supabase: SupabaseClient<Database>,
	sharedProductId: string,
): Promise<CatalogProductReadinessPassport> => {
	const [passportResult, revisionHistoryResult, withholdingReasonsResult] =
		await Promise.all([
			supabase.rpc("get_blendcalc_api_catalog_product_readiness_passport", {
				p_shared_product_id: sharedProductId,
			}),
			supabase.rpc("get_catalog_product_revision_context", {
				p_shared_product_id: sharedProductId,
			}),
			supabase.rpc("get_catalog_product_api_withholding_reasons", {
				p_shared_product_id: sharedProductId,
			}),
		]);
	const { data, error } = passportResult;

	if (error?.code === "P0002") {
		throwAppError(404, "PRODUCT_NOT_FOUND");
	}
	if (error || data === null) {
		throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}
	const revisionHistoryUnavailable = Boolean(
		revisionHistoryResult.error &&
		isRevisionContextSchemaUnavailable(revisionHistoryResult.error),
	);
	if (
		(revisionHistoryResult.error && !revisionHistoryUnavailable) ||
		(!revisionHistoryUnavailable && revisionHistoryResult.data === null)
	) {
		throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}
	const withholdingReasonsUnavailable = Boolean(
		withholdingReasonsResult.error &&
		isWithholdingReasonsSchemaUnavailable(withholdingReasonsResult.error),
	);
	if (
		(withholdingReasonsResult.error && !withholdingReasonsUnavailable) ||
		(!withholdingReasonsUnavailable && withholdingReasonsResult.data === null)
	) {
		throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}

	try {
		const passport = {
			...parseCatalogProductReadinessPassport({
				...(data as Record<string, unknown>),
				product: {
					...((data as Record<string, unknown>).product as Record<
						string,
						unknown
					>),
					apiWithholdingReasons: withholdingReasonsUnavailable
						? []
						: withholdingReasonsResult.data,
				},
				revisionHistoryAvailable: !revisionHistoryUnavailable,
			}),
			revisionHistory: revisionHistoryUnavailable
				? []
				: parseCatalogProductRevisionHistory(revisionHistoryResult.data),
		};
		return withholdingReasonsUnavailable
			? {
					...passport,
					product: {
						...passport.product,
						apiWithholdingReasons: deriveWithholdingReasons(passport),
					},
				}
			: passport;
	} catch {
		return throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}
};
