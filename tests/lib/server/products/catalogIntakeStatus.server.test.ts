import { readCatalogIntakeStatus } from "$lib/server/products/catalogIntakeStatus.server";
import { describe, expect, it, vi } from "vitest";

const submissionId = "11111111-1111-4111-8111-111111111111";
const submittedAt = "2026-08-31T10:00:00.000Z";
const updatedAt = "2026-08-31T11:00:00.000Z";

const createSupabaseMock = (result: {
	data: {
		id: string;
		status: string;
		created_at: string;
		updated_at: string;
	} | null;
	error: unknown;
}) => {
	const maybeSingle = vi.fn().mockResolvedValue(result);
	const submittedBy = vi.fn().mockReturnValue({ maybeSingle });
	const id = vi.fn().mockReturnValue({ eq: submittedBy });
	const select = vi.fn().mockReturnValue({ eq: id });
	const from = vi.fn().mockReturnValue({ select });

	return {
		supabase: { from },
		spies: { from, select, id, submittedBy, maybeSingle },
	};
};

describe("catalog intake status reads", () => {
	it.each([
		["pending", "pending"],
		["approved", "accepted"],
		["rejected", "declined"],
		["auto_declined", "declined"],
	] as const)("maps %s to the safe %s state", async (storedStatus, state) => {
		const { supabase } = createSupabaseMock({
			data: {
				id: submissionId,
				status: storedStatus,
				created_at: submittedAt,
				updated_at: updatedAt,
			},
			error: null,
		});

		await expect(
			readCatalogIntakeStatus(supabase as never, {
				submissionId,
				userId: "owner-id",
			}),
		).resolves.toEqual({ id: submissionId, state, submittedAt, updatedAt });
	});

	it("selects only public workflow fields through the owner boundary", async () => {
		const { supabase, spies } = createSupabaseMock({ data: null, error: null });

		await readCatalogIntakeStatus(supabase as never, {
			submissionId,
			userId: "owner-id",
		});

		expect(spies.from).toHaveBeenCalledWith("shared_product_submissions");
		expect(spies.select).toHaveBeenCalledWith(
			"id, status, created_at, updated_at",
		);
		expect(spies.id).toHaveBeenCalledWith("id", submissionId);
		expect(spies.submittedBy).toHaveBeenCalledWith("submitted_by", "owner-id");
	});

	it("treats invalid and unavailable identifiers as not found", async () => {
		const { supabase, spies } = createSupabaseMock({ data: null, error: null });

		await expect(
			readCatalogIntakeStatus(supabase as never, {
				submissionId: "not-a-submission-id",
				userId: "owner-id",
			}),
		).resolves.toBeNull();
		expect(spies.from).not.toHaveBeenCalled();

		await expect(
			readCatalogIntakeStatus(supabase as never, {
				submissionId,
				userId: "owner-id",
			}),
		).resolves.toBeNull();
	});

	it("fails closed for unknown workflow states", async () => {
		const { supabase } = createSupabaseMock({
			data: {
				id: submissionId,
				status: "unexpected",
				created_at: submittedAt,
				updated_at: updatedAt,
			},
			error: null,
		});

		await expect(
			readCatalogIntakeStatus(supabase as never, {
				submissionId,
				userId: "owner-id",
			}),
		).rejects.toThrow("Unsupported catalog intake status.");
	});
});
