// BlendCalc-specific consumer configuration for the project-neutral Rehearsal engine.
import { defineRehearsalConfig } from "@rehearsal-db/core";

export default defineRehearsalConfig({
	schemaVersion: 1,
	project: { name: "blendcalc" },
	supabase: {
		workdir: ".",
		migrationDirectory: "supabase/migrations",
		rehearsalConfig:
			"infrastructure/rehearsal/application/supabase/config.toml",
		runtimeWorkdir: ".rehearsal-native/primary/.rehearsal/runtime",
		serviceEnvironmentFile: ".env.rehearsal-auth.local",
		serviceEnvironmentVariables: [
			"SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID",
			"SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET",
		],
	},
	baseline: {
		artifactDirectory: ".rehearsal-native/primary/.rehearsal",
		sanitizationPolicy:
			"infrastructure/rehearsal/application/privacy-policy.v2.json",
	},
	// The reviewed source is a purpose-created loopback copy, never the hosted app.
	preparation: {
		sourcePolicy:
			"infrastructure/rehearsal/application/source-access-policy.json",
		privacyKey: ".rehearsal-native/primary/.rehearsal/secrets/privacy.key",
		batchRows: 500,
		maximumRows: 2000000,
		maximumBytes: 2147483648,
		diskHeadroomBytes: 67108864,
	},
	runtimePolicy: "infrastructure/rehearsal/application/runtime-policy.json",
	identityPolicy: "infrastructure/rehearsal/application/identity-policy.json",
	dependentTargets: [
		{
			name: "publication-api",
			configPath: "infrastructure/rehearsal/publication/rehearsal.config.mjs",
		},
	],
	application: {
		startCommand:
			"env PUBLIC_SITE_URL=http://localhost:5175 PUBLIC_TURNSTILE_SITE_KEY= TURNSTILE_SECRET_KEY= BLENDCALC_API_READ_MODE=isolated node node_modules/vite/bin/vite.js dev --mode rehearsal --host 127.0.0.1 --port 5175 --strictPort",
		proofCommand: "node scripts/operations/quality/prove_local_application.mjs",
		environmentFile: ".rehearsal-native/primary/.rehearsal/runtime.env",
		environmentVariables: {
			BLENDCALC_RUNTIME_ENVIRONMENT: "primary:REHEARSAL_RUNTIME_ENVIRONMENT",
			PUBLIC_SUPABASE_URL: "primary:SUPABASE_URL",
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: "primary:SUPABASE_PUBLISHABLE_KEY",
			SUPABASE_SERVICE_ROLE_KEY: "primary:SUPABASE_SERVICE_ROLE_KEY",
			BLENDCALC_API_SUPABASE_URL: "publication-api:SUPABASE_URL",
			BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY:
				"publication-api:SUPABASE_SERVICE_ROLE_KEY",
		},
		readiness: {
			url: "http://localhost:5175/auth",
			expectedStatus: 200,
			timeoutSeconds: 90,
		},
	},
	runtime: {
		applicationUrl: "http://localhost:5175",
		projectId: "blendcalc-rehearsal-native",
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
});
