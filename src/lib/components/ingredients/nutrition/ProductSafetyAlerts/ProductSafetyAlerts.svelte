<script lang="ts">
	import { page } from "$app/state";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ProductSafetyAlertInformationSheet from "$lib/components/ingredients/nutrition/ProductSafetyAlertInformationSheet/ProductSafetyAlertInformationSheet.svelte";
	import {
		buildIngredientRouteHref,
		getActiveIngredientRouteUrl,
		getIngredientRouteState,
		INGREDIENT_ROUTE_MODALS,
	} from "$lib/utils/ingredients/ingredientRouteState";
	import { navigateShallowRoute } from "$lib/utils/navigation/shallowRouteNavigation";
	import { SHALLOW_ROUTE_PAGE_STATE_KEYS } from "$lib/utils/navigation/shallowRouteState";
	import type { ProductSafetyAlertsProps } from "./types";

	let { food, alerts: providedAlerts }: ProductSafetyAlertsProps = $props();
	let alertSummaryElement = $state<HTMLElement | null>(null);
	const alerts = $derived(providedAlerts ?? food?.safetyAlerts ?? []);
	const requiresPackageCheck = $derived(
		alerts.some((alert) => alert.requiresPackageCheck),
	);
	const ingredientPageUrl = $derived.by(() => {
		if (page.url?.href) return new URL(page.url.href);
		if (typeof window !== "undefined") return new URL(window.location.href);
		return new URL("https://blendcalc.local/ingredients/fridge");
	});
	const activeIngredientRouteUrl = $derived.by(() => {
		try {
			return getActiveIngredientRouteUrl(
				ingredientPageUrl,
				page.state.ingredientRouteHref,
			);
		} catch {
			return ingredientPageUrl;
		}
	});
	const informationSheetOpen = $derived(
		getIngredientRouteState(activeIngredientRouteUrl).modal ===
			INGREDIENT_ROUTE_MODALS.recallNotice,
	);

	const setInformationSheetOpen = (open: boolean) => {
		const href = buildIngredientRouteHref(activeIngredientRouteUrl, {
			modal: open ? INGREDIENT_ROUTE_MODALS.recallNotice : null,
		});
		navigateShallowRoute({
			href,
			pageState: page.state,
			routeStateKey: SHALLOW_ROUTE_PAGE_STATE_KEYS.ingredients,
			replace: !open,
		});
	};
</script>

{#if alerts.length > 0}
	<section
		bind:this={alertSummaryElement}
		class="product-safety-alerts"
		aria-label="Official food safety alerts"
	>
		<StatusMessage
			tone="danger"
			iconPlacement="top-end"
			title={requiresPackageCheck
				? "Check your package"
				: "Active food safety recall"}
		>
			<div class="product-safety-alerts__summary">
				<p>
					{requiresPackageCheck
						? "This product may be part of an active recall. Check the affected package details before using it."
						: "This product appears in an active official recall. Review the recall details before using it."}
				</p>
				<ActionButton
					type="button"
					variant="ghost"
					size="small"
					onclick={() => setInformationSheetOpen(true)}
				>
					{alerts.length === 1 ? "View recall details" : "View recall notices"}
				</ActionButton>
			</div>
		</StatusMessage>
	</section>

	<ProductSafetyAlertInformationSheet
		open={informationSheetOpen}
		{alerts}
		returnFocusTarget={() =>
			alertSummaryElement?.querySelector<HTMLElement>("button") ?? null}
		onClose={() => setInformationSheetOpen(false)}
	/>
{/if}

<style lang="scss">
	@use "./ProductSafetyAlerts.scss";
</style>
