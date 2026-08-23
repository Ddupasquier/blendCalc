import { describe, expect, it, vi } from "vitest";
import {
	decideNutrientMappingReview,
	readNutrientMappingReviewWorkspace,
} from "$lib/server/moderation/nutrientMappingReview.server";
import {
	nutrientMappingReviewDecisionFixture,
	nutrientMappingReviewWorkspaceFixture,
} from "../../../fixtures/nutrientMappingReview";

describe("nutrient mapping review repository", () => {
	it("loads one guarded workspace through its stable mapping ID", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: nutrientMappingReviewWorkspaceFixture,
			error: null,
		});

		await expect(readNutrientMappingReviewWorkspace(
			{ rpc } as never,
			nutrientMappingReviewWorkspaceFixture.mapping.id,
		)).resolves.toEqual(nutrientMappingReviewWorkspaceFixture);
		expect(rpc).toHaveBeenCalledWith("get_nutrient_mapping_review_workspace", {
			p_mapping_id: nutrientMappingReviewWorkspaceFixture.mapping.id,
		});
	});

	it("approves evidence-backed mappings and omits excluded fields when unavailable", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: nutrientMappingReviewDecisionFixture,
			error: null,
		});
		await expect(decideNutrientMappingReview({ rpc } as never, {
			mappingId: nutrientMappingReviewWorkspaceFixture.mapping.id,
			outcome: "approved",
			selectedNutrientId: 1003,
			reviewNote: "Exact provider documentation confirms protein.",
			evidenceReference: "https://example.test/provider-reference",
		})).resolves.toEqual(nutrientMappingReviewDecisionFixture);
		expect(rpc).toHaveBeenCalledWith("review_nutrient_source_mapping", {
			p_mapping_id: nutrientMappingReviewWorkspaceFixture.mapping.id,
			p_outcome: "approved",
			p_selected_nutrient_id: 1003,
			p_review_note: "Exact provider documentation confirms protein.",
			p_evidence_reference: "https://example.test/provider-reference",
		});
	});

	it("classifies stale decisions and invalid unit paths without leaking database wording", async () => {
		await expect(decideNutrientMappingReview({
			rpc: vi.fn().mockResolvedValue({
				data: null,
				error: { message: "This nutrient mapping is no longer waiting for review." },
			}),
		} as never, {
			mappingId: nutrientMappingReviewWorkspaceFixture.mapping.id,
			outcome: "excluded",
			selectedNutrientId: null,
			reviewNote: "No canonical nutrient identity exists.",
			evidenceReference: null,
		})).rejects.toMatchObject({ reason: "mapping_resolved" });

		await expect(decideNutrientMappingReview({
			rpc: vi.fn().mockResolvedValue({
				data: null,
				error: { message: "The source unit has no reviewed conversion for that nutrient." },
			}),
		} as never, {
			mappingId: nutrientMappingReviewWorkspaceFixture.mapping.id,
			outcome: "approved",
			selectedNutrientId: 1008,
			reviewNote: "Incorrect unit test.",
			evidenceReference: "reference",
		})).rejects.toMatchObject({ reason: "invalid_unit_path" });
	});
});
