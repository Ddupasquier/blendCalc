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
	pendingCatalogDataOperations: 5,
	totalActionableItems: 15,
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

		await expect(readPrivilegedToolReviewSummary(supabase)).resolves.toEqual({
			...completeCounts,
			unavailable: false,
			identityVerificationRequired: false,
		});
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

	it("represents unavailable counts without pretending they are zero", () => {
		expect(getUnavailablePrivilegedToolReviewSummary()).toEqual({
			pendingProductSubmissions: null,
			pendingCatalogReviewItems: null,
			pendingFoodWarningReports: null,
			pendingProfileImageReviews: null,
			pendingCatalogDataOperations: null,
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
			totalActionableItems: null,
			unavailable: false,
			identityVerificationRequired: true,
		});
	});
});
