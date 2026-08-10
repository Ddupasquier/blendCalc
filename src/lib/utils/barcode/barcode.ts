export const GTIN_LENGTHS = [8, 12, 13, 14] as const;
const GTIN_LENGTH_SET = new Set<number>(GTIN_LENGTHS);
const formatGtinLengths = () => GTIN_LENGTHS.join(", ");
const getGtinLengthHelp = () =>
	`Use a barcode with ${formatGtinLengths()} digits.`;

export const cleanBarcode = (value: string) => value.replace(/[^0-9]/g, "");

export const hasValidGtinCheckDigit = (value: string) => {
	const digits = cleanBarcode(value);
	if (!GTIN_LENGTH_SET.has(digits.length)) return false;

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

export const getBarcodeInputValidationMessage = (value: string) => {
	const digits = cleanBarcode(value);
	if (!digits) return "";

	if (!GTIN_LENGTH_SET.has(digits.length)) {
		const nextLength = GTIN_LENGTHS.find((length) => digits.length < length);
		if (nextLength) {
			const remaining = nextLength - digits.length;
			const digitLabel = remaining === 1 ? "digit" : "digits";
			return `Barcode is incomplete. Enter ${remaining} more ${digitLabel}. ${getGtinLengthHelp()}`;
		}
		return `Barcode is too long. ${getGtinLengthHelp()}`;
	}

	if (!hasValidGtinCheckDigit(digits)) {
		return "Barcode check digit does not look valid. Check the digits before continuing.";
	}

	return "";
};

export const getBarcodeLookupCandidates = (value: string) => {
	const digits = cleanBarcode(value);
	const canonicalValue = normalizeBarcode(digits);
	if (!canonicalValue) return [];

	const candidates = new Set<string>([digits, canonicalValue]);
	let unpadded = canonicalValue;
	while (unpadded.startsWith("0") && unpadded.length > 8) {
		unpadded = unpadded.slice(1);
		if (GTIN_LENGTH_SET.has(unpadded.length) && hasValidGtinCheckDigit(unpadded)) {
			candidates.add(unpadded);
		}
	}

	return [...candidates].sort(
		(left, right) => left.length - right.length || left.localeCompare(right),
	);
};
