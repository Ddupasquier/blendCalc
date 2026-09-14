export type RehearsalConfigVersion = 1;

export interface RehearsalConfig {
	schemaVersion: RehearsalConfigVersion;
	project: { name: string };
	supabase: {
		workdir: string;
		migrationDirectory: string;
		rehearsalConfig: string;
		runtimeWorkdir: string;
		serviceEnvironmentFile?: string;
		serviceEnvironmentVariables?: string[];
	};
	baseline: {
		artifactDirectory?: string;
		sanitizationPolicy: string;
	};
	application: {
		startCommand: string;
		proofCommand: string;
		environmentFile?: string;
		runtimeAdapter?: string;
	};
	runtime: {
		applicationUrl?: string;
		projectId?: string;
		apiPort: number;
		databasePort: number;
		studioPort: number;
	};
	safety?: {
		allowedHosts?: string[];
		blockedEnvironmentVariables?: string[];
		authenticationProviders?: string[];
		hostedAccess?: "disabled";
		outboundNetwork?: "deny";
	};
	verification?: { commands?: string[] };
}

export declare const REHEARSAL_CONFIG_VERSION: 1;
export declare const defineRehearsalConfig: <
	const Config extends RehearsalConfig,
>(
	config: Config,
) => Config;
export declare const loadRehearsalConfig: (options?: {
	projectRoot?: string;
	configPath?: string;
}) => Promise<unknown>;
export declare const inspectDetectedProject: (options?: {
	projectRoot?: string;
}) => Promise<unknown>;
export declare const renderDetectedConfig: (detected: unknown) => string;
