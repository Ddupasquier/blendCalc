import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { ManualEntryVolumeOption } from "../../formTypes";
import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";

export type ServingsStepProps = {
	servingWeightGrams: number | null;
	usesInternal100GramBasis: boolean;
	requiresServingWeight: boolean;
	useVolumeEquivalent: boolean;
	volumeQuantity: number | null;
	volumeUnit: ServingMeasureUnit;
	volumeOptions: ManualEntryVolumeOption[];
	regulatoryDisclosureProfiles: ProductRegulatoryDisclosureProfile[];
	regulatoryDisclosureProfileError: string;
	regulatoryDisclosureProfileKey: string;
	alcoholByVolumePercent: number | null;
	requiresAlcoholByVolume: boolean;
	onServingWeightChange: (value: number) => void;
	onUseVolumeChange: (value: boolean) => void;
	onVolumeQuantityChange: (value: number | null) => void;
	onVolumeUnitChange: (value: ServingMeasureUnit) => void;
	onRegulatoryDisclosureChange: (profileKey: string) => void;
	onAlcoholByVolumeChange: (percent: number | null) => void;
	onBack: () => void;
	onNext: () => void;
};
