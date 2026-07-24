import type { ManualEntryStepId } from "../formTypes";
import type { IdentityStepProps } from "../steps/IdentityStep/types";
import type { NutrientStepProps } from "../steps/NutrientStep/types";
import type { ServingsStepProps } from "../steps/ServingsStep/types";
import type { ShareStepProps } from "../steps/ShareStep/types";

export type ManualEntryStepContentProps = {
	activeStep: ManualEntryStepId;
	identity: IdentityStepProps;
	servings: ServingsStepProps;
	macros: NutrientStepProps;
	extended: NutrientStepProps;
	share: ShareStepProps;
};
