import { createHash, randomUUID } from "node:crypto";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import {
	PROFILE_AVATAR_POLICY_ITEMS,
	PROFILE_AVATAR_POLICY_VERSION,
	PROFILE_AVATAR_REQUIRE_HUMAN_FACE,
} from "$lib/utils/profile/avatarPolicy";
import {
	getSignedAvatarUrl,
	getUserProfile,
	PROFILE_AVATAR_BUCKET,
} from "$lib/utils/profile/profile";
import {
	getAvatarExtension,
	getDefaultDisplayName,
	getProfileValidationError,
	isProfileAvatarType,
	matchesAvatarFileSignature,
	normalizeOptionalProfileText,
	PROFILE_AVATAR_ALT_TEXT_MAX_LENGTH,
	PROFILE_AVATAR_MAX_BYTES,
} from "$lib/utils/profile/profileValidation";

const getAuthenticatedUser = async (locals: App.Locals) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw redirect(303, "/auth?next=%2Fprofile");
	return user;
};

const getProfileFormValues = (formData: FormData) => {
	return {
		displayName: normalizeOptionalProfileText(formData.get("displayName")),
		bio: normalizeOptionalProfileText(formData.get("bio")),
	};
};

export const load: PageServerLoad = async ({ locals }) => {
	const user = await getAuthenticatedUser(locals);
	const profile = await getUserProfile(locals.supabase, user.id);
	const avatarUrl = await getSignedAvatarUrl(locals.supabase, profile?.avatar_path);

	return {
		profile,
		avatarUrl,
		defaultDisplayName: getDefaultDisplayName(user.email),
		avatarPolicyItems: PROFILE_AVATAR_POLICY_ITEMS,
		requireHumanFace: PROFILE_AVATAR_REQUIRE_HUMAN_FACE,
	};
};

