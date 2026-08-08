import type { MixWarning } from "$lib/utils/mix/warnings/mixWarnings";
import type {
	MixSectionAttentionTone,
	MixSectionDisclosureProps,
} from "$lib/utils/mix/ui/mixSectionOrder";

export type MixWarningsProps = MixSectionDisclosureProps & {
	warnings?: MixWarning[];
	openWarningId?: string | null;
	attentionTone?: MixSectionAttentionTone;
	onOpenWarning: (warningId: string) => void;
	onCloseWarning: () => void;
};
