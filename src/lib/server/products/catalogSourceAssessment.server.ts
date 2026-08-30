import type { Database } from "$lib/types/database.types";
import { getBarcodeProductDesiredSourceFieldPaths } from "$lib/utils/barcode/barcodeProductEnrichment";
import { resolveBarcodeProductFields } from "$lib/utils/barcode/barcodeProductFieldResolution";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ProductResolutionPolicy } from "$lib/utils/products/productResolutionPolicy";
import type { NutrientRelationshipRule } from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBarcodeDraftCategory } from "./categoryMapping.server";
import {
	lookupOpenFoodFactsBarcodeProduct,
	lookupUsdaBarcodeProduct,
} from "./externalProduct.server";
import { getDefaultProductResolutionPolicy } from "./productResolutionPolicy.server";
import {
	readActiveProductSourceFieldCoverage,
	recordProductSourceFieldCoverage,
	sourceCoverageConfirmsProductNotFound,
} from "./productSourceFieldCoverage.server";
import {
	addSelectedSourceFieldMetrics,
	assessCatalogSourceAccuracy,
	type CatalogSourceAccuracyAssessment,
} from "./catalogSourceAccuracy.server";

export type CatalogSourceLookupStatus = "exact-match" | "not-found" | "error";

export type CatalogSourceAssessment = {
	resolutionPolicy: ProductResolutionPolicy;
	usdaDraft: BarcodeProductDraft | null;
	openFoodFactsDraft: BarcodeProductDraft | null;
	mergedDraft: BarcodeProductDraft | null;
	usdaLookupStatus: CatalogSourceLookupStatus;
	openFoodFactsLookupStatus: CatalogSourceLookupStatus;
	externalLookupFailed: boolean;
	sourceAccuracy: CatalogSourceAccuracyAssessment;
};

type CatalogSourceLookupDependencies = {
	usda?: typeof lookupUsdaBarcodeProduct;
	openFoodFacts?: typeof lookupOpenFoodFactsBarcodeProduct;
	resolveCategory?: typeof resolveBarcodeDraftCategory;
	policy?: ProductResolutionPolicy;
	nutrientRelationshipRules?: readonly NutrientRelationshipRule[];
};

const hasFreshProductNotFoundCoverage = async (
	supabase: SupabaseClient<Database>,
	barcode: string,
	providerKey: "usda" | "open-food-facts",
) => {
	try {
		return sourceCoverageConfirmsProductNotFound(
			await readActiveProductSourceFieldCoverage(supabase, {
				barcode,
				providerKey,
				fieldPaths: ["productIdentity"],
			}),
		);
	} catch {
		return false;
	}
};

const recordSourceCoverageWithoutBlockingLookup = async (
	supabase: SupabaseClient<Database>,
	input: Parameters<typeof recordProductSourceFieldCoverage>[1],
) => {
	try {
		await recordProductSourceFieldCoverage(supabase, input);
	} catch {
		return;
	}
};

const resolveLookup = async (
	supabase: SupabaseClient<Database>,
	barcode: string,
	providerKey: "usda" | "open-food-facts",
	lookup: () => Promise<BarcodeProductDraft | null>,
	resolveCategory: typeof resolveBarcodeDraftCategory,
	policy: ProductResolutionPolicy,
) => {
	if (await hasFreshProductNotFoundCoverage(supabase, barcode, providerKey)) {
		return { draft: null, status: "not-found" as const };
	}

	try {
		const draft = await lookup();
		await recordSourceCoverageWithoutBlockingLookup(supabase, {
			barcode,
			providerKey,
			policy,
			requestedFieldPaths: getBarcodeProductDesiredSourceFieldPaths(),
			draft,
		});
		return {
			draft: draft ? await resolveCategory(supabase, draft) : null,
			status: draft ? ("exact-match" as const) : ("not-found" as const),
		};
	} catch {
		return { draft: null, status: "error" as const };
	}
};

export const assessCatalogProductSources = async (
	supabase: SupabaseClient<Database>,
	barcode: string,
	dependencies: CatalogSourceLookupDependencies = {},
): Promise<CatalogSourceAssessment> => {
	const policy =
		dependencies.policy ?? (await getDefaultProductResolutionPolicy());
	const [usda, openFoodFacts] = await Promise.all([
		resolveLookup(
			supabase,
			barcode,
			"usda",
			() => (dependencies.usda ?? lookupUsdaBarcodeProduct)(barcode),
			dependencies.resolveCategory ?? resolveBarcodeDraftCategory,
			policy,
		),
		resolveLookup(
			supabase,
			barcode,
			"open-food-facts",
			() =>
				(dependencies.openFoodFacts ?? lookupOpenFoodFactsBarcodeProduct)(
					barcode,
				),
			dependencies.resolveCategory ?? resolveBarcodeDraftCategory,
			policy,
		),
	]);
	const sourceAccuracy = assessCatalogSourceAccuracy({
		usdaDraft: usda.draft,
		openFoodFactsDraft: openFoodFacts.draft,
		nutrientRelationshipRules: dependencies.nutrientRelationshipRules ?? [],
		policy,
	});
	const mergedDraft = resolveBarcodeProductFields(
		[sourceAccuracy.usdaDraft, sourceAccuracy.openFoodFactsDraft],
		policy,
	);

	return {
		resolutionPolicy: policy,
		usdaDraft: sourceAccuracy.usdaDraft,
		openFoodFactsDraft: sourceAccuracy.openFoodFactsDraft,
		mergedDraft,
		usdaLookupStatus: usda.status,
		openFoodFactsLookupStatus: openFoodFacts.status,
		externalLookupFailed:
			usda.status === "error" || openFoodFacts.status === "error",
		sourceAccuracy: {
			...sourceAccuracy,
			metricIncrements: addSelectedSourceFieldMetrics(
				sourceAccuracy.metricIncrements,
				mergedDraft,
			),
		},
	};
};
