import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "$env/dynamic/private";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import {
	isLoopbackRuntimeUrl,
	readBlendCalcRuntimeEnvironment,
} from "$lib/server/environment/runtimeEnvironment.server";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

const sha256 = (value: string) =>
	createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

const equalReceipts = (left: string, right: string) => {
	const leftBuffer = Buffer.from(left, "hex");
	const rightBuffer = Buffer.from(right, "hex");
	return (
		leftBuffer.length === rightBuffer.length &&
		timingSafeEqual(leftBuffer, rightBuffer)
	);
};

const isGoogleUser = (user: User) =>
	user.app_metadata?.provider === "google" ||
	user.identities?.some((identity) => identity.provider === "google") === true;

export const claimRehearsalOwnerAfterGoogleSignIn = async ({
	user,
	requestOrigin,
}: {
	user: User;
	requestOrigin: string;
}) => {
	if (readBlendCalcRuntimeEnvironment() !== "rehearsal") return false;
	if (
		!isLoopbackRuntimeUrl(requestOrigin) ||
		new URL(requestOrigin).port !== "5175"
	) {
		throw new Error(
			"Rehearsal owner claiming is limited to the port 5175 runtime.",
		);
	}
	if (!isGoogleUser(user) || !user.email) return false;

	const personaId = env.BLENDCALC_REHEARSAL_OWNER_PERSONA_ID?.trim() ?? "";
	const expectedEmailSha256 =
		env.BLENDCALC_REHEARSAL_OWNER_EMAIL_SHA256?.trim().toLowerCase() ?? "";
	if (
		!UUID_PATTERN.test(personaId) ||
		!SHA256_PATTERN.test(expectedEmailSha256)
	) {
		throw new Error("The Rehearsal owner claim receipt is unavailable.");
	}
	const actualEmailSha256 = sha256(user.email);
	if (!equalReceipts(actualEmailSha256, expectedEmailSha256)) return false;

	const { data, error } = await getSupabaseAdminClient().rpc(
		"claim_rehearsal_owner_persona" as never,
		{
			p_authenticated_user_id: user.id,
			p_email_sha256: actualEmailSha256,
			p_expected_persona_id: personaId,
		} as never,
	);
	if (error) {
		throw new Error(
			"The local Rehearsal owner snapshot could not be claimed.",
			{
				cause: error,
			},
		);
	}
	return data === true;
};
