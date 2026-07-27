import { tick } from "svelte";
import {
	getBarcodeInputValidationMessage,
	normalizeBarcode,
} from "$lib/utils/barcode/barcode";
import {
	getBarcodeProductSourceDisplayLabel,
	type BarcodeProductDraft,
} from "$lib/utils/barcode/productLookup";
import { barcodeDraftHasEntryChanges } from "$lib/utils/barcode/barcodeDraftComparison";
import type { BarcodeScanResult } from "$lib/utils/barcode/types";
import {
	getBarcodeDraftState,
	getBarcodeImportMessage,
	getBarcodeReferenceReviewFlags,
	getKeepManualBarcodeMessage,
	getManualBarcodeReferencePlan,
	lookupManualBarcodeReference,
} from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";
import { resolveManualEntryBarcodeScan } from "$lib/components/ingredients/manual-entry/utils/barcodeScanFlow";
import { pickFoodFullImageUrl } from "$lib/utils/food/images/foodImages";
import { validateBarcodeProductForSharing } from "$lib/utils/products/catalog";
import { getUserFacingErrorMessage } from "$lib/utils/errors/userFacingErrors";
import type { ManualEntryBarcodeShareMismatch } from "$lib/components/ingredients/manual-entry/formTypes";
import type { ManualEntryFormState } from "./manualEntryFormState.svelte";
import type { ManualEntryValidationController } from "./manualEntryValidationController.svelte";

type ManualEntryBarcodeControllerOptions = {
	form: ManualEntryFormState;
	validation: ManualEntryValidationController;
	onScannerOpen?: () => void;
	onScannerClose?: () => void;
	onLookupStateChange: (lookingUp: boolean) => void;
	onError: (message: string) => void;
};

type BarcodeScanCompletion = {
	focusTarget: "name" | "destination";
};

