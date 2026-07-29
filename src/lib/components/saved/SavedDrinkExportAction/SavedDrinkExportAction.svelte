<script lang="ts">
	import Link from "$lib/assets/icons/Link/Link.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { buildSavedDrinkExportText } from "$lib/utils/recipes/recipeExport";
	import type { SavedDrinkExportActionProps } from "./types";

	let {
		drink,
		compact = false,
		fullWidth = false,
		disabled = false,
		variant = "outline",
	}: SavedDrinkExportActionProps = $props();
	let busy = $state(false);
	let message = $state("");
	let error = $state("");

	const shareDrink = async () => {
		if (busy) return;
		busy = true;
		message = "";
		error = "";
		const text = buildSavedDrinkExportText(drink);

		try {
			if (typeof navigator.share === "function") {
				await navigator.share({ title: drink.name, text });
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
	class="saved-drink-export"
	class:saved-drink-export--compact={compact}
>
	{#if compact}
		<CircleIconButton
			label="Share recipe"
			variant="soft"
			size="control"
			{busy}
			{disabled}
			onclick={() => void shareDrink()}
		>
			<Link size={18} />
		</CircleIconButton>
	{:else}
		<RoundedActionButton
			{variant}
			{fullWidth}
			{busy}
			{disabled}
			onclick={() => void shareDrink()}
		>
			Share recipe
		</RoundedActionButton>
	{/if}
	{#if message}
		<div class="saved-drink-export__status">
			<StatusMessage tone="success" message={message} />
		</div>
	{/if}
	{#if error}
		<div class="saved-drink-export__status">
			<StatusMessage tone="danger" message={error} />
		</div>
	{/if}
</div>

<style lang="scss">
	@use "./SavedDrinkExportAction.scss";
</style>
