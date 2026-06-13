import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import {
	getAuthCallbackUrl,
	getCanonicalAuthPageUrl,
} from "$lib/utils/auth/authUrls";
import {
	clearAuthFlowContext,
	getSafeAuthNextPath,
	storeAuthFlowContext,
} from "$lib/utils/auth/authFlow";

const getEmailAuthFields = async (request: Request) => {
	const formData = await request.formData();
	const email = String(formData.get("email") ?? "").trim().toLowerCase();
	const password = String(formData.get("password") ?? "");
	const next = getSafeAuthNextPath(formData.get("next"));

	return { email, password, next };
};

const getEmailField = async (request: Request) => {
	const formData = await request.formData();
	return {
		email: String(formData.get("email") ?? "").trim().toLowerCase(),
		next: getSafeAuthNextPath(formData.get("next")),
	};
};

const getEmailAuthValidationError = (email: string, password: string) => {
	if (!email) return "Enter your email address.";
	if (!email.includes("@")) return "Enter a valid email address.";
	if (!password) return "Enter your password.";
	if (password.length < 8) return "Password must be at least 8 characters.";
	return "";
};

const redirectToCanonicalAuthPage = (
	request: Request,
	url: URL,
	next: string,
) => {
	const canonicalUrl = getCanonicalAuthPageUrl(request, url, next);
	if (canonicalUrl) throw redirect(303, canonicalUrl);
};

const addNextToCallbackUrl = (callbackUrl: string, next: string) => {
	const url = new URL(callbackUrl);
	url.searchParams.set("next", getSafeAuthNextPath(next));
	return url.toString();
};

export const load: PageServerLoad = async ({ locals, request, url }) => {
	const next = getSafeAuthNextPath(url.searchParams.get("next"));
	redirectToCanonicalAuthPage(request, url, next);
	const { user } = await locals.safeGetSession();

	if (user) {
		throw redirect(303, next);
	}

	return {
		authError: url.searchParams.get("error") ?? "",
		next,
	};
};

export const actions: Actions = {
	emailSignIn: async ({ locals, request, url }) => {
		const { email, password, next } = await getEmailAuthFields(request);
		redirectToCanonicalAuthPage(request, url, next);
		const validationError = getEmailAuthValidationError(email, password);

		if (validationError) {
			return fail(400, {
				message: validationError,
				email,
				next,
			});
		}

		const { error } = await locals.supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			return fail(400, {
				message: "Email or password was not accepted.",
				email,
				next,
			});
		}

		throw redirect(303, next);
	},
	emailSignUp: async ({ locals, request, url, cookies }) => {
		const { email, password, next } = await getEmailAuthFields(request);
		redirectToCanonicalAuthPage(request, url, next);
		const validationError = getEmailAuthValidationError(email, password);

		if (validationError) {
			return fail(400, {
				message: validationError,
				email,
				next,
			});
		}

		const callbackUrl = getAuthCallbackUrl(request, url);
		const redirectTo = addNextToCallbackUrl(callbackUrl, next);
		const flowId = storeAuthFlowContext(cookies, next, new URL(redirectTo));
		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: redirectTo,
			},
		});

		if (error) {
			clearAuthFlowContext(cookies);
			console.warn("[auth] Email sign-up failed", {
				flowId,
				code: error.code,
				status: error.status,
			});
			return fail(400, {
				message: "Unable to create that account. Try again in a moment.",
				email,
				next,
			});
		}

		if (data.session) {
			clearAuthFlowContext(cookies);
			throw redirect(303, next);
		}

		return {
			success:
				"Account created. Check your email to confirm it, then come back and sign in.",
			email,
			next,
		};
	},
	requestPasswordReset: async ({ locals, request, url, cookies }) => {
		const { email, next } = await getEmailField(request);
		redirectToCanonicalAuthPage(request, url, next);

		if (!email || !email.includes("@")) {
			return fail(400, {
				message: "Enter a valid email address.",
				email,
				next,
			});
		}

		const callbackUrl = getAuthCallbackUrl(request, url);
		const redirectTo = addNextToCallbackUrl(
			callbackUrl,
			"/auth/update-password",
		);
		const flowId = storeAuthFlowContext(
			cookies,
			"/auth/update-password",
			new URL(callbackUrl),
		);
		const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
			redirectTo,
		});

		if (error) {
			clearAuthFlowContext(cookies);
			console.warn("[auth] Password recovery request failed", {
				flowId,
				code: error.code,
				status: error.status,
			});
		}

		return {
			success:
				"If that email has an account, a password reset link is on the way.",
			email,
			next,
		};
	},
	google: async ({ locals, request, url, cookies }) => {
		const formData = await request.formData();
		const next = getSafeAuthNextPath(formData.get("next"));
		redirectToCanonicalAuthPage(request, url, next);
		const redirectTo = getAuthCallbackUrl(request, url);
		const flowId = storeAuthFlowContext(cookies, next, new URL(redirectTo));
		console.info("[auth] Starting Google OAuth", {
			flowId,
			redirectTo,
		});

		const { data, error } = await locals.supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo,
			},
		});

		if (error || !data.url) {
			clearAuthFlowContext(cookies);
			console.warn("[auth] Unable to start Google OAuth", {
				flowId,
				code: error?.code,
				status: error?.status,
			});
			return fail(400, {
				message: "Unable to start Google sign in. Try again.",
				next,
			});
		}

		throw redirect(303, data.url);
	},
};
