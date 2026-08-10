export type BarcodeProductSourceDisplay = {
	sourceLabel: string;
	sourceDataType?: string;
};

export const getBarcodeProductSourceDisplayLabel = (
	draft: BarcodeProductSourceDisplay,
) => [draft.sourceLabel, draft.sourceDataType].filter(Boolean).join(" · ");
