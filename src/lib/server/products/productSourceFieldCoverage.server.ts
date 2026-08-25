import type { Database } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	barcodeProductDraftReportsSourceField,
	type ProductSourceFieldPath,
} from "$lib/utils/barcode/barcodeProductEnrichment";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import {
	getProductSourceFieldCoveragePolicy,
	type ProductResolutionPolicy,
} from "$lib/utils/products/productResolutionPolicy";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductSourceFieldCoverageStatus =
	"reported" | "not-reported" | "not-applicable" | "product-not-found";

export type ActiveProductSourceFieldCoverage = {
	fieldPath: ProductSourceFieldPath;
	coverageStatus: ProductSourceFieldCoverageStatus;
	expiresAt: string;
};

const isCoverageStatus = (
	value: string,
): value is ProductSourceFieldCoverageStatus =>
	value === "reported" ||
	value === "not-reported" ||
	value === "not-applicable" ||
	value === "product-not-found";

const requireCanonicalBarcode = (barcode: string) => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode)
		throw new Error("A valid GTIN is required for source coverage.");
	return canonicalBarcode;
};

export const readActiveProductSourceFieldCoverage = async (
	supabase: SupabaseClient<Database>,
	input: {
		barcode: string;
		providerKey: string;
		fieldPaths: readonly ProductSourceFieldPath[];
		now?: Date;
	},
) => {
	if (input.fieldPaths.length === 0) {
		return new Map<ProductSourceFieldPath, ActiveProductSourceFieldCoverage>();
	}
	const canonicalBarcode = requireCanonicalBarcode(input.barcode);
	const { data, error } = await supabase
		.from("product_source_field_coverage")
		.select("field_path, coverage_status, expires_at")
		.eq("barcode", canonicalBarcode)
		.eq("provider_key", input.providerKey)
		.in("field_path", [...input.fieldPaths])
		.gt("expires_at", (input.now ?? new Date()).toISOString());
	if (error) throw error;

	const coverage = new Map<
		ProductSourceFieldPath,
		ActiveProductSourceFieldCoverage
	>();
	for (const row of data ?? []) {
		if (!isCoverageStatus(row.coverage_status)) {
			throw new Error(
				`Product source coverage status ${row.coverage_status} is not supported.`,
			);
		}
		const fieldPath = row.field_path as ProductSourceFieldPath;
		coverage.set(fieldPath, {
			fieldPath,
			coverageStatus: row.coverage_status,
			expiresAt: row.expires_at,
		});
	}
	return coverage;
};

export const sourceCoverageConfirmsFieldsUnavailable = (
	fieldPaths: readonly ProductSourceFieldPath[],
	coverage: ReadonlyMap<
		ProductSourceFieldPath,
		ActiveProductSourceFieldCoverage
	>,
) =>
	fieldPaths.length > 0 &&
	fieldPaths.every((fieldPath) => {
		const status = coverage.get(fieldPath)?.coverageStatus;
		return status === "not-reported" || status === "not-applicable";
	});

export const sourceCoverageConfirmsProductNotFound = (
	coverage: ReadonlyMap<
		ProductSourceFieldPath,
		ActiveProductSourceFieldCoverage
	>,
) => coverage.get("productIdentity")?.coverageStatus === "product-not-found";

const getCoverageTtlSeconds = (
	status: ProductSourceFieldCoverageStatus,
	policy: ProductResolutionPolicy,
	providerKey: string,
) => {
	const coveragePolicy = getProductSourceFieldCoveragePolicy(
		policy,
		providerKey,
	);
	if (status === "reported") return coveragePolicy.reportedCoverageTtlSeconds;
	if (status === "product-not-found") {
		return coveragePolicy.notFoundCoverageTtlSeconds;
	}
	return coveragePolicy.notReportedCoverageTtlSeconds;
};

export const recordProductSourceFieldCoverage = async (
	supabase: SupabaseClient<Database>,
	input: {
		barcode: string;
		providerKey: string;
		policy: ProductResolutionPolicy;
		requestedFieldPaths: readonly ProductSourceFieldPath[];
		draft: BarcodeProductDraft | null;
		sourceReference?: string | null;
		providerRevision?: string | null;
		checkedAt?: Date;
	},
) => {
	const canonicalBarcode = requireCanonicalBarcode(input.barcode);
	const checkedAt = input.checkedAt ?? new Date();
	const checkedAtIso = checkedAt.toISOString();
	const draft = input.draft;
	const outcomes: Array<{
		fieldPath: ProductSourceFieldPath;
		coverageStatus: ProductSourceFieldCoverageStatus;
	}> = draft
		? [...new Set(input.requestedFieldPaths)].map((fieldPath) => ({
				fieldPath,
				coverageStatus: barcodeProductDraftReportsSourceField(draft, fieldPath)
					? ("reported" as const)
					: ("not-reported" as const),
			}))
		: [
				{
					fieldPath: "productIdentity",
					coverageStatus: "product-not-found",
				},
			];

	if (outcomes.length === 0) return;
	const rows = outcomes.map((outcome) => ({
		barcode: canonicalBarcode,
		provider_key: input.providerKey,
		field_path: outcome.fieldPath,
		coverage_status: outcome.coverageStatus,
		policy_key: input.policy.key,
		source_reference: input.sourceReference ?? draft?.sourceReference ?? null,
		provider_revision:
			input.providerRevision ?? draft?.sourceModifiedDate ?? null,
		checked_at: checkedAtIso,
		expires_at: new Date(
			checkedAt.getTime() +
				getCoverageTtlSeconds(
					outcome.coverageStatus,
					input.policy,
					input.providerKey,
				) *
					1000,
		).toISOString(),
	}));

	const { error } = await supabase
		.from("product_source_field_coverage")
		.upsert(rows, { onConflict: "barcode,provider_key,field_path" });
	if (error) throw error;
};
