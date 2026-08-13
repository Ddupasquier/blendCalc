import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { requireMfaAuthenticatedUser } from "$lib/server/auth/mfaAccess.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import { getSafeAuthNextPath } from "$lib/utils/auth/authFlow";
import { normalizeAuthenticatorVerificationCode } from "$lib/utils/auth/authenticatorVerificationCode";

const MFA_FORM_MAX_BYTES = 8 * 1024;
const readNext = (url: URL, formData?: FormData) => {
	const submittedNext = formData?.get("next");
	return getSafeAuthNextPath(
		typeof submittedNext === "string"
			? submittedNext
			: url.searchParams.get("next"),
	);
};

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ "cache-control": "private, no-store" });
	const next = readNext(url);
	const { status } = await requireMfaAuthenticatedUser(locals, next);

	if (status.currentLevel === "aal2") throw redirect(303, next);
	if (status.verifiedTotpFactors.length === 0) {
		throw redirect(303, `/auth/mfa/enroll?next=${encodeURIComponent(next)}`);
	}

	return {
		next,
		factorId: status.verifiedTotpFactors[0].id,
		factorName: status.verifiedTotpFactors[0].friendlyName,
	};
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const formData = await readLimitedFormData(request, MFA_FORM_MAX_BYTES);
		const next = readNext(url, formData);
		const { status } = await requireMfaAuthenticatedUser(locals, next);
		const code = normalizeAuthenticatorVerificationCode(formData.get("code"));
		const factorId = String(formData.get("factorId") ?? "").trim();
		const verifiedFactor = status.verifiedTotpFactors.find(
			(factor) => factor.id === factorId,
		);

		if (!verifiedFactor || !code) {
			return fail(400, {
				message: "Enter the six-digit code from your authenticator app.",
				next,
			});
		}

		const result = await locals.supabase.auth.mfa.challengeAndVerify({
			factorId: verifiedFactor.id,
			code,
		});
		if (result.error) {
			return fail(400, {
				message: "That code didn’t match. Wait for a fresh code, make sure your device time is automatic, and try again.",
				next,
			});
		}

		throw redirect(303, next);
	},
};
