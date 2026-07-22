import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import TextInputDialog from "$lib/components/common/dialogs/TextInputDialog/TextInputDialog.svelte";

describe("TextInputDialog", () => {
	it("does not render when closed", () => {
		render(TextInputDialog, {
			props: {
				open: false,
				title: "Save Drink",
				label: "Drink name",
				onConfirm: vi.fn(),
				onCancel: vi.fn(),
			},
		});

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("confirms typed text and supports cancel", async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();

		render(TextInputDialog, {
			props: {
				open: true,
				title: "Save Drink",
				description: "Name this mix.",
				label: "Drink name",
				confirmLabel: "Save",
				initialValue: "Draft",
				onConfirm,
				onCancel,
			},
		});

		const input = screen.getByLabelText(/drink name/i);
		expect(input).toHaveValue("Draft");

		await fireEvent.input(input, { target: { value: "Post-workout" } });
		await fireEvent.click(screen.getByRole("button", { name: "Save" }));
		await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onConfirm).toHaveBeenCalledWith("Post-workout");
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("shows validation feedback and clears it when the name changes", async () => {
		const onValueChange = vi.fn();

		render(TextInputDialog, {
			props: {
				open: true,
				title: "Save Drink",
				label: "Drink name",
				error: "You already have a saved drink with this name.",
				onConfirm: vi.fn(),
				onValueChange,
				onCancel: vi.fn(),
			},
		});

		const input = screen.getByLabelText(/drink name/i);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"You already have a saved drink with this name.",
		);
		expect(input).toHaveAttribute("aria-invalid", "true");

		await fireEvent.input(input, { target: { value: "A different name" } });
		expect(onValueChange).toHaveBeenCalledWith("A different name");
	});
});
