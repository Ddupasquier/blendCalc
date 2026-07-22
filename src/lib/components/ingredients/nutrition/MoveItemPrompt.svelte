<script lang="ts">
    import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";

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
            Move
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
        min-width: 20rem;
        max-width: 90vw;
        margin: $app-gap-md 0;
        display: flex;
        flex-direction: column;
        align-items: center;

        .prompt-title {
            font-size: 1.13em;
            font-weight: $app-font-weight-medium;
            margin-bottom: $app-gap-md;
            color: $app-primary;
            text-align: center;
        }

        .prompt-actions {
            display: flex;
            gap: $app-gap-md;
            margin-top: $app-gap-md;
        }
    }
</style>
