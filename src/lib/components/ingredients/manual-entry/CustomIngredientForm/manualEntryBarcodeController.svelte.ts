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
	let manualBarcodeLookupQueued = $state(false);
	let lookupGeneration = 0;
	let shareValidationGeneration = 0;
	let defaultShareAttemptKey = "";

	const normalizedBarcode = $derived(normalizeBarcode(form.data.barcode));
	const barcodeReferenceLookupPending = $derived(
		manualBarcodeLookupQueued || form.data.checkingBarcodeReference,
	);
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
			form.data.useServingMeasure &&
			form.data.servingMeasureQuantity &&
			form.data.servingMeasureUnit
				? {
						quantity: form.data.servingMeasureQuantity,
						unit: form.data.servingMeasureUnit,
					}
				: null,
		nutrients: form.getSaveNutrients(validation.nutrientFields),
		nutrientQualitativeFacts: form.data.nutrientQualitativeFacts,
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
			(form.data.submissionIntent === "catalog_correction" ||
				form.data.barcodeSource === "manual" ||
				form.data.barcodeShareValidation?.requiresCatalogEvidence === true ||
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
	const hasUserAuthoredCatalogValues = $derived(
		Object.keys(form.data.manualTouchedNutrientIds).length > 0 ||
			Object.values(form.data.fieldProvenance ?? {}).some(
				(provenance) => provenance?.source === "user-label",
			) ||
			form.data.nutrientQualitativeFacts.some(
				(fact) => fact.source === "user-label",
			) ||
			form.data.serving?.source === "user-label",
	);
	const automaticSharingCandidateKey = $derived(
		form.data.activeStep === "share" &&
			form.data.submissionIntent === "catalog_share" &&
			canShareWithCatalog &&
			hasAcceptedSourceBarcode &&
			form.data.barcodeReferenceSourceDraft?.source !== "shared-catalog" &&
			!referenceHasChanges &&
			!hasUserAuthoredCatalogValues &&
			!validation.blockingValidation &&
			!form.data.frontPhoto &&
			!form.data.nutritionPhoto &&
			!form.data.barcodePhoto
			? [
					normalizedBarcode,
					form.data.barcodeReferenceSourceDraft?.source ?? "",
					form.data.barcodeReferenceSourceDraft?.sourceReference ?? "",
				].join(":")
			: "",
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
				form.data.barcodeSource === "cola-cloud" ||
				form.data.barcodeSource === "usda"),
		),
	);
	const shareUnavailableMessage = $derived(
		sharedCatalogMatchIsUnchanged
			? "This barcode already exists in blendCalc with matching data, so it cannot be shared again. You can still save it to your own profile."
			: "",
	);
	const shareHelpMessage = $derived(
		form.data.shareSelectionSource === "automatic"
			? "This complete product matches reusable source data, so sharing is on by default. Turn it off to keep this save private."
			: form.data.submissionIntent === "catalog_correction"
				? "Show us what changed and add clear package photos. Your correction will be reviewed before the shared product changes."
				: hasSharedCatalogReference && referenceHasChanges
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
		if (barcodeLookupDebounce) {
			clearTimeout(barcodeLookupDebounce);
			barcodeLookupDebounce = null;
		}
		manualBarcodeLookupQueued = false;
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
		if (form.data.submissionIntent !== "catalog_correction") {
			form.data.shareWithCatalog = false;
			form.data.shareSelectionSource = "none";
		}
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
			form.data.barcodeSafetyAlerts = [];
			if (!state.lookingUpBarcode) form.data.barcodeMessage = "";
			return;
		}

		if (lookupPlan.action === "invalid") {
			invalidateBarcodeLookup();
			form.data.barcodeReferenceDraft = null;
			form.data.barcodeReferenceSourceDraft = null;
			form.data.barcodeReferenceAcceptedBarcode = "";
			form.data.barcodeSafetyAlerts = [];
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
			form.data.barcodeSafetyAlerts = lookup.safetyAlerts;
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
		manualBarcodeLookupQueued = true;
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

	const detachAcceptedSourceState = () => {
		form.data.nameProvenance = "user";
		form.data.foodIdentityType = "private-custom";
		form.data.barcodeProvenance = undefined;
		form.data.importedNutrients = form.data.importedNutrients.map(
			(nutrient) => ({
				...nutrient,
				source: "user-label",
				sourceReference: undefined,
				confidence: "user-reported",
				sourceNutrientKey: undefined,
				sourceNutrientCode: undefined,
				mappingReviewReference: undefined,
				derivationMethod: undefined,
			}),
		);
		form.data.manualTouchedNutrientIds = Object.fromEntries(
			form.data.importedNutrients.map((nutrient) => [
				nutrient.nutrientId,
				true,
			]),
		);
		form.data.reportedNutrientIds = [];
		form.data.serving = form.data.serving
			? {
					...form.data.serving,
					origin: "user-entered",
					gramWeightMethod: "user-reported",
					source: "user-label",
					sourceReference: undefined,
					sourceMeasureKey: undefined,
					calculationBasis: undefined,
					confidence: "user-reported",
				}
			: undefined;
		form.data.sourceMetadata = undefined;
		form.data.regulatoryDisclosure = form.data.regulatoryDisclosure
			? {
					...form.data.regulatoryDisclosure,
					evidenceStatus: "user-reported",
				}
			: undefined;
		form.data.fieldProvenance = undefined;
		form.data.image = undefined;
	};

	const setManualBarcode = (value: string) => {
		const acceptedBarcode = form.data.barcodeReferenceAcceptedBarcode;
		const nextBarcode = normalizeBarcode(value);
		const detachedAcceptedSource = Boolean(
			acceptedBarcode && acceptedBarcode !== nextBarcode,
		);
		if (detachedAcceptedSource) detachAcceptedSourceState();

		invalidateBarcodeLookup();
		form.data.keptUnmatchedPrivate = detachedAcceptedSource && !nextBarcode;
		form.data.submissionIntent = "catalog_share";
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
		form.data.barcodeSafetyAlerts = [];
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
		form.data.submissionIntent = "catalog_share";
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
			validation.nutrientFields,
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

	const beginBarcodeCorrection = () => {
		const draft = form.data.barcodeReferenceDraft;
		if (!draft) return;
		clearBarcodeShareValidation();
		form.data.keptUnmatchedPrivate = false;
		form.data.submissionIntent = "catalog_correction";
		form.data.shareWithCatalog = true;
		form.data.shareSelectionSource = "user";
		form.data.barcodeReferenceSourceDraft = draft;
		form.data.barcodeReferenceAcceptedBarcode = draft.barcode;
		form.data.barcodeReferenceDraft = null;
		form.data.barcodeSource =
			draft.source === "shared-catalog" ? "community" : draft.source;
		form.data.barcodeMessage =
			"Enter what the current package shows. Clear package, nutrition, and barcode photos will be required before this correction can be reviewed.";
	};

	const beginBarcodeCorrectionForSharing = () => {
		if (form.data.barcodeShareValidation?.status !== "name-mismatch") return;
		const draft = form.data.barcodeShareValidation.draft;
		form.data.barcodeReferenceSourceDraft = draft;
		form.data.barcodeReferenceAcceptedBarcode = draft.barcode;
		form.data.barcodeShareValidation = null;
		form.data.keptUnmatchedPrivate = false;
		form.data.submissionIntent = "catalog_correction";
		form.data.shareWithCatalog = true;
		form.data.shareSelectionSource = "user";
		form.data.barcodeMessage =
			"Your version will be reviewed as a correction. Add clear package, nutrition, and barcode photos before submitting.";
	};

	const validateCatalogSharing = async (
		selectionSource: "automatic" | "user",
	) => {
		const automatic = selectionSource === "automatic";
		if (
			!normalizedBarcode ||
			!canShareWithCatalog ||
			(automatic && !automaticSharingCandidateKey)
		) {
			form.data.shareWithCatalog = false;
			form.data.shareSelectionSource = "none";
			return;
		}

		const candidateKey = automaticSharingCandidateKey;
		const generation = ++shareValidationGeneration;
		form.data.shareWithCatalog = false;
		form.data.shareSelectionSource = "none";
		form.data.barcodeShareValidation = null;
		form.data.validatingBarcodeShare = true;
		onError("");
		try {
			const result = await validateBarcodeProductForSharing(
				normalizedBarcode,
				validation.normalizedName,
			);
			if (generation !== shareValidationGeneration) return;

			if (result.status === "name-mismatch") {
				if (automatic) return;
				form.data.barcodeShareValidation = result;
				form.data.barcodeReferenceDraft = result.draft;
				form.data.barcodeReferenceSourceDraft = result.draft;
				return;
			}
			if (result.status === "matched") {
				form.data.barcodeReferenceSourceDraft = result.draft;
			}
			if (
				automatic &&
				(result.status !== "matched" ||
					!result.defaultSharingAllowed ||
					candidateKey !== automaticSharingCandidateKey)
			) {
				return;
			}
			form.data.barcodeShareValidation = result;
			form.data.shareWithCatalog = true;
			form.data.shareSelectionSource = selectionSource;
		} catch (error) {
			if (generation !== shareValidationGeneration) return;
			if (automatic) return;
			console.error("[manual entry] Barcode sharing check failed", error);
			onError(
				getUserFacingErrorMessage(error, {
					fallback:
						"We couldn't confirm this barcode for community sharing. Try again, or turn off sharing to save it to your account.",
					network:
						"We couldn't connect to check this barcode. Try again, or turn off sharing to save it to your account.",
					timeout:
						"The barcode check took too long. Try again, or turn off sharing to save it to your account.",
				}),
			);
		} finally {
			if (generation === shareValidationGeneration) {
				form.data.validatingBarcodeShare = false;
			}
		}
	};

	const handleShareChange = async (checked: boolean) => {
		if (!checked) {
			clearBarcodeShareValidation();
			form.data.shareSelectionSource = "declined";
			return;
		}
		await validateCatalogSharing("user");
	};

	const applyVerifiedBarcodeForSharing = async () => {
		if (form.data.barcodeShareValidation?.status !== "name-mismatch") return;
		const validationResult = form.data.barcodeShareValidation;
		const draft = validationResult.draft;
		form.data.barcodeReferenceDraft = draft;
		await applyBarcodeReferenceSuggestion();
		form.data.barcodeShareValidation = {
			status: "matched",
			barcode: validationResult.barcode,
			draft,
			defaultSharingAllowed: false,
			requiresCatalogEvidence: validationResult.requiresCatalogEvidence,
		};
		form.data.shareWithCatalog =
			draft.source !== "shared-catalog" && form.data.activeStep === "share";
		form.data.shareSelectionSource = form.data.shareWithCatalog
			? "user"
			: "none";
	};

	const detachMismatchedBarcodeForPrivateSave = () => {
		if (form.data.barcodeShareValidation?.status !== "name-mismatch") return;
		const verifiedName = form.data.barcodeShareValidation.draft.name;
		setManualBarcode("");
		form.data.submissionIntent = "catalog_share";
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
		form.data.barcodeSafetyAlerts = [];
		form.data.activeStep = "share";

		let focusTarget: BarcodeScanCompletion["focusTarget"] = "name";
		try {
			const outcome = await resolveManualEntryBarcodeScan({
				result,
				manualEntryNutrientFields: validation.nutrientFields,
			});
			if (generation !== lookupGeneration) return { focusTarget };

			focusTarget = outcome.focusTarget;
			form.data.barcodeMessage = outcome.message;
			form.data.barcodeSafetyAlerts = outcome.safetyAlerts;
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
			form.data.foodIdentityType = "private-custom";
			form.data.ingredients = "";
			form.data.ingredientList = [];
			form.data.structuredIngredients = [];
			form.data.ingredientAnalysis = undefined;
			form.data.additives = [];
			form.data.allergens = [];
			form.data.traces = [];
			form.data.dietaryTags = [];
			form.data.labels = [];
			form.data.packageQuantity = undefined;
			form.data.alcoholByVolume = undefined;
			form.data.regulatoryDisclosure = undefined;
			form.data.sourceMetadata = undefined;
			form.data.categories = [];
			return { focusTarget };
		} finally {
			if (generation === lookupGeneration) {
				state.lookingUpBarcode = false;
			}
		}
	};

	const getReferenceReviewFlags = () => [
		...(form.data.submissionIntent === "catalog_correction"
			? [
					"The user reports that the current shared or source product information is incorrect, outdated, or incomplete. Compare only the submitted changes against the current revision and package evidence.",
				]
			: []),
		...getBarcodeReferenceReviewFlags({
			shareWithCatalog: form.data.shareWithCatalog,
			barcode: form.data.barcode,
			sourceDraft: form.data.barcodeReferenceSourceDraft,
			currentEntry: currentReferenceEntry,
			barcodeSource: form.data.barcodeSource,
			barcodeReferenceAcceptedBarcode:
				form.data.barcodeReferenceAcceptedBarcode,
		}),
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
				barcodeReferenceLookupPending ||
				form.data.validatingBarcodeShare,
		);
	});

	$effect(() => {
		if (!canShareWithCatalog) {
			form.data.shareWithCatalog = false;
			form.data.shareSelectionSource = "none";
		}
	});

	$effect(() => {
		const candidateKey = automaticSharingCandidateKey;
		if (
			!candidateKey ||
			candidateKey === defaultShareAttemptKey ||
			form.data.shareSelectionSource !== "none"
		) {
			return;
		}
		defaultShareAttemptKey = candidateKey;
		void validateCatalogSharing("automatic");
	});

	return {
		state,
		get barcodeValidationMessage() {
			return barcodeValidationMessage;
		},
		get barcodeReferenceLookupPending() {
			return barcodeReferenceLookupPending;
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
		beginBarcodeCorrection,
		beginBarcodeCorrectionForSharing,
		reset,
		destroy,
	};
};

export type ManualEntryBarcodeController = ReturnType<
	typeof createManualEntryBarcodeController
>;
