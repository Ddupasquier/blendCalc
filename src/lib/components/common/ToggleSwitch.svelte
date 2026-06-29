<script lang="ts">
	let {
		id,
		name = id,
		checked = $bindable(false),
		disabled = false,
		ariaLabel,
		onChange,
	}: {
		id: string;
		name?: string;
		checked?: boolean;
		disabled?: boolean;
		ariaLabel: string;
		onChange?: (checked: boolean) => void;
	} = $props();
</script>

<span class="toggle-switch" class:toggle-switch--disabled={disabled}>
	<input
		{id}
		{name}
		class="toggle-switch__input"
		type="checkbox"
		role="switch"
		aria-label={ariaLabel}
		bind:checked
		{disabled}
		onchange={(event) => onChange?.(event.currentTarget.checked)}
	/>
	<span class="toggle-switch__track" aria-hidden="true">
		<span class="toggle-switch__thumb"></span>
	</span>
</span>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.toggle-switch {
		position: relative;
		display: inline-grid;
		flex: 0 0 auto;
		place-items: center;
		width: 3.25rem;
		height: 2rem;
	}

	.toggle-switch__input {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		margin: 0;
		cursor: pointer;
		opacity: 0;
	}

	.toggle-switch__track {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		background: $color-figma-control-surface;
		border: 1px solid $color-figma-border;
		border-radius: $app-rebuild-radius-pill;
		transition:
			background-color 180ms ease,
			border-color 180ms ease;
	}

	.toggle-switch__thumb {
		position: absolute;
		top: 50%;
		left: 0.2rem;
		width: 1.55rem;
		height: 1.55rem;
		background: $color-figma-card;
		border: 1px solid $color-figma-border;
		border-radius: 50%;
		transform: translateY(-50%);
		transition:
			transform 180ms ease,
			border-color 180ms ease;
	}

	.toggle-switch__input:checked + .toggle-switch__track {
		background: $color-figma-green;
		border-color: $color-figma-green;
	}

	.toggle-switch__input:checked + .toggle-switch__track .toggle-switch__thumb {
		border-color: $color-figma-green;
		transform: translate(1.25rem, -50%);
	}

	.toggle-switch__input:focus-visible + .toggle-switch__track {
		outline: $app-focus-outline;
		outline-offset: $app-gap-xs;
	}

	.toggle-switch--disabled {
		opacity: 0.55;
		pointer-events: none;
	}
</style>
