<script lang="ts">
    let {
        label,
        onRemove,
        onSelect,
        active = false,
        custom = false,
		disabled = false,
    } = $props<{
        label: string;
        onRemove: () => void;
        onSelect?: () => void;
        active?: boolean;
        custom?: boolean;
		disabled?: boolean;
    }>();
</script>

<span
    class="pill {active ? 'active' : ''}"
    class:custom
    role="button"
    tabindex="0"
    onclick={() => !disabled && onSelect?.()}
	aria-disabled={disabled}
    onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
            if (!disabled) onSelect?.();
        }
    }}
>
    {label}
    {#if custom}
        <span class="pill-custom-marker">Custom</span>
    {/if}
    <button
        class="pill-remove"
        aria-label="Remove"
		disabled={disabled}
        tabindex="-1"
        onclick={(e) => {
            e.stopPropagation();
			if (!disabled) onRemove();
        }}>&times;</button
    >
</span>

<style lang="scss">
    @use "../../../styles/variables" as *;
    .pill {
        display: inline-flex;
        align-items: center;
        background: $app-accent;
        color: $app-primary;
        border-radius: $app-radius-pill;
        padding: 0.22rem 0.62rem;
        font-size: $app-font-size-md;
        font-family: $app-button-font-family;
        font-weight: $app-button-font-weight;
        border: 1px solid $app-accent;
        box-shadow: $app-pill-shadow;
        margin-bottom: 0.1rem;
        line-height: $app-button-line-height;
        cursor: pointer;
        transition: background 0.15s;
    }
    .pill.active {
        background: $app-primary;
        color: $app-btn-text;
        border-color: $app-primary;

        .pill-remove {
            color: $app-btn-text;
        }
    }
    .pill.custom {
        background: $app-custom-bg;
        border-color: $app-custom-strong;
    }

    .pill-custom-marker {
        margin-left: 0.35rem;
        padding: 0.04rem 0.32rem;
        color: $app-btn-text;
        background: $app-custom-strong;
        border-radius: $app-radius-pill;
        font-size: $app-font-size-xs;
        font-weight: 800;
        line-height: 1.2;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }
    .pill.custom.active {
        background: $app-custom-strong;
        color: $app-btn-text;
        border-color: $app-custom-strong;

        .pill-remove {
            color: $app-btn-text;
        }
    }

    .pill:active {
        background: $app-primary;
    }
	.pill[aria-disabled="true"] {
		cursor: wait;
		opacity: 0.65;
	}
    .pill-remove {
        background: none;
        border: none;
        color: $app-primary;
        font-size: 1rem;
        margin-left: 0.25rem;
        cursor: pointer;
        padding: 0 0.1rem;
        line-height: 1;
        &:focus {
            outline: $app-focus-outline;
        }
    }
</style>
