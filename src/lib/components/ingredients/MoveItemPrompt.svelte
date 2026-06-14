<script lang="ts">
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
        <button
            class="prompt-btn confirm"
            type="button"
            onclick={onConfirm}
            disabled={busy}>{busy ? "Moving…" : "Move"}</button
        >
        <button
            class="prompt-btn"
            type="button"
            onclick={onCancel}
            disabled={busy}>Cancel</button
        >
    </div>
</div>

<style lang="scss">
    @use "../../../styles/variables" as *;
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

            .prompt-btn {
                background: $app-accent;
                color: $app-primary;
                border: 1px solid $app-accent;
                border-radius: $app-radius-pill;
                padding: 0.5em 1.3em;
                font-size: 1em;
                font-family: $app-button-font-family;
                font-weight: $app-button-font-weight;
                line-height: $app-button-line-height;
                cursor: pointer;
                transition: background 0.13s;

                &.confirm {
                    background: $app-primary;
                    color: $app-btn-text;
                    border: 1px solid $app-primary;
                }

                &:focus {
                    outline: $app-focus-outline;
                }

                &:disabled {
                    cursor: wait;
                    opacity: 0.65;
                }
            }
        }
    }
</style>
