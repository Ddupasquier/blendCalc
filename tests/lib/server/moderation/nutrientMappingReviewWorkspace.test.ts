import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	nutrientMappingReviewDecisionFixture,
	nutrientMappingReviewWorkspaceFixture,
} from "../../../fixtures/nutrientMappingReview";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
	readNutrientMappingReviewWorkspace: vi.fn(),
	decideNutrientMappingReview: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorPermission: mocks.requireModeratorPermission,
}));

vi.mock(
	"$lib/server/moderation/nutrientMappingReview.server",
	async (importOriginal) => {
		const original =
			await importOriginal<
				typeof import("$lib/server/moderation/nutrientMappingReview.server")
			>();
		return {
			...original,
			readNutrientMappingReviewWorkspace:
				mocks.readNutrientMappingReviewWorkspace,
			decideNutrientMappingReview: mocks.decideNutrientMappingReview,
		};
	},
);

import {
	loadNutrientMappingReviewWorkspace,
	reviewNutrientMappingAction,
} from "$lib/server/moderation/nutrientMappingReviewWorkspace.server";

const createFormRequest = (values: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(values)) formData.set(key, value);
	return new Request(
		"http://localhost/profile/privileged-tools/data-operations/nutrient-mappings/mapping",
		{
			method: "POST",
			body: formData,
		},
	);
};

describe("nutrient mapping review workspace", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireModeratorPermission.mockResolvedValue({
			role: "admin",
			permissions: ["data_operations.nutrient_mappings.manage"],
		});
		mocks.readNutrientMappingReviewWorkspace.mockResolvedValue(
			nutrientMappingReviewWorkspaceFixture,
		);
	});

	it("loads one mapping after checking the exact AAL2 permission", async () => {
		const supabase = {};
		await expect(
			loadNutrientMappingReviewWorkspace({
				locals: { supabase },
				params: { mappingId: nutrientMappingReviewWorkspaceFixture.mapping.id },
			} as never),
		).resolves.toEqual({
			viewerRole: "admin",
			workspace: nutrientMappingReviewWorkspaceFixture,
		});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.nutrient_mappings.manage",
			`/profile/privileged-tools/data-operations/nutrient-mappings/${nutrientMappingReviewWorkspaceFixture.mapping.id}`,
		);
		expect(mocks.readNutrientMappingReviewWorkspace).toHaveBeenCalledWith(
			supabase,
			nutrientMappingReviewWorkspaceFixture.mapping.id,
		);
	});

	it("records an evidence-backed approval", async () => {
		mocks.decideNutrientMappingReview.mockResolvedValue(
			nutrientMappingReviewDecisionFixture,
		);
		const supabase = {};
		await expect(
			reviewNutrientMappingAction({
				locals: { supabase },
				params: { mappingId: nutrientMappingReviewWorkspaceFixture.mapping.id },
				request: createFormRequest({
					outcome: "approved",
					selectedNutrientId: "1003",
					reviewNote:
						"The exact provider reference identifies protein in grams.",
					evidenceReference: "https://example.test/provider-reference",
				}),
			} as never),
		).resolves.toEqual({
			nutrientMappingReviewResult: nutrientMappingReviewDecisionFixture,
			nutrientMappingReviewSuccess: expect.stringContaining("approved"),
		});
		expect(mocks.decideNutrientMappingReview).toHaveBeenCalledWith(supabase, {
			mappingId: nutrientMappingReviewWorkspaceFixture.mapping.id,
			outcome: "approved",
			selectedNutrientId: 1003,
			reviewNote: "The exact provider reference identifies protein in grams.",
			evidenceReference: "https://example.test/provider-reference",
		});
	});

	it("rejects incomplete decisions before calling the database", async () => {
		const result = await reviewNutrientMappingAction({
			locals: { supabase: {} },
			params: { mappingId: nutrientMappingReviewWorkspaceFixture.mapping.id },
			request: createFormRequest({
				outcome: "approved",
				selectedNutrientId: "1003",
				reviewNote: "Missing evidence.",
			}),
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: {
				nutrientMappingReviewError: expect.stringContaining(
					"supporting review details",
				),
			},
		});
		expect(mocks.decideNutrientMappingReview).not.toHaveBeenCalled();
	});
});
