import type { FoodItem } from "$lib/utils/food/types";
import {
	formatSourceProductName,
	normalizeFoodProductName,
} from "$lib/utils/products/productNameFormatting.js";
import { resolveFoodSymbolKey } from "$lib/utils/food/reference/appReferenceCatalog";
import type { FoodStructuredIngredient } from "$lib/utils/food/types";

const cloneStructuredIngredients = (
	ingredients: FoodStructuredIngredient[] | undefined,
): FoodStructuredIngredient[] | undefined =>
	ingredients?.map((ingredient) => ({
		...ingredient,
		ingredients: cloneStructuredIngredients(ingredient.ingredients),
	}));

export const getCanonicalFoodDescription = (
	food: Pick<
		FoodItem,
		"canonicalDescription" | "description" | "foodIdentityType"
	>,
) => {
	const canonicalDescription = food.canonicalDescription?.trim();
	if (!canonicalDescription) return food.description.trim();
	return food.foodIdentityType === "private-custom"
		? canonicalDescription
		: formatSourceProductName(canonicalDescription);
};

export const normalizeFoodForStorage = (food: FoodItem): FoodItem => {
	const normalizedFood = normalizeFoodProductName(food) as FoodItem;
	const acceptedFoodNutrients = food.foodNutrients.filter(
		(nutrient) =>
			Number.isSafeInteger(nutrient.nutrientId) &&
			nutrient.nutrientId > 0 &&
			Number.isFinite(nutrient.value) &&
			nutrient.value >= 0,
	);
	const acceptedNutrientIds = new Set(
		acceptedFoodNutrients.map((nutrient) => nutrient.nutrientId),
	);
	const reportedNutrientIds =
		food.reportedNutrientIds ??
		acceptedFoodNutrients
			.filter((nutrient) => nutrient.valueOrigin === "reported")
			.map((nutrient) => nutrient.nutrientId);
	return {
		fdcId: normalizedFood.fdcId,
		description: normalizedFood.description,
		canonicalDescription:
			food.canonicalDescription?.trim() || normalizedFood.description,
		sourceIdentifiers: food.sourceIdentifiers
			? { ...food.sourceIdentifiers }
			: undefined,
		nameProvenance: normalizedFood.nameProvenance,
		brandOwner: food.brandOwner,
		foodCategory: food.foodCategory,
		brandedFoodCategory: food.brandedFoodCategory,
		dataType: food.dataType,
		foodIdentityType: food.foodIdentityType,
		scientificName: food.scientificName,
		alternateDescription: food.alternateDescription,
		preparation: food.preparation,
		publishedDate: food.publishedDate,
		publicationDate: food.publicationDate,
		modifiedDate: food.modifiedDate,
		availableDate: food.availableDate,
		discontinuedDate: food.discontinuedDate,
		servingSize: food.servingSize,
		servingSizeUnit: food.servingSizeUnit,
		householdServingFullText: food.householdServingFullText,
		hasSourceServing: food.hasSourceServing,
		foodServings: food.foodServings?.map((serving) => ({ ...serving })),
		gtinUpc: food.gtinUpc,
		ingredients: food.ingredients,
		ingredientList: food.ingredientList ? [...food.ingredientList] : undefined,
		structuredIngredients: cloneStructuredIngredients(
			food.structuredIngredients,
		),
		ingredientAnalysis: food.ingredientAnalysis
			? {
					...food.ingredientAnalysis,
					ingredientTags: [...food.ingredientAnalysis.ingredientTags],
					analysisTags: [...food.ingredientAnalysis.analysisTags],
					derivedTraceTags: [...food.ingredientAnalysis.derivedTraceTags],
					allergenDeclarationAnalysis: food.ingredientAnalysis
						.allergenDeclarationAnalysis
						? {
								...food.ingredientAnalysis.allergenDeclarationAnalysis,
								contains: [
									...food.ingredientAnalysis.allergenDeclarationAnalysis
										.contains,
								],
								mayContain: [
									...food.ingredientAnalysis.allergenDeclarationAnalysis
										.mayContain,
								],
								statements:
									food.ingredientAnalysis.allergenDeclarationAnalysis.statements.map(
										(statement) => ({
											...statement,
											allergens: [...statement.allergens],
										}),
									),
							}
						: undefined,
				}
			: undefined,
		additives: food.additives ? [...food.additives] : undefined,
		allergens: food.allergens ? [...food.allergens] : undefined,
		traces: food.traces ? [...food.traces] : undefined,
		precautionaryStatements: food.precautionaryStatements?.map((statement) => ({
			...statement,
			allergens: [...statement.allergens],
		})),
		dietaryTags: food.dietaryTags ? [...food.dietaryTags] : undefined,
		labels: food.labels ? [...food.labels] : undefined,
		packageQuantity: food.packageQuantity
			? { ...food.packageQuantity }
			: undefined,
		alcoholByVolume: food.alcoholByVolume
			? { ...food.alcoholByVolume }
			: undefined,
		regulatoryDisclosure: food.regulatoryDisclosure
			? { ...food.regulatoryDisclosure }
			: undefined,
		sourceMetadata: food.sourceMetadata
			? {
					...food.sourceMetadata,
					languages: food.sourceMetadata.languages
						? [...food.sourceMetadata.languages]
						: undefined,
					marketCountries: food.sourceMetadata.marketCountries
						? [...food.sourceMetadata.marketCountries]
						: undefined,
					qualityTags: food.sourceMetadata.qualityTags
						? [...food.sourceMetadata.qualityTags]
						: undefined,
					qualityErrorTags: food.sourceMetadata.qualityErrorTags
						? [...food.sourceMetadata.qualityErrorTags]
						: undefined,
					qualityWarningTags: food.sourceMetadata.qualityWarningTags
						? [...food.sourceMetadata.qualityWarningTags]
						: undefined,
					tagSources: food.sourceMetadata.tagSources
						? Object.fromEntries(
								Object.entries(food.sourceMetadata.tagSources).map(
									([key, sources]) => [key, [...sources]],
								),
							)
						: undefined,
				}
			: undefined,
		categories: food.categories ? [...food.categories] : undefined,
		categoryOptionId: food.categoryOptionId,
		symbolKey: resolveFoodSymbolKey(normalizedFood),
		image: food.image,
		fieldProvenance: food.fieldProvenance
			? Object.fromEntries(
					Object.entries(food.fieldProvenance).map(([field, source]) => [
						field,
						{ ...source },
					]),
				)
			: undefined,
		sourceEnrichmentDecisions: food.sourceEnrichmentDecisions?.map(
			(decision) => ({
				...decision,
				selectedSource: { ...decision.selectedSource },
				previousSource: decision.previousSource
					? { ...decision.previousSource }
					: undefined,
			}),
		),
		customFood: food.customFood,
		barcode: food.barcode,
		barcodeSource: food.barcodeSource,
		barcodeProvenance: food.barcodeProvenance
			? { ...food.barcodeProvenance }
			: undefined,
		sourceKey: food.sourceKey,
		sourceLabel: food.sourceLabel,
		sourceDataType: food.sourceDataType,
		sourcePublishedDate: food.sourcePublishedDate,
		sourceModifiedDate: food.sourceModifiedDate,
		sourceAttribution: food.sourceAttribution
			? { ...food.sourceAttribution }
			: undefined,
		sourceAttributions: food.sourceAttributions?.map((attribution) => ({
			...attribution,
		})),
		sharedProductId: food.sharedProductId,
		sharedProductSubmissionId: food.sharedProductSubmissionId,
		sharedProductConfidence: food.sharedProductConfidence,
		trustStatus: food.trustStatus,
		listAddedAt: food.listAddedAt,
		customServingLabel: food.customServingLabel,
		customServingWeightGrams: food.customServingWeightGrams,
		customDensityGramsPerMilliliter: food.customDensityGramsPerMilliliter,
		customDensityLabel: food.customDensityLabel,
		customDensityVariancePercent: food.customDensityVariancePercent,
		customDensityConfidence: food.customDensityConfidence,
		compatibilitySummary: food.compatibilitySummary,
		compatibilityEvaluation: food.compatibilityEvaluation,
		allergenDisclosure: food.allergenDisclosure
			? {
					contains: [...food.allergenDisclosure.contains],
					mayContain: [...food.allergenDisclosure.mayContain],
				}
			: undefined,
		preferenceWarnings: food.preferenceWarnings?.map((warning) => ({
			...warning,
		})),
		safetyAlerts: food.safetyAlerts?.map((alert) => ({ ...alert })),
		reportedNutrientIds: [...new Set(reportedNutrientIds)].filter(
			(nutrientId) => acceptedNutrientIds.has(nutrientId),
		),
		foodNutrients: acceptedFoodNutrients.map((nutrient) => ({
			nutrientId: nutrient.nutrientId,
			nutrientName: nutrient.nutrientName,
			nutrientNumber: nutrient.nutrientNumber,
			unitName: nutrient.unitName,
			value: nutrient.value,
			measurementBasis: nutrient.measurementBasis
				? { ...nutrient.measurementBasis }
				: undefined,
			valueOrigin: nutrient.valueOrigin,
			source: nutrient.source,
			sourceReference: nutrient.sourceReference,
			confidence: nutrient.confidence,
			valueStatus: nutrient.valueStatus,
			valueQualifier: nutrient.valueQualifier,
			standardError: nutrient.standardError,
			sourceNutrientKey: nutrient.sourceNutrientKey,
			sourceNutrientCode: nutrient.sourceNutrientCode,
			mappingStatus: nutrient.mappingStatus,
			mappingMethod: nutrient.mappingMethod,
			mappingReviewReference: nutrient.mappingReviewReference,
			derivationMethod: nutrient.derivationMethod,
		})),
		nutrientQualitativeFacts: food.nutrientQualitativeFacts?.map((fact) => ({
			...fact,
			measurementBasis: { ...fact.measurementBasis },
		})),
		nutrientSourceReview: food.nutrientSourceReview?.map((entry) => ({
			...entry,
			measurementBasis: entry.measurementBasis
				? { ...entry.measurementBasis }
				: undefined,
		})),
	};
};

export const normalizeSourceManagedFoodForStorage = (
	food: FoodItem,
): FoodItem =>
	normalizeFoodForStorage({
		...food,
		description: formatSourceProductName(food.description),
		nameProvenance: food.nameProvenance === "barcode" ? "barcode" : "source",
	});

export const deduplicateFoodItemsByApplicationId = (foods: FoodItem[]) => {
	const seenApplicationFoodIds = new Set<number>();

	return foods.filter((food) => {
		if (seenApplicationFoodIds.has(food.fdcId)) return false;
		seenApplicationFoodIds.add(food.fdcId);
		return true;
	});
};
