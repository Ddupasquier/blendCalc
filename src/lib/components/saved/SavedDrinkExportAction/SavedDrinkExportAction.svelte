<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import { buildSavedDrinkExportText } from "$lib/utils/recipes/recipeExport";
	import type { SavedDrinkExportActionProps } from "./types";

	let { drink }: SavedDrinkExportActionProps = $props();
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

<div class="saved-drink-export">
	<RoundedActionButton variant="outline" {busy} onclick={() => void shareDrink()}>
		Share recipe
	</RoundedActionButton>
	{#if message}<small role="status">{message}</small>{/if}
	{#if error}<small class="saved-drink-export__error" role="alert">{error}</small>{/if}
</div>

<style lang="scss">
	@use "./SavedDrinkExportAction.scss";
</style>
