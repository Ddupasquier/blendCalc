import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
	readAppRolePermissions: vi.fn(),
	readFoodWarningFollowUpCase: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorPermission: mocks.requireModeratorPermission,
}));
vi.mock("$lib/server/moderation/appRolePermissions.server", () => ({
	readAppRolePermissions: mocks.readAppRolePermissions,
}));
vi.mock("$lib/server/moderation/foodWarningFollowUp.server", () => ({
	readFoodWarningFollowUpCase: mocks.readFoodWarningFollowUpCase,
}));

import {
	actions,
	load,
} from "../../src/routes/profile/privileged-tools/food-warning-reports/follow-ups/[caseId]/+page.server";

const reviewCase = {
	id: "case-id",
	caseType: "rule_review",
	responsibleGroup: "food_policy_review",
	status: "open",
};

const createRequest = (fields: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.set(key, value);
	return new Request("http://localhost/follow-up", {
		method: "POST",
		body: formData,
	});
};

describe("food warning follow-up route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireModeratorPermission.mockResolvedValue({ role: "admin" });
		mocks.readAppRolePermissions.mockResolvedValue([
			"moderation.warnings.review",
			"data_operations.catalog_health.repair",
		]);
		mocks.readFoodWarningFollowUpCase.mockResolvedValue(reviewCase);
	});

	it("loads source follow-ups as writable only for a data-operations reviewer", async () => {
		mocks.readFoodWarningFollowUpCase.mockResolvedValue({
			...reviewCase,
			caseType: "source_correction",
			responsibleGroup: "data_operations",
		});

		await expect(
			load({ locals: {}, params: { caseId: "case-id" } } as never),
		).resolves.toMatchObject({ canResolve: true });

		mocks.readAppRolePermissions.mockResolvedValue([
			"moderation.warnings.review",
		]);
		await expect(
			load({ locals: {}, params: { caseId: "case-id" } } as never),
		).resolves.toMatchObject({ canResolve: false });
	});

	it("loads completed follow-ups as read-only audit records", async () => {
		mocks.readFoodWarningFollowUpCase.mockResolvedValue({
			...reviewCase,
			status: "resolved",
		});

		await expect(
			load({ locals: {}, params: { caseId: "case-id" } } as never),
		).resolves.toMatchObject({ canResolve: false });
	});

	it("rejects incomplete outcomes without writing", async () => {
		const rpc = vi.fn();
		const result = await actions.resolveFollowUp({
			locals: { supabase: { rpc } },
			params: { caseId: "case-id" },
			request: createRequest({
				caseId: "case-id",
				outcome: "resolved",
				resolutionNote: " ",
			}),
		} as never);

		expect(result).toMatchObject({ status: 400 });
		expect(rpc).not.toHaveBeenCalled();
	});

	it("rejects a form target that does not match the focused route", async () => {
		const rpc = vi.fn();
		const result = await actions.resolveFollowUp({
			locals: { supabase: { rpc } },
			params: { caseId: "case-id" },
			request: createRequest({
				caseId: "different-case-id",
				outcome: "resolved",
				resolutionNote: "Reviewed evidence.",
			}),
		} as never);

		expect(result).toMatchObject({ status: 400 });
		expect(rpc).not.toHaveBeenCalled();
	});

	it("saves a bounded outcome and returns to the warning queue", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: { reviewed: true },
			error: null,
		});

		await expect(
			actions.resolveFollowUp({
				locals: { supabase: { rpc } },
				params: { caseId: "case-id" },
				request: createRequest({
					caseId: "case-id",
					outcome: "dismissed",
					resolutionNote:
						"Reviewed package evidence does not support a change.",
				}),
			} as never),
		).rejects.toMatchObject({
			status: 303,
			location: "/profile/privileged-tools/food-warning-reports",
		});
		expect(rpc).toHaveBeenCalledWith(
			"resolve_food_warning_policy_review_case",
			{
				p_case_id: "case-id",
				p_outcome: "dismissed",
				p_resolution_note:
					"Reviewed package evidence does not support a change.",
			},
		);
	});

	it("reports unauthorized and already-completed outcomes distinctly", async () => {
		const unauthorized = await actions.resolveFollowUp({
			locals: {
				supabase: {
					rpc: vi.fn().mockResolvedValue({
						data: null,
						error: { code: "42501" },
					}),
				},
			},
			params: { caseId: "case-id" },
			request: createRequest({
				caseId: "case-id",
				outcome: "resolved",
				resolutionNote: "Reviewed evidence.",
			}),
		} as never);
		expect(unauthorized).toMatchObject({ status: 403 });

		const completed = await actions.resolveFollowUp({
			locals: {
				supabase: {
					rpc: vi.fn().mockResolvedValue({
						data: { reviewed: false },
						error: null,
					}),
				},
			},
			params: { caseId: "case-id" },
			request: createRequest({
				caseId: "case-id",
				outcome: "resolved",
				resolutionNote: "Reviewed evidence.",
			}),
		} as never);
		expect(completed).toMatchObject({
			status: 409,
			data: { followUpError: expect.stringMatching(/already completed/u) },
		});
	});
});
