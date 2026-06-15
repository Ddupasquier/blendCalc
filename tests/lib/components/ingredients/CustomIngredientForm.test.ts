import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/utils/food/customFoods", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/utils/food/customFoods")>();
	return {
		...actual,
		saveCustomFood: vi.fn().mockResolvedValue("saved"),
	};
});

const { submitSharedProduct } = vi.hoisted(() => ({
	submitSharedProduct: vi.fn().mockResolvedValue({
		status: "pending",
		message: "Waiting for review.",
	}),
}));

vi.mock("$lib/utils/products/catalog", () => ({
	submitSharedProduct,
}));

import CustomIngredientForm from "$lib/components/ingredients/CustomIngredientForm.svelte";

const openManualForm = async () => {
	await fireEvent.click(screen.getByText("Enter label details"));
};

describe("CustomIngredientForm", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
	});

	it("requires an ingredient name before saving", async () => {
		render(CustomIngredientForm, {
			props: {
				onCreate: vi.fn(),
			},
		});

		await openManualForm();
		await fireEvent.click(
			screen.getByRole("button", { name: /save custom ingredient/i }),
		);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Add a name for this ingredient.",
		);
	});

	it("keeps barcode scanning visible while manual entry starts collapsed", () => {
		render(CustomIngredientForm, {
			props: {
				onCreate: vi.fn(),
			},
		});

		expect(
			screen.getByRole("button", { name: /scan barcode/i }),
		).toBeVisible();
		expect(screen.getByText("Enter label details").closest("details")).not.toHaveAttribute(
			"open",
		);
		expect(screen.queryByLabelText(/ingredient name/i)).not.toBeVisible();
	});

	it("creates a custom ingredient from label nutrition values", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, {
			props: {
				onCreate,
			},
		});

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Chocolate cookies" },
		});
		await fireEvent.input(screen.getByLabelText(/serving label/i), {
			target: { value: "3 cookies" },
		});
		await fireEvent.input(screen.getByLabelText(/serving weight/i), {
			target: { value: "34" },
		});
		await fireEvent.input(screen.getByLabelText(/^calories$/i), {
			target: { value: "160" },
		});

		await fireEvent.click(
			screen.getByRole("button", { name: /save custom ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			description: "Chocolate cookies",
			customFood: true,
			customServingLabel: "3 cookies",
			customServingWeightGrams: 34,
		});
	});

	it("normalizes a manually entered barcode before saving", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Packaged snack" },
		});
		await fireEvent.input(screen.getByLabelText(/upc \/ ean barcode/i), {
			target: { value: "4006381333931" },
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /save custom ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			barcode: "04006381333931",
			barcodeSource: "manual",
		});
	});

	it("keeps volume conversion off until the user enables it", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		expect(screen.queryByLabelText(/volume in this serving/i)).not.toBeInTheDocument();

		await fireEvent.click(screen.getByLabelText(/allow volume measurements/i));
		expect(screen.getByLabelText(/volume in this serving/i)).toBeInTheDocument();
		expect(screen.getByText(/2 tbsp weighs 32g/i)).toBeInTheDocument();
	});

	it("shares a barcoded label only after explicit consent", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "New packaged food" },
		});
		await fireEvent.input(screen.getByLabelText(/upc \/ ean barcode/i), {
			target: { value: "4006381333931" },
		});

		expect(submitSharedProduct).not.toHaveBeenCalled();
		await fireEvent.click(
			screen.getByLabelText(/help other users find this product/i),
		);
		const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], "label.jpg", {
			type: "image/jpeg",
		});
		for (const label of [
			/front of package/i,
			/nutrition facts label/i,
			/^barcode$/i,
		]) {
			await fireEvent.change(screen.getByLabelText(label), {
				target: { files: [photo] },
			});
		}
		await fireEvent.click(
			screen.getByRole("button", { name: /save custom ingredient/i }),
		);

		await waitFor(() => expect(submitSharedProduct).toHaveBeenCalledOnce());
		expect(screen.getByText("Waiting for review.")).toBeInTheDocument();
	});

	it("requires package evidence before sharing an unknown product", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Unknown packaged food" },
		});
		await fireEvent.input(screen.getByLabelText(/upc \/ ean barcode/i), {
			target: { value: "4006381333931" },
		});
		await fireEvent.click(
			screen.getByLabelText(/help other users find this product/i),
		);
		await fireEvent.click(
			screen.getByRole("button", { name: /save custom ingredient/i }),
		);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Add front package, nutrition label, and barcode photos",
		);
		expect(submitSharedProduct).not.toHaveBeenCalled();
	});

	it("can be closed and reopened without clearing unfinished input", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		const toggle = screen.getByText("Enter label details");
		const panel = toggle.closest("details");
		expect(panel).not.toHaveAttribute("open");

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Unfinished ingredient" },
		});
		expect(panel).toHaveAttribute("open");

		await fireEvent.click(toggle);
		expect(panel).not.toHaveAttribute("open");

		await fireEvent.click(toggle);
		expect(screen.getByLabelText(/ingredient name/i)).toHaveValue(
			"Unfinished ingredient",
		);
	});
});
