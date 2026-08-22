import type {
	RegulatoryRegionOption,
	RegulatoryRegionSelectionSource,
} from "$lib/utils/profile/regulatoryRegion";

export type ProfileRegulatoryRegionSettingsProps = {
	regulatoryRegionCode: string;
	regulatoryRegionSource: RegulatoryRegionSelectionSource | null;
	regulatoryRegionOptions: RegulatoryRegionOption[];
	hasUnsupportedRegion: boolean;
	disabled: boolean;
	onRegulatoryRegionChange: (value: string) => void;
};
