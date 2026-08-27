import { createHash, randomUUID } from "node:crypto";
import { fail, type RequestEvent } from "@sveltejs/kit";
import {
	clearCurrentUserProfileImage,
	saveCurrentUserProfileImage,
	saveCurrentUserProfileImageDescription,
} from "$lib/server/profile/profileOwnerSettings.server";
import { getAppIssueMessage } from "$lib/utils/errors/appIssues";
import {
	PROFILE_AVATAR_POLICY_ITEMS,
	PROFILE_AVATAR_POLICY_VERSION,
	PROFILE_AVATAR_REQUIRE_HUMAN_FACE,
} from "$lib/utils/profile/avatarPolicy";
import {
	getUserProfile,
	PROFILE_AVATAR_BUCKET,
} from "$lib/utils/profile/profile";
import {
	isProfileAvatarType,
	matchesAvatarFileSignature,
	normalizeOptionalProfileText,
	PROFILE_AVATAR_ALT_TEXT_MAX_LENGTH,
	PROFILE_AVATAR_MAX_BYTES,
} from "$lib/utils/profile/profileValidation";
import { consumeRequestRateLimit } from "$lib/server/security/requestRateLimit.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeImageUpload } from "$lib/server/uploads/normalizeImageUpload.server";
import { requireAuthenticatedProfileUser } from "./profileActionAuthentication.server";

const PROFILE_AVATAR_FORM_MAX_BYTES = PROFILE_AVATAR_MAX_BYTES + 1024 * 1024;
const PROFILE_AVATAR_MAX_DIMENSION = 2048;
const PROFILE_IMAGE_DESCRIPTION_FORM_MAX_BYTES = 64 * 1024;

type ProfileImageUploadActionEvent = Pick<RequestEvent, "locals" | "request">;
type ProfileImageRemovalActionEvent = Pick<RequestEvent, "locals">;

export const uploadProfileImage = async ({
	locals,
	request,
}: ProfileImageUploadActionEvent) => {
	const user = await requireAuthenticatedProfileUser(locals);
	try {
		const rateLimit = await consumeRequestRateLimit({
			policy: {
				scope: "profile:avatar-upload",
				limit: 20,
				windowSeconds: 3600,
			},
			subject: `user:${user.id}`,
		});
		if (!rateLimit.allowed) {
			return fail(429, {
				avatarError: getAppIssueMessage("RATE_LIMITED"),
			});
		}
	} catch {
		return fail(503, {
			avatarError: getAppIssueMessage("SERVICE_UNAVAILABLE"),
		});
	}
	const formData = await readLimitedFormData(
		request,
		PROFILE_AVATAR_FORM_MAX_BYTES,
	);
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
		return fail(400, {
			avatarError: "Profile images must be 5 MB or smaller.",
		});
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
	let normalizedAvatar;
	try {
		normalizedAvatar = await normalizeImageUpload({
			bytes,
			maximumOutputBytes: PROFILE_AVATAR_MAX_BYTES,
			maximumWidth: PROFILE_AVATAR_MAX_DIMENSION,
			maximumHeight: PROFILE_AVATAR_MAX_DIMENSION,
		});
	} catch {
		return fail(400, {
			avatarError:
				"We couldn’t read that image. Choose another JPEG, PNG, or WebP file.",
		});
	}

	const existingProfile = await getUserProfile(locals.supabase, user.id);
	const admin = getSupabaseAdminClient();
	const avatarPath = `${user.id}/avatar-${randomUUID()}.${normalizedAvatar.extension}`;
	const fileSha256 = createHash("sha256")
		.update(normalizedAvatar.bytes)
		.digest("hex");

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
				avatarError:
					"The current profile image could not be checked. Try again.",
			});
		}
		if (existingAcceptance) {
			return fail(409, {
				avatarError: "That image is already your profile image.",
			});
		}
	}

	const { error: uploadError } = await admin.storage
		.from(PROFILE_AVATAR_BUCKET)
		.upload(avatarPath, normalizedAvatar.bytes, {
			contentType: normalizedAvatar.contentType,
			cacheControl: "3600",
			upsert: false,
		});

	if (uploadError) {
		return fail(500, {
			avatarError: "The image could not be uploaded. Try again.",
		});
	}

	const { error: acceptanceError } = await admin
		.from("profile_image_policy_acceptances")
		.insert({
			user_id: user.id,
			avatar_path: avatarPath,
			file_sha256: fileSha256,
			policy_version: PROFILE_AVATAR_POLICY_VERSION,
			policy_items: [...PROFILE_AVATAR_POLICY_ITEMS],
		});

	if (acceptanceError) {
		await admin.storage.from(PROFILE_AVATAR_BUCKET).remove([avatarPath]);
		return fail(500, {
			avatarError: "Your policy confirmation could not be recorded. Try again.",
		});
	}

	const { error: profileError } = await saveCurrentUserProfileImage(
		locals.supabase,
		{
			avatarPath,
			avatarAltText: altText,
			policyVersion: PROFILE_AVATAR_POLICY_VERSION,
		},
	);

	if (profileError) {
		await admin
			.from("profile_image_policy_acceptances")
			.delete()
			.eq("user_id", user.id)
			.eq("avatar_path", avatarPath);
		await admin.storage.from(PROFILE_AVATAR_BUCKET).remove([avatarPath]);
		return fail(500, {
			avatarError: "The profile image could not be saved. Try again.",
		});
	}

	if (existingProfile?.avatar_path) {
		await admin.storage
			.from(PROFILE_AVATAR_BUCKET)
			.remove([existingProfile.avatar_path]);
	}

	return { avatarSuccess: "Profile image updated." };
};

