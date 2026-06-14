import { createSupabaseServerClient } from "$lib/supabase/server";
import { applySecurityHeaders } from "$lib/utils/http/securityHeaders";
import { isActiveAccountBlock } from "$lib/utils/moderation/moderation";
import { redirect, type Handle } from "@sveltejs/kit";

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

	if (user) {
		const { data: moderation, error: moderationError } = await event.locals.supabase
			.from("account_moderation")
			.select("status, expires_at")
			.eq("user_id", user.id)
			.maybeSingle();

		if (moderationError) {
			console.error("[moderation] Unable to verify account status", {
				userId: user.id,
				code: moderationError.code,
			});
		} else if (
			moderation &&
			isActiveAccountBlock(moderation.status, moderation.expires_at)
		) {
			await event.locals.supabase.auth.signOut({ scope: "local" });
			throw redirect(303, "/auth?error=account_blocked");
		}
	}

	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) => {
			return name === "content-encoding" || name === "content-range";
		},
	});

	applySecurityHeaders(response, event.url, Boolean(user));
	return response;
};
