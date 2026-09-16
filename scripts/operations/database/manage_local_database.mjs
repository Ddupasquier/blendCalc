/**
 * Purpose: Manage the non-destructive local application Supabase lifecycle without
 * loading hosted credentials.
 * Run: `npm run db:local -- start`, `npm run db:local -- status`, or
 * `npm run db:local -- stop`.
 */

import { fileURLToPath } from "node:url";
import {
	readLocalSupabaseEnvironment,
	startLocalSupabase,
	stopLocalSupabase,
} from "../../lib/environment/local_supabase.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const action = process.argv[2] ?? "status";

switch (action) {
	case "start": {
		const environment = startLocalSupabase({
			cwd: repositoryRoot,
			exclude: ["edge-runtime", "logflare", "vector"],
		});
		console.log(`Local application Supabase: ${environment.apiUrl}`);
		break;
	}
	case "status": {
		const environment = readLocalSupabaseEnvironment({ cwd: repositoryRoot });
		console.log(`Local application Supabase: ${environment.apiUrl}`);
		console.log(`Local Studio: ${environment.studioUrl ?? "unavailable"}`);
		break;
	}
	case "stop":
		stopLocalSupabase({ cwd: repositoryRoot });
		break;
	default:
		throw new Error(`Unknown local database action: ${action}`);
}
