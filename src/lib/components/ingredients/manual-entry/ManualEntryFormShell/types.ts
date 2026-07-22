import type { Snippet } from "svelte";
import type { ManualEntryStep, ManualEntryStepId } from "../formTypes";

export type ManualEntryFormShellProps = {
	inline?: boolean;
	activeStep: ManualEntryStepId;
	steps: ManualEntryStep[];
	saving?: boolean;
	lookingUpBarcode?: boolean;
	stepWarningMessage?: string;
	stepWarningStep?: ManualEntryStepId | null;
	children: Snippet;
	onSelectStep: (step: ManualEntryStepId) => void;
	onDetailsElement?: (element: HTMLDetailsElement | null) => void;
	onBodyElement?: (element: HTMLFieldSetElement | null) => void;
};
