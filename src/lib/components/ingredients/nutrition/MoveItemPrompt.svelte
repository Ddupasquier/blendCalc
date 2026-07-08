<script lang="ts">
    import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton.svelte";

    let {
        message,
        onConfirm,
        onCancel,
        busy = false,
    } = $props<{
        message: string;
        onConfirm: () => void;
        onCancel: () => void;
        busy?: boolean;
    }>();
</script>

<div class="prompt-modal move-prompt">
    <div class="prompt-title">{message}</div>
    <div class="prompt-actions">
        <RoundedActionButton variant="primary" busy={busy} onclick={onConfirm}>
            {busy ? "Moving…" : "Move"}
        </RoundedActionButton>
        <RoundedActionButton variant="quiet" disabled={busy} onclick={onCancel}>
            Cancel
        </RoundedActionButton>
    </div>
</div>

<style lang="scss">
    @use "../../../../styles/variables" as *;
    .move-prompt {
        background: $app-section-bg;
        border: $app-border;
        border-radius: $app-radius;
        padding: $app-gap-lg;
        min-width: $ingredient-nutrition-move-prompt-min-width;
        max-width: $ingredient-nutrition-move-prompt-max-width;
        margin: $app-vertical-stack-gap 0;
        display: flex;
        flex-direction: column;
        align-items: center;

        .prompt-title {
            font-size: $ingredient-nutrition-move-prompt-title-font-size;
            font-weight: 600;
            margin-bottom: $app-vertical-stack-gap;
            color: $app-primary;
            text-align: center;
        }

        .prompt-actions {
            display: flex;
            gap: $app-horizontal-control-gap;
            margin-top: $app-vertical-stack-gap;
        }
    }
</style>
