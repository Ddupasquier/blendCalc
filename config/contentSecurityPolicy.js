const HOSTED_CONNECT_SOURCES = [
	"self",
	"https://api.nal.usda.gov",
	"https://world.openfoodfacts.org",
	"https://images.openfoodfacts.org",
	"https://cdn.jsdelivr.net",
	"https://challenges.cloudflare.com",
	"https://*.supabase.co",
	"wss://*.supabase.co",
	"https://vitals.vercel-insights.com",
];

const SAFE_LOCAL_MODES = new Set(["local", "test", "rehearsal"]);
const KNOWN_RUNTIME_MODES = new Set([
	...SAFE_LOCAL_MODES,
	"staging",
	"production",
]);

const LOCAL_APPLICATION_SUPABASE_PORTS = Object.freeze({
	local: 54321,
	test: 54321,
	rehearsal: 58321,
});

/** @typedef {keyof typeof LOCAL_APPLICATION_SUPABASE_PORTS} SafeLocalMode */

/** @param {string} mode */
const readLocalApplicationSupabasePort = (mode) => {
	if (!Object.hasOwn(LOCAL_APPLICATION_SUPABASE_PORTS, mode)) {
		throw new Error(`No local Supabase CSP target exists for ${mode}.`);
	}
	return LOCAL_APPLICATION_SUPABASE_PORTS[/** @type {SafeLocalMode} */ (mode)];
};

/** @param {string} mode */
const createLocalSupabaseSources = (mode) => {
	const port = readLocalApplicationSupabasePort(mode);
	return [
		"self",
		`http://127.0.0.1:${port}`,
		`ws://127.0.0.1:${port}`,
		"http://127.0.0.1:55321",
		"ws://127.0.0.1:55321",
		"https://images.openfoodfacts.org",
	];
};

export const readViteMode = (
	args = process.argv,
	environment = process.env,
) => {
	if (environment.BLENDCALC_RUNTIME_ENVIRONMENT) {
		const runtimeEnvironment = environment.BLENDCALC_RUNTIME_ENVIRONMENT;
		if (!KNOWN_RUNTIME_MODES.has(runtimeEnvironment)) {
			throw new Error("BLENDCALC_RUNTIME_ENVIRONMENT is invalid.");
		}
		return runtimeEnvironment;
	}
	const modeIndex = args.indexOf("--mode");
	return modeIndex >= 0 ? (args[modeIndex + 1] ?? "") : "";
};

export const createConnectSources = (mode = readViteMode()) =>
	SAFE_LOCAL_MODES.has(mode)
		? createLocalSupabaseSources(mode)
		: HOSTED_CONNECT_SOURCES;

export const createImageSources = (mode = readViteMode()) =>
	SAFE_LOCAL_MODES.has(mode)
		? [
				"self",
				"data:",
				"blob:",
				`http://127.0.0.1:${readLocalApplicationSupabasePort(mode)}`,
				"https://images.openfoodfacts.org",
			]
		: ["self", "data:", "blob:", "https:"];

export const createFrameSources = (mode = readViteMode()) =>
	SAFE_LOCAL_MODES.has(mode)
		? ["self"]
		: ["self", "https://challenges.cloudflare.com"];

export const createScriptSources = (mode = readViteMode()) => [
	"self",
	"wasm-unsafe-eval",
	...(SAFE_LOCAL_MODES.has(mode)
		? []
		: ["https://cdn.jsdelivr.net", "https://challenges.cloudflare.com"]),
];

export const createWorkerSources = (mode = readViteMode()) => [
	"self",
	"blob:",
	...(SAFE_LOCAL_MODES.has(mode) ? [] : ["https://cdn.jsdelivr.net"]),
];

export const createSvelteKitOutputDirectory = (mode = readViteMode()) =>
	mode === "rehearsal" ? ".svelte-kit-rehearsal" : ".svelte-kit";

export const createInactiveSvelteKitOutputWatchPattern = (
	mode = readViteMode(),
) =>
	mode === "rehearsal" ? "**/.svelte-kit/**" : "**/.svelte-kit-rehearsal/**";
