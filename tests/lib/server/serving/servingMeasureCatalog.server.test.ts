import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	readServingMeasureCatalog: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: () => ({ source: "admin" }),
}));
vi.mock("$lib/utils/serving/servingMeasureCatalogReader", () => ({
	readServingMeasureCatalog: mocks.readServingMeasureCatalog,
}));

describe("server serving measure catalog", () => {
	beforeEach(() => {
		vi.resetModules();
		mocks.readServingMeasureCatalog.mockReset();
	});

	it("configures source serving parsing before a server barcode mapper runs", async () => {
		mocks.readServingMeasureCatalog.mockResolvedValue({
			options: [
				{
					value: "g",
					label: "grams (g)",
					shortLabel: "g",
					dimension: "weight",
					conversionToBase: 1,
					isDefault: true,
				},
				{
					value: "item",
					label: "Items",
					shortLabel: "item",
					dimension: "count",
					conversionToBase: 1,
					isDefault: true,
				},
			],
			aliases: { g: "g", item: "item", items: "item" },
			aliasEntries: [
				{ alias: "g", unit: "g" },
				{ alias: "item", unit: "item" },
				{ alias: "items", unit: "item" },
			],
		});
		const { ensureServerServingMeasureCatalog } =
			await import("$lib/server/serving/servingMeasureCatalog.server");
		const { parseSourceWeightMeasure } =
			await import("$lib/utils/serving/servingAmount");

		await ensureServerServingMeasureCatalog();

		expect(parseSourceWeightMeasure("16 crisps (28 g)")).toEqual({
			quantity: 28,
			unit: "g",
		});
		expect(mocks.readServingMeasureCatalog).toHaveBeenCalledOnce();
	});
});
