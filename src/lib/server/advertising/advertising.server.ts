import * as env from "$app/env/private";
import type { CloudDataContext } from "$lib/utils/storage/supabase/shared";
import type { AdEligibility } from "$lib/utils/advertising/adPolicy";
import type { AdvertisingConfiguration } from "$lib/utils/advertising/advertisingConfiguration";
import { readBlendCalcRuntimeEnvironment } from "$lib/server/environment/runtimeEnvironment.server";

/** A failed read, including an unapplied expansion migration, never permits ads. */
export const readAdvertisingEligibility = async (
	context: CloudDataContext,
): Promise<AdEligibility> => {
	try {
		const { data, error } = await context.supabase
			.rpc("read_current_user_advertising_access")
			.abortSignal(AbortSignal.timeout(5_000));
		return !error && (data === "supported" || data === "ad-free")
			? data
			: "unknown";
	} catch {
		return "unknown";
	}
};

export const readAdvertisingConfiguration = (): AdvertisingConfiguration => {
	const runtime = readBlendCalcRuntimeEnvironment();
	// Local verification cannot contact Google, even if production flags leak in.
	if (
		runtime === "test" &&
		(!env.BLENDCALC_ADVERTISING_MODE ||
			env.BLENDCALC_ADVERTISING_MODE === "preview")
	)
		return { mode: "preview" };
	if (
		env.BLENDCALC_RUNTIME_ENVIRONMENT !== "production" ||
		runtime !== "production" ||
		env.BLENDCALC_ADVERTISING_MODE !== "google"
	)
		return { mode: "disabled" };
	// Activation is a separately reviewed operation, independent of source delivery.
	if (env.BLENDCALC_ADVERTISING_APPROVED !== "true")
		return { mode: "disabled" };
	return { mode: "google" };
};
