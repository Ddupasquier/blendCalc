import { describe, expect, it, vi } from "vitest";
import {
	isMissingAppVisualReferenceExpansion,
	readAppVisualReferenceCatalog,
} from "$lib/utils/food/reference/appVisualReferenceCatalogReader";

type QueryResponse = {
	data: unknown[] | null;
	error: { code?: string; message?: string } | null;
};

const createSupabaseClient = (
	getResponse: (table: string, columns: string) => QueryResponse,
) => ({
	from: (table: string) => ({
		select: (columns: string) => {
			const response = getResponse(table, columns);
			const query = {
				eq: () => query,
				order: () => query,
				then: (
					resolve: (value: QueryResponse) => unknown,
					reject: (reason: unknown) => unknown,
				) => Promise.resolve(response).then(resolve, reject),
			};
			return query;
		},
	}),
});

describe("app visual reference catalog rollout", () => {
	it("uses the pre-migration symbol schema without breaking application reads", async () => {
		const getResponse = vi.fn((table: string, columns: string): QueryResponse => {
			if (table === "food_symbol_definitions" && columns.includes("family_key")) {
				return {
					data: null,
					error: {
						code: "PGRST204",
						message: "Could not find the 'family_key' column in the schema cache",
					},
				};
			}
			if (table === "food_symbol_definitions") {
				return {
					data: [{ key: "fruit", display_name: "Fruit", emoji: "🍓", sort_order: 1 }],
					error: null,
				};
			}
			if (table === "food_symbol_category_rules" && columns.includes("match_scopes")) {
				return {
					data: null,
					error: {
						code: "PGRST204",
						message: "Could not find the 'match_scopes' column in the schema cache",
					},
				};
			}
			if (table === "food_symbol_category_rules") {
				return {
					data: [{ symbol_key: "fruit", match_pattern: "fruit", priority: 1 }],
					error: null,
				};
			}
			return {
				data: null,
				error: {
					code: "PGRST205",
					message: "Could not find the table 'public.app_delight_messages' in the schema cache",
				},
			};
		});

		await expect(
			readAppVisualReferenceCatalog(createSupabaseClient(getResponse) as never),
		).resolves.toEqual({
			foodSymbols: [{ key: "fruit", label: "Fruit", emoji: "🍓", familyKey: "fruit" }],
			foodSymbolResolutionRules: [{
				symbolKey: "fruit",
				matchPattern: "fruit",
				priority: 1,
				matchScopes: ["category", "uncategorized_name"],
			}],
			delightMessages: [],
		});
	});

	it("does not mistake permissions failures for an unfinished rollout", async () => {
		const permissionError = {
			code: "42501",
			message: "permission denied for table food_symbol_definitions",
		};
		expect(
			isMissingAppVisualReferenceExpansion(permissionError, ["family_key"]),
		).toBe(false);
		await expect(readAppVisualReferenceCatalog(createSupabaseClient(() => ({
			data: null,
			error: permissionError,
		})) as never)).rejects.toEqual(permissionError);
	});
});
