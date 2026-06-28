<script lang="ts">
	type Step = {
		id: string;
		label: string;
	};

	let {
		steps,
		activeStep,
		onSelect,
	}: {
		steps: Step[];
		activeStep: string;
		onSelect: (step: string) => void;
	} = $props();

	const activeIndex = $derived(
		Math.max(
			0,
			steps.findIndex((step) => step.id === activeStep),
		),
	);
</script>

<nav class="manual-entry-tabs" aria-label="Manual ingredient steps">
	{#each steps as step, index}
		<button
			type="button"
			class:manual-entry-tabs__step--active={index <= activeIndex}
			class:manual-entry-tabs__step--current={step.id === activeStep}
			onclick={() => onSelect(step.id)}
		>
			<span aria-hidden="true"></span>
			<small>{step.label}</small>
		</button>
	{/each}
</nav>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.manual-entry-tabs {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: $app-gap-xs;
		margin-block: $app-vertical-stack-gap;
	}

	button {
		display: grid;
		gap: $app-gap-xs;
		align-items: center;
		padding: 0;
		color: $color-figma-muted;
		font-family: $app-font-family-interface;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-medium;
		background: transparent;
		border: 0;
		cursor: pointer;
	}

	span {
		display: block;
		width: 100%;
		height: 0.22rem;
		border-radius: $app-rebuild-radius-pill;
		background: $color-figma-control-surface;
		transition:
			background-color 160ms ease,
			opacity 160ms ease;
	}

	.manual-entry-tabs__step--active span {
		background: $color-figma-green;
	}

	.manual-entry-tabs__step--current {
		color: $color-figma-green;
	}
</style>
