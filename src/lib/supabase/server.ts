import {
	PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	PUBLIC_SUPABASE_URL,
} from "$env/static/public";
import { dev } from "$app/environment";
import { createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import type { Database } from "$lib/types/database.types";
import type { Cookies } from "@sveltejs/kit";
import WebSocket from "ws";
import { assertRuntimeUrlMatchesEnvironment } from "$lib/server/environment/runtimeEnvironment.server";

const websocketTransport = WebSocket as unknown as WebSocketLikeConstructor;

export const createSupabaseServerClient = (cookies: Cookies) => {
	assertRuntimeUrlMatchesEnvironment(
		"PUBLIC_SUPABASE_URL",
		PUBLIC_SUPABASE_URL,
	);
	const cookieMethods: CookieMethodsServer = {
		getAll: () => cookies.getAll(),
		setAll: (cookiesToSet) => {
			cookiesToSet.forEach(({ name, value, options }) => {
				cookies.set(name, value, {
					...options,
					path: "/",
					secure: dev ? false : options?.secure,
				});
			});
		},
	};

	return createServerClient<Database>(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		{
			realtime: {
				transport: websocketTransport,
			},
			cookies: cookieMethods,
		},
	);
};
