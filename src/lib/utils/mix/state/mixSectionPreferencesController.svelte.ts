import {
	saveCloudMixSectionDisclosureState,
	saveCloudMixSectionOrder,
} from "$lib/utils/storage/supabase";
import {
	normalizeMixSectionDisclosureState,
	normalizeMixSectionOrder,
	type MixSectionDisclosureState,
	type MixSectionId,
} from "$lib/utils/mix/ui/mixSectionOrder";

type MixSectionPreferencesControllerOptions = {
	initialOrder?: unknown;
	initialDisclosureState?: unknown;
};

export const createMixSectionPreferencesController = ({
	initialOrder,
	initialDisclosureState,
}: MixSectionPreferencesControllerOptions) => {
	const state = $state({
		order: normalizeMixSectionOrder(initialOrder),
		disclosureState: normalizeMixSectionDisclosureState(initialDisclosureState),
		orderSaveBusy: false,
		orderSaveError: "",
		disclosureSaveError: "",
	});
	let orderSaveCount = 0;
	let orderSaveQueue: Promise<boolean> = Promise.resolve(true);
	let disclosureSaveQueue: Promise<boolean> = Promise.resolve(true);

	const replace = ({
		order,
		disclosureState,
	}: {
		order?: unknown;
		disclosureState?: unknown;
	}) => {
		state.order = normalizeMixSectionOrder(order);
		state.disclosureState = normalizeMixSectionDisclosureState(disclosureState);
	};

	const setOrder = (nextOrder: MixSectionId[]) => {
		state.order = normalizeMixSectionOrder(nextOrder);
	};

	const saveOrder = (nextOrder: MixSectionId[]) => {
		const normalizedOrder = normalizeMixSectionOrder(nextOrder);
		setOrder(normalizedOrder);
		orderSaveCount += 1;
		state.orderSaveBusy = true;
		state.orderSaveError = "";
		const saveRequest = orderSaveQueue.then(() =>
			saveCloudMixSectionOrder(normalizedOrder),
		);
		orderSaveQueue = saveRequest.catch(() => false);
		void saveRequest
			.then((saved) => {
				state.orderSaveError = saved
					? ""
					: "We could not save your section order. Check your connection and try again.";
			})
			.catch(() => {
				state.orderSaveError =
					"We could not save your section order. Check your connection and try again.";
			})
			.finally(() => {
				orderSaveCount -= 1;
				state.orderSaveBusy = orderSaveCount > 0;
			});
		return saveRequest;
	};

	const setDisclosure = (sectionId: MixSectionId, open: boolean) => {
		if (state.disclosureState[sectionId] === open) return;
		state.disclosureState = {
			...state.disclosureState,
			[sectionId]: open,
		};
		const nextState = { ...state.disclosureState };
		const saveRequest = disclosureSaveQueue.then(() =>
			saveCloudMixSectionDisclosureState(nextState),
		);
		disclosureSaveQueue = saveRequest.catch(() => false);
		void saveRequest
			.then((saved) => {
				state.disclosureSaveError = saved
					? ""
					: "Your section layout could not be saved. Your current Mix is still safe.";
			})
			.catch(() => {
				state.disclosureSaveError =
					"Your section layout could not be saved. Your current Mix is still safe.";
			});
	};

	return {
		state,
		replace,
		setOrder,
		saveOrder,
		setDisclosure,
	};
};

export type MixSectionPreferencesController = ReturnType<
	typeof createMixSectionPreferencesController
>;
