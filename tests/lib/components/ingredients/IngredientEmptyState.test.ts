import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IngredientEmptyState from "$lib/components/ingredients/list/IngredientEmptyState/IngredientEmptyState.svelte";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const emphasisStorageKey = "blendcalc:ingredients:empty-scan-emphasis-seen";

describe("IngredientEmptyState", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("makes scanning the primary empty-list action and emphasizes it only once", async () => {
		const onScan = vi.fn();
		const { container } = render(IngredientEmptyState, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				hasItems: false,
				onScan,
			},
		});

		const scanAction = screen.getByRole("button", { name: "Scan barcode" });
		expect(scanAction).toHaveTextContent("Scan a barcode");
		expect(
			container.querySelector("[data-scan-emphasis='active']"),
		).not.toBeNull();
		expect(localStorage.getItem(emphasisStorageKey)).toBe("true");

		await fireEvent.click(scanAction);
		expect(onScan).toHaveBeenCalledOnce();
		expect(
			container.querySelector("[data-scan-emphasis='settled']"),
		).not.toBeNull();
	});

	it("keeps returning, reduced-motion, and filtered-empty views calm", () => {
		localStorage.setItem(emphasisStorageKey, "true");
		const returning = render(IngredientEmptyState, {
			props: {
				activeList: MIX_STORAGE_KEYS.shoppingList,
				hasItems: false,
				onScan: vi.fn(),
			},
		});
		expect(
			returning.container.querySelector("[data-scan-emphasis='settled']"),
		).not.toBeNull();
		returning.unmount();

		localStorage.clear();
		vi.stubGlobal("matchMedia", () => ({ matches: true }));
		const reducedMotion = render(IngredientEmptyState, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				hasItems: false,
				onScan: vi.fn(),
			},
		});
		expect(
			reducedMotion.container.querySelector("[data-scan-emphasis='settled']"),
		).not.toBeNull();
		reducedMotion.unmount();

		const filteredEmpty = render(IngredientEmptyState, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				hasItems: true,
				onScan: vi.fn(),
			},
		});
		expect(screen.queryByRole("button", { name: "Scan barcode" })).toBeNull();
		expect(
			filteredEmpty.container.querySelector("[data-scan-emphasis]"),
		).toBeNull();
	});
});
