import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrivilegedProductPurge from "$lib/components/moderation/PrivilegedProductPurge/PrivilegedProductPurge.svelte";

const counts = {
	products: 1,
	submissions: 2,
	revisions: 3,
	observations: 2,
	conflicts: 1,
	providerSnapshots: 2,
	images: 1,
	warningReports: 0,
	apiCacheEntries: 1,
	userListItems: 4,
	customFoods: 0,
	savedMixes: 2,
};

describe("PrivilegedProductPurge", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("previews consequences and requires reason plus exact UPC confirmation", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						action: "preview",
						preview: {
							normalizedBarcode: "00076808006568",
							found: true,
							productName: "Test yogurt",
							brandOwner: "Test brand",
							counts,
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						action: "purge",
						result: {
							purgeId: "purge-id",
							normalizedBarcode: "00076808006568",
							deleted: true,
							counts,
							storageObjectsDeleted: 1,
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			);
		vi.stubGlobal("fetch", fetchMock);

		render(PrivilegedProductPurge);
		await fireEvent.click(
			screen.getByRole("button", { name: "Delete product" }),
		);
		expect(screen.getByText("This cannot be undone")).toBeInTheDocument();
		expect(screen.getByText(/closing this tool/i)).toBeInTheDocument();

		await fireEvent.input(screen.getByLabelText("UPC / GTIN to delete"), {
			target: { value: "076808006568" },
		});
		await fireEvent.click(
			screen.getByRole("button", { name: "Preview exact deletion" }),
		);
		await screen.findByText("Test yogurt");
		expect(screen.getByText("19 records are selected.")).toBeInTheDocument();

		const deleteButton = screen.getByRole("button", {
			name: "Permanently delete product records",
		});
		expect(deleteButton).toBeDisabled();
		await fireEvent.input(
			screen.getByLabelText("Why is this product being completely removed?"),
			{ target: { value: "Development fixture with conflicting identity." } },
		);
		await fireEvent.input(
			screen.getByLabelText("Type 00076808006568 to confirm"),
			{ target: { value: "00076808006568" } },
		);
		expect(deleteButton).toBeEnabled();
		await fireEvent.click(deleteButton);

		await screen.findByText("Product deletion verified");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
