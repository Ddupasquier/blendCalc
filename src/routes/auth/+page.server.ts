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
import {
	getPasswordValidationMessage,
	isPasswordPolicyCompliant,
	PASSWORD_POLICY_VERSION,
} from "$lib/utils/auth/passwordPolicy";
import {
	clearPasswordUpgrade,
	requirePasswordUpgrade,
} from "$lib/utils/auth/passwordUpgrade";

const getEmailAuthFields = async (request: Request) => {
	const formData = await request.formData();
	const email = String(formData.get("email") ?? "").trim().toLowerCase();
	const password = String(formData.get("password") ?? "");
	const passwordConfirmation = String(
		formData.get("passwordConfirmation") ?? "",
	);
	const next = getSafeAuthNextPath(formData.get("next"));

	return { email, password, passwordConfirmation, next };
};

const getEmailField = async (request: Request) => {
	const formData = await request.formData();
	return {
		email: String(formData.get("email") ?? "").trim().toLowerCase(),
		next: getSafeAuthNextPath(formData.get("next")),
	};
};

const getEmailValidationError = (email: string) => {
	if (!email) return "Enter your email address.";
	if (!email.includes("@")) return "Enter a valid email address.";
	return "";
};

const getEmailSignInValidationError = (email: string, password: string) => {
	const emailError = getEmailValidationError(email);
	if (emailError) return emailError;
	if (!password) return "Enter your password.";
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
	emailSignIn: async ({ locals, request, url, cookies }) => {
		const { email, password, next } = await getEmailAuthFields(request);
		redirectToCanonicalAuthPage(request, url, next);
		const validationError = getEmailSignInValidationError(email, password);

		if (validationError) {
			return fail(400, {
				message: validationError,
				email,
				next,
				mode: "signIn" as const,
			});
		}

		const { data, error } = await locals.supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			return fail(400, {
				message: "Email or password was not accepted.",
				email,
				next,
				mode: "signIn" as const,
			});
		}

		if (!isPasswordPolicyCompliant(password, email)) {
			requirePasswordUpgrade(cookies, next, url.protocol === "https:");
			throw redirect(
				303,
				`/auth/update-password?reason=policy&next=${encodeURIComponent(next)}`,
			);
		}

		clearPasswordUpgrade(cookies);
		if (data.user?.user_metadata.password_policy_version !== PASSWORD_POLICY_VERSION) {
			const { error: metadataError } = await locals.supabase.auth.updateUser({
				data: {
					...data.user?.user_metadata,
					password_policy_version: PASSWORD_POLICY_VERSION,
				},
			});
			if (metadataError) {
				console.warn("[auth] Unable to record password policy version", {
					code: metadataError.code,
					status: metadataError.status,
				});
			}
		}

		throw redirect(303, next);
	},
	emailSignUp: async ({ locals, request, url, cookies }) => {
		const { email, password, passwordConfirmation, next } =
			await getEmailAuthFields(request);
		redirectToCanonicalAuthPage(request, url, next);
		const validationError =
			getEmailValidationError(email) ||
			getPasswordValidationMessage(password, passwordConfirmation, email);

		if (validationError) {
			return fail(400, {
				message: validationError,
				email,
				next,
				mode: "signUp" as const,
			});
		}

		const callbackUrl = getAuthCallbackUrl(request, url);
		const redirectTo = addNextToCallbackUrl(callbackUrl, next);
		const flowId = storeAuthFlowContext(cookies, next, new URL(redirectTo));
		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					password_policy_version: PASSWORD_POLICY_VERSION,
				},
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
				message:
					error.code === "weak_password"
						? "That password was rejected as too weak. Choose a longer, unique passphrase."
						: "Unable to create that account. Try again in a moment.",
				email,
				next,
				mode: "signUp" as const,
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
			mode: "signIn" as const,
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
