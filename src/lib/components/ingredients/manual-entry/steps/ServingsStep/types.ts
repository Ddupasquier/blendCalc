import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { ManualEntryVolumeOption } from "../../formTypes";

export type ServingsStepProps = {
	servingLabel: string;
	resolvedServingLabel: string;
	servingWeightGrams: number | null;
	useVolumeEquivalent: boolean;
	volumeQuantity: number | null;
	volumeUnit: ServingMeasureUnit;
	volumeOptions: ManualEntryVolumeOption[];
	onServingLabelChange: (value: string) => void;
	onServingWeightChange: (value: number) => void;
	onUseVolumeChange: (value: boolean) => void;
	onVolumeQuantityChange: (value: number | null) => void;
	onVolumeUnitChange: (value: ServingMeasureUnit) => void;
	onBack: () => void;
	onNext: () => void;
};
