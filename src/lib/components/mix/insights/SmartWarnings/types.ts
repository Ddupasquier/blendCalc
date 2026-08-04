import type { SmartWarning } from "$lib/utils/mix/warnings/smartWarnings";
import type {
	MixSectionAttentionTone,
	MixSectionDisclosureProps,
} from "$lib/utils/mix/ui/mixSectionOrder";

export type SmartWarningsProps = MixSectionDisclosureProps & {
	warnings?: SmartWarning[];
	openWarningId?: string | null;
	attentionTone?: MixSectionAttentionTone;
	onOpenWarning: (warningId: string) => void;
	onCloseWarning: () => void;
};
