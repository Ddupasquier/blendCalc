import { describe, expect, it, vi } from "vitest";
import {
	readFoodCategoryPickerData,
	scoreFoodCategoryCandidate,
} from "$lib/server/products/categoryPicker.server";

const proteinBars = {
	id: "protein-bars",
	label: "Protein Bars",
	normalized_value: "protein bars",
	observation_count: 24,
	source_count: 3,
	verification_status: "multi_source_verified",
};

const bars = {
	id: "bars",
	label: "Bars",
	normalized_value: "bars",
	observation_count: 60,
	source_count: 3,
	verification_status: "multi_source_verified",
};

const snacks = {
	id: "snacks",
	label: "Snacks",
	normalized_value: "snacks",
	observation_count: 100,
	source_count: 4,
	verification_status: "multi_source_verified",
};

const createQuery = (candidateRows: typeof proteinBars[], commonRows: typeof proteinBars[]) => {
	let commonOnly = false;
	const query = {
		select: () => query,
		eq: (column: string, value: unknown) => {
			if (column === "verification_status" && value === "multi_source_verified") {
				commonOnly = true;
			}
			return query;
		},
		or: () => query,
		order: () => query,
		limit: async () => ({
			data: commonOnly ? commonRows : candidateRows,
			error: null,
		}),
	};
	return query;
};

describe("food category picker ranking", () => {
	it("ranks a specific early-name match above a broad category", () => {
		const context = ["Chocolate Dough Protein Bar"];

		expect(scoreFoodCategoryCandidate(proteinBars, context)).toBeGreaterThan(
			scoreFoodCategoryCandidate(bars, context),
		);
	});

	it("returns ranked suggestions, common categories, and search results", async () => {
		const candidateRows = [bars, proteinBars];
		const from = vi.fn(() => createQuery(candidateRows, [snacks]));
		const supabase = {
			from,
		};

		const initialResult = await readFoodCategoryPickerData(supabase as never, {
			productName: "Chocolate Dough Protein Bar",
		});
		const searchResult = await readFoodCategoryPickerData(supabase as never, {
			query: "protein bar",
		});

		expect(initialResult.suggestions[0]).toMatchObject({
			id: "protein-bars",
			label: "Protein Bars",
		});
		expect(initialResult.common).toEqual([
			expect.objectContaining({ id: "snacks", label: "Snacks" }),
		]);
		expect(searchResult.results[0]).toMatchObject({ id: "protein-bars" });
		expect(searchResult.suggestions).toEqual([]);
		expect(searchResult.common).toEqual([]);
		expect(from).toHaveBeenCalledTimes(3);
	});
});
