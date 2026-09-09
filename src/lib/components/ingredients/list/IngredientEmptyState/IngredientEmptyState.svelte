<script lang="ts">
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
	import Leaf from "$lib/assets/icons/Leaf/Leaf.svelte";
	import ShoppingBag from "$lib/assets/icons/ShoppingBag/ShoppingBag.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import SecondaryDelightMessage from "$lib/components/common/feedback/SecondaryDelightMessage/SecondaryDelightMessage.svelte";
	import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton/BarcodeScanButton.svelte";
	import { prefersReducedMotion } from "$lib/utils/animation/motion";
	import { resolveDelightMessage } from "$lib/utils/delight/delightMessages";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import { getIngredientListLabel } from "$lib/utils/ingredients/ingredientListUi";
	import type { IngredientEmptyStateProps } from "./types";

	let {
		activeList,
		hasItems,
		scanning = false,
		allowPlayfulMessages = true,
		onScan,
	}: IngredientEmptyStateProps = $props();

	const EMPTY_SCAN_EMPHASIS_SEEN_KEY =
		"blendcalc:ingredients:empty-scan-emphasis-seen";
	let emphasizeScan = $state(false);

	const title = $derived(
		activeList === MIX_STORAGE_KEYS.fridge
			? "Your fridge is empty"
			: "Your shopping list is empty",
	);
	const message = $derived.by(() => {
		if (hasItems) {
			return `No ${getIngredientListLabel(activeList).toLowerCase()} ingredients match these filters.`;
		}
		if (activeList === MIX_STORAGE_KEYS.fridge) {
			return "Search above or tap “Enter manually” to add ingredients.";
		}
		return "Search above or scan a barcode to add shopping items.";
	});
	const delightMessage = $derived(
		!hasItems && activeList === MIX_STORAGE_KEYS.fridge
			? resolveDelightMessage(
					[
						{
							contextKey: "ingredients",
							triggerKey: "empty-list",
							matchKeys: ["fridge"],
						},
					],
					{ allowPlayfulMessages },
				)
			: null,
	);

	const rememberScanEmphasis = () => {
		if (!browser) return;
		try {
			localStorage.setItem(EMPTY_SCAN_EMPHASIS_SEEN_KEY, "true");
		} catch {
			// A blocked device preference must never block the scanner.
		}
	};

	const handleScan = (event?: MouseEvent) => {
		emphasizeScan = false;
		rememberScanEmphasis();
		onScan(event);
	};

	onMount(() => {
		if (hasItems || prefersReducedMotion()) return;
		try {
			if (localStorage.getItem(EMPTY_SCAN_EMPHASIS_SEEN_KEY) === "true") {
				return;
			}
		} catch {
			// Continue with one nonessential emphasis when storage is unavailable.
		}

		emphasizeScan = true;
		rememberScanEmphasis();
	});
</script>

<div class="ingredient-empty-state">
	<CircularIconFrame class="ingredient-empty-state__icon" decorative>
		{#if activeList === MIX_STORAGE_KEYS.fridge}
			<Leaf size="1em" strokeWidth={2.2} />
		{:else}
			<ShoppingBag size="1em" strokeWidth={2.2} />
		{/if}
	</CircularIconFrame>
	<h2>{title}</h2>
	<p>{message}</p>
	{#if !hasItems}
		<div
			class="ingredient-empty-state__scan"
			class:ingredient-empty-state__scan--emphasized={emphasizeScan}
			data-scan-emphasis={emphasizeScan ? "active" : "settled"}
			onanimationend={() => (emphasizeScan = false)}
		>
			<BarcodeScanButton
				{scanning}
				label="Scan a barcode"
				onclick={handleScan}
			/>
		</div>
	{/if}
	<SecondaryDelightMessage
		class="ingredient-empty-state__delight"
		message={delightMessage}
	/>
</div>

<style lang="scss">
	@use "./IngredientEmptyState.scss";
</style>
