import { BLENDCALC_API_V1_ACCESS_POLICY } from "$lib/api/v1/accessPolicy";

type ApiV1RequestLocals = Pick<App.Locals, "getVerifiedUser">;

export const hasApiV1CatalogReadAccess = async (
	locals: ApiV1RequestLocals,
) => {
	if (
		BLENDCALC_API_V1_ACCESS_POLICY.accessMode !== "internal-authenticated" ||
		BLENDCALC_API_V1_ACCESS_POLICY.publicAccessEnabled
	) {
		throw new Error("API v1 access mode has no reviewed implementation.");
	}
	return Boolean(await locals.getVerifiedUser());
};
