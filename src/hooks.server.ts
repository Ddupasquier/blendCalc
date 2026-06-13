import { createSupabaseServerClient } from "$lib/supabase/server";
import { applySecurityHeaders } from "$lib/utils/http/securityHeaders";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	let authResult: ReturnType<App.Locals["safeGetSession"]> | null = null;
	event.locals.safeGetSession = () => {
		authResult ??= (async () => {
			const {
				data: { user },
				error,
			} = await event.locals.supabase.auth.getUser();

			if (error || !user) return { session: null, user: null };
			return { session: null, user };
		})();
		return authResult;
	};

	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) => {
			return name === "content-encoding" || name === "content-range";
		},
	});

	applySecurityHeaders(response, event.url, Boolean(user));
	return response;
};
