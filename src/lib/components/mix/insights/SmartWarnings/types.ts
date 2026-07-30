import type { SmartWarning } from "$lib/utils/mix/warnings/smartWarnings";

export type SmartWarningsProps = {
	warnings?: SmartWarning[];
	openWarningId?: string | null;
	onOpenWarning: (warningId: string) => void;
	onCloseWarning: () => void;
};
