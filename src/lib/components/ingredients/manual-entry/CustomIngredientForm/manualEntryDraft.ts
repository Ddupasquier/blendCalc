import { browser } from "$app/environment";
import { manualEntrySteps } from "$lib/components/ingredients/manual-entry/formTypes";
import type { ManualEntryFormResetState } from "$lib/components/ingredients/manual-entry/utils/formState";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { getScopedStorageKey } from "$lib/utils/storage/client/storageScope";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import type { ManualEntryDraft, ManualEntryDraftData } from "./types";

const MANUAL_ENTRY_DRAFT_KEY = "blendcalc-manual-entry-draft-v1";
const MANUAL_ENTRY_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const validSteps = new Set(manualEntrySteps.map((step) => step.id));
const validDestinations = new Set<SmoothieListKey>([
	MIX_STORAGE_KEYS.fridge,
	MIX_STORAGE_KEYS.shoppingList,
]);

const getStorageKey = () => getScopedStorageKey(MANUAL_ENTRY_DRAFT_KEY);

const hasMeaningfulDraft = (form: ManualEntryFormResetState) =>
	Boolean(
		form.name.trim() ||
			form.brandOwner.trim() ||
			form.category.trim() ||
			form.barcode.trim() ||
			form.servingLabel.trim() ||
			form.servingWeightGrams !== null ||
			form.volumeQuantity !== null ||
			Object.keys(form.manualNutrientValues).length > 0 ||
			form.importedNutrients.length > 0 ||
			form.ingredients.trim() ||
			form.ingredientList.length > 0 ||
			form.allergens.length > 0 ||
			form.traces.length > 0,
	);

const getDraftData = (form: ManualEntryFormResetState): ManualEntryDraftData => {
	const {
		frontPhoto: _frontPhoto,
		nutritionPhoto: _nutritionPhoto,
		barcodePhoto: _barcodePhoto,
		checkingBarcodeReference: _checkingBarcodeReference,
		validatingBarcodeShare: _validatingBarcodeShare,
		...draftData
	} = form;
	return draftData;
};

export const persistManualEntryDraft = (
	form: ManualEntryFormResetState,
	saveDestination: SmoothieListKey,
) => {
	if (!browser) return;
	if (!hasMeaningfulDraft(form)) {
		clearManualEntryDraft();
		return;
	}

	const draft: ManualEntryDraft = {
		version: 1,
		savedAt: Date.now(),
		form: getDraftData(form),
		saveDestination,
	};
	sessionStorage.setItem(getStorageKey(), JSON.stringify(draft));
};

export const readManualEntryDraft = (): ManualEntryDraft | null => {
	if (!browser) return null;

	const storageKey = getStorageKey();
	const value = sessionStorage.getItem(storageKey);
	if (!value) return null;

	try {
		const draft = JSON.parse(value) as Partial<ManualEntryDraft>;
		const expired =
			typeof draft.savedAt !== "number" ||
			Date.now() - draft.savedAt > MANUAL_ENTRY_DRAFT_MAX_AGE_MS;
		const invalid =
			draft.version !== 1 ||
			expired ||
			!draft.form ||
			typeof draft.form !== "object" ||
			!validSteps.has(draft.form.activeStep) ||
			!draft.saveDestination ||
			!validDestinations.has(draft.saveDestination);
		if (invalid) {
			sessionStorage.removeItem(storageKey);
			return null;
		}
		return draft as ManualEntryDraft;
	} catch {
		sessionStorage.removeItem(storageKey);
		return null;
	}
};

export const clearManualEntryDraft = () => {
	if (!browser) return;
	sessionStorage.removeItem(getStorageKey());
};
