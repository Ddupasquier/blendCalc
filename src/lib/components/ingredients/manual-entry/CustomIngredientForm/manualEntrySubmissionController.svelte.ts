import { createManualEntryCustomFood } from "$lib/components/ingredients/manual-entry/utils/customFoodPayload";
import {
	saveManualEntryCustomFood,
	type ManualEntryCatalogMessageTone,
} from "$lib/components/ingredients/manual-entry/utils/submitFlow";
import { getManualEntrySubmitState } from "$lib/components/ingredients/manual-entry/utils/submitValidation";
import { servingMeasureAmountRequiredMessage } from "$lib/components/ingredients/manual-entry/formTypes";
import type { ManualEntryFormState } from "./manualEntryFormState.svelte";
import type { ManualEntryReferenceDataController } from "./manualEntryReferenceDataController.svelte";
import type { ManualEntryValidationController } from "./manualEntryValidationController.svelte";
import type { ManualEntryBarcodeController } from "./manualEntryBarcodeController.svelte";
import type { ManualEntryOutcomeController } from "./manualEntryOutcomeController.svelte";
import { applyCardImagePlacementToFoodImage } from "$lib/utils/food/images/foodImages";
import type { ManualEntryDestinationAction } from "$lib/components/ingredients/manual-entry/utils/listMembership";

type ManualEntrySubmissionControllerOptions = {
	form: ManualEntryFormState;
	referenceData: ManualEntryReferenceDataController;
	validation: ManualEntryValidationController;
	barcode: ManualEntryBarcodeController;
	outcome: ManualEntryOutcomeController;
	onReset: () => void;
	getCatalogSubmissionOnly?: () => boolean;
	getDestinationAction?: () => ManualEntryDestinationAction;
};

