import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parse } from "dotenv";
import { readFile } from "node:fs/promises";
import type { Database } from "$lib/types/database.types";
import { getLocalQaAccountForWorker } from "./localQaAccounts";

const localDatabaseHostnames = new Set(["127.0.0.1", "localhost"]);

export const createAuthenticatedLocalQaDatabaseClient = async (
	parallelWorkerIndex: number,
): Promise<SupabaseClient<Database>> => {
	const environment = parse(await readFile(".env.test.local"));
	const supabaseUrl = environment.PUBLIC_SUPABASE_URL;
	const publishableKey = environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!supabaseUrl || !publishableKey) {
		throw new Error(
			"Local Playwright database access requires PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
		);
	}

	const databaseUrl = new URL(supabaseUrl);
	if (!localDatabaseHostnames.has(databaseUrl.hostname)) {
		throw new Error("Playwright database access is restricted to local Supabase.");
	}

	const supabase = createClient<Database>(supabaseUrl, publishableKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	const account = getLocalQaAccountForWorker(parallelWorkerIndex);
	const { error: signInError } = await supabase.auth.signInWithPassword(account);
	if (signInError) throw signInError;

	return supabase;
};
