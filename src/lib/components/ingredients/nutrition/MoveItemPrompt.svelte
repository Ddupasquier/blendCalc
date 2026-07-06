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
        padding: 2em 2.2em 1.5em 2.2em;
        min-width: 320px;
        max-width: 90vw;
        margin: 1.2rem 0;
        display: flex;
        flex-direction: column;
        align-items: center;

        .prompt-title {
            font-size: 1.13em;
            font-weight: 600;
            margin-bottom: 0.7em;
            color: $app-primary;
            text-align: center;
        }

        .prompt-actions {
            display: flex;
            gap: 1.2em;
            margin-top: 1.2em;
        }
    }
</style>
