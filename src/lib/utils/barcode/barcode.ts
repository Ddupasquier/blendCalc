const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

export const cleanBarcode = (value: string) => value.replace(/[^0-9]/g, "");

export const hasValidGtinCheckDigit = (value: string) => {
	const digits = cleanBarcode(value);
	if (!GTIN_LENGTHS.has(digits.length)) return false;

	const payload = digits.slice(0, -1);
	const suppliedCheckDigit = Number(digits.at(-1));
	const sum = [...payload]
		.reverse()
		.reduce(
			(total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1),
			0,
		);
	const expectedCheckDigit = (10 - (sum % 10)) % 10;

	return suppliedCheckDigit === expectedCheckDigit;
};

export const normalizeBarcode = (value: string) => {
	const digits = cleanBarcode(value);
	if (!hasValidGtinCheckDigit(digits)) return null;
	return digits.padStart(14, "0");
};

export const getBarcodeLookupCandidates = (value: string) => {
	const digits = cleanBarcode(value);
	const canonicalValue = normalizeBarcode(digits);
	if (!canonicalValue) return [];

	const candidates = new Set<string>([digits, canonicalValue]);
	let unpadded = canonicalValue;
	while (unpadded.startsWith("0") && unpadded.length > 8) {
		unpadded = unpadded.slice(1);
		if (GTIN_LENGTHS.has(unpadded.length) && hasValidGtinCheckDigit(unpadded)) {
			candidates.add(unpadded);
		}
	}

	return [...candidates];
};
