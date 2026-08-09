export const localQaAccount = {
	email: process.env.PLAYWRIGHT_QA_EMAIL ?? "qa-user@blendcalc.local",
	password:
		process.env.PLAYWRIGHT_QA_PASSWORD ?? "BlendCalc-Local-QA-2026!",
} as const;

export const authenticatedBrowserStatePath =
	"test-results/authenticated-browser-state/qa-user.json";
