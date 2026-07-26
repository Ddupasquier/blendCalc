const SHARED_CONNECT_SOURCES = [
	"self",
	"https://api.nal.usda.gov",
	"https://world.openfoodfacts.org",
	"https://cdn.jsdelivr.net",
	"https://*.supabase.co",
	"wss://*.supabase.co",
	"https://vitals.vercel-insights.com",
];

const LOCAL_TEST_DATABASE_CONNECT_SOURCES = [
	"http://127.0.0.1:54321",
	"ws://127.0.0.1:54321",
];

export const readViteMode = (
	args = process.argv,
	environment = process.env,
) => {
	if (environment.BLENDCALC_DATABASE_ENVIRONMENT === "test") return "test";
	const modeIndex = args.indexOf("--mode");
	return modeIndex >= 0 ? args[modeIndex + 1] ?? "" : "";
};

export const createConnectSources = (mode = readViteMode()) => [
	...SHARED_CONNECT_SOURCES,
	...(mode === "test" ? LOCAL_TEST_DATABASE_CONNECT_SOURCES : []),
];