export const saveProfileImageDescription = async ({
	locals,
	request,
}: ProfileImageUploadActionEvent) => {
	const user = await requireAuthenticatedProfileUser(locals);
	const profile = await getUserProfile(locals.supabase, user.id);
	if (!profile?.avatar_path) {
		return fail(409, {
			avatarError: "Add a profile image before saving its description.",
		});
	}

	const formData = await readLimitedFormData(
		request,
		PROFILE_IMAGE_DESCRIPTION_FORM_MAX_BYTES,
	);
	const altText = normalizeOptionalProfileText(formData.get("avatarAltText"));
	if (altText && altText.length > PROFILE_AVATAR_ALT_TEXT_MAX_LENGTH) {
		return fail(400, {
			avatarError: `Image description must be ${PROFILE_AVATAR_ALT_TEXT_MAX_LENGTH} characters or fewer.`,
			avatarAltText: altText,
		});
	}

	const { data: saved, error } = await saveCurrentUserProfileImageDescription(
		locals.supabase,
		{
			expectedAvatarPath: profile.avatar_path,
			avatarAltText: altText,
		},
	);
	if (error || !saved) {
		return fail(error ? 500 : 409, {
			avatarError: error
				? "The image description could not be saved. Try again."
				: "The profile image changed before its description was saved. Try again.",
			avatarAltText: altText,
		});
	}

	return { avatarSuccess: "Image description saved." };
};

export const removeProfileImage = async ({
	locals,
}: ProfileImageRemovalActionEvent) => {
	const user = await requireAuthenticatedProfileUser(locals);
	const profile = await getUserProfile(locals.supabase, user.id);
	if (!profile?.avatar_path) {
		return { avatarSuccess: "No profile image to remove." };
	}

	const { data: removed, error } = await clearCurrentUserProfileImage(
		locals.supabase,
		profile.avatar_path,
	);

	if (error || !removed) {
		return fail(500, {
			avatarError: error
				? "The profile image could not be removed."
				: "The profile image changed before it could be removed. Try again.",
		});
	}

	await getSupabaseAdminClient()
		.storage.from(PROFILE_AVATAR_BUCKET)
		.remove([profile.avatar_path]);

	return { avatarSuccess: "Profile image removed." };
};
