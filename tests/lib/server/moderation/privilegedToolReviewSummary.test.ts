import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	getIdentityVerificationRequiredPrivilegedToolReviewSummary,
	getUnavailablePrivilegedToolReviewSummary,
	readPrivilegedToolReviewSummary,
} from "$lib/server/moderation/privilegedToolReviewSummary.server";
import type { Database } from "$lib/types/database.types";

const completeCounts = {
	pendingProductSubmissions: 3,
	pendingCatalogReviewItems: 4,
	pendingFoodWarningReports: 2,
	pendingProfileImageReviews: 1,
	pendingCatalogDataOperations: 1,
	catalogDataOperationSubjects: [
		{
			subjectType: "shared_product",
			subjectKey: "product-id",
			displayName: "Test product",
			context: "Test brand",
			issueCount: 1,
			severity: "blocking",
			resolutionAction: "submit_catalog_correction",
			destination:
				"/profile/privileged-tools/data-operations/products/product-id",
			missingPrerequisite: null,
			issues: [
				{
					code: "CATALOG_REQUIRED_NUTRIENT_MISSING",
					sourceReason: "missing_required_nutrient",
					resolutionAction: "submit_catalog_correction",
					severity: "blocking",
					parameters: { nutrientId: 1008 },
				},
			],
		},
	],
	catalogDataOperationSubjectsTruncated: false,
	totalActionableItems: 11,
};

const createSupabase = (data: unknown, error: unknown = null) => {
	const rpc = vi.fn().mockResolvedValue({ data, error });
	return {
		supabase: { rpc } as unknown as SupabaseClient<Database>,
		rpc,
	};
};

describe("Profile privileged tool action summary", () => {
	it("reads every exact actionable count through one role-aware RPC", async () => {
		const { supabase, rpc } = createSupabase(completeCounts);

		await expect(readPrivilegedToolReviewSummary(supabase)).resolves.toEqual(
			expect.objectContaining({
				pendingCatalogDataOperations: 1,
				catalogDataOperationSubjects: [
					expect.objectContaining({
						displayName: "Test product",
						summary: "A required nutrient is missing",
						issues: [
							expect.objectContaining({
								summary: "A required nutrient is missing",
							}),
						],
					}),
				],
				unavailable: false,
				identityVerificationRequired: false,
			}),
		);
		expect(rpc).toHaveBeenCalledOnce();
		expect(rpc).toHaveBeenCalledWith("get_privileged_tool_action_summary");
	});

	it("rejects a database error instead of presenting incomplete counts", async () => {
		const error = { code: "42501" };
		const { supabase } = createSupabase(null, error);

		await expect(readPrivilegedToolReviewSummary(supabase)).rejects.toBe(error);
	});

	it.each([
		[
			"a missing count",
			{ ...completeCounts, pendingCatalogReviewItems: undefined },
		],
		["a negative count", { ...completeCounts, pendingFoodWarningReports: -1 }],
		["a fractional count", { ...completeCounts, totalActionableItems: 1.5 }],
		["a non-object response", null],
	])("rejects %s", async (_label, data) => {
		const { supabase } = createSupabase(data);

		await expect(readPrivilegedToolReviewSummary(supabase)).rejects.toThrow(
			"Privileged action summary",
		);
	});

	it("rejects a complete-looking response when the exact count and subject list disagree", async () => {
		const { supabase } = createSupabase({
			...completeCounts,
			pendingCatalogDataOperations: 2,
		});

		await expect(readPrivilegedToolReviewSummary(supabase)).rejects.toThrow(
			"count and subject list disagree",
		);
	});

	it("allows a deliberately bounded subject list only when truncation is explicit", async () => {
		const { supabase } = createSupabase({
			...completeCounts,
			pendingCatalogDataOperations: 51,
			catalogDataOperationSubjectsTruncated: true,
		});

		await expect(readPrivilegedToolReviewSummary(supabase)).resolves.toEqual(
			expect.objectContaining({
				pendingCatalogDataOperations: 51,
				catalogDataOperationSubjectsTruncated: true,
			}),
		);
	});

	it("rejects malformed issue facts instead of rendering unsafe fallback copy", async () => {
		const subject = completeCounts.catalogDataOperationSubjects[0];
		const { supabase } = createSupabase({
			...completeCounts,
			catalogDataOperationSubjects: [
				{
					...subject,
					issues: [{ ...subject.issues[0], sourceReason: "" }],
				},
			],
		});

		await expect(readPrivilegedToolReviewSummary(supabase)).rejects.toThrow(
			"sourceReason",
		);
	});

	it("represents unavailable counts without pretending they are zero", () => {
		expect(getUnavailablePrivilegedToolReviewSummary()).toEqual({
			pendingProductSubmissions: null,
			pendingCatalogReviewItems: null,
			pendingFoodWarningReports: null,
			pendingProfileImageReviews: null,
			pendingCatalogDataOperations: null,
			catalogDataOperationSubjects: null,
			catalogDataOperationSubjectsTruncated: false,
			totalActionableItems: null,
			unavailable: true,
			identityVerificationRequired: false,
		});
	});

	it("withholds all privileged action counts until identity verification", () => {
		expect(
			getIdentityVerificationRequiredPrivilegedToolReviewSummary(),
		).toEqual({
			pendingProductSubmissions: null,
			pendingCatalogReviewItems: null,
			pendingFoodWarningReports: null,
			pendingProfileImageReviews: null,
			pendingCatalogDataOperations: null,
			catalogDataOperationSubjects: null,
			catalogDataOperationSubjectsTruncated: false,
			totalActionableItems: null,
			unavailable: false,
			identityVerificationRequired: true,
		});
	});
});
