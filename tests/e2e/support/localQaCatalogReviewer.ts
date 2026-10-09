import { randomUUID } from "node:crypto";
import { CURRENT_TUTORIAL_VERSION } from "../../../src/lib/utils/tutorial/tutorial";
import { createLocalQaServiceRoleDatabaseClient } from "./localQaDatabase";

/** A normal Auth/MFA reviewer owned only by this local browser scenario. */
export const createLocalQaCatalogReviewer = async () => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const email = `qa-catalog-${randomUUID()}@blendcalc.local`;
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password: process.env.PLAYWRIGHT_QA_PASSWORD ?? "BlendCalc-Local-QA-2026!",
		email_confirm: true,
	});
	if (error || !data.user)
		throw new Error("Could not create the local reviewer.");
	const userId = data.user.id;
	try {
		const role = await admin.rpc("set_app_user_role", {
			p_target_user_id: userId,
			p_role: "moderator",
			p_reason_code: "local_test_fixture",
			p_internal_note: "Owned catalog browser reviewer fixture.",
		});
		if (role.error) throw new Error("Could not grant local review permission.");
		const tutorial = await admin.from("user_tutorial_preferences").upsert({
			user_id: userId,
			tutorial_version: CURRENT_TUTORIAL_VERSION,
			do_not_show_again: true,
		});
		if (tutorial.error)
			throw new Error("Could not prepare local review onboarding.");
	} catch (error) {
		await admin.auth.admin.deleteUser(userId);
		throw error;
	}

	return {
		email,
		async cleanup() {
			// Role audit and immutable decisions retain their actual reviewer.
			// Revoke access, ban sign-in and remove its factor without erasing history.
			const role = await admin.rpc("set_app_user_role", {
				p_target_user_id: userId,
				p_role: "user",
				p_reason_code: "local_test_fixture",
				p_internal_note: "Owned catalog browser reviewer retired.",
			});
			if (role.error)
				throw new Error("Could not retire local review permission.");
			const banned = await admin.auth.admin.updateUserById(userId, {
				ban_duration: "876000h",
			});
			if (banned.error)
				throw new Error("Could not disable local reviewer sign-in.");
			const factors = await admin.auth.admin.mfa.listFactors({ userId });
			if (factors.error)
				throw new Error("Could not inspect local review factors.");
			for (const factor of factors.data.factors) {
				const removed = await admin.auth.admin.mfa.deleteFactor({
					userId,
					id: factor.id,
				});
				if (removed.error)
					throw new Error("Could not remove a local review factor.");
			}
		},
	};
};
