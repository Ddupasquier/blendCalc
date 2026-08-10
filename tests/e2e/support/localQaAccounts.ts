const defaultWorkerEmails = [
	"qa-browser-1@blendcalc.local",
	"qa-browser-2@blendcalc.local",
	"qa-browser-3@blendcalc.local",
] as const;

const configuredWorkerEmails = process.env.PLAYWRIGHT_QA_EMAILS
	?.split(",")
	.map((email) => email.trim())
	.filter(Boolean);

const workerEmails =
	configuredWorkerEmails && configuredWorkerEmails.length > 0
		? configuredWorkerEmails
		: process.env.PLAYWRIGHT_QA_EMAIL
			? [process.env.PLAYWRIGHT_QA_EMAIL]
			: [...defaultWorkerEmails];

export const localQaAccountCount = workerEmails.length;

export const getLocalQaAccountForWorker = (parallelWorkerIndex: number) => {
	const email = workerEmails[parallelWorkerIndex];
	if (!email) {
		throw new Error(
			`Playwright worker ${parallelWorkerIndex + 1} has no isolated QA account. ` +
				`Provide at least ${parallelWorkerIndex + 1} comma-separated PLAYWRIGHT_QA_EMAILS values or lower PLAYWRIGHT_WORKERS.`,
		);
	}

	return {
		email,
		password:
			process.env.PLAYWRIGHT_QA_PASSWORD ?? "BlendCalc-Local-QA-2026!",
	};
};

export const getAuthenticatedBrowserStatePath = (
	projectName: string,
	parallelWorkerIndex: number,
) =>
	`test-results/authenticated-browser-state/${projectName}-worker-${parallelWorkerIndex + 1}.json`;
