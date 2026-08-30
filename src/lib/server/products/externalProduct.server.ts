import { type BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { FoodImageAsset } from "$lib/utils/food/types";
import { getProductReferenceCatalog } from "./productReferenceCatalog.server";
import {
	applyCachedImageToBarcodeDraft,
	getBarcodeProductDesiredSourceFieldPaths,
	getBarcodeProductSupplementSourceFieldPaths,
	mergeMissingBarcodeProductFields,
	needsAlcoholBarcodeProductSupplement,
	needsBarcodeProductSupplement,
	type ProductSourceFieldPath,
} from "$lib/utils/barcode/barcodeProductEnrichment";
import { getNutritionCompletenessCatalog } from "$lib/server/nutrition/nutritionCompletenessCatalog.server";
import { getNutritionCompletenessProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import type { FoodItem } from "$lib/utils/food/types";
import { lookupUsdaBarcodeProduct } from "$lib/server/products/sources/usdaBarcodeProduct.server";
import { lookupOpenFoodFactsBarcodeProduct } from "$lib/server/products/sources/openFoodFactsBarcodeProduct.server";
import { lookupColaCloudBarcodeProduct } from "$lib/server/products/sources/colaCloudBarcodeProduct.server";
import { areExternalProductLookupsEnabled } from "./externalProductPolicy.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database } from "$lib/types/database.types";
import type { ProductResolutionPolicy } from "$lib/utils/products/productResolutionPolicy";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultProductResolutionPolicy } from "./productResolutionPolicy.server";
import {
	readActiveProductSourceFieldCoverage,
	recordProductSourceFieldCoverage,
	sourceCoverageConfirmsFieldsUnavailable,
	sourceCoverageConfirmsProductNotFound,
} from "./productSourceFieldCoverage.server";
import { persistLegallyStorableExactProductObservation } from "./productSourceObservation.server";
import type { NutrientRelationshipRule } from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import { getNutrientRelationshipRuleCatalog } from "$lib/server/nutrition/nutrientRelationshipCatalog.server";
import { assessProviderDraftNutrientAccuracy } from "./catalogSourceAccuracy.server";
import { recordProductSourceFieldMetrics } from "./sourceMetrics.server";

export {
	lookupUsdaBarcodeProduct,
	lookupOpenFoodFactsBarcodeProduct,
	lookupColaCloudBarcodeProduct,
};

export const getRequiredPackagedNutrientIds = async (food?: FoodItem) => {
	const catalog = await getNutritionCompletenessCatalog();
	const profiles = catalog.profiles.filter(
		(profile) => profile.foodScope === "packaged",
	);
	const profile = food
		? getNutritionCompletenessProfile(food, catalog)
		: (profiles.find((item) => item.isDefault && item.regionCode === "US") ??
			profiles.find((item) => item.isDefault) ??
			profiles[0]);
	return (
		profile?.nutrients
			.filter((nutrient) => nutrient.requirementLevel === "required")
			.map((nutrient) => nutrient.nutrientId) ?? []
	);
};

const getRegulatedAlcoholDisclosureProfileKeys = async () => {
	const catalog = await getNutritionCompletenessCatalog();
	return (catalog.regulatoryDisclosureProfiles ?? [])
		.filter((profile) => profile.disclosureKind === "regulated-alcohol")
		.map((profile) => profile.key);
};

export const lookupExternalBarcodeProduct = async (
	barcode: string,
	lookups: {
		usda?: typeof lookupUsdaBarcodeProduct;
		openFoodFacts?: typeof lookupOpenFoodFactsBarcodeProduct;
		colaCloud?: typeof lookupColaCloudBarcodeProduct;
		getProductReferenceCatalog?: typeof getProductReferenceCatalog;
		requiredNutrientIds?: Iterable<number> | PromiseLike<Iterable<number>>;
		cachedImage?: FoodImageAsset | null | PromiseLike<FoodImageAsset | null>;
		regulatedAlcoholProfileKeys?:
			Iterable<string> | PromiseLike<Iterable<string>>;
		externalLookupsEnabled?: boolean;
		resolutionPolicy?:
			ProductResolutionPolicy | PromiseLike<ProductResolutionPolicy>;
		nutrientRelationshipRules?:
			| readonly NutrientRelationshipRule[]
			| PromiseLike<readonly NutrientRelationshipRule[]>;
		sourceCoverageSupabase?: SupabaseClient<Database>;
	} = {},
): Promise<BarcodeProductDraft | null> => {
	const hasInjectedProvider = Boolean(
		lookups.usda || lookups.openFoodFacts || lookups.colaCloud,
	);
	const externalLookupsEnabled =
		lookups.externalLookupsEnabled ?? areExternalProductLookupsEnabled();
	if (!hasInjectedProvider && !externalLookupsEnabled) return null;
	const sourceCoverageEnabled =
		!hasInjectedProvider ||
		Boolean(lookups.resolutionPolicy || lookups.sourceCoverageSupabase);
	const sourceCoverageSupabase = sourceCoverageEnabled
		? (lookups.sourceCoverageSupabase ?? getSupabaseAdminClient())
		: null;
	const resolutionPolicyPromise = sourceCoverageEnabled
		? Promise.resolve(
				lookups.resolutionPolicy ?? getDefaultProductResolutionPolicy(),
			).catch(() => null)
		: null;
	const nutrientRelationshipRulesPromise = Promise.resolve(
		lookups.nutrientRelationshipRules ??
			(hasInjectedProvider ? [] : getNutrientRelationshipRuleCatalog()),
	).catch(() => null);

	const productReferenceCatalogPromise = (
		lookups.getProductReferenceCatalog ?? getProductReferenceCatalog
	)();
	const requiredNutrientIdsPromise: Promise<Iterable<number>> =
		lookups.requiredNutrientIds !== undefined
			? Promise.resolve(lookups.requiredNutrientIds)
			: hasInjectedProvider
				? Promise.resolve([])
				: getRequiredPackagedNutrientIds();
	void requiredNutrientIdsPromise.catch(() => undefined);
	const cachedImagePromise = Promise.resolve(lookups.cachedImage ?? null).catch(
		() => null,
	);
	const regulatedAlcoholProfileKeysPromise: Promise<Iterable<string>> =
		lookups.regulatedAlcoholProfileKeys !== undefined
			? Promise.resolve(lookups.regulatedAlcoholProfileKeys)
			: hasInjectedProvider
				? Promise.resolve([])
				: getRegulatedAlcoholDisclosureProfileKeys();
	void regulatedAlcoholProfileKeysPromise.catch(() => undefined);
	const productReferenceCatalog = await productReferenceCatalogPromise;
	const lookupUsda = lookups.usda ?? lookupUsdaBarcodeProduct;
	const lookupOpenFoodFacts =
		lookups.openFoodFacts ?? lookupOpenFoodFactsBarcodeProduct;
	const lookupColaCloud =
		lookups.colaCloud ??
		(hasInjectedProvider ? async () => null : lookupColaCloudBarcodeProduct);
	const lookupProviderWithCoverage = async (
		providerKey: "usda" | "open-food-facts" | "cola-cloud",
		requestedFieldPaths: readonly ProductSourceFieldPath[],
		lookup: () => Promise<BarcodeProductDraft | null>,
	) => {
		const resolutionPolicy = resolutionPolicyPromise
			? await resolutionPolicyPromise
			: null;
		if (sourceCoverageSupabase && resolutionPolicy) {
			try {
				const coverage = await readActiveProductSourceFieldCoverage(
					sourceCoverageSupabase,
					{
						barcode,
						providerKey,
						fieldPaths: ["productIdentity", ...requestedFieldPaths],
					},
				);
				if (
					sourceCoverageConfirmsProductNotFound(coverage) ||
					sourceCoverageConfirmsFieldsUnavailable(requestedFieldPaths, coverage)
				) {
					return null;
				}
			} catch {
				void 0;
			}
		}

		const sourceDraft = await lookup();
		const nutrientAccuracy = assessProviderDraftNutrientAccuracy(
			sourceDraft,
			await nutrientRelationshipRulesPromise,
		);
		const draft = nutrientAccuracy.draft;
		await recordProductSourceFieldMetrics(nutrientAccuracy.metricIncrements);
		if (draft && !hasInjectedProvider) {
			await persistLegallyStorableExactProductObservation({
				draft,
				providerKey,
				productReferenceCatalog,
			});
		}
		if (sourceCoverageSupabase && resolutionPolicy) {
			try {
				await recordProductSourceFieldCoverage(sourceCoverageSupabase, {
					barcode,
					providerKey,
					policy: resolutionPolicy,
					requestedFieldPaths,
					draft,
				});
			} catch {
				void 0;
			}
		}
		return draft;
	};
	const applyCachedImage = async (draft: BarcodeProductDraft | null) => {
		if (!draft) return null;
		return applyCachedImageToBarcodeDraft(draft, await cachedImagePromise);
	};
	const applyAlcoholSupplement = async (draft: BarcodeProductDraft) => {
		const regulatedAlcoholProfileKeys =
			await regulatedAlcoholProfileKeysPromise.catch(() => []);
		if (
			!needsAlcoholBarcodeProductSupplement(draft, regulatedAlcoholProfileKeys)
		) {
			return draft;
		}
		try {
			const requestedFieldPaths = getBarcodeProductSupplementSourceFieldPaths(
				draft,
			).filter((fieldPath) =>
				[
					"brandOwner",
					"package",
					"alcoholByVolume",
					"regulatoryDisclosure",
					"sourceMetadata",
				].includes(fieldPath),
			);
			return mergeMissingBarcodeProductFields(
				draft,
				await lookupProviderWithCoverage(
					"cola-cloud",
					requestedFieldPaths,
					() => lookupColaCloud(barcode, productReferenceCatalog),
				),
			);
		} catch {
			return draft;
		}
	};
	let firstError: unknown;
	try {
		const [usdaDraft, cachedImage] = await Promise.all([
			lookupProviderWithCoverage(
				"usda",
				getBarcodeProductDesiredSourceFieldPaths(),
				() => lookupUsda(barcode, productReferenceCatalog),
			),
			cachedImagePromise,
		]);
		if (usdaDraft) {
			const primaryDraft = applyCachedImageToBarcodeDraft(
				usdaDraft,
				cachedImage,
			);
			const requiredNutrientIds = await requiredNutrientIdsPromise;
			if (!needsBarcodeProductSupplement(primaryDraft, requiredNutrientIds)) {
				return applyAlcoholSupplement(primaryDraft);
			}
			try {
				const requestedFieldPaths = getBarcodeProductSupplementSourceFieldPaths(
					primaryDraft,
					requiredNutrientIds,
				);
				const supplement = await lookupProviderWithCoverage(
					"open-food-facts",
					requestedFieldPaths,
					() => lookupOpenFoodFacts(barcode, productReferenceCatalog),
				);
				return applyAlcoholSupplement(
					mergeMissingBarcodeProductFields(primaryDraft, supplement),
				);
			} catch {
				return applyAlcoholSupplement(primaryDraft);
			}
		}
	} catch (error) {
		firstError = error;
	}

	try {
		const openFoodFactsDraft = await lookupProviderWithCoverage(
			"open-food-facts",
			getBarcodeProductDesiredSourceFieldPaths(),
			() => lookupOpenFoodFacts(barcode, productReferenceCatalog),
		);
		if (openFoodFactsDraft) {
			const draftWithCachedImage = await applyCachedImage(openFoodFactsDraft);
			return draftWithCachedImage
				? applyAlcoholSupplement(draftWithCachedImage)
				: null;
		}
	} catch (error) {
		firstError ??= error;
	}

	try {
		return await applyCachedImage(
			await lookupProviderWithCoverage(
				"cola-cloud",
				getBarcodeProductDesiredSourceFieldPaths(),
				() => lookupColaCloud(barcode, productReferenceCatalog),
			),
		);
	} catch (error) {
		throw firstError ?? error;
	}
};
