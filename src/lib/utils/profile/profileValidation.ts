export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 80;
export const PROFILE_BIO_MAX_LENGTH = 300;
export const PROFILE_AVATAR_ALT_TEXT_MAX_LENGTH = 160;
export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const PROFILE_AVATAR_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

export type ProfileAvatarType = (typeof PROFILE_AVATAR_TYPES)[number];

export const normalizeOptionalProfileText = (value: FormDataEntryValue | null) => {
	const normalized = String(value ?? "").trim();
	return normalized || null;
};

export const getDefaultDisplayName = (email: string | null | undefined) => {
	return (email?.split("@")[0] ?? "").trim().slice(0, PROFILE_DISPLAY_NAME_MAX_LENGTH) || "Smoothie user";
};

export const getProfileValidationError = ({
	displayName,
	bio,
}: {
	displayName: string | null;
	bio: string | null;
}) => {
	if (!displayName) return "Enter your preferred name before saving your profile.";
	if (displayName.length > PROFILE_DISPLAY_NAME_MAX_LENGTH) {
		return `Display name must be ${PROFILE_DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
	}
	if (bio && bio.length > PROFILE_BIO_MAX_LENGTH) {
		return `Bio must be ${PROFILE_BIO_MAX_LENGTH} characters or fewer.`;
	}
	return "";
};

const startsWithBytes = (bytes: Uint8Array, expected: number[]) => {
	return expected.every((value, index) => bytes[index] === value);
};

export const matchesAvatarFileSignature = (
	bytes: Uint8Array,
	type: ProfileAvatarType,
) => {
	if (type === "image/jpeg") return startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
	if (type === "image/png") {
		return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	}
	return (
		startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	);
};

export const getAvatarExtension = (type: ProfileAvatarType) => {
	if (type === "image/jpeg") return "jpg";
	if (type === "image/png") return "png";
	return "webp";
};

export const isProfileAvatarType = (type: string): type is ProfileAvatarType => {
	return PROFILE_AVATAR_TYPES.includes(type as ProfileAvatarType);
};
