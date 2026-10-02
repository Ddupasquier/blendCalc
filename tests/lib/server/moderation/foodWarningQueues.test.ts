import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FOOD_WARNING_QUEUE_PAGE_SIZE } from "$lib/utils/moderation/foodWarningQueuePagination";
const signEvidence = vi.hoisted(() => vi.fn());
vi.mock("$lib/server/food-safety/foodCompatibilityEvidence.server", () => ({
	createFoodCompatibilityEvidenceSignedUrl: signEvidence,
}));
import { readFoodWarningQueuePage } from "$lib/server/moderation/foodWarningQueues.server";

const row = (index: number) => ({
	id: `70000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
	created_at: "2026-10-02T12:00:00.123456+00:00",
	evidence_path: `private/${index}`,
	policy_version: { version_number: 2 },
	affected_field_paths: ["allergens"],
	product: { product_name: "Test food", barcode: "00012345678905" },
	feedback: {
		food_description: "Reported food",
		feedback_type: "missing_warning",
		report_reason: "missing_warning",
	},
});
const makeClient = (
	rows: ReturnType<typeof row>[],
	count: number | null = 25,
	error: unknown = null,
) => {
	const queries: Array<Record<string, ReturnType<typeof vi.fn>>> = [];
	const supabase = {
		from: vi.fn(() => {
			const query: Record<string, ReturnType<typeof vi.fn>> = {};
			for (const method of ["select", "eq", "in", "order", "limit", "or"])
				query[method] = vi.fn(() => query);
			query.then = vi.fn((resolve) => resolve({ data: rows, count, error }));
			queries.push(query);
			return query;
		}),
	} as unknown as SupabaseClient<Database>;
	return { supabase, queries };
};

describe("bounded food-warning queue repositories", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		signEvidence.mockImplementation(async (path) =>
			path ? `signed:${path}` : null,
		);
	});
	it.each(["reports", "policyReviews", "productCorrections"] as const)(
		"bounds %s and counts the full queue independently of its cursor",
		async (queue) => {
			const context = makeClient(
				Array.from({ length: FOOD_WARNING_QUEUE_PAGE_SIZE + 1 }, (_, index) =>
					row(index + 1),
				),
			);
			const cursor = { id: row(5).id, createdAt: row(5).created_at };
			const page = await readFoodWarningQueuePage(context, queue, cursor);
			expect(page.items).toHaveLength(10);
			expect(page.total).toBe(25);
			expect(page.nextCursor).toBe(
				JSON.stringify({ id: row(10).id, createdAt: row(10).created_at }),
			);
			expect(context.queries[0].limit).toHaveBeenCalledWith(11);
			expect(context.queries[0].order.mock.calls).toEqual([
				["created_at", { ascending: true }],
				["id", { ascending: true }],
			]);
			expect(context.queries[0].or).toHaveBeenCalledWith(
				`created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`,
			);
			expect(context.queries[1].select).toHaveBeenCalledWith("id", {
				count: "exact",
				head: true,
			});
			expect(context.queries[1].or).not.toHaveBeenCalled();
			expect(signEvidence).toHaveBeenCalledTimes(queue === "reports" ? 10 : 0);
			if (queue === "reports")
				expect(signEvidence).not.toHaveBeenCalledWith("private/11");
		},
	);
	it.each(
		[[], [row(1)], Array.from({ length: 10 }, (_, index) => row(index))].map(
			(rows) => ({ rows }),
		),
	)("ends empty, partial, and exact-sized final pages", async ({ rows }) => {
		const page = await readFoodWarningQueuePage(
			makeClient(rows, rows.length),
			"reports",
		);
		expect(page.items).toHaveLength(rows.length);
		expect(page.nextCursor).toBeNull();
	});
	it("fails closed on database errors before signing evidence", async () => {
		await expect(
			readFoodWarningQueuePage(
				makeClient([row(1)], 1, { message: "private DB detail" }),
				"reports",
			),
		).rejects.toMatchObject({ status: 503 });
		expect(signEvidence).not.toHaveBeenCalled();
	});
	it("does not replace an unavailable exact total with a loaded-row count", async () => {
		await expect(
			readFoodWarningQueuePage(makeClient([row(1)], null), "reports"),
		).rejects.toMatchObject({ status: 503 });
		expect(signEvidence).not.toHaveBeenCalled();
	});
});
