export type IngredientsSearchPanelProps = {
	barcodeLookupBusy?: boolean;
	filtersActive?: boolean;
	onOpenSearch: () => void;
	onScan: (event?: MouseEvent) => void;
	onToggleFilters: () => void;
	onOpenManualEntry: () => void;
};
