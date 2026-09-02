<script lang="ts">
	import type { IngredientRoutePopinsProps } from "../types";

	let props: IngredientRoutePopinsProps = $props();
	let RoutePopins = $state<
		typeof import("../IngredientRoutePopins.svelte").default | null
	>(null);
	let loadFailed = $state(false);
	const shouldRender = $derived(
		props.activeSheet !== null ||
			props.actionSheetItem !== null ||
			props.imagePlacementItem !== null ||
			props.renamingItem !== null ||
			props.searchViewOpen ||
			props.selectedFood !== null ||
			props.correctionFood !== null,
	);

	const loadRoutePopins = async () => {
		if (RoutePopins || loadFailed) return;
		try {
			RoutePopins = (await import("../IngredientRoutePopins.svelte")).default;
		} catch {
			loadFailed = true;
		}
	};

	$effect(() => {
		void loadRoutePopins();
	});
</script>

{#if RoutePopins}
	<RoutePopins {...props} />
{:else if shouldRender}
	<p class="sr-only" role="status" aria-live="polite">
		{loadFailed
			? "This ingredient view could not load. Close it and try again."
			: "Loading ingredient view…"}
	</p>
{/if}
