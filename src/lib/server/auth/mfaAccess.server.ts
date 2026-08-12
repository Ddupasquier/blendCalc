import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "@sveltejs/kit";
import { throwAppError } from "$lib/server/errors/appError.server";
import type { Database } from "$lib/types/database.types";
import { getSafeAuthNextPath } from "$lib/utils/auth/authFlow";
import type { VerifiedAuthUser } from "$lib/utils/auth/types";

export type MfaAuthenticatorLevel = "aal1" | "aal2" | null;

export type VerifiedTotpFactor = {
	id: string;
	friendlyName: string | null;
	createdAt: string;
	updatedAt: string;
};

export type MfaSecurityStatus = {
	currentLevel: MfaAuthenticatorLevel;
	nextLevel: MfaAuthenticatorLevel;
	verifiedTotpFactors: VerifiedTotpFactor[];
};

export type MfaAuthenticatedUserContext = {
	user: VerifiedAuthUser;
	status: MfaSecurityStatus;
};

const normalizeAuthenticatorLevel = (
	value: string | null,
): MfaAuthenticatorLevel =>
	value === "aal1" || value === "aal2" ? value : null;

export const readMfaSecurityStatus = async (
	supabase: SupabaseClient<Database>,
): Promise<MfaSecurityStatus> => {
	const [assuranceResult, factorsResult] = await Promise.all([
		supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
		supabase.auth.mfa.listFactors(),
	]);

	if (assuranceResult.error) throw assuranceResult.error;
	if (factorsResult.error) throw factorsResult.error;

	return {
		currentLevel: normalizeAuthenticatorLevel(
			assuranceResult.data.currentLevel,
		),
		nextLevel: normalizeAuthenticatorLevel(assuranceResult.data.nextLevel),
		verifiedTotpFactors: factorsResult.data.totp.map((factor) => ({
			id: factor.id,
			friendlyName: factor.friendly_name ?? null,
			createdAt: factor.created_at,
			updatedAt: factor.updated_at,
		})),
	};
};

export const getMfaVerificationRoute = (
	status: MfaSecurityStatus,
	next: string,
) => {
	const route = status.verifiedTotpFactors.length > 0
		? "/auth/mfa/challenge"
		: "/auth/mfa/enroll";
	return `${route}?next=${encodeURIComponent(getSafeAuthNextPath(next))}`;
};

export const requireMfaAuthenticatedUser = async (
	locals: App.Locals,
	next: string,
): Promise<MfaAuthenticatedUserContext> => {
	const safeNext = getSafeAuthNextPath(next);
	const user = await locals.getVerifiedUser();
	if (!user) {
		throw redirect(303, `/auth?next=${encodeURIComponent(safeNext)}`);
	}

	return {
		user,
		status: await readMfaSecurityStatus(locals.supabase),
	};
};

export const requireElevatedAuthenticatorAssuranceForPage = async (
	supabase: SupabaseClient<Database>,
	returnPath: string,
) => {
	const status = await readMfaSecurityStatus(supabase);
	if (status.currentLevel === "aal2") return status;
	throw redirect(303, getMfaVerificationRoute(status, returnPath));
};

export const requireElevatedAuthenticatorAssuranceForApi = async (
	supabase: SupabaseClient<Database>,
) => {
	const status = await readMfaSecurityStatus(supabase);
	if (status.currentLevel !== "aal2") {
		throwAppError(403, "MFA_REQUIRED");
	}
	return status;
};
