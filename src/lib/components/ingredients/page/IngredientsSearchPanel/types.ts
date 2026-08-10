export type IngredientsSearchPanelProps = {
	barcodeLookupBusy?: boolean;
	filtersActive?: boolean;
	onOpenSearch: () => void;
	onScan: () => void;
	onToggleFilters: () => void;
	onOpenManualEntry: () => void;
};
