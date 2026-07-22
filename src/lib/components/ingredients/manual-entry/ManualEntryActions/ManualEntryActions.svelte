<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import type { ManualEntryActionsProps } from "./types";

	let {
		onBack,
		onNext,
		nextLabel = "Continue",
		busy = false,
	}: ManualEntryActionsProps = $props();
</script>

<div class="manual-entry-actions">
	<RoundedActionButton variant="neutral" onclick={onBack}>Back</RoundedActionButton>
	<RoundedActionButton onclick={onNext} {busy}>{nextLabel}</RoundedActionButton>
</div>

<style lang="scss">
	@use "./ManualEntryActions.scss";
</style>
