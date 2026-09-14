/**
 * Purpose: Build the isolated Docker-backed PostgreSQL client invocation used for
 * hosted Rehearsal reads without requiring a host psql installation.
 * Do not run directly; this module is reusable Rehearsal infrastructure.
 */

import { createCleanProcessEnvironment } from "@rehearsal/db/process-environment";

const POSTGRES_CLIENT_IMAGE = "postgres:17-alpine";

export const createRehearsalSourcePsqlInvocation = ({
	databaseUrl,
	connectionUsername,
	password,
	database,
}) => {
	if (!(databaseUrl instanceof URL)) {
		throw new Error("The Rehearsal PostgreSQL client requires a parsed URL.");
	}
	const environment = createCleanProcessEnvironment({
		overrides: {
			PGHOST: databaseUrl.hostname,
			PGPORT: databaseUrl.port || "5432",
			PGDATABASE: database,
			PGUSER: connectionUsername,
			PGPASSWORD: password,
			PGSSLMODE: databaseUrl.searchParams.get("sslmode") ?? "require",
		},
	});
	return Object.freeze({
		command: "docker",
		args: [
			"run",
			"--rm",
			"--interactive",
			"--env",
			"PGHOST",
			"--env",
			"PGPORT",
			"--env",
			"PGDATABASE",
			"--env",
			"PGUSER",
			"--env",
			"PGPASSWORD",
			"--env",
			"PGSSLMODE",
			POSTGRES_CLIENT_IMAGE,
			"psql",
		],
		environment,
	});
};
