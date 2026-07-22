import type { ManualEntryStep, ManualEntryStepId } from "../formTypes";

export type ManualEntryStepTabsProps = {
	steps: ManualEntryStep[];
	activeStep: ManualEntryStepId;
	panelId: string;
	tabIdPrefix: string;
	onSelect: (step: ManualEntryStepId) => void;
};
