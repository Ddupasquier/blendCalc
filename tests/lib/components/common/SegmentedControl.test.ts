import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SegmentedControl from "$lib/components/common/buttons/SegmentedControl/SegmentedControl.svelte";

describe("SegmentedControl", () => {
	it("renders URL-backed tabs as real links", () => {
		const { container } = render(SegmentedControl, {
			props: {
				label: "Saved ingredient lists",
				value: "fridge",
				options: [
					{ value: "fridge", label: "Fridge", href: "/fridge" },
					{
						value: "shopping",
						label: "Shopping List",
						href: "/fridge/shopping-list",
					},
				],
			},
		});

		const fridgeTab = screen.getByRole("tab", { name: "Fridge" });
		expect(fridgeTab).toHaveAttribute(
			"href",
			"/fridge",
		);
		expect(fridgeTab).toHaveAttribute("data-sveltekit-keepfocus");
		expect(fridgeTab).toHaveAttribute("data-sveltekit-noscroll");
		expect(
			screen.getByRole("tab", { name: "Shopping List" }),
		).toHaveAttribute("href", "/fridge/shopping-list");
		expect(container.querySelector(".segmented-control")).toHaveAttribute(
			"data-active-index",
			"0",
		);
		expect(
			container.querySelector(".segmented-control__selection"),
		).toBeInTheDocument();
	});

	it("moves the visual selection before following a route link", async () => {
		const { container } = render(SegmentedControl, {
			props: {
				label: "Saved ingredient lists",
				value: "fridge",
				options: [
					{ value: "fridge", label: "Fridge", href: "/fridge" },
					{
						value: "shopping",
						label: "Shopping List",
						href: "/fridge/shopping-list",
					},
				],
			},
		});

		const shoppingTab = screen.getByRole("tab", { name: "Shopping List" });
		const control = container.querySelector(".segmented-control");
		expect(shoppingTab).toHaveAttribute("href", "/fridge/shopping-list");
		expect(control).toHaveAttribute("data-active-index", "0");
		await fireEvent.click(shoppingTab);
		expect(control).toHaveAttribute("data-active-index", "1");
		expect(shoppingTab).toHaveClass("segmented-control__button--active");
	});

	it("uses roving focus and arrow-key tab navigation", async () => {
		const onSelect = vi.fn();
		render(SegmentedControl, {
			props: {
				label: "Saved ingredient lists",
				value: "fridge",
				options: [
					{
						value: "fridge",
						label: "Fridge",
						id: "fridge-tab",
						controlsId: "ingredients-panel",
					},
					{
						value: "shopping",
						label: "Shopping List",
						id: "shopping-tab",
						controlsId: "ingredients-panel",
					},
				],
				onSelect,
			},
		});

		const [fridgeTab, shoppingTab] = screen.getAllByRole("tab");
		expect(fridgeTab).toHaveAttribute("tabindex", "0");
		expect(shoppingTab).toHaveAttribute("tabindex", "-1");
		expect(fridgeTab).toHaveAttribute("aria-controls", "ingredients-panel");

		fridgeTab.focus();
		await fireEvent.keyDown(fridgeTab, { key: "ArrowRight" });
		expect(onSelect).toHaveBeenCalledWith("shopping");
		expect(shoppingTab).toHaveFocus();
	});

	it("renders reusable progress steps with completion and current-step state", async () => {
		const onSelect = vi.fn();
		render(SegmentedControl, {
			props: {
				label: "Manual ingredient progress",
				value: "macros",
				variant: "progress",
				options: [
					{ value: "identity", label: "Identity" },
					{ value: "servings", label: "Servings" },
					{ value: "macros", label: "Macros" },
					{ value: "extended", label: "Extended" },
				],
				onSelect,
			},
		});

		const [identityTab, servingsTab, macrosTab, extendedTab] = screen.getAllByRole("tab");
		expect(identityTab).toHaveClass("segmented-control__button--completed");
		expect(servingsTab).toHaveClass("segmented-control__button--completed");
		expect(macrosTab).toHaveClass("segmented-control__button--completed");
		expect(macrosTab).toHaveAttribute("aria-current", "step");
		expect(extendedTab).not.toHaveClass("segmented-control__button--completed");

		await fireEvent.click(extendedTab);
		expect(onSelect).toHaveBeenCalledWith("extended");
	});
});