export const createManualEntrySubmissionController = ({
	form,
	referenceData,
	validation,
	barcode,
	outcome,
	onReset,
	getCatalogSubmissionOnly = () => false,
	getDestinationAction = () => ({
		kind: "add",
		label: "Add Ingredient",
		disabled: false,
		message: "",
		messageTone: "info",
	}),
}: ManualEntrySubmissionControllerOptions) => {
	const state = $state<{
		error: string;
		catalogMessage: string;
		catalogMessageTone: ManualEntryCatalogMessageTone;
		saving: boolean;
	}>({
		error: "",
		catalogMessage: "",
		catalogMessageTone: "success",
		saving: false,
	});

	const setError = (message: string) => {
		state.error = message;
	};

	const handleSubmit = async () => {
		if (state.saving) return;
		state.error = "";
		state.catalogMessage = "";
		state.catalogMessageTone = "success";
		outcome.resetBeforeSubmit();
		const catalogSubmissionOnly = getCatalogSubmissionOnly();
		const destinationAction = catalogSubmissionOnly
			? null
			: getDestinationAction();
		if (
			destinationAction?.kind === "checking" ||
			destinationAction?.kind === "duplicate"
		) {
			return;
		}

		const submitState = getManualEntrySubmitState({
			loadingNutrientRelationshipRules:
				referenceData.state.loadingNutrientRelationshipRules,
			blockingValidation: validation.blockingValidation,
			useServingMeasure: form.data.useServingMeasure,
			servingMeasureQuantity: form.data.servingMeasureQuantity,
			servingMeasureAmountRequiredMessage,
			barcode: form.data.barcode,
			requiresCatalogEvidence: barcode.requiresCatalogEvidence,
			requiresFreshFrontPhoto:
				form.data.submissionIntent === "catalog_correction",
			hasTrustedProductImage: barcode.hasTrustedProductImage,
			frontPhoto: form.data.frontPhoto,
			nutritionPhoto: form.data.nutritionPhoto,
			barcodePhoto: form.data.barcodePhoto,
		});
		if (submitState.block) {
			validation.markValidationAttempted(submitState.block.step);
			state.error = submitState.block.message;
			form.data.activeStep = submitState.block.step;
			validation.showNavigationStepWarning(
				submitState.block.message,
				submitState.block.step,
			);
			return;
		}

		const { normalizedBarcode } = submitState;
		state.saving = true;
		try {
			if (normalizedBarcode) {
				await barcode.checkManualBarcodeReference();
			}

			const food = createManualEntryCustomFood({
				name: form.data.name,
				nameProvenance: form.data.nameProvenance,
				brandOwner: form.data.brandOwner,
				servingLabel: form.getResolvedServingLabel(),
				servingWeightGrams: form.data.servingWeightGrams,
				serving: form.data.serving,
				useServingMeasure: form.data.useServingMeasure,
				servingMeasureQuantity: form.data.servingMeasureQuantity,
				servingMeasureUnit: form.data.servingMeasureUnit,
				barcode: normalizedBarcode,
				barcodeSource: form.data.barcodeSource,
				barcodeProvenance: form.data.barcodeProvenance,
				sourceKey:
					form.data.barcodeSource !== "manual"
						? form.data.barcodeReferenceSourceDraft?.sourceKey
						: undefined,
				sourceLabel:
					form.data.barcodeSource !== "manual"
						? form.data.barcodeReferenceSourceDraft?.sourceLabel
						: undefined,
				sourceDataType:
					form.data.barcodeSource !== "manual"
						? form.data.barcodeReferenceSourceDraft?.sourceDataType
						: undefined,
				sourcePublishedDate:
					form.data.barcodeSource !== "manual"
						? form.data.barcodeReferenceSourceDraft?.sourcePublishedDate
						: undefined,
				sourceModifiedDate:
					form.data.barcodeSource !== "manual"
						? form.data.barcodeReferenceSourceDraft?.sourceModifiedDate
						: undefined,
				foodIdentityType: form.data.foodIdentityType,
				ingredients: form.data.ingredients,
				ingredientList: form.data.ingredientList,
				structuredIngredients: form.data.structuredIngredients,
				ingredientAnalysis: form.data.ingredientAnalysis,
				additives: form.data.additives,
				allergens: form.data.allergens,
				traces: form.data.traces,
				dietaryTags: form.data.dietaryTags,
				labels: form.data.labels,
				packageQuantity: form.data.packageQuantity,
				alcoholByVolume: form.data.alcoholByVolume,
				regulatoryDisclosure: form.data.regulatoryDisclosure,
				sourceMetadata: form.data.sourceMetadata,
				activeCategory: form.data.category,
				categoryOptionId: form.data.categoryOptionId,
				categorySymbolKey: form.data.categorySymbolKey,
				categories: form.data.categories,
				image: form.data.image
					? applyCardImagePlacementToFoodImage(
							form.data.image,
							form.data.imagePlacement,
						)
					: undefined,
				fieldProvenance: form.data.fieldProvenance,
				reportedNutrientIds: form.data.reportedNutrientIds,
				nutrientQualitativeFacts: form.data.nutrientQualitativeFacts,
				nutrientSourceReview: form.data.nutrientSourceReview,
				hasSourceServing: form.data.usesInternal100GramBasis
					? false
					: form.data.barcodeSource === "manual"
						? form.data.useServingMeasure ||
							(Number.isFinite(form.data.servingWeightGrams) &&
								Number(form.data.servingWeightGrams) > 0)
						: form.data.barcodeReferenceSourceDraft?.hasSourceServing,
				importedNutrients: form.data.importedNutrients,
				manualEntryNutrientFields: validation.nutrientFields,
				manualNutrientValues: form.data.manualNutrientValues,
				manualTouchedNutrientIds: form.data.manualTouchedNutrientIds,
				customFood: barcode.privateCustomFood,
			});

			const result = await saveManualEntryCustomFood({
				food,
				name: form.data.name,
				normalizedBarcode,
				shareWithCatalog: form.data.shareWithCatalog,
				photos: {
					frontPhoto: form.data.frontPhoto,
					frontImageCrop: form.data.frontPhoto
						? form.data.imagePlacement
						: null,
					nutritionPhoto: form.data.nutritionPhoto,
					barcodePhoto: form.data.barcodePhoto,
				},
				reviewFlags: barcode.getReferenceReviewFlags(),
				useIngredient: outcome.useIngredient,
				submissionIntent: form.data.submissionIntent,
				catalogSubmissionOnly,
			});

			if (result.status === "error") {
				state.error = result.error;
				return;
			}
			if (result.status === "cancelled") return;

			state.catalogMessage = result.catalogMessage;
			state.catalogMessageTone = result.catalogMessageTone;
			if (catalogSubmissionOnly) return;
			if (result.resetForm) onReset();
		} catch {
			state.error =
				"We couldn’t save this ingredient. Check your connection and try again.";
		} finally {
			state.saving = false;
		}
	};

	return {
		state,
		setError,
		handleSubmit,
	};
};

export type ManualEntrySubmissionController = ReturnType<
	typeof createManualEntrySubmissionController
>;
