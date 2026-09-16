import { defineRehearsalConfig } from "@rehearsal-db/core";

export default defineRehearsalConfig({
	schemaVersion: 1,
	project: { name: "blendcalc" },
	supabase: {
		workdir: ".",
		migrationDirectory: "supabase/migrations",
		rehearsalConfig:
			"infrastructure/rehearsal/application/supabase/config.toml",
		runtimeWorkdir: ".rehearsal/runtime",
		serviceEnvironmentFile: ".env.rehearsal-auth.local",
		serviceEnvironmentVariables: [
			"SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID",
			"SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET",
		],
	},
	baseline: {
		artifactDirectory: ".rehearsal",
		sanitizationPolicy:
			"infrastructure/rehearsal/application/sanitization-policy.json",
	},
	application: {
		startCommand: "npm run dev:rehearsal",
		proofCommand: "npm run rehearsal:app:prove",
		environmentFile: ".rehearsal/runtime.env",
		runtimeAdapter: "infrastructure/rehearsal/application/runtime_adapter.mjs",
	},
	runtime: {
		applicationUrl: "http://localhost:5175",
		projectId: "blendcalc-rehearsal",
		apiPort: 58321,
		databasePort: 58322,
		studioPort: 58323,
	},
	safety: {
		allowedHosts: ["127.0.0.1", "::1", "localhost"],
		authenticationProviders: ["google"],
		blockedEnvironmentVariables: [
			"SUPABASE_ACCESS_TOKEN",
			"SUPABASE_DB_PASSWORD",
			"SUPABASE_PROJECT_ID",
			"RESEND_API_KEY",
			"FDC_API_KEY",
			"OPENFDA_API_KEY",
		],
		hostedAccess: "disabled",
		outboundNetwork: "deny",
	},
	verification: {
		commands: [
			"node scripts/generators/rehearsal/generate_sanitization_manifest.mjs --check",
			"node scripts/generators/rehearsal/generate_export_boundary_migration.mjs --check",
			"node scripts/operations/rehearsal/verify_local_migration_history.mjs",
		],
	},
});
