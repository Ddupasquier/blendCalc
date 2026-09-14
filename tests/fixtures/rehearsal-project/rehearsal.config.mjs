export default {
	schemaVersion: 1,
	project: { name: "rehearsal-fixture-project" },
	supabase: {
		workdir: ".",
		migrationDirectory: "supabase/migrations",
		rehearsalConfig: "supabase/config.toml",
		runtimeWorkdir: ".rehearsal/runtime",
	},
	baseline: {
		artifactDirectory: ".rehearsal",
		sanitizationPolicy: "rehearsal/sanitization-policy.json",
	},
	application: {
		startCommand: "npm run dev",
		proofCommand: "npm run proof",
	},
	runtime: {
		applicationUrl: "http://localhost:5275",
		projectId: "rehearsal-fixture",
		apiPort: 59321,
		databasePort: 59322,
		studioPort: 59323,
	},
	safety: {
		hostedAccess: "disabled",
		outboundNetwork: "deny",
	},
};
