<script lang="ts">
	import CustomBadge from "./CustomBadge.svelte";

    let {
        label,
        onRemove,
		onRename,
        onSelect,
        active = false,
        custom = false,
		disabled = false,
    } = $props<{
        label: string;
        onRemove: () => void;
		onRename?: () => void;
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
    <span class="pill-label" title={label}>{label}</span>
    {#if custom}
        <CustomBadge />
    {/if}
	{#if onRename}
		<button
			class="pill-action pill-rename"
			aria-label={`Rename ${label}`}
			disabled={disabled}
			tabindex="-1"
			type="button"
			onclick={(e) => {
				e.stopPropagation();
				if (!disabled) onRename();
			}}
		>✎</button>
	{/if}
    <button
        class="pill-action pill-remove"
        aria-label={`Remove ${label}`}
		disabled={disabled}
        tabindex="-1"
		type="button"
        onclick={(e) => {
            e.stopPropagation();
			if (!disabled) onRemove();
        }}>&times;</button
    >
</span>

<style lang="scss">
    @use "../../../styles/variables" as *;
    .pill {
        display: inline-grid;
		grid-template-columns: minmax(0, 1fr) repeat(3, auto);
        align-items: center;
		gap: 0.28rem;
		max-width: 100%;
        background: $app-accent;
        color: $app-primary;
        border-radius: $app-radius-pill;
        padding: 0.22rem 0.62rem;
        font-size: $app-font-size-md;
        font-family: $app-button-font-family;
        font-weight: $app-button-font-weight;
        border: 1px solid $app-accent;
        margin-bottom: 0.1rem;
        line-height: $app-button-line-height;
        cursor: pointer;
        transition: background 0.15s;
    }

	.pill-label {
		display: -webkit-box;
		min-width: 0;
		overflow: hidden;
		line-height: 1.15;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow-wrap: anywhere;
	}

    .pill.active {
        background: $app-primary;
        color: $app-btn-text;
        border-color: $app-primary;

        .pill-action {
            color: $app-btn-text;
        }
    }
    .pill.custom {
        background: $app-custom-bg;
        border-color: $app-custom-strong;
    }

    .pill.custom.active {
        background: $app-custom-strong;
        color: $app-btn-text;
        border-color: $app-custom-strong;

		:global(.custom-badge) {
			color: $app-custom-strong;
			background: $app-btn-text;
			border-color: $app-btn-text;
		}

        .pill-action {
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
    .pill-action {
        background: none;
        border: none;
        color: $app-primary;
        font-size: 1rem;
        cursor: pointer;
        padding: 0 0.1rem;
        line-height: 1;
        &:focus {
            outline: $app-focus-outline;
        }
    }

	.pill-rename {
		font-size: 0.9rem;
	}
</style>
