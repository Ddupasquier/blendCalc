/**
 * Purpose: Validate GTIN check digits, normalize barcode lengths, generate safe lookup
 * candidates, and stop at the first exact candidate match. This is a shared module.
 * Do not run directly; it is imported by barcode audit, seed, and backfill workflows.
 */

export const GTIN_LENGTHS = [8, 12, 13, 14];
const GTIN_LENGTH_SET = new Set(GTIN_LENGTHS);

export const cleanBarcode = (value) =>
	String(value ?? "").replace(/[^0-9]/g, "");

export const hasValidGtinCheckDigit = (value) => {
	const digits = cleanBarcode(value);
	if (!GTIN_LENGTH_SET.has(digits.length)) return false;

	const payload = digits.slice(0, -1);
	const suppliedCheckDigit = Number(digits.at(-1));
	const sum = [...payload]
		.reverse()
		.reduce(
			(total, digit, index) =>
				total + Number(digit) * (index % 2 === 0 ? 3 : 1),
			0,
		);
	const expectedCheckDigit = (10 - (sum % 10)) % 10;

	return suppliedCheckDigit === expectedCheckDigit;
};

export const normalizeBarcode = (value) => {
	const digits = cleanBarcode(value);
	if (!hasValidGtinCheckDigit(digits)) return null;
	return digits.padStart(14, "0");
};

export const getBarcodeLookupCandidates = (value) => {
	const digits = cleanBarcode(value);
	const canonicalValue = normalizeBarcode(digits);
	if (!canonicalValue) return [];

	const candidates = new Set([digits, canonicalValue]);
	let unpadded = canonicalValue;
	while (unpadded.startsWith("0") && unpadded.length > 8) {
		unpadded = unpadded.slice(1);
		if (
			GTIN_LENGTH_SET.has(unpadded.length)
			&& hasValidGtinCheckDigit(unpadded)
		) {
			candidates.add(unpadded);
		}
	}

	return [...candidates].sort(
		(left, right) => left.length - right.length || left.localeCompare(right),
	);
};

export const findFirstBarcodeCandidateMatch = async (
	barcode,
	lookupCandidate,
) => {
	for (const candidate of getBarcodeLookupCandidates(barcode)) {
		const value = await lookupCandidate(candidate);
		if (value !== null) return { candidate, value };
	}

	return null;
};
