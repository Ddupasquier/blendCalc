import type { FdcFood } from "$lib/utils/food/types";

export type SharedProductSubmissionStatus =
	| "already-available"
	| "approved"
	| "pending";

export type SharedProductSubmissionResult = {
	status: SharedProductSubmissionStatus;
	message: string;
	evidenceAccepted?: boolean;
};

export type SharedProductEvidence = {
	frontPhoto?: File | null;
	nutritionPhoto?: File | null;
	barcodePhoto?: File | null;
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
	evidence: SharedProductEvidence = {},
): Promise<SharedProductSubmissionResult> => {
	const formData = new FormData();
	formData.set("food", JSON.stringify(food));
	formData.set("consentToShare", "true");
	if (evidence.frontPhoto) formData.set("frontPhoto", evidence.frontPhoto);
	if (evidence.nutritionPhoto) {
		formData.set("nutritionPhoto", evidence.nutritionPhoto);
	}
	if (evidence.barcodePhoto) formData.set("barcodePhoto", evidence.barcodePhoto);

	const response = await fetch("/api/products/submissions", {
		method: "POST",
		headers: { accept: "application/json" },
		body: formData,
	});

	if (!response.ok) {
		const body = await response.json().catch(() => null) as { message?: string } | null;
		throw new Error(
			body?.message ?? "The product could not be submitted for catalog review.",
		);
	}

	return await response.json() as SharedProductSubmissionResult;
};
