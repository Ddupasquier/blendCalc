import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHealthRepairDryRunFixture } from "../../../fixtures/catalogHealthRepair";
import { catalogProductReadinessPassportFixture } from "../../../fixtures/catalogProductReadinessPassport";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
	readCatalogProductReadinessPassport: vi.fn(),
	runCatalogHealthRepair: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorPermission: mocks.requireModeratorPermission,
}));

vi.mock("$lib/server/moderation/catalogProductReadinessPassport.server", () => ({
	readCatalogProductReadinessPassport: mocks.readCatalogProductReadinessPassport,
}));

vi.mock("$lib/server/moderation/catalogHealthRepair.server", async (importOriginal) => {
	const original = await importOriginal<typeof import("$lib/server/moderation/catalogHealthRepair.server")>();
	return {
		...original,
		runCatalogHealthRepair: mocks.runCatalogHealthRepair,
	};
});

import {
	loadCatalogProductRepairWorkspace,
	runCatalogProductRepairAction,
} from "$lib/server/moderation/catalogProductRepairWorkspace.server";

const createFormRequest = (values: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(values)) formData.set(key, value);
	return new Request("http://localhost/profile/privileged-tools/data-operations/product", {
		method: "POST",
		body: formData,
	});
};

describe("catalog product repair workspace", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireModeratorPermission.mockResolvedValue({
			role: "developer",
			permissions: [
				"data_operations.catalog_health.read",
				"data_operations.catalog_health.repair",
			],
		});
		mocks.readCatalogProductReadinessPassport.mockResolvedValue(
			catalogProductReadinessPassportFixture,
		);
	});

	it("loads the product passport and exposes repair capability from exact permissions", async () => {
		const supabase = {};
		await expect(loadCatalogProductRepairWorkspace({
			locals: { supabase },
			params: { productId: "product-id" },
		} as never)).resolves.toEqual({
			viewerRole: "developer",
			canRunRepairs: true,
			passport: catalogProductReadinessPassportFixture,
		});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.catalog_health.read",
			"/profile/privileged-tools/data-operations/products/product-id",
		);
		expect(mocks.readCatalogProductReadinessPassport).toHaveBeenCalledWith(
			supabase,
			"product-id",
		);
	});

	it("runs a dry run only after checking the repair permission", async () => {
		mocks.runCatalogHealthRepair.mockResolvedValue(catalogHealthRepairDryRunFixture);
		const supabase = {};
		const occurrenceKey = catalogProductReadinessPassportFixture.issues[0].occurrenceKey;
		await expect(runCatalogProductRepairAction({
			locals: { supabase },
			params: { productId: "product-id" },
			request: createFormRequest({
				occurrenceKey,
				mode: "dry_run",
			}),
		} as never)).resolves.toEqual({
			catalogRepairOccurrenceKey: occurrenceKey,
			catalogRepairResult: catalogHealthRepairDryRunFixture,
		});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.catalog_health.repair",
			"/profile/privileged-tools/data-operations/products/product-id",
		);
		expect(mocks.runCatalogHealthRepair).toHaveBeenCalledWith(supabase, {
			occurrenceKey,
			apply: false,
			dryRunId: null,
		});
	});

	it("requires a valid dry-run identifier before apply", async () => {
		const result = await runCatalogProductRepairAction({
			locals: { supabase: {} },
			params: { productId: "product-id" },
			request: createFormRequest({ occurrenceKey: "issue", mode: "apply" }),
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: {
				catalogRepairOccurrenceKey: "issue",
				catalogRepairError: expect.stringContaining("fresh safety check"),
			},
		});
		expect(mocks.runCatalogHealthRepair).not.toHaveBeenCalled();
	});

	it("rejects an issue that does not belong to the current product passport", async () => {
		const result = await runCatalogProductRepairAction({
			locals: { supabase: {} },
			params: { productId: "product-id" },
			request: createFormRequest({
				occurrenceKey: "another-product:issue",
				mode: "dry_run",
			}),
		} as never);

		expect(result).toMatchObject({
			status: 409,
			data: { catalogRepairError: expect.stringContaining("options have changed") },
		});
		expect(mocks.runCatalogHealthRepair).not.toHaveBeenCalled();
	});
});
