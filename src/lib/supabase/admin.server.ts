import { env } from "$env/dynamic/private";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import type { Database } from "$lib/types/database.types";
import { createClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import WebSocket from "ws";

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;

const websocketTransport = WebSocket as unknown as WebSocketLikeConstructor;

let adminClient: SupabaseAdminClient | null = null;

export const getSupabaseAdminClient = () => {
	if (adminClient) return adminClient;

	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!serviceRoleKey) {
		throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
	}

	adminClient = createClient<Database>(PUBLIC_SUPABASE_URL, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
		realtime: {
			transport: websocketTransport,
		},
	});
	return adminClient;
};
