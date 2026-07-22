<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import type { MoveItemPromptProps } from "./types";

    let {
        message,
        onConfirm,
        onCancel,
		busy = false,
	}: MoveItemPromptProps = $props();
</script>

<div class="prompt-modal move-prompt">
    <div class="prompt-title">{message}</div>
    <div class="prompt-actions">
        <RoundedActionButton variant="primary" busy={busy} onclick={onConfirm}>
            Move
        </RoundedActionButton>
        <RoundedActionButton variant="quiet" disabled={busy} onclick={onCancel}>
            Cancel
        </RoundedActionButton>
    </div>
</div>

<style lang="scss">
	@use "./MoveItemPrompt.scss";
</style>
