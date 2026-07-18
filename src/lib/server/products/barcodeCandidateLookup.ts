import { getBarcodeLookupCandidates } from "$lib/utils/barcode/barcode";

export type BarcodeCandidateMatch<T> = {
	candidate: string;
	value: T;
};

export const findFirstBarcodeCandidateMatch = async <T>(
	barcode: string,
	lookupCandidate: (candidate: string) => Promise<T | null>,
): Promise<BarcodeCandidateMatch<T> | null> => {
	for (const candidate of getBarcodeLookupCandidates(barcode)) {
		const value = await lookupCandidate(candidate);
		if (value !== null) return { candidate, value };
	}

	return null;
};
