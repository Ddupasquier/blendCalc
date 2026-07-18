import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSignedUrls } = vi.hoisted(() => ({
	createSignedUrls: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: () => ({
		storage: {
			from: () => ({ createSignedUrls }),
		},
	}),
}));

import { createProductEvidenceSignedUrlBatches } from "$lib/server/products/productEvidence.server";

describe("createProductEvidenceSignedUrlBatches", () => {
	beforeEach(() => {
		createSignedUrls.mockReset();
	});

	it("signs every moderation evidence path in one storage request", async () => {
		createSignedUrls.mockResolvedValue({
			data: [
				{ path: "one/front.jpg", signedUrl: "signed-front" },
				{ path: "one/label.jpg", signedUrl: "signed-label" },
				{ path: "two/front.jpg", signedUrl: "signed-second-front" },
			],
			error: null,
		});

		await expect(createProductEvidenceSignedUrlBatches([
			{ front: "one/front.jpg", nutrition: "one/label.jpg" },
			{ front: "two/front.jpg" },
		])).resolves.toEqual([
			{ front: "signed-front", nutrition: "signed-label" },
			{ front: "signed-second-front" },
		]);

		expect(createSignedUrls).toHaveBeenCalledTimes(1);
		expect(createSignedUrls).toHaveBeenCalledWith(
			["one/front.jpg", "one/label.jpg", "two/front.jpg"],
			600,
		);
	});
});
