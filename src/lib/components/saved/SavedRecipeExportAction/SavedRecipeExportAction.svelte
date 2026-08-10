<script lang="ts">
	import Link from "$lib/assets/icons/Link/Link.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { buildSavedRecipeExportText } from "$lib/utils/recipes/recipeExport";
	import type { SavedRecipeExportActionProps } from "./types";

	let {
		recipe,
		compact = false,
		fullWidth = false,
		disabled = false,
		variant = "outline",
	}: SavedRecipeExportActionProps = $props();
	let busy = $state(false);
	let message = $state("");
	let error = $state("");

	const shareRecipe = async () => {
		if (busy) return;
		busy = true;
		message = "";
		error = "";
		const text = buildSavedRecipeExportText(recipe);

		try {
			if (typeof navigator.share === "function") {
				await navigator.share({ title: recipe.name, text });
				message = "Recipe shared.";
			} else if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				message = "Recipe copied to your clipboard.";
			} else {
				throw new Error("Sharing is unavailable.");
			}
		} catch (shareError) {
			if (shareError instanceof DOMException && shareError.name === "AbortError") {
				return;
			}
			error = "This recipe could not be shared. Try copying it from another browser.";
		} finally {
			busy = false;
		}
	};
</script>

<div
	class="saved-recipe-export"
	class:saved-recipe-export--compact={compact}
>
	{#if compact}
		<CircleIconButton
			label="Share recipe"
			variant="soft"
			size="control"
			{busy}
			{disabled}
			onclick={() => void shareRecipe()}
		>
			<Link size={18} />
		</CircleIconButton>
	{:else}
		<RoundedActionButton
			{variant}
			{fullWidth}
			{busy}
			{disabled}
			onclick={() => void shareRecipe()}
		>
			Share recipe
		</RoundedActionButton>
	{/if}
	{#if message}
		<div class="saved-recipe-export__status">
			<StatusMessage tone="success" message={message} />
		</div>
	{/if}
	{#if error}
		<div class="saved-recipe-export__status">
			<StatusMessage tone="danger" message={error} />
		</div>
	{/if}
</div>

<style lang="scss">
	@use "./SavedRecipeExportAction.scss";
</style>
