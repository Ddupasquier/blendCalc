import type { Database } from "$lib/types/database.types";
import {
	mergeMissingBarcodeProductFields,
} from "$lib/utils/barcode/barcodeProductEnrichment";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBarcodeDraftCategory } from "./categoryMapping.server";
import {
	lookupOpenFoodFactsBarcodeProduct,
	lookupUsdaBarcodeProduct,
} from "./externalProduct.server";

export type CatalogSourceLookupStatus = "exact-match" | "not-found" | "error";

export type CatalogSourceAssessment = {
	usdaDraft: BarcodeProductDraft | null;
	openFoodFactsDraft: BarcodeProductDraft | null;
	mergedDraft: BarcodeProductDraft | null;
	usdaLookupStatus: CatalogSourceLookupStatus;
	openFoodFactsLookupStatus: CatalogSourceLookupStatus;
	externalLookupFailed: boolean;
};

type CatalogSourceLookupDependencies = {
	usda?: typeof lookupUsdaBarcodeProduct;
	openFoodFacts?: typeof lookupOpenFoodFactsBarcodeProduct;
	resolveCategory?: typeof resolveBarcodeDraftCategory;
};

const resolveLookup = async (
	supabase: SupabaseClient<Database>,
	lookup: () => Promise<BarcodeProductDraft | null>,
	resolveCategory: typeof resolveBarcodeDraftCategory,
) => {
	try {
		const draft = await lookup();
		return {
			draft: draft ? await resolveCategory(supabase, draft) : null,
			status: draft ? "exact-match" as const : "not-found" as const,
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
	const [usda, openFoodFacts] = await Promise.all([
		resolveLookup(
			supabase,
			() => (dependencies.usda ?? lookupUsdaBarcodeProduct)(barcode),
			dependencies.resolveCategory ?? resolveBarcodeDraftCategory,
		),
		resolveLookup(
			supabase,
			() => (dependencies.openFoodFacts ?? lookupOpenFoodFactsBarcodeProduct)(
				barcode,
			),
			dependencies.resolveCategory ?? resolveBarcodeDraftCategory,
		),
	]);

	return {
		usdaDraft: usda.draft,
		openFoodFactsDraft: openFoodFacts.draft,
		mergedDraft: usda.draft
			? mergeMissingBarcodeProductFields(usda.draft, openFoodFacts.draft)
			: openFoodFacts.draft,
		usdaLookupStatus: usda.status,
		openFoodFactsLookupStatus: openFoodFacts.status,
		externalLookupFailed:
			usda.status === "error" || openFoodFacts.status === "error",
	};
};
