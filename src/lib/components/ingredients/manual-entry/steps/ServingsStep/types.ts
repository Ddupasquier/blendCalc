import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { ManualEntryServingMeasureOption } from "../../formTypes";
import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";

export type ServingsStepProps = {
	servingWeightGrams: number | null;
	usesInternal100GramBasis: boolean;
	requiresServingMeasurement: boolean;
	useServingMeasure: boolean;
	servingLabel: string;
	servingMeasureQuantity: number | null;
	servingMeasureUnit: ServingMeasureUnit;
	servingMeasureOptions: ManualEntryServingMeasureOption[];
	regulatoryDisclosureProfiles: ProductRegulatoryDisclosureProfile[];
	regulatoryDisclosureProfileError: string;
	regulatoryDisclosureProfileKey: string;
	alcoholByVolumePercent: number | null;
	requiresAlcoholByVolume: boolean;
	onServingWeightChange: (value: number) => void;
	onServingLabelChange: (value: string) => void;
	onUseServingMeasureChange: (value: boolean) => void;
	onServingMeasureQuantityChange: (value: number | null) => void;
	onServingMeasureUnitChange: (value: ServingMeasureUnit) => void;
	onRegulatoryDisclosureChange: (profileKey: string) => void;
	onAlcoholByVolumeChange: (percent: number | null) => void;
	onBack: () => void;
	onNext: () => void;
};
