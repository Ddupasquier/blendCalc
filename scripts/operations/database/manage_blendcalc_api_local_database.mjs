/**
 * Purpose: Manage the isolated local blendCalcAPI Supabase lifecycle without loading
 * hosted credentials.
 * Run: `npm run blendCalcAPI:db -- start`, `npm run blendCalcAPI:db -- reset`,
 * `npm run blendCalcAPI:db -- test`, `npm run blendCalcAPI:db -- status`, or
 * `npm run blendCalcAPI:db -- stop`.
 */

import { fileURLToPath } from "node:url";
import {
	readLocalSupabaseEnvironment,
	runLocalCommand,
	startLocalSupabase,
	stopLocalSupabase,
} from "../../lib/environment/local_supabase.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const workdir = "infrastructure/blendCalcAPI";
const action = process.argv[2] ?? "status";

switch (action) {
	case "start": {
		const environment = startLocalSupabase({ cwd: repositoryRoot, workdir });
		console.log(`Local blendCalcAPI Supabase: ${environment.apiUrl}`);
		break;
	}
	case "reset":
		runLocalCommand(
			"supabase",
			["db", "reset", "--local", "--workdir", workdir],
			{ cwd: repositoryRoot },
		);
		break;
	case "test":
		runLocalCommand(
			"supabase",
			["test", "db", "--local", "--workdir", workdir],
			{ cwd: repositoryRoot },
		);
		break;
	case "status": {
		const environment = readLocalSupabaseEnvironment({
			cwd: repositoryRoot,
			workdir,
		});
		console.log(`Local blendCalcAPI Supabase: ${environment.apiUrl}`);
		console.log(
			`Local blendCalcAPI Studio: ${environment.studioUrl ?? "unavailable"}`,
		);
		break;
	}
	case "stop":
		stopLocalSupabase({ cwd: repositoryRoot, workdir });
		break;
	default:
		throw new Error(`Unknown local blendCalcAPI database action: ${action}`);
}
