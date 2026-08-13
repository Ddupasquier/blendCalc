const AUTHENTICATOR_CODE_SEPARATOR_PATTERN = /[\s\-\u2010-\u2015\u2212]/gu;
const AUTHENTICATOR_CODE_PATTERN = /^\d{6}$/u;

const normalizeCompatibleDigits = (value: string) => value.normalize("NFKC");

export const normalizeAuthenticatorVerificationCode = (
	value: FormDataEntryValue | null,
) => {
	const normalizedCode = normalizeCompatibleDigits(String(value ?? ""))
		.replace(AUTHENTICATOR_CODE_SEPARATOR_PATTERN, "");
	return AUTHENTICATOR_CODE_PATTERN.test(normalizedCode)
		? normalizedCode
		: null;
};
