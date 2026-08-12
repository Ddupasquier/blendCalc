import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { requireMfaAuthenticatedUser } from "$lib/server/auth/mfaAccess.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import { getSafeAuthNextPath } from "$lib/utils/auth/authFlow";

const MFA_FORM_MAX_BYTES = 8 * 1024;

const createQrCodeDataUrl = (svg: string) =>
	`data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`;

const readNext = (url: URL) => getSafeAuthNextPath(url.searchParams.get("next"));

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ "cache-control": "private, no-store" });
	const next = readNext(url);
	const { status } = await requireMfaAuthenticatedUser(locals, next);

	if (status.currentLevel === "aal2") throw redirect(303, next);
	if (status.verifiedTotpFactors.length > 0) {
		throw redirect(
			303,
			`/auth/mfa/challenge?next=${encodeURIComponent(next)}`,
		);
	}

	return { next };
};

export const actions: Actions = {
	beginEnrollment: async ({ locals, request, url }) => {
		const next = readNext(url);
		await requireMfaAuthenticatedUser(locals, next);
		await readLimitedFormData(request, MFA_FORM_MAX_BYTES);

		const factorsResult = await locals.supabase.auth.mfa.listFactors();
		if (factorsResult.error) {
			return fail(503, {
				message: "We couldn’t start authenticator setup. Try again in a moment.",
				next,
			});
		}

		for (const factor of factorsResult.data.all) {
			if (factor.factor_type === "totp" && factor.status === "unverified") {
				await locals.supabase.auth.mfa.unenroll({ factorId: factor.id });
			}
		}

		const enrollmentResult = await locals.supabase.auth.mfa.enroll({
			factorType: "totp",
			friendlyName: "blendCalc authenticator",
			issuer: "blendCalc",
		});

		if (enrollmentResult.error) {
			return fail(400, {
				message: "We couldn’t start authenticator setup. Try again in a moment.",
				next,
			});
		}

		return {
			next,
			enrollment: {
				factorId: enrollmentResult.data.id,
				qrCodeDataUrl: createQrCodeDataUrl(
					enrollmentResult.data.totp.qr_code,
				),
				secret: enrollmentResult.data.totp.secret,
			},
		};
	},
	verifyEnrollment: async ({ locals, request, url }) => {
		const next = readNext(url);
		await requireMfaAuthenticatedUser(locals, next);
		const formData = await readLimitedFormData(request, MFA_FORM_MAX_BYTES);
		const factorId = String(formData.get("factorId") ?? "").trim();
		const code = String(formData.get("code") ?? "").replace(/\s/g, "");

		if (!factorId || !/^\d{6}$/.test(code)) {
			return fail(400, {
				message: "Enter the six-digit code from your authenticator app.",
				next,
			});
		}

		const factorsResult = await locals.supabase.auth.mfa.listFactors();
		const factorExists = factorsResult.data?.all.some(
			(factor) => factor.id === factorId && factor.factor_type === "totp",
		);
		if (factorsResult.error || !factorExists) {
			return fail(400, {
				message: "That setup session expired. Start authenticator setup again.",
				next,
			});
		}

		const verificationResult = await locals.supabase.auth.mfa.challengeAndVerify({
			factorId,
			code,
		});
		if (verificationResult.error) {
			return fail(400, {
				message: "That code wasn’t accepted. Check your authenticator and try again.",
				next,
			});
		}

		throw redirect(303, next);
	},
};
