import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrivilegedProductLookup from "$lib/components/moderation/PrivilegedProductLookup/PrivilegedProductLookup.svelte";
import type { FoodItem } from "$lib/utils/food/types";

const product = (
	fdcId: number,
	description: string,
	protein: number,
): FoodItem => ({
	fdcId,
	description,
	brandOwner: "Example brand",
	barcode: "00076808006568",
	foodNutrients: [
		{
			nutrientId: 1003,
			nutrientName: "Protein",
			nutrientNumber: "203",
			unitName: "G",
			value: protein,
			measurementBasis: { kind: "mass", quantity: 100, unitKey: "g" },
		},
	],
});

describe("PrivilegedProductLookup", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("keeps stored and provider results separate and highlights their differences", async () => {
		vi.stubGlobal("matchMedia", () => ({
			matches: true,
			media: "(min-width: 681px)",
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input), "http://localhost");
			const live = url.searchParams.get("scope") === "live";
			return new Response(
				JSON.stringify({
					query: "protein bar",
					scope: live ? "live" : "stored",
					results: [
						{
							id: live ? "live:usda:2" : "stored:1",
							scope: live ? "live" : "stored",
							providerKey: live ? "usda" : "shared-catalog",
							providerLabel: live
								? "USDA FoodData Central"
								: "Stored in blendCalc",
							food: product(
								live ? 2 : 1,
								live ? "Provider protein bar" : "Stored protein bar",
								live ? 12 : 10,
							),
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		render(PrivilegedProductLookup);
		await fireEvent.click(
			screen.getByRole("button", { name: "Product lookup" }),
		);
		await fireEvent.input(
			screen.getByRole("searchbox", { name: "Product name or UPC / GTIN" }),
			{ target: { value: "protein bar" } },
		);
		await fireEvent.click(screen.getByRole("button", { name: "Look up" }));
		await screen.findByText("Stored protein bar");
		await fireEvent.click(screen.getByRole("button", { name: "View as A" }));

		await fireEvent.click(
			screen.getByRole("tab", { name: "Live provider APIs" }),
		);
		await fireEvent.click(screen.getByRole("button", { name: "Look up" }));
		await screen.findByText("Provider protein bar");
		await fireEvent.click(
			screen.getByRole("button", { name: "Compare with A" }),
		);

		expect(screen.getByText("Product comparison")).toBeInTheDocument();
		expect(screen.getByText("2 findings")).toBeInTheDocument();
		const proteinRow = screen.getByRole("row", { name: /Protein/u });
		expect(proteinRow).toHaveAttribute("data-status", "different");
		expect(proteinRow).toHaveTextContent("Different");
		expect(proteinRow).toHaveTextContent("10 g");
		expect(proteinRow).toHaveTextContent("12 g");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Close product lookup" }),
			).toBeEnabled(),
		);
	});
});
