/**
 * Purpose: Parse a dedicated PostgreSQL source URL while keeping a Supabase pooler
 * connection username distinct from the database role observed after connection.
 * Do not run directly; this module is reusable Rehearsal infrastructure.
 */

const DEDICATED_ROLE_PATTERN = /^rehearsal_[a-z0-9_]+$/u;
const SUPABASE_PROJECT_REFERENCE_PATTERN = /^[a-z0-9]{20}$/u;

export const parseRehearsalSourceDatabaseUrl = (value) => {
	let databaseUrl;
	try {
		databaseUrl = new URL(value);
	} catch (error) {
		throw new Error("The Rehearsal source database URL is invalid.", {
			cause: error,
		});
	}
	if (!new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol)) {
		throw new Error("The Rehearsal source database URL must use PostgreSQL.");
	}
	const connectionUsername = decodeURIComponent(databaseUrl.username);
	const password = decodeURIComponent(databaseUrl.password);
	const database = decodeURIComponent(databaseUrl.pathname.slice(1));
	if (!connectionUsername || !password || !database || !databaseUrl.hostname) {
		throw new Error("The Rehearsal source database credential is incomplete.");
	}

	const usernameSegments = connectionUsername.split(".");
	if (usernameSegments.length > 2) {
		throw new Error("The Rehearsal source database username is invalid.");
	}
	const databaseRole = usernameSegments[0];
	const poolerProjectReference = usernameSegments[1];
	if (!DEDICATED_ROLE_PATTERN.test(databaseRole)) {
		throw new Error("The Rehearsal source database role is not dedicated.");
	}
	if (
		poolerProjectReference !== undefined &&
		!SUPABASE_PROJECT_REFERENCE_PATTERN.test(poolerProjectReference)
	) {
		throw new Error(
			"The Rehearsal source pooler username has an invalid project reference.",
		);
	}

	return Object.freeze({
		databaseUrl,
		database,
		databaseRole,
		connectionUsername,
		password,
		poolerProjectReference,
	});
};
