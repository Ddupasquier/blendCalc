import { BLENDCALC_API_V1_ACCESS_POLICY } from "$lib/blendCalcAPI/v1/blendCalcAPIAccessPolicy";

type BlendCalcAPIV1RequestLocals = Pick<App.Locals, "getVerifiedUser">;

export const hasBlendCalcAPIV1CatalogReadAccess = async (
	locals: BlendCalcAPIV1RequestLocals,
) => {
	if (
		BLENDCALC_API_V1_ACCESS_POLICY.accessMode !== "internal-authenticated" ||
		BLENDCALC_API_V1_ACCESS_POLICY.publicAccessEnabled
	) {
		throw new Error(
			"blendCalcAPI v1 access mode has no reviewed implementation.",
		);
	}
	return Boolean(await locals.getVerifiedUser());
};
