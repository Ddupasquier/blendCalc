import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getManualEntryReferenceData: vi.fn(),
}));

vi.mock("$lib/server/reference/manualEntryReferenceData.server", () => ({
	getManualEntryReferenceData: mocks.getManualEntryReferenceData,
}));

import { GET } from "../../src/routes/api/manual-entry/reference-data/+server";

const referenceData = {
	nutrientGroups: { macros: [], extended: [] },
	nutrientRelationshipRules: [],
	nutritionLabelOcrMappings: [],
	regulatoryDisclosureProfiles: [],
};

const createEvent = (signedIn: boolean) => ({
	locals: {
		getVerifiedUser: vi
			.fn()
			.mockResolvedValue(signedIn ? { id: "manual-entry-user" } : null),
	},
});

describe("manual entry reference data route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getManualEntryReferenceData.mockResolvedValue(referenceData);
	});

	it("requires a verified signed-in user", async () => {
		const response = await GET(createEvent(false) as never);

		expect(response?.status).toBe(401);
		expect(await response?.json()).toMatchObject({ code: "AUTH_REQUIRED" });
		expect(mocks.getManualEntryReferenceData).not.toHaveBeenCalled();
	});

	it("returns the server-owned reference catalogs in one response", async () => {
		const response = await GET(createEvent(true) as never);

		expect(response?.status).toBe(200);
		expect(response?.headers.get("cache-control")).toBe("private, max-age=60");
		expect(await response?.json()).toEqual(referenceData);
		expect(mocks.getManualEntryReferenceData).toHaveBeenCalledOnce();
	});

	it("returns one safe failure when the reference catalog is unavailable", async () => {
		mocks.getManualEntryReferenceData.mockRejectedValue(
			new Error("database details stay server-side"),
		);

		const response = await GET(createEvent(true) as never);

		expect(response?.status).toBe(503);
		expect(await response?.json()).toMatchObject({
			code: "SERVICE_UNAVAILABLE",
		});
	});
});
