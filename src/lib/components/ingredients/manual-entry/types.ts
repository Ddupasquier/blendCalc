import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type ManualEntryCreateContext = {
	destination: SmoothieListKey | "custom-only";
	addedToList: boolean;
	source: "manual-entry";
};

export type ManualEntryCreateHandler = (
	food: FdcFood,
	context: ManualEntryCreateContext,
) => void | Promise<void>;
