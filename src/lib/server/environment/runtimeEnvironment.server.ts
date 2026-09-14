import { env } from "$env/dynamic/private";

export const BLENDCALC_RUNTIME_ENVIRONMENTS = [
	"local",
	"test",
	"rehearsal",
	"staging",
	"production",
] as const;

export type BlendCalcRuntimeEnvironment =
	(typeof BLENDCALC_RUNTIME_ENVIRONMENTS)[number];

type RuntimeEnvironmentInput = Record<string, string | undefined>;

const SAFE_LOCAL_RUNTIME_ENVIRONMENTS = new Set<BlendCalcRuntimeEnvironment>([
	"local",
	"test",
	"rehearsal",
]);
const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "::1", "localhost"]);
const SAFE_READ_ONLY_ASSET_HOSTNAMES = new Set(["images.openfoodfacts.org"]);

export const isBlendCalcRuntimeEnvironment = (
	value: string | undefined,
): value is BlendCalcRuntimeEnvironment =>
	BLENDCALC_RUNTIME_ENVIRONMENTS.some((candidate) => candidate === value);

export const readBlendCalcRuntimeEnvironment = (
	environment: RuntimeEnvironmentInput = env,
): BlendCalcRuntimeEnvironment => {
	const configuredEnvironment =
		environment.BLENDCALC_RUNTIME_ENVIRONMENT?.trim().toLowerCase();
	if (configuredEnvironment) {
		if (!isBlendCalcRuntimeEnvironment(configuredEnvironment)) {
			throw new Error("BLENDCALC_RUNTIME_ENVIRONMENT is invalid.");
		}
		return configuredEnvironment;
	}

	if (environment.VERCEL_ENV === "production") return "production";
	if (environment.VERCEL_ENV === "preview") return "staging";
	if (environment.NODE_ENV === "test") return "test";
	if (environment.NODE_ENV === "development") return "local";
	if (environment.NODE_ENV === "production") return "production";

	throw new Error("BLENDCALC_RUNTIME_ENVIRONMENT is not configured.");
};

export const isSafeLocalRuntimeEnvironment = (
	runtimeEnvironment = readBlendCalcRuntimeEnvironment(),
) => SAFE_LOCAL_RUNTIME_ENVIRONMENTS.has(runtimeEnvironment);

export const isDisposableDatabaseRuntimeEnvironment = (
	runtimeEnvironment: string | undefined,
) => runtimeEnvironment === "test" || runtimeEnvironment === "rehearsal";

export const isLoopbackRuntimeUrl = (value: string) => {
	try {
		return LOOPBACK_HOSTNAMES.has(new URL(value).hostname);
	} catch {
		return false;
	}
};

export const assertRuntimeUrlMatchesEnvironment = (
	label: string,
	value: string,
	runtimeEnvironment = readBlendCalcRuntimeEnvironment(),
) => {
	if (
		isSafeLocalRuntimeEnvironment(runtimeEnvironment) &&
		!isLoopbackRuntimeUrl(value)
	) {
		throw new Error(`${label} must use a loopback URL in safe local runtimes.`);
	}
	return value;
};

export const assertExternalRequestAllowed = (
	input: string | URL | Request,
	runtimeEnvironment = readBlendCalcRuntimeEnvironment(),
	method = input instanceof Request ? input.method : "GET",
) => {
	if (!isSafeLocalRuntimeEnvironment(runtimeEnvironment)) return;
	const value =
		input instanceof Request
			? input.url
			: input instanceof URL
				? input.toString()
				: input;
	const url = new URL(value);
	const isApprovedReadOnlyAsset =
		(method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD") &&
		url.protocol === "https:" &&
		SAFE_READ_ONLY_ASSET_HOSTNAMES.has(url.hostname);
	if (!isLoopbackRuntimeUrl(value) && !isApprovedReadOnlyAsset) {
		throw new Error(
			`External network requests are disabled in the ${runtimeEnvironment} runtime.`,
		);
	}
};
