import { env } from "$env/dynamic/private";
import {
	readBlendCalcRuntimeEnvironment,
	type BlendCalcRuntimeEnvironment,
} from "$lib/server/environment/runtimeEnvironment.server";

export const areExternalProductLookupsEnabled = (
	runtimeEnvironment: BlendCalcRuntimeEnvironment = readBlendCalcRuntimeEnvironment(
		env,
	),
) => runtimeEnvironment === "staging" || runtimeEnvironment === "production";
