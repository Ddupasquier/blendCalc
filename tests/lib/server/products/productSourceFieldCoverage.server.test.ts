import { describe, expect, it, vi } from "vitest";
import {
	readActiveProductSourceFieldCoverage,
	recordProductSourceFieldCoverage,
	sourceCoverageConfirmsFieldsUnavailable,
	sourceCoverageConfirmsProductNotFound,
	type ActiveProductSourceFieldCoverage,
} from "$lib/server/products/productSourceFieldCoverage.server";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { PRODUCT_RESOLUTION_POLICY_FIXTURE } from "../../../fixtures/productResolutionPolicy";

const createCoverage = (
	fieldPath: ActiveProductSourceFieldCoverage["fieldPath"],
	coverageStatus: ActiveProductSourceFieldCoverage["coverageStatus"],
): ActiveProductSourceFieldCoverage => ({
	fieldPath,
	coverageStatus,
	expiresAt: "2026-08-25T00:00:00.000Z",
});

const createDraft = (): BarcodeProductDraft => ({
	barcode: "00012345678905",
	name: "Example food",
	nameProvenance: "source",
	brandOwner: "",
	servingLabel: "100 g",
	servingWeightGrams: 100,
	hasSourceServing: true,
	nutrients: [],
	reportedNutrientIds: [],
	source: "usda",
	sourceLabel: "USDA FoodData Central",
	sourceReference: "123",
});

describe("product source field coverage", () => {
	it("reads only coverage whose expiry is later than the requested instant", async () => {
		const query = {
			select: vi.fn(),
			eq: vi.fn(),
			in: vi.fn(),
			gt: vi.fn(),
		};
		query.select.mockReturnValue(query);
		query.eq.mockReturnValue(query);
		query.in.mockReturnValue(query);
		query.gt.mockResolvedValue({
			data: [
				{
					field_path: "ingredients",
					coverage_status: "not-reported",
					expires_at: "2026-08-25T00:00:00.000Z",
				},
			],
			error: null,
		});
		const supabase = { from: vi.fn(() => query) };

		const coverage = await readActiveProductSourceFieldCoverage(
			supabase as never,
			{
				barcode: "00012345678905",
				providerKey: "open-food-facts",
				fieldPaths: ["ingredients"],
				now: new Date("2026-08-24T00:00:00.000Z"),
			},
		);

		expect(query.gt).toHaveBeenCalledWith(
			"expires_at",
			"2026-08-24T00:00:00.000Z",
		);
		expect(coverage.get("ingredients")).toMatchObject({
			coverageStatus: "not-reported",
		});
	});

	it("suppresses only when every requested field has fresh unavailable coverage", () => {
		const coverage = new Map([
			["ingredients" as const, createCoverage("ingredients", "not-reported")],
			["allergens" as const, createCoverage("allergens", "not-applicable")],
		]);

		expect(
			sourceCoverageConfirmsFieldsUnavailable(
				["ingredients", "allergens"],
				coverage,
			),
		).toBe(true);
		expect(
			sourceCoverageConfirmsFieldsUnavailable(
				["ingredients", "allergens", "image"],
				coverage,
			),
		).toBe(false);
	});

	it("keeps product-not-found distinct from ordinary absent fields", () => {
		const coverage = new Map([
			[
				"productIdentity" as const,
				createCoverage("productIdentity", "product-not-found"),
			],
		]);

		expect(sourceCoverageConfirmsProductNotFound(coverage)).toBe(true);
		expect(
			sourceCoverageConfirmsFieldsUnavailable(["productName"], coverage),
		).toBe(false);
	});

	it("records reported and absent field outcomes with policy-owned expiry", async () => {
		const upsert = vi.fn(async (_rows: Array<Record<string, unknown>>) => ({
			error: null,
		}));
		const supabase = { from: vi.fn(() => ({ upsert })) };
		await recordProductSourceFieldCoverage(supabase as never, {
			barcode: "00012345678905",
			providerKey: "usda",
			policy: PRODUCT_RESOLUTION_POLICY_FIXTURE,
			requestedFieldPaths: ["productIdentity", "brandOwner"],
			draft: createDraft(),
			checkedAt: new Date("2026-08-24T00:00:00.000Z"),
		});

		const rows = upsert.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
		expect(rows).toEqual([
			expect.objectContaining({
				field_path: "productIdentity",
				coverage_status: "reported",
				expires_at: "2026-09-23T00:00:00.000Z",
			}),
			expect.objectContaining({
				field_path: "brandOwner",
				coverage_status: "not-reported",
				expires_at: "2026-09-23T00:00:00.000Z",
			}),
		]);
	});

	it("records an exact not-found result without fabricating field evidence", async () => {
		const upsert = vi.fn(async (_rows: Array<Record<string, unknown>>) => ({
			error: null,
		}));
		const supabase = { from: vi.fn(() => ({ upsert })) };
		await recordProductSourceFieldCoverage(supabase as never, {
			barcode: "00012345678905",
			providerKey: "open-food-facts",
			policy: PRODUCT_RESOLUTION_POLICY_FIXTURE,
			requestedFieldPaths: ["ingredients", "allergens"],
			draft: null,
			checkedAt: new Date("2026-08-24T00:00:00.000Z"),
		});

		expect(upsert.mock.calls[0]?.[0]).toEqual([
			expect.objectContaining({
				field_path: "productIdentity",
				coverage_status: "product-not-found",
				expires_at: "2026-08-24T12:00:00.000Z",
			}),
		]);
	});
});