export const actions: Actions = {
	saveProfile: async ({ locals, request }) => {
		const user = await getAuthenticatedUser(locals);
		const values = getProfileFormValues(await request.formData());
		const validationError = getProfileValidationError(values);

		if (validationError) {
			return fail(400, { profileError: validationError, profileValues: values });
		}

		const existingProfile = await getUserProfile(locals.supabase, user.id);
		if (
			existingProfile?.display_name === values.displayName &&
			(existingProfile.bio ?? null) === values.bio
		) {
			return {
				profileSuccess: "Your profile already has these details.",
				profileValues: values,
			};
		}

		const { error } = await locals.supabase.from("profiles").upsert(
			{
				user_id: user.id,
				display_name: values.displayName,
				bio: values.bio,
			},
			{ onConflict: "user_id" },
		);

		if (error) {
			return fail(500, {
				profileError: "Profile changes could not be saved. Try again.",
				profileValues: values,
			});
		}

		return { profileSuccess: "Profile saved." };
	},
	uploadAvatar: async ({ locals, request }) => {
		const user = await getAuthenticatedUser(locals);
		const formData = await request.formData();
		const avatar = formData.get("avatar");
		const altText = normalizeOptionalProfileText(formData.get("avatarAltText"));
		const policyAccepted = formData.get("avatarPolicyAccepted") === "on";
		const faceConfirmed = formData.get("avatarHasHumanFace") === "on";

		if (!(avatar instanceof File) || avatar.size === 0) {
			return fail(400, { avatarError: "Choose an image to upload." });
		}
		if (!isProfileAvatarType(avatar.type)) {
			return fail(400, { avatarError: "Use a JPEG, PNG, or WebP image." });
		}
		if (avatar.size > PROFILE_AVATAR_MAX_BYTES) {
			return fail(400, { avatarError: "Profile images must be 5 MB or smaller." });
		}
		if (altText && altText.length > PROFILE_AVATAR_ALT_TEXT_MAX_LENGTH) {
			return fail(400, {
				avatarError: `Image description must be ${PROFILE_AVATAR_ALT_TEXT_MAX_LENGTH} characters or fewer.`,
			});
		}
		if (!policyAccepted) {
			return fail(400, {
				avatarError: "Confirm that the image follows the profile image rules.",
			});
		}
		if (PROFILE_AVATAR_REQUIRE_HUMAN_FACE && !faceConfirmed) {
			return fail(400, {
				avatarError: "Confirm that the image contains a recognizable human face.",
			});
		}

		const bytes = new Uint8Array(await avatar.arrayBuffer());
		if (!matchesAvatarFileSignature(bytes, avatar.type)) {
			return fail(400, {
				avatarError: "The selected file does not match its reported image type.",
			});
		}

		const existingProfile = await getUserProfile(locals.supabase, user.id);
		const avatarPath = `${user.id}/avatar-${randomUUID()}.${getAvatarExtension(avatar.type)}`;
		const fileSha256 = createHash("sha256").update(bytes).digest("hex");

		if (existingProfile?.avatar_path) {
			const { data: existingAcceptance, error: acceptanceLookupError } =
				await locals.supabase
					.from("profile_image_policy_acceptances")
					.select("id")
					.eq("user_id", user.id)
					.eq("avatar_path", existingProfile.avatar_path)
					.eq("file_sha256", fileSha256)
					.maybeSingle();

			if (acceptanceLookupError) {
				return fail(500, {
					avatarError: "The current profile image could not be checked. Try again.",
				});
			}
			if (existingAcceptance) {
				return fail(409, {
					avatarError: "That image is already your profile image.",
				});
			}
		}

		const { error: uploadError } = await locals.supabase.storage
			.from(PROFILE_AVATAR_BUCKET)
			.upload(avatarPath, bytes, {
				contentType: avatar.type,
				cacheControl: "3600",
				upsert: false,
			});

		if (uploadError) {
			return fail(500, { avatarError: "The image could not be uploaded. Try again." });
		}

		const { error: acceptanceError } = await locals.supabase
			.from("profile_image_policy_acceptances")
			.insert({
				user_id: user.id,
				avatar_path: avatarPath,
				file_sha256: fileSha256,
				policy_version: PROFILE_AVATAR_POLICY_VERSION,
				policy_items: [...PROFILE_AVATAR_POLICY_ITEMS],
			});

		if (acceptanceError) {
			await locals.supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([avatarPath]);
			return fail(500, {
				avatarError: "Your policy confirmation could not be recorded. Try again.",
			});
		}

		const { error: profileError } = await locals.supabase.from("profiles").upsert(
			{
				user_id: user.id,
				avatar_path: avatarPath,
				avatar_alt_text: altText,
				avatar_moderation_status: "self_attested",
				avatar_policy_acknowledged_at: new Date().toISOString(),
			},
			{ onConflict: "user_id" },
		);

		if (profileError) {
			await locals.supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([avatarPath]);
			return fail(500, { avatarError: "The profile image could not be saved. Try again." });
		}

		if (existingProfile?.avatar_path) {
			await locals.supabase.storage
				.from(PROFILE_AVATAR_BUCKET)
				.remove([existingProfile.avatar_path]);
		}

		return { avatarSuccess: "Profile image updated." };
	},
	removeAvatar: async ({ locals }) => {
		const user = await getAuthenticatedUser(locals);
		const profile = await getUserProfile(locals.supabase, user.id);
		if (!profile?.avatar_path) return { avatarSuccess: "No profile image to remove." };

		const { error } = await locals.supabase
			.from("profiles")
			.update({
				avatar_path: null,
				avatar_alt_text: null,
				avatar_moderation_status: "none",
				avatar_policy_acknowledged_at: null,
			})
			.eq("user_id", user.id);

		if (error) {
			return fail(500, { avatarError: "The profile image could not be removed." });
		}

		await locals.supabase.storage
			.from(PROFILE_AVATAR_BUCKET)
			.remove([profile.avatar_path]);

		return { avatarSuccess: "Profile image removed." };
	},
};
