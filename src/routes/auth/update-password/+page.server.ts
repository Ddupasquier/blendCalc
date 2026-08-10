import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { getSafeAuthNextPath } from "$lib/utils/auth/authFlow";
import {
	getPasswordValidationMessage,
	PASSWORD_POLICY_VERSION,
} from "$lib/utils/auth/passwordPolicy";
import { clearPasswordUpgrade } from "$lib/utils/auth/passwordUpgrade";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";

const PASSWORD_UPDATE_FORM_MAX_BYTES = 32 * 1024;

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) throw redirect(303, "/auth?error=recovery_session");
	return {
		email: user.email ?? "",
		next: getSafeAuthNextPath(url.searchParams.get("next")),
		reason: url.searchParams.get("reason") === "policy" ? "policy" : "recovery",
	};
};

export const actions: Actions = {
	default: async ({ locals, request, cookies }) => {
		const formData = await readLimitedFormData(
			request,
			PASSWORD_UPDATE_FORM_MAX_BYTES,
		);
		const password = String(formData.get("password") ?? "");
		const confirmation = String(formData.get("passwordConfirmation") ?? "");
		const next = getSafeAuthNextPath(formData.get("next"));
		const user = await locals.getVerifiedUser();
		if (!user) throw redirect(303, "/auth?error=recovery_session");

		const validationError = getPasswordValidationMessage(
			password,
			confirmation,
			user.email ?? "",
		);
		if (validationError) {
			return fail(400, {
				message: validationError,
				next,
			});
		}

		const { error } = await locals.supabase.auth.updateUser({
			password,
			data: {
				...user.user_metadata,
				password_policy_version: PASSWORD_POLICY_VERSION,
			},
		});
		if (error) {
			console.warn("[auth] Password update failed", {
				code: error.code,
				status: error.status,
			});
			return fail(400, {
				message:
					error.code === "same_password"
						? "Choose a password that is different from your current password."
						: error.code === "weak_password"
							? "That password was rejected as too weak. Choose a longer, unique passphrase."
							: "Unable to update your password. Request a new reset link.",
				next,
			});
		}

		clearPasswordUpgrade(cookies);
		throw redirect(303, next);
	},
};
