// BlendCalc's isolated publication database. Lifecycle and restoration belong to Rehearsal.
import { defineRehearsalConfig } from "@rehearsal-db/core";

export default defineRehearsalConfig({
	schemaVersion: 1,
	project: { name: "blendcalc-publication" },
	supabase: {
		workdir: "infrastructure/blendCalcAPI",
		// The approved copy includes an acceptance-only collision migration. Restore its
		// exact historical prefix until a newly reviewed publication baseline replaces it.
		// This target does not yet validate new publication migrations.
		migrationDirectory: ".rehearsal-publication/.rehearsal/current/migrations",
		rehearsalConfig:
			"infrastructure/rehearsal/publication/supabase/config.toml",
		runtimeWorkdir: ".rehearsal-native/publication/.rehearsal/runtime",
	},
	baseline: {
		artifactDirectory: ".rehearsal-native/publication/.rehearsal",
		sanitizationPolicy:
			"infrastructure/rehearsal/publication/privacy-policy.v2.json",
	},
	preparation: {
		sourcePolicy:
			"infrastructure/rehearsal/publication/source-access-policy.json",
		privacyKey: ".rehearsal-native/publication/.rehearsal/secrets/privacy.key",
		batchRows: 500,
		maximumRows: 100000,
		maximumBytes: 2147483648,
		diskHeadroomBytes: 67108864,
	},
	application: {
		// This dependent target is a database, not another application server.
		startCommand: "node --version",
		proofCommand: "node scripts/operations/quality/prove_local_publication.mjs",
		environmentFile: ".rehearsal-native/publication/.rehearsal/runtime.env",
	},
	runtime: {
		target: "supabase",
		applicationUrl: "http://localhost:5175",
		projectId: "blendcalc-rehearsal-native-publication",
		apiPort: 59321,
		databasePort: 59322,
		studioPort: 59323,
	},
	safety: {
		allowedHosts: ["127.0.0.1", "::1", "localhost"],
		blockedEnvironmentVariables: [
			"SUPABASE_ACCESS_TOKEN",
			"SUPABASE_DB_PASSWORD",
			"SUPABASE_PROJECT_ID",
		],
		hostedAccess: "disabled",
		outboundNetwork: "deny",
	},
});
