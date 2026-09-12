import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSupabaseAdminClient: vi.fn(),
	getDefaultProductResolutionPolicy: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));
vi.mock("$lib/server/products/productResolutionPolicy.server", () => ({
	getDefaultProductResolutionPolicy: mocks.getDefaultProductResolutionPolicy,
}));

import { runPrivilegedQueueAdmission } from "$lib/server/moderation/privilegedQueueAdmission.server";

const resultQuery = (data: unknown, error: unknown = null) => {
	const result = { data, error };
	const query: Record<string, unknown> = {};
	for (const method of ["select", "eq", "in", "not", "order"]) {
		query[method] = vi.fn(() => query);
	}
	query.limit = vi.fn().mockResolvedValue(result);
	query.then = (resolve: (value: typeof result) => unknown) =>
		Promise.resolve(result).then(resolve);
	return query;
};

const policy = {
	minimumRelatedNameTokenOverlap: 0.5,
	numericDifferenceRatioFloor: 1,
	servingWeightToleranceGrams: 0,
	differenceThresholds: [],
};

describe("privileged queue admission", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getDefaultProductResolutionPolicy.mockResolvedValue(policy);
	});

	it("rechecks old submissions and closes an exact current-catalog match", async () => {
		const food = {
			fdcId: 1,
			description: "Same Product",
			foodCategory: "Snacks",
			foodNutrients: [],
		};
		const tables = new Map([
			[
				"shared_product_submissions",
				resultQuery([
					{
						id: "submission-id",
						barcode: "00000000000001",
						food,
						submission_kind: "new_product",
						base_revision_id: null,
						updated_at: "2026-09-11T20:00:00Z",
					},
				]),
			],
			[
				"shared_products",
				resultQuery([
					{
						id: "product-id",
						barcode: "00000000000001",
						product_name: "Same Product",
						brand_owner: null,
						food,
						updated_at: "2026-09-11T21:00:00Z",
					},
				]),
			],
			[
				"shared_product_revisions",
				resultQuery([
					{
						id: "revision-id",
						shared_product_id: "product-id",
						revision_number: 2,
					},
				]),
			],
		]);
		const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn((table: string) => tables.get(table)),
			rpc,
		});

		await runPrivilegedQueueAdmission({} as never, ["product_submissions"]);

		expect(rpc).toHaveBeenCalledWith("apply_catalog_queue_admission", {
			p_limit: 100,
		});
		expect(rpc).toHaveBeenCalledWith(
			"resolve_catalog_submission_queue_admission",
			expect.objectContaining({
				p_submission_id: "submission-id",
				p_reason_code: "exact_current_catalog_match",
			}),
		);
	});

	it("tolerates only the expected rolling-schema missing-function state", async () => {
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn(() => resultQuery([])),
			rpc: vi.fn().mockResolvedValue({
				data: null,
				error: {
					code: "PGRST202",
					message: "Function is not in the schema cache",
				},
			}),
		});

		await expect(
			runPrivilegedQueueAdmission({} as never, ["product_submissions"]),
		).resolves.toBeUndefined();
	});

	it("fails closed when catalog admission returns an unexpected error", async () => {
		mocks.getSupabaseAdminClient.mockReturnValue({
			rpc: vi.fn().mockResolvedValue({
				data: null,
				error: { code: "XX000", message: "Unexpected admission failure" },
			}),
		});

		await expect(
			runPrivilegedQueueAdmission({} as never, ["catalog_review"]),
		).rejects.toMatchObject({ code: "XX000" });
	});

	it("dry-runs and applies only an exact data-operations repair candidate", async () => {
		const tables = new Map([
			[
				"app_issue_codes",
				resultQuery([{ code: "CATALOG_FIELD_PROVENANCE_MISSING" }]),
			],
			[
				"catalog_health_actionable_issue_occurrences",
				resultQuery([
					{
						occurrence_key: "field:product-id:name",
						issue_code: "CATALOG_FIELD_PROVENANCE_MISSING",
						detected_at: "2026-09-11T20:00:00Z",
					},
				]),
			],
			["catalog_health_repair_runs", resultQuery([])],
		]);
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn((table: string) => tables.get(table)),
			rpc: vi.fn(),
		});
		const rpc = vi
			.fn()
			.mockResolvedValueOnce({
				data: { runId: "dry-run-id", candidateCount: 1 },
				error: null,
			})
			.mockResolvedValueOnce({ data: { changedCount: 1 }, error: null });

		await runPrivilegedQueueAdmission({ rpc } as never, ["data_operations"]);

		expect(rpc).toHaveBeenNthCalledWith(1, "run_catalog_health_repair", {
			p_occurrence_key: "field:product-id:name",
			p_apply: false,
		});
		expect(rpc).toHaveBeenNthCalledWith(2, "run_catalog_health_repair", {
			p_occurrence_key: "field:product-id:name",
			p_apply: true,
			p_dry_run_id: "dry-run-id",
		});
	});

	it("leaves exact repairs with unchanged evidence alone after a current zero-candidate check", async () => {
		const tables = new Map([
			[
				"app_issue_codes",
				resultQuery([{ code: "CATALOG_FIELD_PROVENANCE_MISSING" }]),
			],
			[
				"catalog_health_actionable_issue_occurrences",
				resultQuery([
					{
						occurrence_key: "field:product-id:name",
						issue_code: "CATALOG_FIELD_PROVENANCE_MISSING",
						detected_at: "2026-09-11T20:00:00Z",
					},
				]),
			],
			[
				"catalog_health_repair_runs",
				resultQuery([
					{
						occurrence_key: "field:product-id:name",
						mode: "dry_run",
						status: "completed_with_unresolved",
						candidate_count: 0,
						unresolved_count: 1,
						started_at: "2026-09-11T21:00:00Z",
					},
				]),
			],
		]);
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn((table: string) => tables.get(table)),
			rpc: vi.fn(),
		});
		const rpc = vi.fn();

		await runPrivilegedQueueAdmission({ rpc } as never, ["data_operations"]);

		expect(rpc).not.toHaveBeenCalled();
	});

	it("treats an occurrence closed by a concurrent admission pass as resolved", async () => {
		const tables = new Map([
			[
				"app_issue_codes",
				resultQuery([{ code: "CATALOG_FIELD_PROVENANCE_MISSING" }]),
			],
			[
				"catalog_health_actionable_issue_occurrences",
				resultQuery([
					{
						occurrence_key: "field:product-id:name",
						issue_code: "CATALOG_FIELD_PROVENANCE_MISSING",
						detected_at: "2026-09-11T20:00:00Z",
					},
				]),
			],
			["catalog_health_repair_runs", resultQuery([])],
		]);
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn((table: string) => tables.get(table)),
			rpc: vi.fn(),
		});
		const rpc = vi.fn().mockResolvedValue({
			data: null,
			error: { code: "P0002", message: "Issue unavailable" },
		});

		await expect(
			runPrivilegedQueueAdmission({ rpc } as never, ["data_operations"]),
		).resolves.toBeUndefined();
	});
});
