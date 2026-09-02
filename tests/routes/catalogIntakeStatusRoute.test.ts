import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	readCatalogIntakeStatus: vi.fn(),
}));

vi.mock("$lib/server/products/catalogIntakeStatus.server", () => ({
	readCatalogIntakeStatus: mocks.readCatalogIntakeStatus,
}));

import { GET } from "../../src/routes/api/intake/v1/submissions/[submissionId]/+server";

const submissionId = "11111111-1111-4111-8111-111111111111";

const createEvent = ({
	userId = "owner-id",
	requestedSubmissionId = submissionId,
}: {
	userId?: string | null;
	requestedSubmissionId?: string;
} = {}) => ({
	locals: {
		getVerifiedUser: vi.fn().mockResolvedValue(userId ? { id: userId } : null),
		supabase: {},
	},
	params: { submissionId: requestedSubmissionId },
	request: new Request(
		`http://localhost:5173/api/intake/v1/submissions/${requestedSubmissionId}`,
		{ headers: { "x-blendcalc-api-key": "api-key-does-not-authorize" } },
	),
});

describe("catalog intake status route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readCatalogIntakeStatus.mockResolvedValue({
			id: submissionId,
			state: "pending",
			submittedAt: "2026-08-31T10:00:00.000Z",
			updatedAt: "2026-08-31T11:00:00.000Z",
		});
	});

	it("returns only the authenticated owner's bounded workflow status", async () => {
		const response = await GET(createEvent() as never);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(await response.json()).toEqual({
			data: {
				id: submissionId,
				state: "pending",
				submittedAt: "2026-08-31T10:00:00.000Z",
				updatedAt: "2026-08-31T11:00:00.000Z",
			},
		});
		expect(mocks.readCatalogIntakeStatus).toHaveBeenCalledWith(
			{},
			{
				submissionId,
				userId: "owner-id",
			},
		);
	});

	it("does not let an API key replace an authenticated app session", async () => {
		await expect(
			GET(createEvent({ userId: null }) as never),
		).rejects.toMatchObject({ status: 401 });
		expect(mocks.readCatalogIntakeStatus).not.toHaveBeenCalled();
	});

	it("uses the same not-found response for absent and non-owned submissions", async () => {
		mocks.readCatalogIntakeStatus.mockResolvedValue(null);

		await expect(GET(createEvent() as never)).rejects.toMatchObject({
			status: 404,
		});
	});

	it("returns a safe service error when status storage is unavailable", async () => {
		mocks.readCatalogIntakeStatus.mockRejectedValue(
			new Error("private database detail"),
		);
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		await expect(GET(createEvent() as never)).rejects.toMatchObject({
			status: 503,
		});
		expect(consoleError).toHaveBeenCalledOnce();
		consoleError.mockRestore();
	});
});
