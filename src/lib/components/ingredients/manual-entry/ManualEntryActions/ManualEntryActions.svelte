<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import type { ManualEntryActionsProps } from "./types";

	let {
		onBack,
		onNext,
		nextLabel = "Continue",
		busy = false,
		nextDisabled = false,
		showBack = true,
	}: ManualEntryActionsProps = $props();
</script>

<div
	class="manual-entry-actions"
	class:manual-entry-actions--single={!showBack}
>
	{#if showBack}
		<RoundedActionButton variant="neutral" onclick={onBack}>Back</RoundedActionButton>
	{/if}
	<RoundedActionButton onclick={onNext} {busy} disabled={nextDisabled}>{nextLabel}</RoundedActionButton>
</div>

<style lang="scss">
	@use "./ManualEntryActions.scss";
</style>
