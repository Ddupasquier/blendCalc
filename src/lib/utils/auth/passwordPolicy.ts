export const PASSWORD_POLICY_VERSION = 1;
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordPolicyIssueCode =
	| "too_short"
	| "too_long"
	| "common"
	| "contains_email";

export type PasswordPolicyIssue = {
	code: PasswordPolicyIssueCode;
	message: string;
};

const commonPasswords = new Set([
	"123456789012345",
	"1234567890123456",
	"adminadminadmin",
	"correcthorsebatterystaple",
	"iloveyouiloveyou",
	"letmeinletmein",
	"passwordpassword",
	"password123456",
	"qwertyqwertyqwerty",
	"smoothiesmoothie",
	"welcome123456789",
]);

const normalizeForComparison = (value: string) => {
	return value.normalize("NFC").toLowerCase();
};

export const getPasswordLength = (password: string) => {
	return Array.from(password.normalize("NFC")).length;
};

export const getPasswordPolicyIssues = (
	password: string,
	email = "",
): PasswordPolicyIssue[] => {
	const issues: PasswordPolicyIssue[] = [];
	const length = getPasswordLength(password);
	const comparablePassword = normalizeForComparison(password);
	const emailName = normalizeForComparison(email.split("@")[0] ?? "");

	if (length < PASSWORD_MIN_LENGTH) {
		issues.push({
			code: "too_short",
			message: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
		});
	}

	if (length > PASSWORD_MAX_LENGTH) {
		issues.push({
			code: "too_long",
			message: `Use no more than ${PASSWORD_MAX_LENGTH} characters.`,
		});
	}

	if (commonPasswords.has(comparablePassword)) {
		issues.push({
			code: "common",
			message: "Choose a password that is not commonly used.",
		});
	}

	if (emailName.length >= 4 && comparablePassword.includes(emailName)) {
		issues.push({
			code: "contains_email",
			message: "Do not include the name from your email address.",
		});
	}

	return issues;
};

export const isPasswordPolicyCompliant = (password: string, email = "") => {
	return getPasswordPolicyIssues(password, email).length === 0;
};

export const getPasswordValidationMessage = (
	password: string,
	confirmation: string,
	email = "",
) => {
	const [firstIssue] = getPasswordPolicyIssues(password, email);
	if (firstIssue) return firstIssue.message;
	if (password !== confirmation) return "Passwords do not match.";
	return "";
};
