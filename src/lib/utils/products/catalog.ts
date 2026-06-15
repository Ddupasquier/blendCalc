import type { FdcFood } from "$lib/utils/food/types";

export type SharedProductSubmissionStatus =
	| "already-available"
	| "approved"
	| "pending";

export type SharedProductSubmissionResult = {
	status: SharedProductSubmissionStatus;
	message: string;
};

export const searchSharedProducts = async (query: string): Promise<FdcFood[]> => {
	const trimmed = query.trim();
	if (trimmed.length < 2) return [];

	const response = await fetch(
		`/api/products/search?q=${encodeURIComponent(trimmed)}`,
		{ headers: { accept: "application/json" } },
	);
	if (!response.ok) return [];
	const data = await response.json() as { foods?: FdcFood[] };
	return data.foods ?? [];
};

export const submitSharedProduct = async (
	food: FdcFood,
): Promise<SharedProductSubmissionResult> => {
	const response = await fetch("/api/products/submissions", {
		method: "POST",
		headers: {
			accept: "application/json",
			"content-type": "application/json",
		},
		body: JSON.stringify({ food, consentToShare: true }),
	});

	if (!response.ok) {
		throw new Error("The product could not be submitted for catalog review.");
	}

	return await response.json() as SharedProductSubmissionResult;
};
