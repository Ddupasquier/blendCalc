import { beforeEach, describe, expect, it, vi } from "vitest";

const manualEntryPayload = vi.hoisted(() => ({
	createManualEntryCustomFood: vi.fn(() => ({ fdcId: -1 })),
}));
const manualEntrySave = vi.hoisted(() => ({
	saveManualEntryCustomFood: vi.fn(),
}));
const manualEntryValidation = vi.hoisted(() => ({
	getManualEntrySubmitState: vi.fn(),
}));

vi.mock(
	"$lib/components/ingredients/manual-entry/utils/customFoodPayload",
	() => manualEntryPayload,
);
vi.mock(
	"$lib/components/ingredients/manual-entry/utils/submitFlow",
	() => manualEntrySave,
);
vi.mock(
	"$lib/components/ingredients/manual-entry/utils/submitValidation",
	() => manualEntryValidation,
);

import { createManualEntrySubmissionController } from "$lib/components/ingredients/manual-entry/CustomIngredientForm/manualEntrySubmissionController.svelte";

const createDeferredResult = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
};

const createController = (checkManualBarcodeReference: () => Promise<void>) =>
	createManualEntrySubmissionController({
		form: {
			data: {},
			getResolvedServingLabel: () => "100 g",
		} as never,
		referenceData: { state: {} } as never,
		validation: {
			blockingValidation: null,
			nutrientFields: [],
			markValidationAttempted: vi.fn(),
			showNavigationStepWarning: vi.fn(),
		} as never,
		barcode: {
			checkManualBarcodeReference,
			getReferenceReviewFlags: () => [],
		} as never,
		outcome: {
			resetBeforeSubmit: vi.fn(),
			useIngredient: true,
		} as never,
		onReset: vi.fn(),
	});

describe("createManualEntrySubmissionController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		manualEntryValidation.getManualEntrySubmitState.mockReturnValue({
			normalizedBarcode: "00011110129505",
		});
		manualEntrySave.saveManualEntryCustomFood.mockResolvedValue({
			status: "cancelled",
		});
	});

	it("blocks duplicate submissions while the final barcode check is pending", async () => {
		const barcodeLookup = createDeferredResult();
		const checkManualBarcodeReference = vi.fn(() => barcodeLookup.promise);
		const controller = createController(checkManualBarcodeReference);

		const firstSubmission = controller.handleSubmit();
		const duplicateSubmission = controller.handleSubmit();

		expect(controller.state.saving).toBe(true);
		expect(checkManualBarcodeReference).toHaveBeenCalledOnce();
		expect(manualEntrySave.saveManualEntryCustomFood).not.toHaveBeenCalled();

		barcodeLookup.resolve();
		await Promise.all([firstSubmission, duplicateSubmission]);

		expect(manualEntrySave.saveManualEntryCustomFood).toHaveBeenCalledOnce();
		expect(controller.state.saving).toBe(false);
	});

	it("recovers when the final barcode check fails", async () => {
		const controller = createController(() =>
			Promise.reject(new Error("offline")),
		);

		await controller.handleSubmit();

		expect(controller.state.saving).toBe(false);
		expect(controller.state.error).toContain("couldn’t save this ingredient");
		expect(manualEntrySave.saveManualEntryCustomFood).not.toHaveBeenCalled();
	});
});