export const createManualEntryBarcodeController = ({
	form,
	validation,
	onScannerOpen,
	onScannerClose,
	onLookupStateChange,
	onError,
}: ManualEntryBarcodeControllerOptions) => {
	const state = $state({
		lookingUpBarcode: false,
		scannerOpen: false,
	});
	let barcodeLookupDebounce: ReturnType<typeof setTimeout> | null = null;
	let lookupGeneration = 0;
	let shareValidationGeneration = 0;

	const normalizedBarcode = $derived(normalizeBarcode(form.data.barcode));
	const barcodeValidationMessage = $derived(
		getBarcodeInputValidationMessage(form.data.barcode),
	);
	const currentReferenceEntry = $derived({
		name: validation.normalizedName,
		brandOwner: form.data.brandOwner,
		category: form.data.category,
		servingLabel: form.data.servingLabel,
		servingWeightGrams: form.data.servingWeightGrams,
		volumeEquivalent:
			form.data.useVolumeEquivalent && form.data.volumeQuantity
				? {
						quantity: form.data.volumeQuantity,
						unit: form.data.volumeUnit,
					}
				: null,
		nutrients: form.getSaveNutrients(validation.nutrientFields),
		ingredients: form.data.ingredients,
		ingredientList: form.data.ingredientList,
		allergens: form.data.allergens,
		traces: form.data.traces,
		dietaryTags: form.data.dietaryTags,
		labels: form.data.labels,
		categories: form.data.categories,
	});
	const hasSharedCatalogReference = $derived(
		form.data.barcodeReferenceSourceDraft?.source === "shared-catalog" &&
			normalizedBarcode === form.data.barcodeReferenceSourceDraft.barcode,
	);
	const referenceHasChanges = $derived(
		barcodeDraftHasEntryChanges(
			form.data.barcodeReferenceSourceDraft,
			currentReferenceEntry,
		),
	);
	const sharedCatalogMatchIsUnchanged = $derived(
		Boolean(hasSharedCatalogReference && !referenceHasChanges),
	);
	const canShareWithCatalog = $derived(
		Boolean(normalizedBarcode) && !sharedCatalogMatchIsUnchanged,
	);
	const requiresCatalogEvidence = $derived(
		form.data.shareWithCatalog &&
			(form.data.barcodeSource === "manual" ||
				Boolean(hasSharedCatalogReference && referenceHasChanges)),
	);
	const trustedProductImage = $derived(
		pickFoodFullImageUrl(form.data.image) ? form.data.image : undefined,
	);
	const hasTrustedProductImage = $derived(Boolean(trustedProductImage));
	const hasAcceptedSourceBarcode = $derived(
		Boolean(
			normalizedBarcode &&
				form.data.barcodeReferenceAcceptedBarcode === normalizedBarcode &&
				form.data.barcodeReferenceSourceDraft?.barcode === normalizedBarcode,
		),
	);
	const privateCustomFood = $derived(
		form.data.keptUnmatchedPrivate ||
			(!form.data.shareWithCatalog &&
				form.data.barcodeSource === "manual" &&
				!hasAcceptedSourceBarcode),
	);
	const showOptionalProductImageUpload = $derived(
		Boolean(
			normalizedBarcode &&
				hasAcceptedSourceBarcode &&
				!hasTrustedProductImage &&
				(form.data.barcodeSource === "open-food-facts" ||
					form.data.barcodeSource === "usda"),
		),
	);
	const shouldSubmitOptionalProductImageReview = $derived(
		showOptionalProductImageUpload && Boolean(form.data.frontPhoto),
	);
	const shareUnavailableMessage = $derived(
		sharedCatalogMatchIsUnchanged
			? "This barcode already exists in blendCalc with matching data, so it cannot be shared again. You can still save it to your own profile."
			: "",
	);
	const shareHelpMessage = $derived(
		hasSharedCatalogReference && referenceHasChanges
			? "Submit your edits for moderator review. Your private ingredient can still be saved now."
			: canShareWithCatalog
				? "Make this ingredient available to other users. All submissions are reviewed for accuracy."
				: "Add a valid UPC or barcode if you want to submit this ingredient for shared search.",
	);
	const barcodeShareMismatch = $derived<ManualEntryBarcodeShareMismatch>(
		form.data.barcodeShareValidation?.status === "name-mismatch"
			? {
					name: form.data.barcodeShareValidation.draft.name,
					brandOwner: form.data.barcodeShareValidation.draft.brandOwner,
					sourceLabel: getBarcodeProductSourceDisplayLabel(
						form.data.barcodeShareValidation.draft,
					),
					message:
						form.data.barcodeShareValidation.message ??
						"Use the verified information to share this product, or remove the barcode and save your current entry only to your account.",
				}
			: null,
	);
	const barcodeSuggestion = $derived(
		form.data.barcodeReferenceDraft
			? {
					name: form.data.barcodeReferenceDraft.name,
					brandOwner: form.data.barcodeReferenceDraft.brandOwner,
					sourceLabel: getBarcodeProductSourceDisplayLabel(
						form.data.barcodeReferenceDraft,
					),
				}
			: null,
	);

	const clearBarcodeLookupDebounce = () => {
		if (!barcodeLookupDebounce) return;
		clearTimeout(barcodeLookupDebounce);
		barcodeLookupDebounce = null;
	};

	const invalidateBarcodeLookup = () => {
		lookupGeneration += 1;
		clearBarcodeLookupDebounce();
		form.data.checkingBarcodeReference = false;
	};

	const clearBarcodeShareValidation = () => {
		shareValidationGeneration += 1;
		form.data.barcodeShareValidation = null;
		form.data.validatingBarcodeShare = false;
		form.data.shareWithCatalog = false;
	};

	const checkManualBarcodeReference = async () => {
		clearBarcodeLookupDebounce();
		const lookupPlan = getManualBarcodeReferencePlan({
			barcode: form.data.barcode,
			normalizedName: validation.normalizedName,
			checkedBarcodeReferenceKey: form.data.checkedBarcodeReferenceKey,
			checkingBarcodeReference: form.data.checkingBarcodeReference,
		});

		if (lookupPlan.action === "clear") {
			invalidateBarcodeLookup();
			form.data.checkedBarcodeReferenceKey = "";
			form.data.barcodeReferenceDraft = null;
			form.data.barcodeReferenceSourceDraft = null;
			form.data.barcodeReferenceAcceptedBarcode = "";
			if (!state.lookingUpBarcode) form.data.barcodeMessage = "";
			return;
		}

		if (lookupPlan.action === "invalid") {
			invalidateBarcodeLookup();
			form.data.barcodeReferenceDraft = null;
			form.data.barcodeReferenceSourceDraft = null;
			form.data.barcodeReferenceAcceptedBarcode = "";
			return;
		}

		if (lookupPlan.action === "skip") return;

		const generation = ++lookupGeneration;
		form.data.checkingBarcodeReference = true;
		form.data.barcodeMessage =
			"Checking barcode against available product sources…";
		try {
			const lookup = await lookupManualBarcodeReference({
				normalizedBarcode: lookupPlan.normalizedBarcode,
				referenceKey: lookupPlan.referenceKey,
				normalizedName: validation.normalizedName,
			});
			if (generation !== lookupGeneration) return;

			form.data.checkedBarcodeReferenceKey = lookup.referenceKey;
			form.data.barcodeSource = "manual";
			if (lookup.status === "found") {
				form.data.barcodeReferenceDraft = lookup.draft;
				form.data.barcodeReferenceSourceDraft = lookup.draft;
				form.data.barcodeMessage = lookup.message;
				return;
			}

			form.data.barcodeReferenceDraft = null;
			form.data.barcodeReferenceSourceDraft = null;
			form.data.barcodeReferenceAcceptedBarcode = "";
			form.data.barcodeMessage = lookup.message;
		} finally {
			if (generation === lookupGeneration) {
				form.data.checkingBarcodeReference = false;
			}
		}
	};

	const scheduleManualBarcodeReferenceCheck = () => {
		clearBarcodeLookupDebounce();
		if (!normalizeBarcode(form.data.barcode.trim())) return;
		barcodeLookupDebounce = setTimeout(() => {
			void checkManualBarcodeReference();
		}, 650);
	};

	const setManualName = (value: string) => {
		form.data.name = value;
		form.data.nameProvenance = normalizeBarcode(form.data.barcode)
			? "barcode"
			: "user";
		clearBarcodeShareValidation();
	};

	const setManualBarcode = (value: string) => {
		invalidateBarcodeLookup();
		form.data.keptUnmatchedPrivate = false;
		form.data.barcode = value;
		form.data.barcodeProvenance = value.trim()
			? { captureMethod: "manual-entry" }
			: undefined;
		form.data.nameProvenance = normalizeBarcode(value) ? "barcode" : "user";
		clearBarcodeShareValidation();
		form.data.barcodeSource = "manual";
		form.data.checkedBarcodeReferenceKey = "";
		form.data.barcodeReferenceDraft = null;
		form.data.barcodeReferenceSourceDraft = null;
		form.data.barcodeReferenceAcceptedBarcode = "";
		if (!state.lookingUpBarcode) form.data.barcodeMessage = "";
		scheduleManualBarcodeReferenceCheck();
	};

	const openBarcodeScanner = () => {
		state.scannerOpen = true;
		onScannerOpen?.();
	};

	const closeBarcodeScanner = () => {
		state.scannerOpen = false;
		onScannerClose?.();
	};

	const applyBarcodeProductDraft = (draft: BarcodeProductDraft) => {
		form.data.keptUnmatchedPrivate = false;
		clearBarcodeShareValidation();
		Object.assign(form.data, getBarcodeDraftState(draft));
		form.data.manualTouchedNutrientIds = {};
		form.data.barcodeReferenceSourceDraft = draft;
		form.data.barcodeReferenceAcceptedBarcode = form.data.barcode;
	};

	const applyBarcodeReferenceSuggestion = async () => {
		const draft = form.data.barcodeReferenceDraft;
		if (!draft) return;

		applyBarcodeProductDraft(draft);
		form.data.barcodeReferenceDraft = null;
		form.data.barcodeMessage = getBarcodeImportMessage(
			draft,
			form.getOptionalNutrientTotal(
				validation.nutrientFields,
				validation.requiredNutrientFields,
			),
			"autofill",
		);
		await tick();
		await validation.goToStep("share");
	};

	const keepManualBarcodeEntry = () => {
		if (!form.data.barcodeReferenceDraft) return;
		form.data.keptUnmatchedPrivate = true;
		clearBarcodeShareValidation();
		form.data.barcodeReferenceAcceptedBarcode = "";
		form.data.barcodeSource = "manual";
		form.data.barcodeMessage = getKeepManualBarcodeMessage(
			form.data.barcodeReferenceDraft,
		);
	};

	const handleShareChange = async (checked: boolean) => {
		if (!checked) {
			clearBarcodeShareValidation();
			return;
		}
		if (!normalizedBarcode || !canShareWithCatalog) {
			form.data.shareWithCatalog = false;
			return;
		}

		const generation = ++shareValidationGeneration;
		form.data.shareWithCatalog = false;
		form.data.barcodeShareValidation = null;
		form.data.validatingBarcodeShare = true;
		onError("");
		try {
			const result = await validateBarcodeProductForSharing(
				normalizedBarcode,
				validation.normalizedName,
			);
			if (generation !== shareValidationGeneration) return;

			form.data.barcodeShareValidation = result;
			if (result.status === "name-mismatch") {
				form.data.barcodeReferenceDraft = result.draft;
				form.data.barcodeReferenceSourceDraft = result.draft;
				return;
			}
			if (result.status === "matched") {
				form.data.barcodeReferenceSourceDraft = result.draft;
			}
			form.data.shareWithCatalog = true;
		} catch (error) {
			if (generation !== shareValidationGeneration) return;
			console.error("[manual entry] Barcode sharing check failed", error);
			onError(getUserFacingErrorMessage(error, {
				fallback:
					"We couldn't confirm this barcode for community sharing. Try again, or turn off sharing to save it to your account.",
				network:
					"We couldn't connect to check this barcode. Try again, or turn off sharing to save it to your account.",
				timeout:
					"The barcode check took too long. Try again, or turn off sharing to save it to your account.",
			}));
		} finally {
			if (generation === shareValidationGeneration) {
				form.data.validatingBarcodeShare = false;
			}
		}
	};

	const applyVerifiedBarcodeForSharing = async () => {
		if (form.data.barcodeShareValidation?.status !== "name-mismatch") return;
		const draft = form.data.barcodeShareValidation.draft;
		form.data.barcodeReferenceDraft = draft;
		await applyBarcodeReferenceSuggestion();
		form.data.barcodeShareValidation = null;
		form.data.shareWithCatalog =
			draft.source !== "shared-catalog" && form.data.activeStep === "share";
	};

	const detachMismatchedBarcodeForPrivateSave = () => {
		if (form.data.barcodeShareValidation?.status !== "name-mismatch") return;
		const verifiedName = form.data.barcodeShareValidation.draft.name;
		setManualBarcode("");
		form.data.keptUnmatchedPrivate = true;
		form.data.frontPhoto = null;
		form.data.nutritionPhoto = null;
		form.data.barcodePhoto = null;
		form.data.image = undefined;
		form.data.barcodeMessage = `Barcode removed. “${verifiedName}” remains the verified product, while your current entry can be saved privately to your account.`;
	};

	const handleBarcodeDetected = async (
		result: BarcodeScanResult,
	): Promise<BarcodeScanCompletion> => {
		closeBarcodeScanner();
		const generation = ++lookupGeneration;
		state.lookingUpBarcode = true;
		form.data.barcodeMessage = "Looking up this product…";
		form.data.barcode = result.canonicalValue;
		form.data.barcodeProvenance = {
			captureMethod: result.captureMethod,
			sourceReference: result.sourceReference,
			format: result.format,
		};
		form.data.barcodeReferenceDraft = null;
		form.data.barcodeReferenceAcceptedBarcode = "";
		form.data.activeStep = "share";

		let focusTarget: BarcodeScanCompletion["focusTarget"] = "name";
		try {
			const outcome = await resolveManualEntryBarcodeScan({
				result,
				getOptionalNutrientCount: () =>
					form.getOptionalNutrientTotal(
						validation.nutrientFields,
						validation.requiredNutrientFields,
					),
			});
			if (generation !== lookupGeneration) return { focusTarget };

			focusTarget = outcome.focusTarget;
			form.data.barcodeMessage = outcome.message;
			if (outcome.status === "found") {
				form.data.barcodeReferenceDraft = outcome.draft;
				applyBarcodeProductDraft(outcome.draft);
				return { focusTarget };
			}

			form.data.activeStep = "identity";
			form.data.barcodeSource = "manual";
			form.data.barcodeReferenceDraft = null;
			form.data.barcodeReferenceAcceptedBarcode = "";
			form.data.reportedNutrientIds = [];
			form.data.ingredients = "";
			form.data.ingredientList = [];
			form.data.allergens = [];
			form.data.traces = [];
			form.data.dietaryTags = [];
			form.data.labels = [];
			form.data.categories = [];
			return { focusTarget };
		} finally {
			if (generation === lookupGeneration) {
				state.lookingUpBarcode = false;
			}
		}
	};

	const getReferenceReviewFlags = () => [
		...getBarcodeReferenceReviewFlags({
			shareWithCatalog: form.data.shareWithCatalog,
			barcode: form.data.barcode,
			sourceDraft: form.data.barcodeReferenceSourceDraft,
			currentEntry: currentReferenceEntry,
			barcodeSource: form.data.barcodeSource,
			barcodeReferenceAcceptedBarcode:
				form.data.barcodeReferenceAcceptedBarcode,
		}),
		...(shouldSubmitOptionalProductImageReview
			? [
					"User provided an optional product image because no trusted DB/API image exists for this barcode. Review the package image and crop before publishing it.",
				]
			: []),
	];

	const reset = () => {
		invalidateBarcodeLookup();
		clearBarcodeShareValidation();
		state.lookingUpBarcode = false;
		state.scannerOpen = false;
	};

	const destroy = () => {
		invalidateBarcodeLookup();
		shareValidationGeneration += 1;
	};

	$effect(() => {
		onLookupStateChange(
			state.lookingUpBarcode ||
				form.data.checkingBarcodeReference ||
				form.data.validatingBarcodeShare,
		);
	});

	$effect(() => {
		if (!canShareWithCatalog) form.data.shareWithCatalog = false;
	});

	return {
		state,
		get barcodeValidationMessage() {
			return barcodeValidationMessage;
		},
		get hasValidBarcode() {
			return Boolean(normalizedBarcode);
		},
		get canShareWithCatalog() {
			return canShareWithCatalog;
		},
		get requiresCatalogEvidence() {
			return requiresCatalogEvidence;
		},
		get trustedProductImage() {
			return trustedProductImage;
		},
		get hasTrustedProductImage() {
			return hasTrustedProductImage;
		},
		get privateCustomFood() {
			return privateCustomFood;
		},
		get showOptionalProductImageUpload() {
			return showOptionalProductImageUpload;
		},
		get shouldSubmitOptionalProductImageReview() {
			return shouldSubmitOptionalProductImageReview;
		},
		get shareUnavailableMessage() {
			return shareUnavailableMessage;
		},
		get shareHelpMessage() {
			return shareHelpMessage;
		},
		get barcodeShareMismatch() {
			return barcodeShareMismatch;
		},
		get barcodeSuggestion() {
			return barcodeSuggestion;
		},
		checkManualBarcodeReference,
		setManualName,
		setManualBarcode,
		openBarcodeScanner,
		closeBarcodeScanner,
		applyBarcodeReferenceSuggestion,
		keepManualBarcodeEntry,
		handleShareChange,
		applyVerifiedBarcodeForSharing,
		detachMismatchedBarcodeForPrivateSave,
		handleBarcodeDetected,
		getReferenceReviewFlags,
		reset,
		destroy,
	};
};

export type ManualEntryBarcodeController = ReturnType<
	typeof createManualEntryBarcodeController
>;
